-- Run once in the Supabase SQL editor before starting the worker.
begin;
-- Football-Data reports IN_PLAY without telling us which half is running.
-- Keep that uncertainty instead of incorrectly storing 1H or estimating 2H.
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check check (
  status in ('SCHEDULED','TIMED','IN_PLAY','1H','HT','2H','ET','PEN','FINISHED','POSTPONED','CANCELLED')
);
-- Shared quota reservations survive restarts and serialize concurrent workers.
create table if not exists public.sync_request_budgets (
  bucket text primary key,
  quota_day date not null default (now() at time zone 'UTC')::date,
  requests integer not null default 0,
  reserved_at timestamptz not null default '-infinity'
);
alter table public.sync_request_budgets enable row level security;
revoke all on public.sync_request_budgets from anon, authenticated;

create or replace function public.reserve_sync_request(bucket_name text, interval_seconds integer, daily_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare acquired text;
begin
  if interval_seconds < 0 or daily_limit < 1 then raise exception 'Invalid quota'; end if;
  insert into sync_request_budgets(bucket) values(bucket_name) on conflict do nothing;
  update sync_request_budgets set
    requests = case when quota_day = (now() at time zone 'UTC')::date then requests + 1 else 1 end,
    quota_day = (now() at time zone 'UTC')::date,
    reserved_at = now()
  where bucket = bucket_name
    and reserved_at <= now() - make_interval(secs => interval_seconds)
    and (quota_day <> (now() at time zone 'UTC')::date or requests < daily_limit)
  returning bucket into acquired;
  return acquired is not null;
end;
$$;
revoke all on function public.reserve_sync_request(text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_sync_request(text, integer, integer) to service_role;

-- Legacy generated events remain unverified and are excluded by application reads.
alter table public.match_events add column if not exists source text;
create index if not exists match_events_source_match_idx on public.match_events(source, match_id);
create or replace function public.replace_match_events(target_match_id bigint, snapshot jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(snapshot) <> 'array' then raise exception 'Expected array'; end if;
  if exists(select 1 from jsonb_array_elements(snapshot) e where (e->>'match_id')::bigint <> target_match_id) then
    raise exception 'Mismatched fixture';
  end if;
  perform pg_advisory_xact_lock(target_match_id);
  delete from match_events where match_id = target_match_id;
  insert into match_events(id, match_id, minute, extra_minute, team_id, player_name, assist_or_sub_name, event_type, detail, created_at, source)
  select e.id, e.match_id, e.minute, e.extra_minute, e.team_id, e.player_name, e.assist_or_sub_name, e.event_type, e.detail, e.created_at, 'api-football'
  from jsonb_populate_recordset(null::public.match_events, snapshot) e;
end;
$$;
revoke all on function public.replace_match_events(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.replace_match_events(bigint, jsonb) to service_role;

-- Official data is public read-only; only the server service role can write.
do $$
declare target text; policy_row record;
begin
  foreach target in array array['standings','matches','match_events','predictions','news_articles','player_injuries'] loop
    if to_regclass('public.' || target) is null then continue; end if;
    execute format('alter table public.%I enable row level security', target);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated', target);
    execute format('grant select on public.%I to anon, authenticated', target);
    for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = target and cmd <> 'SELECT' loop
      execute format('drop policy %I on public.%I', policy_row.policyname, target);
    end loop;
    execute format('drop policy if exists pitchline_official_read on public.%I', target);
    execute format('create policy pitchline_official_read on public.%I for select to anon, authenticated using (true)', target);
  end loop;
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach target in array array['matches','match_events'] loop
      if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = target) then
        execute format('alter publication supabase_realtime add table public.%I', target);
      end if;
    end loop;
  end if;
end;
$$;

commit;
