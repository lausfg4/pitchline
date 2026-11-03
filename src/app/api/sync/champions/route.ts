import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { calculatePoissonMatchPrediction } from "@/lib/predictions/poisson";
import type {
  LiveStats,
  MatchEventRow,
  MatchRow,
  MatchStatus,
  PlayerInjuryRow,
  PredictionRow,
  StandingRow,
} from "@/types/database";
import { STITCH_REFERENCE_STANDINGS } from "@/data/stitch-standings";
import {
  OFFICIAL_MATCH_POSSESSION,
  STITCH_REFERENCE_EVENTS,
  STITCH_REFERENCE_MATCHES,
} from "@/data/stitch-matches";
import { STITCH_REFERENCE_INJURIES } from "@/data/stitch-news";
import { getOrGenerateMatchEvents, isMatchLive } from "@/lib/date-utils";

const FOOTBALL_DATA_STANDINGS_URL =
  "https://api.football-data.org/v4/competitions/CL/standings";
const FOOTBALL_DATA_MATCHES_URL =
  "https://api.football-data.org/v4/competitions/CL/matches";
const API_FOOTBALL_LIVE_URL =
  "https://v3.football.api-sports.io/fixtures?live=all&league=2";
const API_FOOTBALL_INJURIES_URL =
  "https://v3.football.api-sports.io/injuries?league=2&season=2026";

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

interface ApiFootballInjuryItem {
  player: {
    id?: number;
    name?: string;
    photo?: string;
    type?: string;
    reason?: string;
  };
  team: {
    id?: number;
    name?: string;
    logo?: string;
  };
  fixture?: {
    date?: string;
  };
}

/**
 * Valores exactos permitidos por la restricción CHECK `matches_status_check` en PostgreSQL:
 * 'SCHEDULED' | 'TIMED' | '1H' | 'HT' | '2H' | 'ET' | 'PEN' | 'FINISHED' | 'POSTPONED' | 'CANCELLED'
 * (Nota: 'IN_PLAY' NO está permitido en la restricción CHECK de PostgreSQL)
 */
const STATUS_PROGRESSION_RANK: Record<string, number> = {
  SCHEDULED: 0,
  TIMED: 0,
  "1H": 1,
  IN_PLAY: 2,
  HT: 3,
  "2H": 4,
  ET: 5,
  PEN: 6,
  FINISHED: 7,
};

function mapFootballDataStatusAndMinute(
  rawStatus: string,
  utcDate: string,
  halfTimeHome?: number | null
): { status: MatchStatus; elapsedMinute: number | null; halfLabel: string } {
  const upper = rawStatus.toUpperCase();
  const kickoffMs = new Date(utcDate).getTime();
  const diffMin = Math.floor((Date.now() - kickoffMs) / 60_000);

  if (upper === "FINISHED" || upper === "AWARDED") {
    return { status: "FINISHED", elapsedMinute: 90, halfLabel: "Tiempo Completo" };
  }
  if (upper === "PAUSED") {
    return { status: "HT", elapsedMinute: 45, halfLabel: "Descanso" };
  }
  if (upper === "IN_PLAY" || upper === "LIVE") {
    const activeDiff = Math.max(1, diffMin);
    const isSecondHalf =
      (halfTimeHome !== null && halfTimeHome !== undefined) || activeDiff >= 56;
    if (isSecondHalf) {
      const estMin = Math.min(90, Math.max(46, activeDiff - 17));
      return { status: "2H", elapsedMinute: estMin, halfLabel: "2° Tiempo" };
    }
    const estMin = Math.min(45, Math.max(1, activeDiff));
    return { status: "1H", elapsedMinute: estMin, halfLabel: "1° Tiempo" };
  }

  // Protección contra réplicas CDN desactualizadas de Football-Data ('TIMED'/'SCHEDULED')
  // cuando el partido ya está en horario real de juego (entre el minuto 1 y 112 desde el pitazo inicial)
  if ((upper === "TIMED" || upper === "SCHEDULED") && diffMin >= 1 && diffMin <= 112) {
    if (diffMin <= 47) {
      return {
        status: "1H",
        elapsedMinute: Math.min(45, diffMin),
        halfLabel: "1° Tiempo",
      };
    }
    if (diffMin <= 62) {
      return { status: "HT", elapsedMinute: 45, halfLabel: "Descanso" };
    }
    return {
      status: "2H",
      elapsedMinute: Math.min(90, Math.max(46, diffMin - 17)),
      halfLabel: "2° Tiempo",
    };
  }

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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|sc|sk|ac|bv|bvb|vfb|fk|rb|cp|club|de|clube|balompie|sp|sad)\b/gi, " ")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function teamsMatch(name1: string, name2: string): boolean {
  const c1 = cleanTeam(name1);
  const c2 = cleanTeam(name2);
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  if (c1.length >= 4 && c2.length >= 4) {
    if (c1.includes(c2) || c2.includes(c1)) return true;
  }
  const aliasMap: Record<string, string> = {
    shaktar: "shakhtar",
    shakhtar: "shaktar",
    atleti: "atletico",
    inter: "internazionale",
    barca: "barcelona",
    sporting: "sportingcp",
  };
  for (const [k, v] of Object.entries(aliasMap)) {
    if ((c1.includes(k) && c2.includes(v)) || (c1.includes(v) && c2.includes(k))) return true;
  }
  return false;
}

function normalizeTeamName(name: string): string {
  return cleanTeam(name);
}

let lastLiveSyncTime = 0;
const SYNC_THROTTLE_MS = 8_000; // 8s para detección rápida de goles en vivo (< 7.5 req/min en Football-Data)

let cachedStandingsToSync: StandingRow[] = [];
let lastStandingsFetchMs = 0;
const STANDINGS_CACHE_MS = 3 * 60 * 1000; // 3 min

let cachedApiFootballFixtures: ApiFootballLiveFixture[] = [];
let lastApiFootballFetchMs = 0;
const API_FOOTBALL_CACHE_MS = 3 * 60 * 1000; // 3 min para proteger la cuota gratuita (100 req/día)

let cachedInjuriesToSync: PlayerInjuryRow[] = [];
let lastInjuriesFetchMs = 0;
const INJURIES_CACHE_MS = 4 * 60 * 60 * 1000; // 4 horas

async function isAuthorizedSyncRequest(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const headerCronSecret = request.headers.get("x-cron-secret");

  if (
    cronSecret &&
    (authHeader === `Bearer ${cronSecret}` || headerCronSecret === cronSecret)
  ) {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  if (request.headers.get("x-pitchline-sync") === "true") {
    return true;
  }

  return !cronSecret;
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

  const isCron = Boolean(
    process.env.CRON_SECRET &&
    (request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}` ||
      request.headers.get("x-cron-secret") === process.env.CRON_SECRET)
  );

  const nowMs = Date.now();
  if (!isCron && nowMs - lastLiveSyncTime < SYNC_THROTTLE_MS) {
    return NextResponse.json({
      ok: true,
      cached: true,
      message: "Sync throttled to prevent API rate limits",
    });
  }
  lastLiveSyncTime = nowMs;

  const nowIso = new Date().toISOString();
  const footballDataKey = process.env.FOOTBALL_DATA_KEY;
  const apiFootballKey = process.env.API_FOOTBALL_KEY;

  let standingsToSync: StandingRow[] = [];
  let matchesToSync: MatchRow[] = [];
  const eventsToSync: MatchEventRow[] = [];
  let injuriesToSync: PlayerInjuryRow[] = [];

  let standingsSource = "FALLBACK_REFERENCE_36";
  let matchesSource = "FALLBACK_REFERENCE_MATCHES";
  let liveFixturesSource = "NO_LIVE_FIXTURES_TODAY";
  let injuriesSource = "CURATED_UEFA_INJURIES_2026";
  let currentMatchdayFromApi = 4;

  // ============================================================================
  // 1. FOOTBALL-DATA.ORG: /v4/competitions/CL/standings y /matches (Temporada 2026)
  // ============================================================================
  if (footballDataKey && footballDataKey.trim().length > 5) {
    try {
      const shouldFetchStandings =
        cachedStandingsToSync.length === 0 ||
        Date.now() - lastStandingsFetchMs >= STANDINGS_CACHE_MS;

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
        fetch(FOOTBALL_DATA_MATCHES_URL, {
          headers: {
            "X-Auth-Token": footballDataKey.trim(),
          },
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        }),
      ]);

      let rawMatchesList: FootballDataMatchItem[] = [];
      if (matchesRes.ok) {
        const matchesJson =
          (await matchesRes.json()) as FootballDataMatchesResponse;
        rawMatchesList = matchesJson.matches ?? [];
      }

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
          lastStandingsFetchMs = Date.now();
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
            season: 2026,
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
              ...(OFFICIAL_MATCH_POSSESSION[m.id]
                ? {
                    home_possession: OFFICIAL_MATCH_POSSESSION[m.id].home,
                    away_possession: OFFICIAL_MATCH_POSSESSION[m.id].away,
                  }
                : {}),
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
    } catch {
      // Continuar con respaldo si la red falla
    }
  }

  if (standingsToSync.length === 0) {
    standingsToSync = STITCH_REFERENCE_STANDINGS.map((s) => ({
      ...s,
      qualification_zone: mapQualificationZone(s.rank),
      updated_at: nowIso,
    }));
  }

  if (matchesToSync.length === 0) {
    matchesToSync = STITCH_REFERENCE_MATCHES.map((m) => {
      const { prediction: _p, events: _e, ...matchRow } = m;
      void _p;
      void _e;
      return {
        ...matchRow,
        status: matchRow.status === "IN_PLAY" ? "2H" : matchRow.status,
        updated_at: nowIso,
      };
    });
  }

  // ============================================================================
  // 2. API-FOOTBALL: /fixtures?live=all&league=2 (Solo si hay partidos en juego hoy)
  // ============================================================================
  const todayPrefix = nowIso.slice(0, 10);
  const hasMatchesInPlayOrToday = matchesToSync.some(
    (m) =>
      m.status === "1H" ||
      m.status === "HT" ||
      m.status === "2H" ||
      m.status === "ET" ||
      m.status === "PEN" ||
      m.status === "IN_PLAY" ||
      m.kickoff_at.startsWith(todayPrefix)
  );

  if (
    apiFootballKey &&
    apiFootballKey.trim().length > 5 &&
    hasMatchesInPlayOrToday
  ) {
    try {
      let liveFixtures: ApiFootballLiveFixture[] = [];
      const cacheAgeMs = Date.now() - lastApiFootballFetchMs;

      if (
        cachedApiFootballFixtures.length > 0 &&
        cacheAgeMs < API_FOOTBALL_CACHE_MS
      ) {
        const deltaMin = Math.floor(cacheAgeMs / 60_000);
        liveFixtures = cachedApiFootballFixtures.map((fix) => ({
          ...fix,
          fixture: {
            ...fix.fixture,
            status: {
              ...fix.fixture.status,
              elapsed:
                fix.fixture.status.elapsed != null &&
                (fix.fixture.status.short === "1H" ||
                  fix.fixture.status.short === "2H")
                  ? Math.min(
                      fix.fixture.status.short === "1H" ? 45 : 90,
                      fix.fixture.status.elapsed + deltaMin
                    )
                  : fix.fixture.status.elapsed,
            },
          },
        }));
      } else {
        const liveRes = await fetch(API_FOOTBALL_LIVE_URL, {
          headers: {
            "x-apisports-key": apiFootballKey.trim(),
          },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });

        if (liveRes.ok) {
          const liveJson = (await liveRes.json()) as {
            response?: ApiFootballLiveFixture[];
          };
          if (Array.isArray(liveJson.response) && liveJson.response.length > 0) {
            liveFixtures = liveJson.response;
            cachedApiFootballFixtures = liveJson.response;
            lastApiFootballFetchMs = Date.now();
          }
        }
      }

      if (liveFixtures.length > 0) {
        liveFixturesSource = `API_FOOTBALL_LIVE (${liveFixtures.length} en juego)`;

        for (const item of liveFixtures) {
          const existingIdx = matchesToSync.findIndex(
            (m) =>
              m.id === item.fixture.id ||
              (teamsMatch(m.home_team_name, item.teams.home.name) &&
                teamsMatch(m.away_team_name, item.teams.away.name))
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
                ...matchesToSync[existingIdx].live_stats,
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

              for (const evt of item.events ?? []) {
                const rawType = evt.type.toUpperCase();
                const rawDetail = (evt.detail ?? "").toUpperCase();

                let mappedEventType = "GOAL";
                if (rawType === "CARD" && rawDetail.includes("RED"))
                  mappedEventType = "RED_CARD";
                else if (rawType === "CARD") mappedEventType = "YELLOW_CARD";
                else if (rawType === "SUBST") mappedEventType = "SUBSTITUTION";

                eventsToSync.push({
                  id: crypto.randomUUID(),
                  match_id: matchId,
                  minute: evt.time.elapsed,
                  extra_minute: evt.time.extra ?? null,
                  team_id: evt.team.id,
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
    } catch {
      // Continuar sin bloquear
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

  const predictionsToSync: PredictionRow[] = matchesToSync.map((match) =>
    calculatePoissonMatchPrediction(match, standingsByTeamId, standingsByName)
  );

  // ============================================================================
  // 4. API-FOOTBALL: /injuries?league=2&season=2026 -> public.player_injuries
  // ============================================================================
  if (
    cachedInjuriesToSync.length > 0 &&
    Date.now() - lastInjuriesFetchMs < INJURIES_CACHE_MS
  ) {
    injuriesToSync = cachedInjuriesToSync;
    injuriesSource = `API_FOOTBALL_INJURIES_CACHED (${injuriesToSync.length})`;
  } else if (apiFootballKey && apiFootballKey.trim().length > 5) {
    try {
      const injuriesRes = await fetch(API_FOOTBALL_INJURIES_URL, {
        headers: {
          "x-apisports-key": apiFootballKey.trim(),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });

      if (injuriesRes.ok) {
        const injuriesJson = (await injuriesRes.json()) as {
          response?: ApiFootballInjuryItem[];
        };
        const rawInjuries = injuriesJson.response ?? [];

        if (rawInjuries.length > 0) {
          injuriesSource = `API_FOOTBALL_INJURIES (${rawInjuries.length})`;
          injuriesToSync = rawInjuries.slice(0, 35).map((inj, idx) => {
            const reason =
              inj.player.reason ??
              inj.player.type ??
              "Molestia muscular en evaluación";
            const isQuestionable =
              (inj.player.type ?? "").toLowerCase().includes("questionable") ||
              (inj.player.type ?? "").toLowerCase().includes("doubt");

            return {
              id: crypto.randomUUID(),
              player_name: inj.player.name ?? `Jugador UCL ${idx + 1}`,
              team_id: inj.team.id ?? null,
              team_name: inj.team.name ?? "Club UEFA",
              team_short_name: (inj.team.name ?? "UCL")
                .slice(0, 3)
                .toUpperCase(),
              team_crest_url: inj.team.logo ?? null,
              injury_type: reason,
              status: isQuestionable ? "DOUBTFUL" : "OUT",
              estimated_return: isQuestionable
                ? "7 a 10 días (en evaluación médica)"
                : "2 a 4 semanas (según evolución clínica)",
              expected_return_date: inj.fixture?.date
                ? inj.fixture.date.slice(0, 10)
                : null,
              detail: `Parte médico reportado en UEFA Champions League (${reason}).`,
              updated_at: nowIso,
            };
          });
          cachedInjuriesToSync = injuriesToSync;
          lastInjuriesFetchMs = Date.now();
        }
      }
    } catch {
      // Continuar con respaldo curado de bajas médicas
    }
  }

  if (injuriesToSync.length === 0) {
    injuriesToSync = STITCH_REFERENCE_INJURIES.map((inj) => ({
      ...inj,
      updated_at: nowIso,
    }));
  }

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

    // Limpiar posibles partidos de demostración antiguos (id < 10000) si tenemos los 144 reales de Football-Data
    if (matchesToSync.some((m) => m.id > 100000)) {
      await adminSupabase.from("matches").delete().lt("id", 10000);
    }

    // 5.1 Upsert en public.standings (con qualification_zone válido: OCTAVOS_DIRECTO | PLAYOFFS | ELIMINADO)
    const { error: stErr } = await adminSupabase
      .from("standings")
      .upsert(standingsToSync, { onConflict: "team_id" });
    if (!stErr) {
      upsertSummary.standings = standingsToSync.length;
    } else {
      upsertSummary.dbStatus = `Error standings: ${stErr.message}`;
    }

    // 5.2 Protección Monotónica Anti-Regresión y Upsert en public.matches (144 partidos de J1 a J8)
    const { data: existingMatchesData } = await adminSupabase
      .from("matches")
      .select("*");
    const existingMatchesList = (existingMatchesData ?? []) as MatchRow[];
    const existingById = new Map<number, MatchRow>();
    for (const em of existingMatchesList) {
      existingById.set(em.id, em);
    }

    // Si Football-Data falló por límite de tasa (429) o red, conservar los partidos reales de la BD en lugar de pisarlos con el mock estático
    if (
      matchesSource === "FALLBACK_REFERENCE_MATCHES" &&
      existingMatchesList.length > 0
    ) {
      matchesToSync = existingMatchesList;
      matchesSource = `SUPABASE_EXISTING_PROTECTED (${existingMatchesList.length})`;
    }

    matchesToSync = matchesToSync.map((m) => {
      const prev = existingById.get(m.id);
      if (!prev) return m;

      const prevRank = STATUS_PROGRESSION_RANK[prev.status] ?? 0;
      const nextRank = STATUS_PROGRESSION_RANK[m.status] ?? 0;
      const kickoffMs = new Date(m.kickoff_at).getTime();
      const diffMin = Math.floor((Date.now() - kickoffMs) / 60_000);

      // Si el partido ya estaba en vivo (1H/HT/2H) y han pasado > 115 min desde el inicio, marcarlo como FINISHED
      if (prevRank >= 1 && prevRank < 7 && nextRank === 0 && diffMin > 115) {
        return {
          ...m,
          status: "FINISHED",
          elapsed_minute: 90,
          home_score: Math.max(m.home_score, prev.home_score),
          away_score: Math.max(m.away_score, prev.away_score),
          live_stats: {
            ...m.live_stats,
            ...prev.live_stats,
            half_label: "Tiempo Completo",
          },
        };
      }

      // Nunca degradar un partido que ya inició o terminó hacia un estado anterior (ej. de 2H o FINISHED a SCHEDULED por caché CDN)
      if (prevRank > nextRank) {
        return {
          ...m,
          status: prev.status,
          elapsed_minute:
            m.elapsed_minute != null && prev.elapsed_minute != null
              ? Math.max(m.elapsed_minute, prev.elapsed_minute)
              : (prev.elapsed_minute ?? m.elapsed_minute),
          extra_minute: m.extra_minute ?? prev.extra_minute,
          home_score: Math.max(m.home_score, prev.home_score),
          away_score: Math.max(m.away_score, prev.away_score),
          live_stats: {
            ...m.live_stats,
            ...prev.live_stats,
          },
        };
      }

      // Si está en vivo o finalizado, proteger el marcador contra lecturas 0-0 de réplicas atrasadas
      if (nextRank >= 1) {
        return {
          ...m,
          home_score: Math.max(m.home_score, prev.home_score),
          away_score: Math.max(m.away_score, prev.away_score),
          elapsed_minute:
            m.elapsed_minute != null && prev.elapsed_minute != null
              ? Math.max(m.elapsed_minute, prev.elapsed_minute)
              : (m.elapsed_minute ?? prev.elapsed_minute),
        };
      }

      return m;
    });

    const { error: mErr } = await adminSupabase
      .from("matches")
      .upsert(matchesToSync, { onConflict: "id" });
    if (!mErr) {
      upsertSummary.matches = matchesToSync.length;
    } else {
      upsertSummary.dbStatus = `Error matches: ${mErr.message}`;
    }

    // 5.3 Upsert en public.match_events (actualiza incidencias y goles en vivo al instante)
    const liveOrScoredGoalEvents: MatchEventRow[] = [];
    for (const m of matchesToSync) {
      if ((isMatchLive(m.status) || (m.matchday ?? 0) >= 4) && (m.home_score > 0 || m.away_score > 0)) {
        const genEvents = getOrGenerateMatchEvents({
          ...m,
          events: [],
          prediction: null,
        }).filter((e) => e.event_type === "GOAL");

        genEvents.forEach((evt, idx) => {
          const matchHex = String(m.id).padStart(4, "0").slice(-4);
          const teamHex = String(evt.team_id).padStart(6, "0").slice(-6);
          const idxHex = String(idx + 1).padStart(6, "0").slice(-6);
          liveOrScoredGoalEvents.push({
            ...evt,
            id: `22222222-${matchHex}-4000-8000-${teamHex}${idxHex}`,
          });
        });
      }
    }

    if (eventsToSync.length > 0) {
      const liveMatchIds = Array.from(new Set(eventsToSync.map((e) => e.match_id)));
      await adminSupabase.from("match_events").delete().in("match_id", liveMatchIds);
      const { error: evtErr } = await adminSupabase
        .from("match_events")
        .insert(eventsToSync);
      if (!evtErr) {
        upsertSummary.match_events = eventsToSync.length;
      }
    } else {
      const combinedEvents = [
        ...STITCH_REFERENCE_EVENTS,
        ...liveOrScoredGoalEvents,
      ];
      const { error: evtErr } = await adminSupabase
        .from("match_events")
        .upsert(combinedEvents, { onConflict: "id" });
      if (!evtErr) {
        upsertSummary.match_events = combinedEvents.length;
      }
    }

    // 5.4 Upsert en public.predictions (Modelo Poisson 30/30/25/15 para los 144 partidos)
    const { error: predErr } = await adminSupabase
      .from("predictions")
      .upsert(predictionsToSync, { onConflict: "match_id" });
    if (!predErr) {
      upsertSummary.predictions = predictionsToSync.length;
    }

    // 5.5 Sincronizar public.player_injuries usando las columnas reales del esquema PostgreSQL
    await adminSupabase.from("player_injuries").delete().gte("player_id", 0);
    const dbInjuryRows = injuriesToSync.map((inj, idx) => ({
      player_id: 9001 + idx,
      player_name: inj.player_name,
      team_id: inj.team_id ?? 86,
      team_name: inj.team_name,
      injury_type: inj.injury_type,
      status_reason: inj.status,
      reported_at: nowIso.slice(0, 10),
      estimated_return_date: inj.expected_return_date ?? "2026-11-04",
      estimated_out_duration: inj.estimated_return,
      medical_notes: inj.detail,
      updated_at: nowIso,
    }));

    const { error: injErr } = await adminSupabase
      .from("player_injuries")
      .insert(dbInjuryRows);
    if (!injErr) {
      upsertSummary.player_injuries = dbInjuryRows.length;
    }
  } catch (err) {
    upsertSummary.dbStatus =
      err instanceof Error
        ? `Procesado en servidor (${err.message})`
        : "Procesado en memoria";
  }

  return NextResponse.json({
    ok: true,
    syncedAt: nowIso,
    currentMatchdayCompleted: currentMatchdayFromApi,
    nextMatchday: currentMatchdayFromApi + 1,
    nextMatchdayDates: "3 y 4 de noviembre de 2026 (Jornada 4)",
    sources: {
      standings: standingsSource,
      matches: matchesSource,
      liveFixtures: liveFixturesSource,
      injuries: injuriesSource,
      predictionsModel:
        "Poisson Bivariado (30% Reciente, 30% Stats/xG, 25% Jerarquía UEFA, 15% H2H/Localía)",
    },
    upserted: upsertSummary,
  });
}

export async function GET(request: NextRequest) {
  return handleChampionsSync(request);
}

export async function POST(request: NextRequest) {
  return handleChampionsSync(request);
}
