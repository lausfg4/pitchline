import { createClient } from "@/lib/supabase/server";
import type {
  MatchEventRow,
  MatchRow,
  MatchWithDetails,
  PredictionRow,
} from "@/types/database";

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
    if (eventsRes.data) {
      for (const evt of eventsRes.data as MatchEventRow[]) {
        const list = eventsByMatchId.get(evt.match_id) ?? [];
        list.push(evt);
        eventsByMatchId.set(evt.match_id, list);
      }
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
