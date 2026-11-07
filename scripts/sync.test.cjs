/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness loads transpiled route modules with mocked server imports. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => mocks[name] ?? require(name), process: { env: { CRON_SECRET: 'test-secret', API_FOOTBALL_KEY: 'test-api-key', ...mocks.env } }, Date, AbortSignal, console: { ...console, error() {} }, fetch: mocks.fetch });
  return exports;
}

function harness({ grants = true, score = 0, failure = false, eventSnapshot = [], existingSource = 'api-football', env = {}, fdStatus = 'TIMED' } = {}) {
  const now = new Date().toISOString();
  const existing = { id: 123456, season: 2026, home_team_id: 1, away_team_id: 2, home_team_name: 'Arsenal', away_team_name: 'Bayern', kickoff_at: now, status: '1H', elapsed_minute: 20, home_score: 1, away_score: 0, updated_at: now, live_stats: { source: existingSource, source_updated_at: now } };
  const writes = [], calls = [], reservations = [], replacements = [];
  const db = {
    from(table) { return { select: async () => ({ data: [existing] }), upsert: async rows => { writes.push({ table, rows }); return { error: null }; } }; },
    async rpc(name, args) {
      if (name === 'replace_match_events') { replacements.push(args); return { error: null }; }
      reservations.push(args); return { data: args.bucket_name === 'champions-worker' || (typeof grants === 'function' ? grants(args.bucket_name) : grants) };
    },
  };
  const mocks = {
    env,
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/supabase/server': { createAdminClient: () => db },
    '@/lib/predictions/poisson': { calculatePoissonMatchPrediction: () => ({}) },
    fetch: async url => {
      calls.push(url);
      if (failure) throw Error('offline');
      if (url.includes('football-data.org')) return { ok: true, json: async () => ({ matches: [{ id: existing.id, utcDate: now, status: fdStatus, homeTeam: { id: 1, name: 'Arsenal' }, awayTeam: { id: 2, name: 'Bayern' }, score: { fullTime: { home: 0, away: 0 } } }] }) };
      if (url.includes('/events?')) return { ok: true, json: async () => ({ response: eventSnapshot }) };
      return { ok: true, json: async () => ({ response: [{ fixture: { id: 88, date: now, status: { short: '1H', elapsed: 21 } }, teams: { home: { id: 10, name: 'Arsenal' }, away: { id: 20, name: 'Bayern' } }, goals: { home: score, away: 0 } }] }) };
    },
  };
  const route = load('src/app/api/sync/champions/route.ts', mocks);
  const request = headers => ({ headers: new Headers(headers) });
  return { route, request, existing, writes, calls, reservations, replacements };
}

test('a browser header cannot authorize writes', async () => {
  const h = harness();
  const result = await h.route.POST(h.request({ 'x-pitchline-sync': 'true' }));
  assert.equal(result.status, 401);
  assert.equal(h.calls.length, 0);
  assert.equal(h.reservations.length, 0);
});

test('VAR can lower the score and an empty event snapshot clears a cancelled goal', async () => {
  const h = harness();
  const result = await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  assert.equal(result.status, 200);
  const match = h.writes.find(w => w.table === 'matches').rows[0];
  assert.equal(match.home_score, 0);
  assert.equal(match.elapsed_minute, 21);
  assert.equal(h.replacements.length, 1);
  assert.equal(h.replacements[0].snapshot.length, 0);
});

test('exhausted shared quota causes no provider calls or fabricated updates', async () => {
  const h = harness({ grants: false });
  await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  assert.equal(h.calls.length, 0);
  assert.equal(h.writes.length, 0);
});

test('provider failure preserves score, minute and freshness', async () => {
  const h = harness({ failure: true });
  const result = await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  assert.equal(h.writes.length, 0);
  assert.equal(h.replacements.length, 0);
  assert.ok(result.body.warnings.length > 0);
});

test('events receive stable IDs and provider team IDs map to canonical team IDs', async () => {
  const event = { time: { elapsed: 20 }, team: { id: 10, name: 'Arsenal' }, player: { id: 5, name: 'Player' }, type: 'Goal', detail: 'Normal Goal' };
  const one = harness({ score: 2, eventSnapshot: [event] });
  const two = harness({ score: 2, eventSnapshot: [event] });
  await one.route.POST(one.request({ authorization: 'Bearer test-secret' }));
  await two.route.POST(two.request({ authorization: 'Bearer test-secret' }));
  const a = one.replacements[0].snapshot[0];
  assert.equal(a.id, two.replacements[0].snapshot[0].id);
  assert.equal(a.team_id, 1);
});

test('missing telemetry stays unknown and historic generated events are excluded', () => {
  const utils = load('src/lib/date-utils.ts');
  const match = { id: 1, status: '2H', home_score: 2, away_score: 1, live_stats: { home_possession: 65, home_xg: 2 }, events: [{ id: 'generated', minute: 10 }, { id: 'real', minute: 20, source: 'api-football', event_type: 'YELLOW_CARD' }] };
  const stats = utils.computeMatchTelemetry(match);
  assert.equal(stats.homePossession, null);
  assert.equal(stats.homeXg, null);
  assert.equal(utils.getVerifiedMatchEvents(match).length, 1);
  match.live_stats.source = 'api-football';
  assert.equal(utils.computeMatchTelemetry(match).homePossession, 65);
});


test('missing CRON_SECRET rejects even a browser trigger', async () => {
  const h = harness({ env: { CRON_SECRET: undefined } });
  assert.equal((await h.route.POST(h.request({ 'x-pitchline-sync': 'true' }))).status, 401);
});

test('Football-Data live state never invents a minute', async () => {
  const h = harness({ existingSource: 'football-data', fdStatus: 'IN_PLAY', env: { FOOTBALL_DATA_KEY: 'test-fd-key', API_FOOTBALL_KEY: undefined } });
  await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  const match = h.writes.find(w => w.table === 'matches').rows[0];
  assert.equal(match.elapsed_minute, null);
  assert.equal(match.status, 'IN_PLAY');
  assert.equal(match.live_stats.source, 'football-data');
});

test('delayed Football-Data does not overwrite an API-Football snapshot', async () => {
  const h = harness({ grants: bucket => bucket !== 'api-football', env: { FOOTBALL_DATA_KEY: 'test-fd-key' } });
  await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  const update = h.writes.find(w => w.table === 'matches')?.rows[0];
  if (update) {
    assert.equal(update.home_score, 1);
    assert.equal(update.elapsed_minute, 20);
    assert.equal(update.live_stats.source, 'api-football');
  }
});

test('unreconciled scorer details are hidden after a VAR score change', () => {
  const utils = load('src/lib/date-utils.ts');
  assert.equal(utils.getVerifiedMatchEvents({ home_team_id: 1, away_team_id: 2, home_score: 0, away_score: 0, events: [{ source: 'api-football', team_id: 1, event_type: 'GOAL', minute: 20 }] }).length, 0);
});
