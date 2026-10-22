import type { MatchWithDetails } from "@/types/database";

const DEFAULT_REFERENCE_DATE = new Date("2026-10-22T18:00:00Z");

/**
 * Obtiene el rango de lunes (00:00:00) a domingo (23:59:59) de la semana actual.
 */
export function getCurrentWeekBounds(
  referenceDate: Date = DEFAULT_REFERENCE_DATE
): {
  monday: Date;
  sunday: Date;
  label: string;
} {
  const current = new Date(referenceDate);
  const day = current.getDay(); // 0 = Domingo, 1 = Lunes, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const formatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  });

  return {
    monday,
    sunday,
    label: `${formatter.format(monday)} – ${formatter.format(sunday)}`,
  };
}

/**
 * Filtra los partidos que pertenecen a la semana actual (lunes a domingo).
 */
export function getMatchesInCurrentWeek(
  matches: MatchWithDetails[],
  referenceDate: Date = DEFAULT_REFERENCE_DATE
): MatchWithDetails[] {
  const { monday, sunday } = getCurrentWeekBounds(referenceDate);
  return matches.filter((m) => {
    const kickoff = new Date(m.kickoff_at);
    return kickoff >= monday && kickoff <= sunday;
  });
}

/**
 * Calcula la fecha de la próxima jornada de Champions League a partir de los partidos futuros
 * o devuelve la siguiente fecha oficial programada.
 */
export function getNextMatchdayDateLabel(
  matches: MatchWithDetails[],
  referenceDate: Date = DEFAULT_REFERENCE_DATE
): string {
  const now = referenceDate.getTime();
  const futureMatches = matches
    .filter((m) => new Date(m.kickoff_at).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    );

  if (futureMatches.length > 0) {
    const nextDate = new Date(futureMatches[0].kickoff_at);
    return new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(nextDate);
  }

  // Si la tabla está vacía, calculamos el próximo martes de jornada UCL
  const nextUclTuesday = new Date(referenceDate);
  const daysUntilTuesday = (2 + 7 - nextUclTuesday.getDay()) % 7 || 7;
  nextUclTuesday.setDate(nextUclTuesday.getDate() + daysUntilTuesday + 7);

  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(nextUclTuesday);
}

/**
 * Formatea la hora local de un partido programado.
 */
export function formatLocalKickoffTime(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "21:00";
  }
}
