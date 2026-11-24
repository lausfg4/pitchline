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

function harness({ grants = true, score = 0, failure = false, eventSnapshot = [], playerGroups, teamStats, dataSports, dataSportsMatch = {}, dataSportsIncidents = [], omitBoardClock = false, apiStatus = '1H', existingSource = 'api-football', snapshotAge = 0, env = {}, fdStatus = 'TIMED', fdScore = 0, fdHalfTime } = {}) {
  const now = new Date().toISOString();
  const existing = { id: 123456, season: 2026, home_team_id: 1, away_team_id: 2, home_team_name: 'Arsenal', away_team_name: 'Bayern', kickoff_at: now, status: '1H', elapsed_minute: 20, home_score: 1, away_score: 0, updated_at: now, live_stats: { source: existingSource, source_updated_at: now } };
  existing.live_stats.source_updated_at = new Date(Date.parse(now) - snapshotAge).toISOString();
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
      if (url.includes('datasportsapi.com')) {
        if (dataSports === 'unauthorized') return { ok: false, status: 401 };
        const fixture = {
          id: 44, league: { name: 'UEFA Champions League' }, startTime: now,
          home: { name: 'Arsenal' }, away: { name: 'Bayern' },
          status: { phase: 'inprogress' },
          clock: {
            periodStartedAt: new Date(Date.parse(now) - 45 * 60_000).toISOString(),
            periodOffsetSeconds: 2700, periodEndSeconds: 5400, maxExtraSeconds: 300,
          },
          ...dataSportsMatch,
        };
        const data = url.includes('/fixtures?date=') ? [{ ...fixture, clock: omitBoardClock ? null : fixture.clock }]
          : url.endsWith('/fixtures/44') ? fixture : url.endsWith('/events') ? dataSportsIncidents : dataSports;
        return { ok: true, json: async () => ({ data }) };
      }
      if (url.includes('football-data.org')) return { ok: true, json: async () => ({ matches: [{ id: existing.id, utcDate: now, status: fdStatus, homeTeam: { id: 1, name: 'Arsenal' }, awayTeam: { id: 2, name: 'Bayern' }, score: { fullTime: { home: fdScore, away: 0 }, halfTime: fdHalfTime } }] }) };
      if (url.includes('/events?')) return { ok: true, json: async () => ({ response: eventSnapshot }) };
      if (url.includes('?ids=') && (playerGroups || teamStats)) return { ok: true, json: async () => ({
        response: [{ fixture: { id: 88, status: { short: apiStatus } }, teams: { home: { id: 10 }, away: { id: 20 } }, players: playerGroups, statistics: teamStats }],
      }) };
      return { ok: true, json: async () => ({ response: [{ fixture: { id: 88, date: now, status: { short: apiStatus, elapsed: 21 } }, teams: { home: { id: 10, name: 'Arsenal' }, away: { id: 20, name: 'Bayern' } }, goals: { home: score, away: 0 } }] }) };
    },
  };
  const route = load('src/app/api/sync/champions/route.ts', mocks);
  const request = headers => ({ headers: new Headers(headers) });
  return { route, request, existing, writes, calls, reservations, replacements };
}

test('club questions and their follow-ups stay scoped to the named club', () => {
  const { selectMatchContext } = load('src/lib/chat/match-context.ts', { '@/lib/date-utils': {} });
  const next = { id: 4, home_team_id: 81, home_team_name: 'Barça', away_team_id: 7, away_team_name: 'Arsenal', status: 'TIMED', kickoff_at: '2026-11-20' };
  const other = { id: 3, home_team_id: 9, home_team_name: 'Como', away_team_id: 7, away_team_name: 'Arsenal', status: 'FINISHED', kickoff_at: '2026-11-04' };
  const last = { ...next, id: 2, status: 'FINISHED', kickoff_at: '2026-11-03' };
  const previous = { ...last, id: 1, kickoff_at: '2026-10-22' };
  const matches = [next, other, last, previous];
  const question = 'como quedo el ultimo partido del barcelona en champions?';
  for (const result of [
    selectMatchContext(matches, [], question, []),
    selectMatchContext(matches, [], 'la ultima jornada jugada', [question]),
  ]) {
    assert.equal(result.focused.id, last.id);
    assert.equal(result.scopedClubs.join(','), '81');
    assert.ok(result.recent.every(match => match.home_team_id === 81));
    assert.ok(result.detailed.every(match => match.home_team_id === 81 && match.status === 'FINISHED'));
  }
  assert.equal(selectMatchContext(matches, [], 'y el proximo?', [question]).focused.id, next.id);
  assert.equal(selectMatchContext(matches, [], 'resultados de la jornada completa', [question]).recent[0].id, other.id);
});

test('a browser header cannot authorize writes', async () => {
  const h = harness();
  const result = await h.route.POST(h.request({ 'x-pitchline-sync': 'true' }));
  assert.equal(result.status, 401);
  assert.equal(h.calls.length, 0);
  assert.equal(h.reservations.length, 0);
});

test('player snapshots keep recorded zeroes and omit missing metrics', async () => {
  const h = harness({ playerGroups: [{ team: { name: 'Arsenal' }, players: [
    { player: { name: 'Example Player' }, statistics: [{ games: { minutes: 21 }, goals: { total: 0, assists: null }, passes: { key: 2 } }] },
  ] }] });
  await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  const snapshot = h.writes.find(w => w.table === 'matches').rows[0].live_stats.player_stats;
  assert.equal(snapshot.final, false);
  assert.equal(snapshot.players[0].minutes, 21);
  assert.equal(snapshot.players[0].goals, 0);
  assert.equal(snapshot.players[0].assists, undefined);
  assert.equal(snapshot.players[0].key_passes, 2);
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

test('a delayed live score can replace a stale API-Football snapshot once it catches up', async () => {
  for (const fdScore of [null, 0, 2]) {
    const h = harness({
      snapshotAge: 16 * 60_000,
      fdStatus: 'IN_PLAY',
      fdScore,
      env: { FOOTBALL_DATA_KEY: 'test-fd-key', API_FOOTBALL_KEY: undefined },
    });
    await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
    const match = h.writes.find(w => w.table === 'matches')?.rows[0] ?? h.existing;
    assert.equal(match.home_score, fdScore === 2 ? 2 : 1);
    assert.equal(match.live_stats.source, fdScore === 2 ? 'football-data' : 'api-football');
  }
});

test('halftime and possession are persisted from the providers', async () => {
  const h = harness({
    apiStatus: 'HT',
    teamStats: [
      { team: { id: 20 }, statistics: [{ type: 'Ball Possession', value: '39%' }] },
      { team: { id: 10 }, statistics: [{ type: 'Ball Possession', value: '61%' }] },
    ],
  });
  await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  const match = h.writes.find(w => w.table === 'matches').rows[0];
  assert.equal(match.status, 'HT');
  assert.equal(match.live_stats.home_possession, 61);
  assert.equal(match.live_stats.away_possession, 39);
  const { getLiveMatchPhase } = load('src/lib/date-utils.ts');
  assert.equal(getLiveMatchPhase(match.status), 'Medio tiempo');

  const fd = harness({ existingSource: 'football-data', fdStatus: 'PAUSED', env: { FOOTBALL_DATA_KEY: 'test-fd-key', API_FOOTBALL_KEY: undefined } });
  await fd.route.POST(fd.request({ authorization: 'Bearer test-secret' }));
  assert.equal(fd.writes.find(w => w.table === 'matches').rows[0].status, 'HT');
});

test('Football-Data identifies the second half after a confirmed halftime score', async () => {
  const h = harness({
    existingSource: 'football-data',
    fdStatus: 'IN_PLAY',
    fdHalfTime: { home: 0, away: 0 },
    env: { FOOTBALL_DATA_KEY: 'test-fd-key', API_FOOTBALL_KEY: undefined },
  });
  await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  const match = h.writes.find(w => w.table === 'matches').rows[0];
  assert.equal(match.status, '2H');
  assert.equal(match.elapsed_minute, null);
});

test('DataSportsAPI enriches Football-Data possession without changing its match state', async () => {
  const h = harness({
    existingSource: 'football-data',
    env: { API_FOOTBALL_KEY: undefined, FOOTBALL_DATA_KEY: 'test-fd-key', DATASPORTSAPI_API_KEY: 'test-stats-key' },
    fdStatus: 'PAUSED',
    fdScore: 1,
    dataSports: { periods: [{ period: 'all', groups: [{
      items: [{ key: 'ballPossession', home: { value: 38 }, away: { value: 62 } }],
    }] }] },
  });
  const result = await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  assert.equal(result.status, 200);
  const match = h.writes.find(w => w.table === 'matches').rows[0];
  assert.equal(match.status, 'HT');
  assert.equal(match.home_score, 1);
  assert.equal(match.live_stats.source, 'football-data');
  const { computeMatchTelemetry } = load('src/lib/date-utils.ts');
  assert.equal(computeMatchTelemetry(match).homePossession, 38);
  assert.equal(computeMatchTelemetry(match).awayPossession, 62);
  assert.equal(h.reservations.filter(args => args.bucket_name === 'datasports-requests').length, 3);
});

test('a rejected DataSportsAPI key does not block score synchronization', async () => {
  const h = harness({
    existingSource: 'football-data',
    env: { API_FOOTBALL_KEY: undefined, FOOTBALL_DATA_KEY: 'test-fd-key', DATASPORTSAPI_API_KEY: 'test-stats-key' },
    fdStatus: 'IN_PLAY',
    dataSports: 'unauthorized',
  });
  const result = await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  assert.equal(result.status, 200);
  assert.ok(result.body.warnings.some(warning => warning.includes('HTTP 401')));
  assert.equal(h.writes.find(w => w.table === 'matches').rows[0].status, 'IN_PLAY');
});

test('DataSportsAPI advances the minute from the official period clock and stops when stale', async () => {
  const h = harness({
    existingSource: 'football-data',
    env: { API_FOOTBALL_KEY: undefined, FOOTBALL_DATA_KEY: 'test-fd-key', DATASPORTSAPI_API_KEY: 'test-stats-key' },
    fdStatus: 'IN_PLAY',
    fdHalfTime: { home: 0, away: 0 },
    dataSports: { periods: [] },
  });
  await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  const match = h.writes.find(w => w.table === 'matches').rows[0];
  const { getMatchMinuteLabel } = load('src/lib/date-utils.ts');
  const start = Date.parse(match.live_stats.datasports_clock.period_started_at);
  assert.equal(getMatchMinuteLabel(match, start + 46 * 60_000), "90+1'");
  assert.equal(getMatchMinuteLabel({ ...match, status: 'HT' }, start + 46 * 60_000), null);
  assert.equal(getMatchMinuteLabel(match, start + 52 * 60_000), null);
  assert.equal(getMatchMinuteLabel(match, start + 62 * 60_000), null);
});

test('DataSportsAPI looks up the detailed clock when the live list omits it', async () => {
  const h = harness({
    existingSource: 'football-data',
    env: { API_FOOTBALL_KEY: undefined, DATASPORTSAPI_API_KEY: 'test-stats-key' },
    dataSports: { periods: [] },
    omitBoardClock: true,
  });
  await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  const match = h.writes.find(w => w.table === 'matches').rows[0];
  assert.equal(match.live_stats.datasports_clock.period_offset_seconds, 2700);
  assert.ok(h.calls.some(url => url.endsWith('/fixtures/44')));
});

test('a stale calendar cannot turn an in-play or finished fixture back into a scheduled match', async () => {
  for (const status of ['2H', 'FINISHED']) {
    const h = harness({
      existingSource: 'football-data',
      env: { FOOTBALL_DATA_KEY: 'test-fd-key', API_FOOTBALL_KEY: undefined },
      fdStatus: 'TIMED',
      fdScore: null,
    });
    h.existing.status = status;
    await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
    assert.equal(h.writes.some(w => w.table === 'matches'), false);
  }
});

test('a confirmed DataSportsAPI final beats a stale calendar and includes verified stats and incidents', async () => {
  const h = harness({
    existingSource: 'football-data',
    env: { FOOTBALL_DATA_KEY: 'test-fd-key', API_FOOTBALL_KEY: undefined, DATASPORTSAPI_API_KEY: 'test-stats-key' },
    fdStatus: 'TIMED',
    dataSportsMatch: { status: { phase: 'finished' }, homeScore: { current: 1 }, awayScore: { current: 0 } },
    dataSports: { periods: [{ period: 'all', groups: [{ items: [
      { key: 'ballPossession', home: { value: 55 }, away: { value: 45 } },
      { key: 'expectedGoals', home: { value: 1.25 }, away: { value: 0 } },
      { key: 'totalShots', home: { value: 9 }, away: { value: 3 } },
    ] }] }] },
    dataSportsIncidents: [
      { type: 'goal', side: 'home', minute: 90, addedMinute: 2, playerName: 'Scorer' },
      { type: 'goal', side: 'away', minute: 88, playerName: 'Cancelled', rescinded: true },
      { type: 'card', detail: 'secondYellow', side: 'away', minute: 76, playerName: 'Defender' },
      { type: 'substitution', side: 'home', minute: 82, playerIn: { name: 'Incoming' }, playerOut: { name: 'Outgoing' } },
    ],
  });
  const result = await h.route.POST(h.request({ authorization: 'Bearer test-secret' }));
  assert.equal(result.status, 200);
  const match = h.writes.find(w => w.table === 'matches').rows[0];
  assert.equal(match.status, 'FINISHED');
  assert.equal(match.home_score, 1);
  assert.equal(match.away_score, 0);
  assert.equal(match.live_stats.source, 'datasportsapi');
  const { computeMatchTelemetry, getVerifiedMatchEvents } = load('src/lib/date-utils.ts');
  const stats = computeMatchTelemetry(match);
  assert.equal(stats.homePossession, 55);
  assert.equal(stats.awayXg, 0);
  assert.equal(stats.shots.join(','), '9,3');
  const incidents = getVerifiedMatchEvents(match);
  assert.equal(incidents.map(e => e.event_type).join(','), 'RED_CARD,SUBSTITUTION,GOAL');
  assert.equal(incidents[2].extra_minute, 2);
  assert.equal(match.live_stats.datasports_clock, undefined);
});
