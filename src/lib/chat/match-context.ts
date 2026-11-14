import { getVerifiedMatchEvents } from "@/lib/date-utils";
import type { MatchEventRow, MatchRow, StandingRow } from "@/types/database";

const aliases = [
  ["real madrid", "madrid", "los blancos"],
  ["atletico", "atleti"],
  ["barcelona", "barca", "barca blaugrana"],
  ["paris saint germain", "psg"],
  ["manchester city", "man city", "city"],
  ["manchester united", "man united", "man utd"],
  ["bayern", "bayern munich", "bayern munchen"],
  ["inter", "internazionale"],
  ["borussia dortmund", "dortmund", "bvb"],
];

export function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function mentions(text: string, name: string) {
  return !!name && ` ${text} `.includes(` ${name} `);
}

export function selectMatchContext(
  matches: MatchRow[],
  standings: StandingRow[],
  question: string,
  history: string[],
) {
  const current = normalize(question);
  const earlier = history.map(normalize).reverse();
  const teamNames = new Map(standings.map(team => [team.team_id, team.team_short_name]));
  const namesForTeam = (name: string, teamId: number) => {
    const full = normalize(name);
    const short = normalize(teamNames.get(teamId) ?? "");
    return [full, short, full.replace(/\b(fc|cf|ac|sc|fk)\b/g, "").replace(/\s+/g, " ").trim(),
      ...aliases.filter(group => mentions(full, group[0]) ||
        group.some(alias => alias === full || (alias !== "city" && alias === short))).flat()];
  };
  const clubs = new Map<number, Set<string>>();
  const clubNames = new Map<number, string>();
  function addClub(id: number, name: string) {
    const names = clubs.get(id) ?? new Set<string>();
    namesForTeam(name, id).forEach(alias => names.add(alias));
    clubs.set(id, names);
    clubNames.set(id, name);
  }
  for (const match of matches) {
    addClub(match.home_team_id, match.home_team_name);
    addClub(match.away_team_id, match.away_team_name);
  }
  for (const club of standings) addClub(club.team_id, club.team_name);

  function mentionedClubs(query: string) {
    let text = normalize(query);
    // “¿Cómo quedó...?” must not resolve to Como 1907.
    text = text.replace(/^como (?=qued\w*|jug\w*|va\b|fue\b|le\b|est\w*)/, "");
    const hits = [...clubs].flatMap(([id, names]) =>
      [...names].filter(name => mentions(text, name)).map(name => ({ id, name })));
    return [...new Set(hits.filter(hit => !hits.some(other =>
      other.id !== hit.id && other.name.length > hit.name.length && mentions(other.name, hit.name)
    )).map(hit => hit.id))];
  }
  const explicitClubs = mentionedClubs(question);
  const general = /\b(todos los (equipos|partidos)|jornada completa|en general)\b/.test(current);
  const scopedClubs = explicitClubs.length ? explicitClubs : general ? [] :
    history.slice().reverse().map(mentionedClubs).find(ids => ids.length) ?? [];
  const scopedMatches = matches.filter(match => !scopedClubs.length ||
    scopedClubs.includes(match.home_team_id) || scopedClubs.includes(match.away_team_id));
  const lastPlayed = /\b(ultim[oa]s?|recient\w*)\b/.test(current);
  const nextGame = /\bproxim[oa]s?\b/.test(current);
  const eligibleMatches = scopedMatches.filter(match => !scopedClubs.length ||
    (!lastPlayed || match.status === "FINISHED") &&
    (!nextGame || ["SCHEDULED", "TIMED"].includes(match.status)));
  const getScore = (match: MatchRow, text: string) => {
    const namedPlayer = match.live_stats?.player_stats?.players.some(player => {
      const name = normalize(player.name);
      return mentions(text, name) || name.split(" ").some(part => part.length >= 4 && mentions(text, part));
    });
    const matchday = text.match(/\b(?:jornada|fecha) (\d+)\b/);
    const date = text.match(/\b\d{4} \d{2} \d{2}\b/);
    if ((matchday && match.matchday !== Number(matchday[1])) ||
        (date && normalize(match.kickoff_at.slice(0, 10)) !== date[0])) return -100;
    return (namedPlayer ? 8 : 0) + (matchday || date ? 4 : 0);
  };

  const priorReference = !explicitClubs.length && !general && !lastPlayed && !nextGame
    ? earlier.find(text => eligibleMatches.some(match => getScore(match, text) > 0))
    : undefined;
  const ranked = eligibleMatches.map(match => {
    const score = getScore(match, current);
    const inherited = priorReference ? Math.max(0, getScore(match, priorReference)) : 0;
    const clubsInMatch = [match.home_team_id, match.away_team_id].filter(id => scopedClubs.includes(id)).length;
    return { match, score: score < 0 ? score : score * 2 + clubsInMatch * 12 + inherited / (score ? 8 : 1) };
  }).sort((a, b) => b.score - a.score ||
    Number(b.match.status === "FINISHED") - Number(a.match.status === "FINISHED") ||
    (nextGame ? a.match.kickoff_at.localeCompare(b.match.kickoff_at) : b.match.kickoff_at.localeCompare(a.match.kickoff_at)));

  const relevant = ranked.filter(row => row.score > 0);
  const singleLatest = scopedClubs.length === 1 && (lastPlayed || nextGame) &&
    !/\b(partidos|resultados|ultimos|ultimas|proximos|proximas)\b/.test(current);
  const recent = scopedMatches.filter(m => m.status === "FINISHED").slice(0, 18);
  const live = scopedMatches.filter(m => ["IN_PLAY", "1H", "HT", "2H", "ET", "PEN"].includes(m.status));
  const upcoming = scopedMatches.filter(m => ["SCHEDULED", "TIMED"].includes(m.status))
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at)).slice(0, 18);
  return {
    detailed: relevant.length ? relevant.slice(0, singleLatest ? 1 : 18).map(row => row.match) :
      scopedClubs.length ? [] : [...live, ...recent].slice(0, 24),
    focused: relevant[0]?.match,
    scopedClubs,
    clubNames: scopedClubs.map(id => clubNames.get(id)),
    ambiguous: !!relevant[1] && relevant[0].score === relevant[1].score &&
      !/\b(ultim\w*|recient\w*|proxim\w*)\b/.test(current) &&
      relevant[0].match.status === relevant[1].match.status,
    recent: singleLatest && lastPlayed ? recent.slice(0, 1) : recent,
    live,
    upcoming: singleLatest && nextGame ? upcoming.slice(0, 1) : upcoming,
  };
}

export function describeMatch(match: MatchRow) {
  const hasScore = !["SCHEDULED", "TIMED", "POSTPONED", "CANCELLED"].includes(match.status);
  return {
    partido: `${match.home_team_name} vs. ${match.away_team_name}`,
    fecha_utc: match.kickoff_at,
    fase: match.stage,
    jornada: match.matchday,
    temporada: match.season,
    estado: match.status,
    marcador: hasScore ? `${match.home_score}-${match.away_score}` : undefined,
    minuto: match.elapsed_minute,
    penales: match.penalty_home_score != null ? `${match.penalty_home_score}-${match.penalty_away_score}` : undefined,
    actualizacion: match.updated_at,
    estadio: match.venue,
  };
}

export function describeMatchEvents(match: MatchRow, events: MatchEventRow[]) {
  return getVerifiedMatchEvents({ ...match, events }).map(event => ({
    tipo: event.event_type,
    minuto: `${event.minute}${event.extra_minute ? `+${event.extra_minute}` : ""}'`,
    equipo: event.team_id === match.home_team_id ? match.home_team_name : match.away_team_name,
    jugador: event.player_name,
    asistencia: event.event_type === "GOAL" ? event.assist_or_sub_name : undefined,
    otro_jugador_del_cambio: event.event_type === "SUBSTITUTION" ? event.assist_or_sub_name : undefined,
    detalle: event.detail,
  }));
}
