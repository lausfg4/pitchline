import type { MatchEventRow, MatchWithDetails } from "@/types/database";

export const DEFAULT_REFERENCE_DATE = new Date("2026-11-03T18:00:00Z");

/**
 * Determina si un estado de partido corresponde a un encuentro en juego o descanso (1H, HT, 2H, ET, PEN, IN_PLAY).
 */
export function isMatchLive(status?: string | null): boolean {
  return (
    status === "IN_PLAY" ||
    status === "1H" ||
    status === "HT" ||
    status === "2H" ||
    status === "ET" ||
    status === "PEN"
  );
}

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
 * Filtra todos los partidos de la UEFA Champions League programados, en vivo o jugados en la semana actual (Lunes a Domingo).
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

export type TournamentPhaseKey =
  | "J1"
  | "J2"
  | "J3"
  | "J4"
  | "J5"
  | "J6"
  | "J7"
  | "J8"
  | "PLAYOFFS"
  | "R16"
  | "QF"
  | "SF"
  | "FINAL";

export function isKnockoutPhaseKey(phaseKey: TournamentPhaseKey): boolean {
  return (
    phaseKey === "PLAYOFFS" ||
    phaseKey === "R16" ||
    phaseKey === "QF" ||
    phaseKey === "SF" ||
    phaseKey === "FINAL"
  );
}

export function getMatchPhaseKey(match: MatchWithDetails): TournamentPhaseKey {
  const upper = (match.stage ?? "").toUpperCase();
  if (
    upper.includes("FINAL") &&
    !upper.includes("QUARTER") &&
    !upper.includes("SEMI") &&
    !upper.includes("LAST")
  ) {
    return "FINAL";
  }
  if (upper.includes("SEMI") || upper === "SF") {
    return "SF";
  }
  if (upper.includes("QUARTER") || upper === "QF") {
    return "QF";
  }
  if (upper.includes("16") || upper.includes("OCTAVOS") || upper === "R16") {
    return "R16";
  }
  if (upper.includes("PLAYOFF") || upper.includes("PLAY_OFF")) {
    return "PLAYOFFS";
  }

  const md = match.matchday ?? 1;
  if (md >= 1 && md <= 8) {
    return `J${md}` as TournamentPhaseKey;
  }
  if (md === 9 || md === 10) return "PLAYOFFS";
  if (md === 11 || md === 12) return "R16";
  if (md === 13 || md === 14) return "QF";
  if (md === 15 || md === 16) return "SF";
  return "FINAL";
}

export function hasLeagueStageCompleted(matches: MatchWithDetails[]): boolean {
  const leagueMatches = matches.filter((m) => !isKnockoutPhaseKey(getMatchPhaseKey(m)));
  if (leagueMatches.length === 0) return false;
  const j8Matches = leagueMatches.filter((m) => m.matchday === 8);
  const allJ8Finished =
    j8Matches.length > 0 && j8Matches.every((m) => m.status === "FINISHED");
  const anyKnockoutStarted = matches.some(
    (m) =>
      isKnockoutPhaseKey(getMatchPhaseKey(m)) &&
      (isMatchLive(m.status) || m.status === "FINISHED")
  );
  return allJ8Finished || anyKnockoutStarted;
}

export function getStageNameEs(stage?: string | null, matchday?: number | null): string {
  const upper = (stage ?? "").toUpperCase();
  if (upper.includes("FINAL") && !upper.includes("QUARTER") && !upper.includes("SEMI") && !upper.includes("LAST")) {
    return "Gran Final";
  }
  if (upper.includes("SEMI")) {
    return "Semifinales";
  }
  if (upper.includes("QUARTER") || upper === "QF") {
    return "Cuartos de Final";
  }
  if (upper.includes("16") || upper.includes("OCTAVOS") || upper === "R16") {
    return "Octavos de Final";
  }
  if (upper.includes("PLAYOFF") || upper.includes("PLAY_OFF")) {
    return "Playoffs Eliminatorios";
  }
  if (matchday != null) {
    return `Jornada ${matchday}`;
  }
  return "Fase Eliminatoria";
}

/**
 * Calcula la etiqueta de la próxima jornada o fase eliminatoria (Octavos, Cuartos, Semifinales, Final)
 * de la UEFA Champions League a partir de los partidos programados en la base de datos.
 */
export function getNextMatchdayDateLabel(
  matches: MatchWithDetails[],
  referenceDate: Date = DEFAULT_REFERENCE_DATE
): string {
  const now = referenceDate.getTime();
  const futureMatches = matches
    .filter(
      (m) =>
        m.status === "SCHEDULED" && new Date(m.kickoff_at).getTime() > now - 12 * 3600 * 1000
    )
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    );

  if (futureMatches.length > 0) {
    const firstNext = futureMatches[0];
    const nextMatchdayNum = firstNext.matchday;
    const nextStage = firstNext.stage;

    const samePhaseMatches = nextMatchdayNum
      ? futureMatches.filter((m) => m.matchday === nextMatchdayNum)
      : futureMatches.filter((m) => m.stage === nextStage);

    const firstDate = new Date(samePhaseMatches[0].kickoff_at);
    const lastDate = new Date(
      samePhaseMatches[samePhaseMatches.length - 1].kickoff_at
    );

    const day1 = firstDate.getUTCDate();
    const day2 = lastDate.getUTCDate();
    const monthName = new Intl.DateTimeFormat("es-ES", {
      month: "long",
      timeZone: "UTC",
    }).format(firstDate);
    const yearNum = firstDate.getUTCFullYear();

    const dateRangeStr =
      day1 !== day2
        ? `${day1} y ${day2} de ${monthName} de ${yearNum}`
        : `${day1} de ${monthName} de ${yearNum}`;

    const phaseLabel = getStageNameEs(nextStage, nextMatchdayNum);
    return `${phaseLabel} (${dateRangeStr})`;
  }

  return "Fase Eliminatoria UEFA Champions League";
}

/**
 * Construye dinámicamente el texto descriptivo con los próximos partidos programados
 * tanto para la Fase de Liga como cuando el torneo avanza a Octavos, Cuartos, Semifinales o Final.
 */
export function getUpcomingPhaseMatchesSummary(
  matches: MatchWithDetails[],
  referenceDate: Date = DEFAULT_REFERENCE_DATE
): string {
  const now = referenceDate.getTime();
  const futureMatches = matches
    .filter(
      (m) =>
        m.status === "SCHEDULED" &&
        new Date(m.kickoff_at).getTime() > now - 12 * 3600 * 1000
    )
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    );

  if (futureMatches.length === 0) {
    return "El calendario se actualizará automáticamente en cuanto se definan los próximos cruces.";
  }

  const firstNext = futureMatches[0];
  const nextMatchdayNum = firstNext.matchday;
  const nextStage = firstNext.stage;
  const phaseName = getStageNameEs(nextStage, nextMatchdayNum);

  const samePhaseMatches = nextMatchdayNum
    ? futureMatches.filter((m) => m.matchday === nextMatchdayNum)
    : futureMatches.filter((m) => m.stage === nextStage);

  const featuredPairs = samePhaseMatches
    .slice(0, 4)
    .map((m) => `${m.home_team_name} vs ${m.away_team_name}`)
    .join(", ");

  const remainingCount = Math.max(0, samePhaseMatches.length - 4);
  const moreSuffix =
    remainingCount > 0 ? ` y ${remainingCount} encuentros más.` : ".";

  return `Los próximos partidos de ${phaseName} son: ${featuredPairs}${moreSuffix}`;
}

/**
 * Determina automáticamente la jornada activa o próxima a disputarse según la fecha actual
 * y el estado de los partidos en la base de datos.
 */
export function getActiveOrNextMatchday(
  matches: MatchWithDetails[],
  referenceDate: Date = DEFAULT_REFERENCE_DATE
): number {
  if (!matches || matches.length === 0) return 1;

  // 1. Si hay algún partido en vivo ahora mismo, priorizar su jornada
  const liveMatch = matches.find(
    (m) => isMatchLive(m.status) && m.matchday != null
  );
  if (liveMatch?.matchday) {
    return liveMatch.matchday;
  }

  // 2. Si hay partidos programados en la semana en curso, mostrar esa jornada
  const weekMatches = getMatchesInCurrentWeek(matches, referenceDate);
  if (weekMatches.length > 0 && weekMatches[0].matchday) {
    return weekMatches[0].matchday;
  }

  // 3. Buscar el próximo partido programado (SCHEDULED) a partir de la fecha actual
  const nowMs = referenceDate.getTime();
  const upcoming = matches
    .filter(
      (m) =>
        m.status === "SCHEDULED" &&
        m.matchday != null &&
        new Date(m.kickoff_at).getTime() >= nowMs - 12 * 3600 * 1000
    )
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    );

  if (upcoming.length > 0 && upcoming[0].matchday) {
    return upcoming[0].matchday;
  }

  // 4. Si todos los partidos ya finalizaron, mostrar la última jornada registrada
  const maxMd = matches.reduce(
    (max, m) => (m.matchday && m.matchday > max ? m.matchday : max),
    1
  );
  return maxMd;
}

/**
 * Genera dinámicamente el subtítulo de cualquier jornada (fechas reales y estado: En Vivo / Finalizada / Próxima)
 * a partir de los partidos reales de esa jornada.
 */
export function getMatchdaySubtitle(
  matches: MatchWithDetails[],
  matchday: number,
  activeOrNextMatchday: number
): string {
  const mdMatches = matches
    .filter((m) => m.matchday === matchday)
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    );

  if (mdMatches.length === 0) {
    return `Jornada ${matchday}`;
  }

  const firstDate = new Date(mdMatches[0].kickoff_at);
  const lastDate = new Date(mdMatches[mdMatches.length - 1].kickoff_at);

  const uniqueDays = Array.from(
    new Set(mdMatches.map((m) => new Date(m.kickoff_at).getUTCDate()))
  );

  const monthShort = new Intl.DateTimeFormat("es-ES", {
    month: "short",
    timeZone: "UTC",
  })
    .format(firstDate)
    .replace(".", "");
  const monthCap = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
  const yearNum = firstDate.getUTCFullYear();

  let datePart: string;
  if (uniqueDays.length === 1) {
    datePart = `${uniqueDays[0]} ${monthCap} ${yearNum}`;
  } else if (uniqueDays.length === 2) {
    datePart = `${uniqueDays[0]} y ${uniqueDays[1]} ${monthCap}`;
  } else {
    datePart = `${uniqueDays[0]} a ${uniqueDays[uniqueDays.length - 1]} ${monthCap}`;
  }

  const hasLive = mdMatches.some(
    (m) => isMatchLive(m.status)
  );
  const allFinished = mdMatches.every((m) => m.status === "FINISHED");

  if (hasLive) {
    return `En Juego • ${datePart}`;
  }
  if (allFinished) {
    return `Finalizada • ${datePart}`;
  }
  if (matchday === activeOrNextMatchday) {
    return `Próxima • ${datePart} ${lastDate.getUTCFullYear()}`;
  }
  return `${datePart} ${lastDate.getUTCFullYear()}`;
}

/**
 * Determina automáticamente la fase activa o próxima del torneo (J1..J8 en Fase de Liga,
 * o PLAYOFFS / R16 / QF / SF / FINAL cuando finaliza la Fase de Liga y pasa a Eliminatorias).
 */
export function getActiveOrNextPhaseKey(
  matches: MatchWithDetails[],
  referenceDate: Date = DEFAULT_REFERENCE_DATE
): TournamentPhaseKey {
  if (!matches || matches.length === 0) return "J1";

  // 1. Si hay un partido en vivo ahora mismo, priorizar su fase
  const liveMatch = matches.find(
    (m) => isMatchLive(m.status)
  );
  if (liveMatch) {
    return getMatchPhaseKey(liveMatch);
  }

  // 2. Si hay partidos programados en la semana en curso, mostrar su fase
  const weekMatches = getMatchesInCurrentWeek(matches, referenceDate);
  if (weekMatches.length > 0) {
    return getMatchPhaseKey(weekMatches[0]);
  }

  // 3. Buscar el próximo partido programado (SCHEDULED) a partir de la fecha actual
  const nowMs = referenceDate.getTime();
  const upcoming = matches
    .filter(
      (m) =>
        m.status === "SCHEDULED" &&
        new Date(m.kickoff_at).getTime() >= nowMs - 12 * 3600 * 1000
    )
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    );

  if (upcoming.length > 0) {
    return getMatchPhaseKey(upcoming[0]);
  }

  // 4. Si ya terminaron las 8 jornadas de Fase de Liga, pasar a la primera fase eliminatoria activa o pendiente
  if (hasLeagueStageCompleted(matches)) {
    const koOrder: TournamentPhaseKey[] = ["PLAYOFFS", "R16", "QF", "SF", "FINAL"];
    for (const koKey of koOrder) {
      const koMatches = matches.filter((m) => getMatchPhaseKey(m) === koKey);
      if (
        koMatches.length > 0 &&
        koMatches.some((m) => m.status !== "FINISHED")
      ) {
        return koKey;
      }
    }
    const existingKo = [...koOrder]
      .reverse()
      .find((koKey) => matches.some((m) => getMatchPhaseKey(m) === koKey));
    return existingKo ?? "R16";
  }

  const md = getActiveOrNextMatchday(matches, referenceDate);
  return `J${Math.min(8, Math.max(1, md))}` as TournamentPhaseKey;
}

export interface PhaseOptionMeta {
  key: TournamentPhaseKey;
  shortLabel: string;
  title: string;
  isKnockout: boolean;
}

/**
 * Devuelve la secuencia ordenada de todas las fases del torneo (J1..J8 + Eliminatorias).
 */
export function getTournamentPhaseList(
  matches: MatchWithDetails[]
): PhaseOptionMeta[] {
  const hasPlayoffsInDb = matches.some(
    (m) => getMatchPhaseKey(m) === "PLAYOFFS"
  );

  const phases: PhaseOptionMeta[] = [
    { key: "J1", shortLabel: "J1", title: "Jornada 1 de 8", isKnockout: false },
    { key: "J2", shortLabel: "J2", title: "Jornada 2 de 8", isKnockout: false },
    { key: "J3", shortLabel: "J3", title: "Jornada 3 de 8", isKnockout: false },
    { key: "J4", shortLabel: "J4", title: "Jornada 4 de 8", isKnockout: false },
    { key: "J5", shortLabel: "J5", title: "Jornada 5 de 8", isKnockout: false },
    { key: "J6", shortLabel: "J6", title: "Jornada 6 de 8", isKnockout: false },
    { key: "J7", shortLabel: "J7", title: "Jornada 7 de 8", isKnockout: false },
    { key: "J8", shortLabel: "J8", title: "Jornada 8 de 8", isKnockout: false },
  ];

  if (hasPlayoffsInDb) {
    phases.push({
      key: "PLAYOFFS",
      shortLabel: "Playoffs",
      title: "Playoffs Eliminatorios",
      isKnockout: true,
    });
  }

  phases.push(
    {
      key: "R16",
      shortLabel: "Octavos",
      title: "Octavos de Final",
      isKnockout: true,
    },
    {
      key: "QF",
      shortLabel: "Cuartos",
      title: "Cuartos de Final",
      isKnockout: true,
    },
    {
      key: "SF",
      shortLabel: "Semis",
      title: "Semifinales",
      isKnockout: true,
    },
    {
      key: "FINAL",
      shortLabel: "Final",
      title: "Gran Final",
      isKnockout: true,
    }
  );

  return phases;
}

const KNOCKOUT_DEFAULT_CALENDAR: Record<TournamentPhaseKey, string> = {
  J1: "Jornada 1",
  J2: "Jornada 2",
  J3: "Jornada 3",
  J4: "Jornada 4",
  J5: "Jornada 5",
  J6: "Jornada 6",
  J7: "Jornada 7",
  J8: "Jornada 8",
  PLAYOFFS: "Ida y Vuelta • Feb 2027",
  R16: "Ida y Vuelta • Mar 2027",
  QF: "Ida y Vuelta • Abr 2027",
  SF: "Ida y Vuelta • Abr/May 2027",
  FINAL: "Final Única • May 2027",
};

/**
 * Obtiene toda la información visual dinámica (título, etiqueta corta, subtítulo con fechas/estado y encabezado)
 * tanto para las Jornadas 1-8 de Fase de Liga como para Octavos, Cuartos, Semifinales y Final.
 */
export function getPhaseDisplayInfo(
  matches: MatchWithDetails[],
  phaseKey: TournamentPhaseKey,
  activePhaseKey: TournamentPhaseKey
): {
  title: string;
  shortLabel: string;
  subtitle: string;
  sectionHeading: string;
  headerPillLabel: string;
  isKnockout: boolean;
} {
  const allPhases = getTournamentPhaseList(matches);
  const meta =
    allPhases.find((p) => p.key === phaseKey) ?? {
      key: phaseKey,
      shortLabel: phaseKey,
      title: phaseKey,
      isKnockout: isKnockoutPhaseKey(phaseKey),
    };

  if (!meta.isKnockout) {
    const mdNum = Number(phaseKey.replace("J", "")) || 1;
    const activeMdNum = !isKnockoutPhaseKey(activePhaseKey)
      ? Number(activePhaseKey.replace("J", "")) || mdNum
      : 8;
    const subtitle = getMatchdaySubtitle(matches, mdNum, activeMdNum);
    return {
      title: `Jornada ${mdNum} de 8`,
      shortLabel: `J${mdNum}`,
      subtitle,
      sectionHeading: `Partidos de la Jornada ${mdNum}`,
      headerPillLabel: `J${mdNum} de 8 (${subtitle})`,
      isKnockout: false,
    };
  }

  const phaseMatches = matches
    .filter((m) => getMatchPhaseKey(m) === phaseKey)
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    );

  let subtitle = KNOCKOUT_DEFAULT_CALENDAR[phaseKey] ?? "Fase Eliminatoria";

  if (phaseMatches.length > 0) {
    const firstDate = new Date(phaseMatches[0].kickoff_at);
    const lastDate = new Date(phaseMatches[phaseMatches.length - 1].kickoff_at);
    const uniqueDays = Array.from(
      new Set(phaseMatches.map((m) => new Date(m.kickoff_at).getUTCDate()))
    );

    const monthShort = new Intl.DateTimeFormat("es-ES", {
      month: "short",
      timeZone: "UTC",
    })
      .format(firstDate)
      .replace(".", "");
    const monthCap = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
    const yearNum = lastDate.getUTCFullYear();

    let datePart: string;
    if (uniqueDays.length === 1) {
      datePart = `${uniqueDays[0]} ${monthCap} ${yearNum}`;
    } else if (uniqueDays.length === 2) {
      datePart = `${uniqueDays[0]} y ${uniqueDays[1]} ${monthCap}`;
    } else {
      datePart = `${uniqueDays[0]} a ${uniqueDays[uniqueDays.length - 1]} ${monthCap}`;
    }

    const hasLive = phaseMatches.some(
      (m) => isMatchLive(m.status)
    );
    const allFinished = phaseMatches.every((m) => m.status === "FINISHED");

    if (hasLive) {
      subtitle = `En Juego • ${datePart}`;
    } else if (allFinished) {
      subtitle = `Finalizada • ${datePart}`;
    } else if (phaseKey === activePhaseKey) {
      subtitle = `Próxima • ${datePart} ${yearNum}`;
    } else {
      subtitle = `${datePart} ${yearNum}`;
    }
  }

  const sectionHeading =
    phaseKey === "FINAL"
      ? "Partido de la Gran Final"
      : `Partidos de ${meta.title}`;

  return {
    title: meta.title,
    shortLabel: meta.shortLabel,
    subtitle,
    sectionHeading,
    headerPillLabel: `${meta.title} (${subtitle})`,
    isKnockout: true,
  };
}

/**
 * Formatea únicamente la hora local de un partido programado.
 */
export function formatLocalKickoffTime(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "20:00";
  }
}

/**
 * Formatea la fecha real y hora local de un partido (ej. "Mar 3 nov • 15:00" o "Mié 4 nov • 15:00").
 * Solo muestra "Hoy" si la fecha del partido coincide exactamente con el día calendario actual.
 */
export function formatMatchDateTimeLabel(
  isoDate: string,
  referenceDate?: Date | null
): string {
  try {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "Próxima Jornada";

    const isToday =
      referenceDate != null &&
      date.getFullYear() === referenceDate.getFullYear() &&
      date.getMonth() === referenceDate.getMonth() &&
      date.getDate() === referenceDate.getDate();

    const timeStr = new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

    if (isToday) {
      return `Hoy • ${timeStr}`;
    }

    const dayMonthStr = new Intl.DateTimeFormat("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
      .format(date)
      .replace(".", "");

    return `${dayMonthStr} • ${timeStr}`;
  } catch {
    return "3-4 nov • 20:00";
  }
}

export function computeMatchTelemetry(match: MatchWithDetails): {
  homePossession: number | null; awayPossession: number | null; homeXg: number | null; awayXg: number | null;
} {
  const stats = match.live_stats?.source === "api-football" ? match.live_stats : null;
  const value = (n: unknown, max = Infinity) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  return { homePossession: value(stats?.home_possession, 100), awayPossession: value(stats?.away_possession, 100), homeXg: value(stats?.home_xg), awayXg: value(stats?.away_xg) };
}

/** Returns verified provider events only; missing events remain unknown. */
export function getVerifiedMatchEvents(match: MatchWithDetails): MatchEventRow[] {
  const verified = (match.events ?? []).filter(e => e.source === "api-football");
  const goals = verified.filter(e => e.event_type === "GOAL");
  const scoresAgree = goals.filter(e => e.team_id === match.home_team_id).length === match.home_score && goals.filter(e => e.team_id === match.away_team_id).length === match.away_score;
  return verified.filter(e => e.event_type !== "GOAL" || scoresAgree).sort((a,b) => a.minute - b.minute || (a.extra_minute ?? 0) - (b.extra_minute ?? 0));
}
