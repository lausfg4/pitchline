import { createClient } from "@/lib/supabase/server";
import { STITCH_REFERENCE_EVENTS } from "@/data/stitch-matches";
import type {
  MatchEventRow,
  MatchRow,
  MatchWithDetails,
  NewsArticleRow,
  PlayerInjuryRow,
  PredictionRow,
  StandingRow,
} from "@/types/database";

const CLUB_PATTERNS: { tag: string; patterns: string[] }[] = [
  { tag: "Real Madrid", patterns: ["real madrid", "madrid", "bernabéu", "vinicius", "vinícius", "bellingham", "mbappé", "mbappe"] },
  { tag: "FC Barcelona", patterns: ["barcelona", "barça", "lewandowski", "yamal", "pedri", "raphinha", "flick"] },
  { tag: "Liverpool FC", patterns: ["liverpool", "anfield", "salah", "van dijk", "slot"] },
  { tag: "Arsenal FC", patterns: ["arsenal", "saka", "ødegaard", "odegaard", "arteta", "gunners"] },
  { tag: "Manchester City", patterns: ["manchester city", "man city", "haaland", "de bruyne", "guardiola", "rodri"] },
  { tag: "Bayern München", patterns: ["bayern", "munich", "múnich", "kane", "musiala", "kompany"] },
  { tag: "Inter de Milán", patterns: ["inter", "milán", "milan", "lautaro", "inzaghi", "calhanoglu"] },
  { tag: "Borussia Dortmund", patterns: ["dortmund", "bvb", "guirassy", "adeyemi"] },
  { tag: "Paris Saint-Germain", patterns: ["paris", "psg", "dembélé", "hakimi", "luis enrique"] },
  { tag: "Bayer Leverkusen", patterns: ["leverkusen", "wirtz", "xabi alonso"] },
  { tag: "Atlético de Madrid", patterns: ["atlético", "atletico", "griezmann", "simeone", "atleti"] },
];

function inferClubFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const c of CLUB_PATTERNS) {
    if (c.patterns.some((p) => lower.includes(p))) return c.tag;
  }
  return null;
}

function inferCategoryFromText(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("lesión") || lower.includes("baja") || lower.includes("médic") || lower.includes("injur")) {
    return "Parte Médico";
  }
  if (lower.includes("xg") || lower.includes("táctic") || lower.includes("estadístic") || lower.includes("simula")) {
    return "Táctica & xG";
  }
  if (lower.includes("previa") || lower.includes("jornada 4") || lower.includes("sorteo") || lower.includes("cuadro")) {
    return "Previa";
  }
  if (lower.includes("gol") || lower.includes("crónica") || lower.includes("firma") || lower.includes("vence") || lower.includes("domina")) {
    return "Crónica";
  }
  return "Oficial UEFA";
}

/**
 * Obtiene desde el servidor los artículos exclusivos de la UEFA Champions League (`public.news_articles`),
 * cumpliendo con las políticas RLS de solo lectura (SELECT).
 */
export async function fetchInitialNewsArticles(): Promise<NewsArticleRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("news_articles")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(40);

    if (error || !data) {
      return [];
    }

    return (data as Record<string, unknown>[]).map((row, idx) => {
      const title = String(row.title ?? "Actualidad UEFA Champions League");
      const summary =
        row.summary !== undefined && row.summary !== null
          ? String(row.summary)
          : row.description !== undefined && row.description !== null
            ? String(row.description)
            : null;
      const combined = `${title} ${summary ?? ""}`;

      return {
        id: String(row.id ?? `news-${idx}`),
        title,
        summary,
        url: String(
          row.external_url ??
            row.url ??
            row.source_url ??
            "https://www.uefa.com/uefachampionsleague/news/"
        ),
        image_url:
          row.image_url !== undefined && row.image_url !== null
            ? String(row.image_url)
            : null,
        source_name: String(
          row.source_name ?? row.source ?? "UEFA.com Oficial"
        ),
        category:
          row.category !== undefined && row.category !== null
            ? String(row.category)
            : inferCategoryFromText(combined),
        club_tag:
          row.club_tag !== undefined && row.club_tag !== null
            ? String(row.club_tag)
            : inferClubFromText(combined),
        published_at: String(
          row.published_at ?? row.created_at ?? new Date().toISOString()
        ),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Obtiene desde el servidor el listado de lesionados y partes médicos (`public.player_injuries`),
 * cumpliendo con las políticas RLS de solo lectura (SELECT).
 */
export async function fetchInitialPlayerInjuries(): Promise<PlayerInjuryRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("player_injuries")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return (data as Record<string, unknown>[]).map((row, idx) => ({
      id: String(row.id ?? `inj-${idx}`),
      player_name: String(row.player_name ?? "Jugador"),
      team_id: typeof row.team_id === "number" ? row.team_id : null,
      team_name: String(row.team_name ?? "Club UEFA"),
      team_short_name:
        typeof row.team_short_name === "string" ? row.team_short_name : null,
      team_crest_url:
        typeof row.team_crest_url === "string"
          ? row.team_crest_url
          : typeof row.team_id === "number"
            ? `https://crests.football-data.org/${row.team_id}.png`
            : null,
      injury_type: String(
        row.injury_type ?? row.reason ?? "Molestia muscular en evaluación"
      ),
      status: String(row.status_reason ?? row.status ?? "OUT"),
      estimated_return: String(
        row.estimated_out_duration ??
          row.estimated_return ??
          row.expected_return ??
          "En evaluación por el cuerpo médico"
      ),
      expected_return_date:
        typeof row.estimated_return_date === "string"
          ? row.estimated_return_date
          : typeof row.expected_return_date === "string"
            ? row.expected_return_date
            : null,
      detail:
        typeof row.medical_notes === "string"
          ? row.medical_notes
          : typeof row.detail === "string"
            ? row.detail
            : null,
      updated_at: String(row.updated_at ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

/**
 * Obtiene desde el servidor la tabla de posiciones de la Fase de Liga (`standings` - 36 clubes),
 * ordenada por `rank` ascendente, cumpliendo con las políticas RLS de solo lectura (SELECT).
 */
export async function fetchInitialStandings(): Promise<StandingRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("standings")
      .select("*")
      .order("rank", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data as StandingRow[];
  } catch {
    return [];
  }
}

/**
 * Obtiene desde el servidor los partidos de la tabla `matches` junto con sus pronósticos (`predictions`)
 * e incidencias (`match_events`), cumpliendo con las políticas RLS de solo lectura (SELECT).
 */
export async function fetchInitialMatchesWithDetails(): Promise<
  MatchWithDetails[]
> {
  try {
    const supabase = await createClient();

    const [matchesRes, predictionsRes, eventsRes] = await Promise.all([
      supabase
        .from("matches")
        .select("*")
        .order("kickoff_at", { ascending: true }),
      supabase.from("predictions").select("*"),
      supabase
        .from("match_events")
        .select("*")
        .order("minute", { ascending: true }),
    ]);

    if (matchesRes.error || !matchesRes.data) {
      return [];
    }

    const predictionsByMatchId = new Map<number, PredictionRow>();
    if (predictionsRes.data) {
      for (const pred of predictionsRes.data as PredictionRow[]) {
        predictionsByMatchId.set(pred.match_id, pred);
      }
    }

    const eventsByMatchId = new Map<number, MatchEventRow[]>();
    const allEventsSource: MatchEventRow[] =
      eventsRes.data && eventsRes.data.length > 0
        ? (eventsRes.data as MatchEventRow[])
        : STITCH_REFERENCE_EVENTS;
    for (const evt of allEventsSource) {
      const list = eventsByMatchId.get(evt.match_id) ?? [];
      list.push(evt);
      eventsByMatchId.set(evt.match_id, list);
    }

    return (matchesRes.data as MatchRow[]).map((match) => ({
      ...match,
      prediction: predictionsByMatchId.get(match.id) ?? null,
      events: eventsByMatchId.get(match.id) ?? [],
    }));
  } catch {
    return [];
  }
}
