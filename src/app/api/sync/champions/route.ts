import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { calculatePoissonMatchPrediction } from "@/lib/predictions/poisson";
import type {
  LiveStats,
  MatchEventRow,
  MatchPlayerStats,
  MatchRow,
  MatchStatus,
  PredictionRow,
  StandingRow,
} from "@/types/database";
const FOOTBALL_DATA_STANDINGS_URL =
  "https://api.football-data.org/v4/competitions/CL/standings";
const FOOTBALL_DATA_MATCHES_URL =
  "https://api.football-data.org/v4/competitions/CL/matches";
interface FootballDataStandingTableEntry {
  position: number;
  team: {
    id: number;
    name: string;
    shortName?: string;
    tla?: string;
    crest?: string;
  };
  playedGames: number;
  form?: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface FootballDataStandingsResponse {
  season?: {
    id?: number;
    startDate?: string;
    endDate?: string;
    currentMatchday?: number;
  };
  standings?: {
    stage?: string;
    type?: string;
    table?: FootballDataStandingTableEntry[];
  }[];
}

interface FootballDataMatchItem {
  id: number;
  utcDate: string;
  status: string;
  stage?: string;
  matchday?: number | null;
  venue?: string | null;
  homeTeam: {
    id: number;
    name: string;
    shortName?: string;
    tla?: string;
    crest?: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName?: string;
    tla?: string;
    crest?: string;
  };
  score?: {
    duration?: string;
    fullTime?: {
      home?: number | null;
      away?: number | null;
    };
    halfTime?: {
      home?: number | null;
      away?: number | null;
    };
    penalties?: {
      home?: number | null;
      away?: number | null;
    };
  };
  referees?: {
    name?: string;
    nationality?: string;
  }[];
}

interface FootballDataMatchesResponse {
  matches?: FootballDataMatchItem[];
}

interface ApiFootballPlayerGroup {
  team: { name: string };
  players: {
    player: { name: string };
    statistics: {
      games?: { minutes?: number | null; position?: string | null; rating?: string | null };
      goals?: { total?: number | null; assists?: number | null; saves?: number | null };
      shots?: { total?: number | null; on?: number | null };
      passes?: { total?: number | null; key?: number | null };
      tackles?: { total?: number | null; interceptions?: number | null };
      cards?: { yellow?: number | null; red?: number | null };
    }[];
  }[];
}

function readPlayerStats(groups: ApiFootballPlayerGroup[]): MatchPlayerStats[] {
  return groups.flatMap(({ team, players }) => players.flatMap(({ player, statistics }) => {
    const s = statistics[0];
    if (!player.name || !s || !(Number(s.games?.minutes) > 0)) return [];
    return [{
      name: player.name,
      team: team.name,
      minutes: s.games?.minutes ?? undefined,
      position: s.games?.position ?? undefined,
      rating: s.games?.rating ?? undefined,
      goals: s.goals?.total ?? undefined,
      assists: s.goals?.assists ?? undefined,
      saves: s.goals?.saves ?? undefined,
      shots: s.shots?.total ?? undefined,
      shots_on_target: s.shots?.on ?? undefined,
      passes: s.passes?.total ?? undefined,
      key_passes: s.passes?.key ?? undefined,
      tackles: s.tackles?.total ?? undefined,
      interceptions: s.tackles?.interceptions ?? undefined,
      yellow_cards: s.cards?.yellow ?? undefined,
      red_cards: s.cards?.red ?? undefined,
    }];
  }));
}

interface ApiFootballLiveFixture {
  fixture: {
    id: number;
    date: string;
    venue?: {
      name?: string;
      city?: string;
    };
    status: {
      short: string;
      elapsed: number | null;
      extra?: number | null;
    };
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo?: string;
    };
    away: {
      id: number;
      name: string;
      logo?: string;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  events?: {
    time: {
      elapsed: number;
      extra?: number | null;
    };
    team: {
      id: number;
      name: string;
    };
    player: {
      id?: number;
      name?: string;
    };
    assist?: {
      id?: number | null;
      name?: string | null;
    };
    type: string;
    detail?: string;
  }[];
  statistics?: {
    team: {
      id: number;
      name: string;
    };
    statistics: {
      type: string;
      value: number | string | null;
    }[];
  }[];
  players?: ApiFootballPlayerGroup[];
}


function readTeamTelemetry(fixture: ApiFootballLiveFixture, teams = fixture.teams) {
  const read = (teamId: number, type: RegExp, max = Infinity) => {
    const stats = fixture.statistics?.find(group => group.team.id === teamId)?.statistics;
    const value = stats?.find(stat => type.test(stat.type))?.value;
    if (value == null) return undefined;
    const cleaned = String(value).replace(/%$/, "").trim();
    const number = Number(cleaned);
    return cleaned && Number.isFinite(number) && number >= 0 && number <= max ? number : undefined;
  };
  return {
    home_possession: read(teams.home.id, /^ball possession$/i, 100),
    away_possession: read(teams.away.id, /^ball possession$/i, 100),
    home_xg: read(teams.home.id, /^expected[_ ]goals$/i),
    away_xg: read(teams.away.id, /^expected[_ ]goals$/i),
  };
}

function mapFootballDataStatusAndMinute(
  rawStatus: string,
  score: FootballDataMatchItem["score"]
): { status: MatchStatus; elapsedMinute: number | null; halfLabel: string } {
  const upper = rawStatus.toUpperCase();
  if (["FINISHED", "AWARDED"].includes(upper)) return { status: "FINISHED", elapsedMinute: null, halfLabel: "Finalizado" };
  if (upper === "PAUSED") return { status: "HT", elapsedMinute: 45, halfLabel: "Descanso" };
  if (upper === "IN_PLAY" && score?.duration === "EXTRA_TIME") return { status: "ET", elapsedMinute: null, halfLabel: "Prórroga" };
  if (upper === "IN_PLAY" && score?.duration === "PENALTY_SHOOTOUT") return { status: "PEN", elapsedMinute: null, halfLabel: "Penales" };
  if (upper === "IN_PLAY" && score?.halfTime?.home != null && score.halfTime.away != null) {
    return { status: "2H", elapsedMinute: null, halfLabel: "Segundo tiempo" };
  }
  if (["IN_PLAY", "LIVE"].includes(upper)) return { status: "IN_PLAY", elapsedMinute: null, halfLabel: "En juego · minuto no disponible" };
  if (upper === "POSTPONED" || upper === "SUSPENDED") return { status: "POSTPONED", elapsedMinute: null, halfLabel: "Aplazado o suspendido" };
  if (upper === "CANCELLED") return { status: "CANCELLED", elapsedMinute: null, halfLabel: "Cancelado" };
  return { status: "SCHEDULED", elapsedMinute: null, halfLabel: "Programado" };
}

function mapApiFootballStatus(shortStatus: string): MatchStatus {
  const upper = shortStatus.toUpperCase();
  if (upper === "1H") return "1H";
  if (upper === "HT") return "HT";
  if (upper === "2H") return "2H";
  if (upper === "LIVE") return "IN_PLAY";
  if (upper === "ET" || upper === "BT") return "ET";
  if (upper === "P") return "PEN";
  if (["FT", "AET", "PEN"].includes(upper)) return "FINISHED";
  return "SCHEDULED";
}

/**
 * Valores exactos permitidos por la restricción CHECK `standings_qualification_zone_check` en PostgreSQL:
 * - Puestos 1-8: 'OCTAVOS_DIRECTO'
 * - Puestos 9-24: 'PLAYOFFS'
 * - Puestos 25-36: 'ELIMINADO'
 */
function mapQualificationZone(rank: number): string {
  if (rank <= 8) return "OCTAVOS_DIRECTO";
  if (rank <= 24) return "PLAYOFFS";
  return "ELIMINADO";
}

/**
 * Calcula la racha real (ej. "V,V,V" o "V,E,D") de cada equipo a partir de los partidos finalizados
 * de la temporada actual en Football-Data.org.
 */
function computeFormByTeamFromMatches(
  rawMatches: FootballDataMatchItem[]
): Map<number, string> {
  const finished = rawMatches
    .filter(
      (m) =>
        m.status === "FINISHED" &&
        m.score?.fullTime?.home !== null &&
        m.score?.fullTime?.home !== undefined &&
        m.score?.fullTime?.away !== null &&
        m.score?.fullTime?.away !== undefined
    )
    .sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );

  const historyByTeam = new Map<number, string[]>();

  for (const m of finished) {
    const hGoals = m.score?.fullTime?.home ?? 0;
    const aGoals = m.score?.fullTime?.away ?? 0;

    const hRes = hGoals > aGoals ? "V" : hGoals === aGoals ? "E" : "D";
    const aRes = aGoals > hGoals ? "V" : aGoals === hGoals ? "E" : "D";

    const hList = historyByTeam.get(m.homeTeam.id) ?? [];
    hList.push(hRes);
    historyByTeam.set(m.homeTeam.id, hList);

    const aList = historyByTeam.get(m.awayTeam.id) ?? [];
    aList.push(aRes);
    historyByTeam.set(m.awayTeam.id, aList);
  }

  const formMap = new Map<number, string>();
  for (const [teamId, results] of historyByTeam.entries()) {
    formMap.set(teamId, results.slice(-5).join(","));
  }
  return formMap;
}

function normalizeForm(
  rawForm: string | null | undefined,
  computedForm?: string
): string {
  if (computedForm && computedForm.length > 0) {
    return computedForm;
  }
  if (!rawForm) return "V,E,V";
  return rawForm
    .split(/[,;\s]+/)
    .map((c) => {
      const upper = c.trim().toUpperCase();
      if (upper === "W" || upper === "V") return "V";
      if (upper === "D" || upper === "E") return "E";
      if (upper === "L") return "D";
      return upper;
    })
    .filter(Boolean)
    .slice(0, 5)
    .join(",");
}

function cleanTeam(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[øØ]/g, "o")
    .replace(/[łŁ]/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(
      /\b(fc|cf|sc|sk|ac|bv|bvb|vfb|fk|rb|cp|club|de|clube|balompie|sp|sad|linz|rotterdam|donetsk)\b/gi,
      " "
    )
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function teamsMatch(name1: string, name2: string): boolean {
  const c1 = cleanTeam(name1);
  const c2 = cleanTeam(name2);
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  if (c1.length >= 3 && c2.length >= 3) {
    if (c1.includes(c2) || c2.includes(c1)) return true;
  }
  const aliasMap: Record<string, string> = {
    shaktar: "shakhtar",
    shakhtar: "shaktar",
    atleti: "atletico",
    inter: "internazionale",
    barca: "barcelona",
    sporting: "sportingcp",
    psg: "parissaintgermain",
    manutd: "manchesterunited",
    manunited: "manchesterunited",
    mancity: "manchestercity",
    slbratislava: "slovanbratislava",
    sbratislava: "slovanbratislava",
  };
  for (const [k, v] of Object.entries(aliasMap)) {
    if ((c1.includes(k) && c2.includes(v)) || (c1.includes(v) && c2.includes(k))) return true;
  }
  return false;
}

type DataSportsFixture = {
  id: number;
  league?: { id: number; name: string };
  startTime: string;
  home: { name: string; shortName?: string };
  away: { name: string; shortName?: string };
  status?: { phase?: string; code?: number; period?: string | null; finish?: string | null };
  homeScore?: { current?: number | null; penalties?: number | null };
  awayScore?: { current?: number | null; penalties?: number | null };
  clock?: {
    periodStartedAt?: string | null;
    periodOffsetSeconds?: number | null;
    periodEndSeconds?: number | null;
    maxExtraSeconds?: number | null;
    injuryTimeMinutes?: number | null;
  } | null;
};

function readDataSportsClock(fixture: DataSportsFixture, now: string): LiveStats["datasports_clock"] {
  const clock = fixture.clock;
  if (fixture.status?.phase !== "inprogress" || !clock?.periodStartedAt) return undefined;
  const started = Date.parse(clock.periodStartedAt);
  const offset = clock.periodOffsetSeconds;
  const end = clock.periodEndSeconds;
  if (!Number.isFinite(started) || started > Date.parse(now) || offset == null || end == null ||
      !Number.isInteger(offset) || !Number.isInteger(end) || offset < 0 || end <= offset || end % 60 !== 0) return undefined;
  const maxExtra = clock.maxExtraSeconds ?? (clock.injuryTimeMinutes ?? 0) * 60;
  return {
    period_started_at: clock.periodStartedAt,
    period_offset_seconds: offset,
    period_end_seconds: end,
    max_extra_seconds: Number.isFinite(maxExtra) ? Math.max(0, maxExtra) : 0,
    observed_at: now,
  };
}

type DataSportsStatistics = {
  periods?: {
    period: string;
    groups: { items: { key: string; home?: { value?: number }; away?: { value?: number } }[] }[];
  }[];
};

type DataSportsIncident = {
  type: string;
  detail?: string | null;
  side?: string | null;
  minute?: number | null;
  addedMinute?: number | null;
  rescinded?: boolean;
  period?: string | null;
  player?: { name: string } | null;
  playerName?: string | null;
  playerIn?: { name: string } | null;
  playerOut?: { name: string } | null;
  assists?: { name: string }[];
};

function dataSportsStatus(fixture: DataSportsFixture): MatchStatus | undefined {
  const status = fixture.status;
  if (status?.phase === "finished") return "FINISHED";
  if (status?.phase === "break") return status.code === 31 ? "HT" : undefined;
  if (status?.phase !== "inprogress") return undefined;
  if (status.period === "period1") return "1H";
  if (status.period === "period2") return "2H";
  if (status.period === "penalties" || [50, 51, 52].includes(status.code ?? 0)) return "PEN";
  if (status.period?.startsWith("extra") || [40, 41, 42].includes(status.code ?? 0)) return "ET";
  return "IN_PLAY";
}

function readDataSportsEvents(events: DataSportsIncident[], match: MatchRow, now: string): MatchEventRow[] {
  const cards: Record<string, string> = { yellow: "YELLOW_CARD", red: "RED_CARD", secondYellow: "RED_CARD" };
  const rows = new Map<string, MatchEventRow>();
  for (const event of events) {
    if (event.rescinded || event.period === "penalties" || (event.side !== "home" && event.side !== "away") ||
        event.minute == null || !Number.isInteger(event.minute) || event.minute < 0) continue;
    const type = event.type === "goal" ? "GOAL" : event.type === "substitution" ? "SUBSTITUTION"
      : event.type === "card" ? cards[event.detail ?? ""] : undefined;
    if (!type || (type === "GOAL" && /cancel|miss|disallow/i.test(event.detail ?? ""))) continue;
    const player = type === "SUBSTITUTION" ? event.playerIn?.name : event.playerName ?? event.player?.name;
    const other = type === "SUBSTITUTION" ? event.playerOut?.name : event.assists?.[0]?.name;
    if (!player) continue;
    const teamId = event.side === "home" ? match.home_team_id : match.away_team_id;
    const id = createHash("sha256").update(JSON.stringify([match.id, teamId, type, event.minute, event.addedMinute, player, other])).digest("hex");
    rows.set(id, { id, source: "datasportsapi", match_id: match.id, minute: event.minute,
      extra_minute: event.addedMinute ?? null, team_id: teamId, player_name: player,
      assist_or_sub_name: other ?? null, event_type: type, detail: null, created_at: now });
  }
  return [...rows.values()];
}

async function fetchDataSports<T>(path: string, key: string): Promise<T> {
  const response = await fetch(`https://api.datasportsapi.com/v2/${path}`, {
    headers: { authorization: `Bearer ${key}` },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json() as { data: T };
  return result.data;
}

function readDataSportsPossession(stats: DataSportsStatistics, updatedAt: string): LiveStats["datasports_possession"] {
  const item = stats.periods?.find(period => period.period === "all")?.groups
    .flatMap(group => group.items).find(stat => stat.key === "ballPossession");
  const home = item?.home?.value;
  const away = item?.away?.value;
  if (typeof home !== "number" || typeof away !== "number" ||
      !(home >= 0 && home <= 100 && away >= 0 && away <= 100) ||
      Math.abs(home + away - 100) > 1) return undefined;
  return { home, away, updated_at: updatedAt };
}

function readDataSportsStatistics(stats: DataSportsStatistics, updatedAt: string, final: boolean): LiveStats["datasports_statistics"] {
  const items = stats.periods?.find(period => period.period === "all")?.groups.flatMap(group => group.items);
  const pair = (key: string): [number, number] | undefined => {
    const item = items?.find(stat => stat.key === key);
    const home = item?.home?.value;
    const away = item?.away?.value;
    if (typeof home === "number" && Number.isFinite(home) && home >= 0 &&
        typeof away === "number" && Number.isFinite(away) && away >= 0) return [home, away];
  };
  const xg = pair("expectedGoals");
  const shots = pair("totalShots");
  const corners = pair("cornerKicks");
  if (xg || shots || corners || readDataSportsPossession(stats, updatedAt)) return { xg, shots, corners, updated_at: updatedAt, final };
}

let cachedStandingsToSync: StandingRow[] = [];
async function isAuthorizedSyncRequest(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && (request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret));
}

function stableEventId(matchId: number, event: unknown) {
  const hex = createHash("sha256").update(JSON.stringify([matchId, event])).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

async function handleChampionsSync(request: NextRequest) {
  const authorized = await isAuthorizedSyncRequest(request);
  if (!authorized) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No autorizado: comprueba que CRON_SECRET coincida en el programador y en el servidor.",
      },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const reserve = async (bucket: string, interval: number, limit: number) => {
    const { data, error } = await admin.rpc("reserve_sync_request", { bucket_name: bucket, interval_seconds: interval, daily_limit: limit });
    if (error) throw new Error("No se pudo reservar la cuota. Aplica la migración de sincronización en Supabase.");
    return data === true;
  };
  try {
    if (!(await reserve("champions-worker", 60, 1440))) return NextResponse.json({ ok: true, skipped: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 503 });
  }
  const { data: stored, error: readError } = await admin.from("matches").select("*");
  if (readError) return NextResponse.json({ ok: false, error: "No se pudieron leer los partidos" }, { status: 503 });
  const storedMatches = (stored ?? []) as MatchRow[];
  const warnings: string[] = [];
  const nowIso = new Date().toISOString();
  const footballDataKey = process.env.FOOTBALL_DATA_KEY;
  const apiFootballKey = process.env.API_FOOTBALL_KEY;
  const dataSportsKey = process.env.DATASPORTSAPI_API_KEY?.trim();
  const possessionSnapshots = new Map<number, NonNullable<LiveStats["datasports_possession"]>>();
  const dataSportsStatistics = new Map<number, NonNullable<LiveStats["datasports_statistics"]>>();
  const dataSportsEvents = new Map<number, NonNullable<LiveStats["datasports_events"]>>();
  const dataSportsMatches = new Map<number, { fixture: DataSportsFixture; status: MatchStatus }>();
  const clockSnapshots = new Map<number, NonNullable<LiveStats["datasports_clock"]>>();
  let dataSportsBoardRead = false;

  let standingsToSync: StandingRow[] = [];
  let matchesToSync: MatchRow[] = [];
  const footballDataScoreIds = new Set<number>();
  const apiUpdatedIds = new Set<number>();
  const authoritativeEvents = new Set<number>();
  const teamSnapshots = new Map<number, ReturnType<typeof readTeamTelemetry>>();
  const playerSnapshots = new Map<number, NonNullable<LiveStats["player_stats"]>>();
  const playerStatsChecked = new Set<number>();
  const eventsToSync: MatchEventRow[] = [];

  let standingsSource = "UNCHANGED";
  let matchesSource = "UNCHANGED";
  let liveFixturesSource = "NO_LIVE_FIXTURES_TODAY";
  const injuriesSource = "UNCHANGED_NO_VERIFIED_MEDICAL_UPDATE";
  let currentMatchdayFromApi: number | null = null;

  // ============================================================================
  // 1. FOOTBALL-DATA.ORG: /v4/competitions/CL/standings y /matches (Temporada 2026)
  // ============================================================================
  if (footballDataKey && footballDataKey.trim().length > 5) {
    try {
      const shouldFetchStandings = await reserve("football-data-standings", 3600, 24);
      const activeWindow = storedMatches.some(m => Date.now() >= Date.parse(m.kickoff_at) - 15 * 60_000 && Date.now() <= Date.parse(m.kickoff_at) + 240 * 60_000);
      const shouldFetchMatches = await reserve("football-data-matches", activeWindow ? 60 : 3600, 600);

      const [standingsRes, matchesRes] = await Promise.all([
        shouldFetchStandings
          ? fetch(FOOTBALL_DATA_STANDINGS_URL, {
              headers: {
                "X-Auth-Token": footballDataKey.trim(),
              },
              cache: "no-store",
              signal: AbortSignal.timeout(10000),
            })
          : Promise.resolve(null),
        shouldFetchMatches ? fetch(FOOTBALL_DATA_MATCHES_URL, {
          headers: {
            "X-Auth-Token": footballDataKey.trim(),
          },
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        }) : Promise.resolve(null),
      ]);

      let rawMatchesList: FootballDataMatchItem[] = [];
      if (matchesRes?.ok) {
        const matchesJson =
          (await matchesRes.json()) as FootballDataMatchesResponse;
        rawMatchesList = matchesJson.matches ?? [];
      }

      if (matchesRes && !matchesRes.ok) warnings.push(`football-data matches: HTTP ${matchesRes.status}`);
      if (standingsRes && !standingsRes.ok) warnings.push(`football-data standings: HTTP ${standingsRes.status}`);
      const computedFormMap = computeFormByTeamFromMatches(rawMatchesList);

      if (!shouldFetchStandings && cachedStandingsToSync.length > 0) {
        standingsToSync = cachedStandingsToSync;
        standingsSource = "FOOTBALL_DATA_ORG_2026_CACHED";
      } else if (standingsRes && standingsRes.ok) {
        const standingsJson =
          (await standingsRes.json()) as FootballDataStandingsResponse;
        const totalTable =
          standingsJson.standings?.find((s) => s.type === "TOTAL")?.table ??
          standingsJson.standings?.[0]?.table ??
          [];

        if (standingsJson.season?.currentMatchday) {
          currentMatchdayFromApi = standingsJson.season.currentMatchday;
        }

        if (totalTable.length > 0) {
          const seasonYear = standingsJson.season?.startDate
            ? Number(standingsJson.season.startDate.slice(0, 4)) || 2026
            : 2026;

          standingsToSync = totalTable.map((row) => ({
            team_id: row.team.id,
            season: seasonYear,
            rank: row.position,
            team_name: row.team.name,
            team_short_name:
              row.team.tla ??
              row.team.shortName ??
              row.team.name.slice(0, 3).toUpperCase(),
            team_crest_url: row.team.crest ?? "",
            played: row.playedGames,
            won: row.won,
            drawn: row.draw,
            lost: row.lost,
            goals_for: row.goalsFor,
            goals_against: row.goalsAgainst,
            goal_diff: row.goalDifference,
            points: row.points,
            form: normalizeForm(row.form, computedFormMap.get(row.team.id)),
            qualification_zone: mapQualificationZone(row.position),
            uefa_coefficient: Number(
              Math.max(65, 138 - row.position * 1.6).toFixed(2)
            ),
            updated_at: nowIso,
          }));
          cachedStandingsToSync = standingsToSync;
          standingsSource = "FOOTBALL_DATA_ORG_2026_LIVE";
        }
      }

      if (rawMatchesList.length > 0) {
        const rankMap = new Map<number, StandingRow>();
        for (const st of standingsToSync) {
          rankMap.set(st.team_id, st);
        }

        // Sincronizar TODOS los 144 partidos de las 8 jornadas de la Fase de Liga 2026/27
        matchesToSync = rawMatchesList.map((m) => {
          if (m.score?.fullTime?.home != null && m.score?.fullTime?.away != null) {
            footballDataScoreIds.add(m.id);
          }
          const homeSt = rankMap.get(m.homeTeam.id);
          const awaySt = rankMap.get(m.awayTeam.id);

          const homeRankLabel = homeSt
            ? `${homeSt.rank}° Lugar • ${homeSt.points} pts (${homeSt.goal_diff >= 0 ? `+${homeSt.goal_diff}` : homeSt.goal_diff})`
            : "Fase de Liga UCL";
          const awayRankLabel = awaySt
            ? `${awaySt.rank}° Lugar • ${awaySt.points} pts (${awaySt.goal_diff >= 0 ? `+${awaySt.goal_diff}` : awaySt.goal_diff})`
            : "Fase de Liga UCL";

          const {
            status: mappedStatus,
            elapsedMinute: estimatedMinute,
            halfLabel: fdHalfLabel,
          } = mapFootballDataStatusAndMinute(
            m.status,
            m.score
          );

          // Destacar el partidazo estelar de cada jornada (ej. Barça vs Aston Villa / Atleti vs Bayern / RB Leipzig vs Man City en J4)
          const isBigMatch =
            (homeSt && awaySt && homeSt.rank <= 12 && awaySt.rank <= 14) ||
            [81, 86, 524, 65, 5, 64].includes(m.homeTeam.id) &&
              [81, 86, 524, 65, 5, 64, 58, 108].includes(m.awayTeam.id);

          return {
            id: m.id,
            season: new Date(m.utcDate).getUTCFullYear() - (new Date(m.utcDate).getUTCMonth() < 6 ? 1 : 0),
            stage: m.stage ?? "LEAGUE_STAGE",
            matchday: m.matchday ?? null,
            bracket_slot: null,
            leg: null,
            kickoff_at: m.utcDate,
            status: mappedStatus,
            elapsed_minute: estimatedMinute,
            extra_minute: null,
            home_team_id: m.homeTeam.id,
            home_team_name: m.homeTeam.shortName ?? m.homeTeam.name,
            home_team_crest: m.homeTeam.crest ?? "",
            away_team_id: m.awayTeam.id,
            away_team_name: m.awayTeam.shortName ?? m.awayTeam.name,
            away_team_crest: m.awayTeam.crest ?? "",
            home_score: m.score?.fullTime?.home ?? 0,
            away_score: m.score?.fullTime?.away ?? 0,
            aggregate_home_score: null,
            aggregate_away_score: null,
            penalty_home_score: m.score?.penalties?.home ?? null,
            penalty_away_score: m.score?.penalties?.away ?? null,
            live_stats: {
              source: "football-data",
              source_updated_at: nowIso,
              home_rank_label: homeRankLabel,
              away_rank_label: awayRankLabel,
              half_label:
                mappedStatus === "SCHEDULED"
                  ? `Jornada ${m.matchday ?? 4}`
                  : fdHalfLabel,
              is_spotlight: Boolean(
                isBigMatch ||
                  mappedStatus === "1H" ||
                  mappedStatus === "2H" ||
                  mappedStatus === "HT"
              ),
            },
            venue: m.venue ?? `Estadio UEFA (${m.homeTeam.shortName ?? m.homeTeam.name})`,
            referee: m.referees?.[0]?.name ?? "Designación Oficial UEFA",
            updated_at: nowIso,
          };
        });
        matchesSource = `FOOTBALL_DATA_ORG_2026_LIVE (${matchesToSync.length} partidos J1-J8)`;
      }
    } catch { warnings.push("football-data: consulta fallida; se conserva la última lectura"); }
  }

  if (matchesToSync.length === 0) matchesToSync = [...storedMatches];
  // ============================================================================
  // 2. API-FOOTBALL: partidos del día, incluidos los que acaban de finalizar.
  // ============================================================================
  const hasMatchesInPlayOrToday = matchesToSync.some(m => Date.now() >= Date.parse(m.kickoff_at) - 15 * 60_000 && Date.now() <= Date.parse(m.kickoff_at) + 240 * 60_000);

  if (
    apiFootballKey &&
    apiFootballKey.trim().length > 5 &&
    hasMatchesInPlayOrToday
  ) {
    try {
      let liveFixtures: ApiFootballLiveFixture[] = [];


      if (await reserve("api-football", 300, 85)) {
        const date = nowIso.slice(0, 10);
        const month = new Date(nowIso).getUTCMonth();
        const year = new Date(nowIso).getUTCFullYear() - (month < 6 ? 1 : 0);
        const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}&league=2&season=${year}`, {
          headers: { "x-apisports-key": apiFootballKey.trim() }, cache: "no-store", signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error(`API-Football HTTP ${response.status}`);
        const json = await response.json();
        if (json.errors && Object.keys(json.errors).length) throw new Error("API-Football: cuota o cobertura no disponible");
        liveFixtures = Array.isArray(json.response) ? json.response : [];
      }
      if (liveFixtures.length > 0) {
        liveFixturesSource = `API_FOOTBALL_LIVE (${liveFixtures.length} en juego)`;

        let eventRequests = 0;
        for (const item of liveFixtures) {
          const existingIdx = matchesToSync.findIndex(
            (m) =>
              teamsMatch(m.home_team_name, item.teams.home.name) &&
              teamsMatch(m.away_team_name, item.teams.away.name) &&
              Math.abs(Date.parse(m.kickoff_at) - Date.parse(item.fixture.date)) < 6 * 60 * 60 * 1000
          );

            if (existingIdx >= 0) {
              const matchId = matchesToSync[existingIdx].id;


              const status = mapApiFootballStatus(item.fixture.status.short);
              const liveStatsObj: LiveStats = {
                ...readTeamTelemetry(item),
                source: "api-football",
                source_updated_at: nowIso,
                provider_fixture_id: item.fixture.id,
                is_spotlight: true,
              };

              if (["TBD", "NS", "PST", "CANC", "ABD", "SUSP", "INT"].includes(item.fixture.status.short)) continue;
              if (item.goals.home == null || item.goals.away == null) continue;
              apiUpdatedIds.add(matchId);
              matchesToSync[existingIdx] = {
                ...matchesToSync[existingIdx],
                status,
                elapsed_minute: item.fixture.status.elapsed,
                extra_minute: item.fixture.status.extra ?? null,
                home_score: item.goals.home ?? 0,
                away_score: item.goals.away ?? 0,
                live_stats: liveStatsObj,
                updated_at: nowIso,
              };

              let officialEvents = item.events;
              const previous = storedMatches.find(m => m.id === matchId);
              const scoreChanged = previous?.home_score !== item.goals.home || previous?.away_score !== item.goals.away;
              const justFinished = status === "FINISHED" && previous?.status !== "FINISHED";
              const eventsPending = scoreChanged || justFinished || previous?.live_stats?.events_pending === true;
              liveStatsObj.events_pending = eventsPending;
              if (!officialEvents && eventRequests < 2 && eventsPending && await reserve("api-football-events", 0, 10)) {
                eventRequests++;
                const eventResponse = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${item.fixture.id}`, { headers: { "x-apisports-key": apiFootballKey.trim() }, cache: "no-store", signal: AbortSignal.timeout(8000) });
                if (eventResponse.ok) {
                  const body = await eventResponse.json();
                  if ((!body.errors || Object.keys(body.errors).length === 0) && Array.isArray(body.response)) officialEvents = body.response;
                }
              }
              if (Array.isArray(officialEvents)) {
                authoritativeEvents.add(matchId);
                liveStatsObj.events_pending = officialEvents.filter(e => e.type.toUpperCase() === "GOAL" && !/missed|cancel|disallow/i.test(e.detail ?? "")).length !== (item.goals.home ?? 0) + (item.goals.away ?? 0);
              }
              for (const evt of officialEvents ?? []) {
                const rawType = evt.type.toUpperCase();
                const rawDetail = (evt.detail ?? "").toUpperCase();

                if (!["GOAL", "CARD", "SUBST"].includes(rawType)) continue;
                if (rawType === "GOAL" && /missed|cancel|disallow/i.test(evt.detail ?? "")) continue;
                let mappedEventType = "GOAL";
                if (rawType === "CARD" && rawDetail.includes("RED"))
                  mappedEventType = "RED_CARD";
                else if (rawType === "CARD") mappedEventType = "YELLOW_CARD";
                else if (rawType === "SUBST") mappedEventType = "SUBSTITUTION";

                eventsToSync.push({
                  id: stableEventId(matchId, evt),
                  match_id: matchId,
                  minute: evt.time.elapsed,
                  extra_minute: evt.time.extra ?? null,
                  team_id: evt.team.id === item.teams.home.id ? matchesToSync[existingIdx].home_team_id : matchesToSync[existingIdx].away_team_id,
                  player_name: evt.player.name ?? "Jugador",
                  assist_or_sub_name: evt.assist?.name ?? null,
                  event_type: mappedEventType,
                  detail: evt.detail ?? null,
                  created_at: nowIso,
                });
              }
            }
          }
        }
    } catch (error) { console.error("API-Football sync failed", error); warnings.push("api-football: cuota, cobertura o red no disponible"); }
  }

  if (dataSportsKey && hasMatchesInPlayOrToday) {
    try {
      if (await reserve("datasports-possession-cycle", 600, 45) && await reserve("datasports-requests", 0, 90)) {
        const date = nowIso.slice(0, 10);
        const fixtures = await fetchDataSports<DataSportsFixture[]>(`fixtures?date=${date}&league=4409`, dataSportsKey);
        if (!Array.isArray(fixtures)) throw new Error("Listado de partidos inválido");
        dataSportsBoardRead = true;
        const observedAt = new Date().toISOString();
        const missingClocks: { matchId: number; fixtureId: number }[] = [];
        const storedById = new Map(storedMatches.map(match => [match.id, match]));
        const candidates = fixtures.flatMap(fixture => {
          if (fixture.league?.name !== "UEFA Champions League" || !Number.isSafeInteger(fixture.id) || fixture.id < 1) return [];
          const status = dataSportsStatus(fixture);
          if (!status) return [];
          const matching = matchesToSync.filter(match =>
            Math.abs(Date.parse(match.kickoff_at) - Date.parse(fixture.startTime)) <= 60 * 60_000 &&
            (teamsMatch(match.home_team_name, fixture.home.name) || teamsMatch(match.home_team_name, fixture.home.shortName ?? "")) &&
            (teamsMatch(match.away_team_name, fixture.away.name) || teamsMatch(match.away_team_name, fixture.away.shortName ?? "")));
          if (matching.length !== 1) return [];
          const [match] = matching;
          dataSportsMatches.set(match.id, { fixture, status });
          const clock = readDataSportsClock(fixture, observedAt);
          if (clock) clockSnapshots.set(match.id, clock);
          else if (fixture.status?.phase === "inprogress") {
            missingClocks.push({ matchId: match.id, fixtureId: fixture.id });
          }
          return [{ fixture, match, status, previous: storedById.get(match.id)?.live_stats }];
        });

        const requests = [];
        for (const { matchId, fixtureId } of missingClocks.slice(0, 2)) {
          if (!(await reserve("datasports-detail-budget", 0, 45)) || !(await reserve("datasports-requests", 0, 90))) break;
          requests.push(fetchDataSports<DataSportsFixture>(`fixtures/${fixtureId}`, dataSportsKey)
            .then(fixture => {
              if (fixture.id !== fixtureId) return;
              const clock = readDataSportsClock(fixture, new Date().toISOString());
              if (clock) clockSnapshots.set(matchId, clock);
            }).catch(() => {
              warnings.push("datasportsapi: reloj detallado del partido no disponible");
            }));
        }
        const details = candidates.flatMap(({ fixture, match, status, previous }) => {
          const final = status === "FINISHED";
          const stats = previous?.datasports_statistics;
          const events = previous?.datasports_events;
          const requests = [];
          if (final ? !stats?.final : !(Date.now() - Date.parse(stats?.updated_at ?? "") < 30 * 60_000)) {
            requests.push({ kind: "statistics", fixture, match, final, updatedAt: stats?.updated_at ?? "" });
          }
          if (final ? !events?.final : !(Date.now() - Date.parse(events?.updated_at ?? "") < 20 * 60_000)) {
            requests.push({ kind: "events", fixture, match, final, updatedAt: events?.updated_at ?? "" });
          }
          return requests;
        }).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.match.id - b.match.id);
        for (const { kind, fixture, match, final } of details.slice(0, 6)) {
          if (!(await reserve("datasports-detail-budget", 0, 45)) || !(await reserve("datasports-requests", 0, 90))) break;
          const base = `fixtures/${fixture.id}/${kind}`;
          const detail = kind === "statistics"
            ? fetchDataSports<DataSportsStatistics>(base, dataSportsKey).then(stats => {
              const updatedAt = new Date().toISOString();
              const possession = readDataSportsPossession(stats, updatedAt);
              const telemetry = readDataSportsStatistics(stats, updatedAt, final);
              if (possession) possessionSnapshots.set(match.id, possession);
              if (telemetry) dataSportsStatistics.set(match.id, telemetry);
            })
            : fetchDataSports<DataSportsIncident[]>(base, dataSportsKey).then(events => {
              if (!Array.isArray(events)) return;
              const updatedAt = new Date().toISOString();
              dataSportsEvents.set(match.id, { rows: readDataSportsEvents(events, match, updatedAt), updated_at: updatedAt, final });
            });
          requests.push(detail.catch(() => { warnings.push(`datasportsapi: ${kind} del partido no disponible`); }));
        }
        await Promise.all(requests);
      }
    } catch (error) {
      warnings.push(`datasportsapi: sin acceso a partidos en vivo${error instanceof Error && /^HTTP \d{3}$/.test(error.message) ? ` (${error.message})` : ""}`);
    }
  }

  // Enrich existing fixtures in batches, using the remaining shared daily budget.
  if (apiFootballKey) {
    const storedById = new Map(storedMatches.map(m => [m.id, m]));
    const candidates = matchesToSync.flatMap(match => {
      const previous = storedById.get(match.id)?.live_stats;
      const fixtureId = match.live_stats?.provider_fixture_id ?? previous?.provider_fixture_id;
      const snapshot = previous?.player_stats;
      const checkedAt = previous?.player_stats_checked_at;
      const final = match.status === "FINISHED";
      const live = ["IN_PLAY", "1H", "HT", "2H", "ET", "PEN"].includes(match.status);
      if (!fixtureId || (!final && !live)) return [];
      const hasPossession = previous?.home_possession != null && previous?.away_possession != null;
      if (snapshot?.final && hasPossession) return [];
      if (snapshot && !final && Date.now() - Date.parse(snapshot.updated_at) < 5 * 60_000) return [];
      return [{ match, fixtureId, checkedAt }];
    }).sort((a, b) =>
      Number(b.match.status === "FINISHED") - Number(a.match.status === "FINISHED") ||
      (a.checkedAt ?? "").localeCompare(b.checkedAt ?? "") ||
      b.match.kickoff_at.localeCompare(a.match.kickoff_at)
    ).slice(0, 20);

    try {
      if (candidates.length && await reserve("api-football-player-stats", 300, 5)) {
        const ids = candidates.map(({ fixtureId }) => fixtureId).join("-");
        const response = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${ids}`, {
          headers: { "x-apisports-key": apiFootballKey.trim() },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error(`API-Football HTTP ${response.status}`);
        const body = await response.json();
        if (Object.keys(body.errors ?? {}).length || !Array.isArray(body.response)) throw new Error("Respuesta de estadísticas no disponible");
        for (const fixture of body.response as ApiFootballLiveFixture[]) {
          const candidate = candidates.find(({ fixtureId }) => fixtureId === fixture.fixture.id);
          if (!candidate) continue;
          playerStatsChecked.add(candidate.match.id);
          if (fixture.teams) teamSnapshots.set(candidate.match.id, readTeamTelemetry(fixture));
          const players = readPlayerStats(fixture.players ?? []);
          if (players.length) playerSnapshots.set(candidate.match.id, {
            updated_at: nowIso,
            final: mapApiFootballStatus(fixture.fixture.status.short) === "FINISHED",
            players,
          });
        }
      }
    } catch {
      warnings.push("api-football: estadísticas individuales no disponibles; se conserva la última lectura");
    }
  }

  // ============================================================================
  // 3. MOTOR DE PRONÓSTICOS ALGORÍTMICOS POISSON (30% / 30% / 25% / 15%)
  // ============================================================================
  const standingsByTeamId = new Map<number, StandingRow>();
  const standingsByName = new Map<string, StandingRow>();

  for (const s of standingsToSync) {
    standingsByTeamId.set(s.team_id, s);
    standingsByName.set(s.team_name.toLowerCase(), s);
    if (s.team_short_name) {
      standingsByName.set(s.team_short_name.toLowerCase(), s);
    }
  }

  const predictionsToSync: PredictionRow[] = (standingsToSync.length && matchesSource !== "UNCHANGED" ? matchesToSync.filter(m => m.status === "SCHEDULED" || m.status === "TIMED") : []).map((match) =>
    calculatePoissonMatchPrediction(match, standingsByTeamId, standingsByName)
  );

  // ============================================================================
  // 5. UPSERT ADMINISTRATIVO EN SUPABASE (createAdminClient + SERVICE_ROLE_KEY)
  // ============================================================================
  const upsertSummary = {
    standings: 0,
    matches: 0,
    match_events: 0,
    predictions: 0,
    player_injuries: 0,
    dbStatus: "SYNCED_WITH_SERVICE_ROLE",
  };

  try {
    const adminSupabase = createAdminClient();

    // 5.1 Upsert en public.standings (con qualification_zone válido: OCTAVOS_DIRECTO | PLAYOFFS | ELIMINADO)
    const { error: stErr } = standingsToSync.length ? await adminSupabase
      .from("standings")
      .upsert(standingsToSync, { onConflict: "team_id" }) : { error: null };
    if (!stErr) {
      upsertSummary.standings = standingsToSync.length;
    } else {
      upsertSummary.dbStatus = `Error standings: ${stErr.message}`;
    }

    const existingById = new Map(storedMatches.map(m => [m.id, m]));
    matchesToSync = matchesToSync.map(m => {
      const prev = existingById.get(m.id);
      const hasConfirmedFinal = m.status === "FINISHED" &&
        (apiUpdatedIds.has(m.id) || footballDataScoreIds.has(m.id));
      const dataSports = dataSportsMatches.get(m.id);
      const home = dataSports?.fixture.homeScore?.current;
      const away = dataSports?.fixture.awayScore?.current;
      if (dataSports && !hasConfirmedFinal &&
          (dataSports.status === "FINISHED" || (!apiUpdatedIds.has(m.id) && prev?.status !== "FINISHED")) &&
          typeof home === "number" && Number.isInteger(home) && home >= 0 &&
          typeof away === "number" && Number.isInteger(away) && away >= 0) {
        return { ...m, status: dataSports.status, home_score: home, away_score: away,
          elapsed_minute: null, extra_minute: null, updated_at: nowIso,
          penalty_home_score: dataSports.fixture.homeScore?.penalties ?? m.penalty_home_score,
          penalty_away_score: dataSports.fixture.awayScore?.penalties ?? m.penalty_away_score,
          live_stats: { ...m.live_stats, source: "datasportsapi" as const, source_updated_at: nowIso } };
      }
      if (prev?.status === "FINISHED" && !hasConfirmedFinal) return prev;
      if (prev && ["SCHEDULED", "TIMED"].includes(m.status) &&
          ["IN_PLAY", "1H", "HT", "2H", "ET", "PEN"].includes(prev.status)) return prev;
      if (apiUpdatedIds.has(m.id)) return m; // Authoritative corrections may lower the score (VAR).
      if (prev?.live_stats?.source !== "api-football") return m;

      const snapshotAge = Date.now() - Date.parse(prev.live_stats.source_updated_at ?? prev.updated_at);
      const canUseDelayedScore = snapshotAge > 15 * 60_000 && footballDataScoreIds.has(m.id) && (
        m.status === "FINISHED" ||
        (prev.status !== "FINISHED" && ["IN_PLAY", "HT", "2H", "ET", "PEN"].includes(m.status) &&
          m.home_score >= prev.home_score && m.away_score >= prev.away_score)
      );
      if (canUseDelayedScore) return m;
      return { ...m, status: prev.status, home_score: prev.home_score, away_score: prev.away_score, elapsed_minute: prev.elapsed_minute, extra_minute: prev.extra_minute, live_stats: prev.live_stats, updated_at: prev.updated_at };
    });
    matchesToSync = matchesToSync.map(m => {
      const previous = existingById.get(m.id)?.live_stats;
      const possession = possessionSnapshots.get(m.id) ?? previous?.datasports_possession;
      if (possession) m = { ...m, live_stats: { ...m.live_stats, datasports_possession: possession } };
      const statistics = dataSportsStatistics.get(m.id) ?? previous?.datasports_statistics;
      const incidents = dataSportsEvents.get(m.id) ?? previous?.datasports_events;
      if (statistics || incidents) m = { ...m, live_stats: { ...m.live_stats, datasports_statistics: statistics, datasports_events: incidents } };
      const clock = clockSnapshots.get(m.id) ?? (dataSportsBoardRead ? undefined : previous?.datasports_clock);
      if (clock || m.live_stats?.datasports_clock) {
        m = { ...m, live_stats: { ...m.live_stats, datasports_clock: clock } };
      }
      const fixtureId = m.live_stats?.provider_fixture_id ?? previous?.provider_fixture_id;
      const playerStats = playerSnapshots.get(m.id) ?? previous?.player_stats;
      if (!fixtureId) return m;
      const telemetry = teamSnapshots.get(m.id);
      const previousTelemetry = previous?.source === "api-football" && previous.provider_fixture_id === fixtureId ? previous : undefined;
      const checkedAt = playerStatsChecked.has(m.id) ? nowIso : previous?.player_stats_checked_at;
      return { ...m, live_stats: {
        ...m.live_stats,
        provider_fixture_id: fixtureId,
        ...(m.live_stats?.source === "api-football" ? {
          home_possession: telemetry?.home_possession ?? m.live_stats.home_possession ?? previousTelemetry?.home_possession,
          away_possession: telemetry?.away_possession ?? m.live_stats.away_possession ?? previousTelemetry?.away_possession,
          home_xg: telemetry?.home_xg ?? m.live_stats.home_xg ?? previousTelemetry?.home_xg,
          away_xg: telemetry?.away_xg ?? m.live_stats.away_xg ?? previousTelemetry?.away_xg,
        } : {}),
        ...(playerStats ? { player_stats: playerStats } : {}),
        ...(checkedAt ? { player_stats_checked_at: checkedAt } : {}),
      } };
    });
    matchesToSync = matchesToSync.filter(m => JSON.stringify(m) !== JSON.stringify(existingById.get(m.id)));
    const { error: mErr } = matchesToSync.length ? await adminSupabase
      .from("matches")
      .upsert(matchesToSync, { onConflict: "id" }) : { error: null };
    if (!mErr) {
      upsertSummary.matches = matchesToSync.length;
    } else {
      throw new Error(`Error matches: ${mErr.message}`);
    }

    // Reconcile complete event snapshots atomically, including empty lists after VAR.
    for (const matchId of authoritativeEvents) {
      const rows = [...new Map(eventsToSync.filter(e => e.match_id === matchId).map(e => [e.id, e])).values()];
      const { error } = await adminSupabase.rpc("replace_match_events", { target_match_id: matchId, snapshot: rows });
      if (error) throw error;
      upsertSummary.match_events += rows.length;
    }
    // 5.4 Upsert en public.predictions (Modelo Poisson 30/30/25/15 para los 144 partidos)
    const { error: predErr } = predictionsToSync.length ? await adminSupabase
      .from("predictions")
      .upsert(predictionsToSync, { onConflict: "match_id" }) : { error: null };
    if (!predErr) {
      upsertSummary.predictions = predictionsToSync.length;
    }

  } catch (err) {
    upsertSummary.dbStatus =
      err instanceof Error
        ? `Procesado en servidor (${err.message})`
        : "Procesado en memoria";
  }

  return NextResponse.json({
    ok: upsertSummary.dbStatus === "SYNCED_WITH_SERVICE_ROLE",
    syncedAt: nowIso,
    currentMatchdayCompleted: currentMatchdayFromApi,
    warnings,
    nextMatchday: currentMatchdayFromApi == null ? null : currentMatchdayFromApi + 1,
    sources: {
      standings: standingsSource,
      matches: matchesSource,
      liveFixtures: liveFixturesSource,
      injuries: injuriesSource,
      predictionsModel:
        "Poisson Bivariado (30% Reciente, 30% Stats/xG, 25% Jerarquía UEFA, 15% H2H/Localía)",
    },
    upserted: upsertSummary,
  }, { status: upsertSummary.dbStatus === "SYNCED_WITH_SERVICE_ROLE" ? 200 : 503 });
}

export async function GET(request: NextRequest) {
  return handleChampionsSync(request);
}

export async function POST(request: NextRequest) {
  return handleChampionsSync(request);
}
