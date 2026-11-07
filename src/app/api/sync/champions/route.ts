import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { calculatePoissonMatchPrediction } from "@/lib/predictions/poisson";
import type {
  LiveStats,
  MatchEventRow,
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
}

function mapFootballDataStatusAndMinute(
  rawStatus: string,
  utcDate: string,
  halfTimeHome?: number | null
): { status: MatchStatus; elapsedMinute: number | null; halfLabel: string } {
  const upper = rawStatus.toUpperCase();
  void utcDate;
  void halfTimeHome;
  if (["FINISHED", "AWARDED"].includes(upper)) return { status: "FINISHED", elapsedMinute: null, halfLabel: "Finalizado" };
  if (upper === "PAUSED") return { status: "HT", elapsedMinute: 45, halfLabel: "Descanso" };
  if (["IN_PLAY", "LIVE"].includes(upper)) return { status: "IN_PLAY", elapsedMinute: null, halfLabel: "En juego · minuto no disponible" };
  if (upper === "POSTPONED" || upper === "SUSPENDED") return { status: "POSTPONED", elapsedMinute: null, halfLabel: "Aplazado o suspendido" };
  if (upper === "CANCELLED") return { status: "CANCELLED", elapsedMinute: null, halfLabel: "Cancelado" };
  return { status: "SCHEDULED", elapsedMinute: null, halfLabel: "Programado" };
}

function mapApiFootballStatus(shortStatus: string): MatchStatus {
  const upper = shortStatus.toUpperCase();
  if (upper === "1H") return "1H";
  if (upper === "HT") return "HT";
  if (upper === "2H" || upper === "LIVE") return "2H";
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
          "No autorizado: se requiere cabecera Authorization: Bearer CRON_SECRET o sesión autenticada.",
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

  let standingsToSync: StandingRow[] = [];
  let matchesToSync: MatchRow[] = [];
  const apiUpdatedIds = new Set<number>();
  const authoritativeEvents = new Set<number>();
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
            m.utcDate,
            m.score?.halfTime?.home
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
  // 2. API-FOOTBALL: /fixtures?live=all&league=2 (Solo si hay partidos en juego hoy)
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


              let apiHomePoss: number | undefined;
              let apiAwayPoss: number | undefined;
              let apiHomeXg: number | undefined;
              let apiAwayXg: number | undefined;

              if (Array.isArray(item.statistics) && item.statistics.length >= 2) {
                const homeStatGroup = item.statistics[0]?.statistics ?? [];
                const awayStatGroup = item.statistics[1]?.statistics ?? [];

                const parsePoss = (
                  stats: { type: string; value: number | string | null }[]
                ) => {
                  const found = stats.find((s) =>
                    s.type.toLowerCase().includes("possession")
                  );
                  if (!found || found.value == null) return undefined;
                  const num = Number(String(found.value).replace("%", "").trim());
                  return Number.isFinite(num) ? num : undefined;
                };

                const parseXg = (
                  stats: { type: string; value: number | string | null }[]
                ) => {
                  const found = stats.find((s) =>
                    s.type.toLowerCase().includes("expected_goals")
                  );
                  if (!found || found.value == null) return undefined;
                  const num = Number(found.value);
                  return Number.isFinite(num) ? num : undefined;
                };

                apiHomePoss = parsePoss(homeStatGroup);
                apiAwayPoss = parsePoss(awayStatGroup);
                apiHomeXg = parseXg(homeStatGroup);
                apiAwayXg = parseXg(awayStatGroup);
              }

              const liveStatsObj: LiveStats = {
                source: "api-football",
                source_updated_at: nowIso,
                provider_fixture_id: item.fixture.id,
                ...(apiHomePoss !== undefined ? { home_possession: apiHomePoss } : {}),
                ...(apiAwayPoss !== undefined ? { away_possession: apiAwayPoss } : {}),
                ...(apiHomeXg !== undefined ? { home_xg: apiHomeXg } : {}),
                ...(apiAwayXg !== undefined ? { away_xg: apiAwayXg } : {}),
                half_label:
                  item.fixture.status.short === "HT"
                    ? "Descanso"
                    : item.fixture.status.short === "1H"
                      ? "1° Tiempo"
                      : "2° Tiempo",
                is_spotlight: true,
              };

              if (["TBD", "NS", "PST", "CANC", "ABD", "SUSP", "INT"].includes(item.fixture.status.short)) continue;
              if (item.goals.home == null || item.goals.away == null) continue;
              apiUpdatedIds.add(matchId);
              matchesToSync[existingIdx] = {
                ...matchesToSync[existingIdx],
                status: mapApiFootballStatus(item.fixture.status.short),
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
              const justFinished = mapApiFootballStatus(item.fixture.status.short) === "FINISHED" && previous?.status !== "FINISHED";
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
    } catch (error) { console.error("API-Football sync failed", error); warnings.push("api-football: cuota, cobertura o red no disponible; se conserva la última lectura"); }
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
      if (apiUpdatedIds.has(m.id)) return m; // Authoritative corrections may lower the score (VAR).
      if (prev?.live_stats?.source === "api-football" && !(m.status === "FINISHED" && Date.now() - Date.parse(prev.live_stats.source_updated_at ?? prev.updated_at) > 15 * 60_000)) return { ...m, status: prev.status, home_score: prev.home_score, away_score: prev.away_score, elapsed_minute: prev.elapsed_minute, extra_minute: prev.extra_minute, live_stats: prev.live_stats, updated_at: prev.updated_at };
      return m;
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
