"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  MatchEventRow,
  MatchRow,
  MatchWithDetails,
  PredictionRow,
} from "@/types/database";
import {
  DEFAULT_REFERENCE_DATE,
  getActiveOrNextPhaseKey,
  getCurrentWeekBounds,
  getMatchesInCurrentWeek,
  getMatchPhaseKey,
  getNextMatchdayDateLabel,
  getPhaseDisplayInfo,
  getTournamentPhaseList,
  getUpcomingPhaseMatchesSummary,
  hasLeagueStageCompleted,
  type TournamentPhaseKey,
} from "@/lib/date-utils";
import { STITCH_REFERENCE_MATCHES } from "@/data/stitch-matches";
import { PitchlineShell } from "@/components/layout/PitchlineShell";
import { EmptyWeekCard } from "@/components/partidos/EmptyWeekCard";
import { SpotlightMatchCard } from "@/components/partidos/SpotlightMatchCard";
import { MatchGridCard } from "@/components/partidos/MatchGridCard";

type FilterTab = "ALL" | "LIVE" | "FINISHED" | "PREDICTIONS";

interface PartidosRealtimeViewProps {
  initialDbMatches: MatchWithDetails[];
}

export function PartidosRealtimeView({
  initialDbMatches,
}: PartidosRealtimeViewProps) {
  const [dbMatches, setDbMatches] =
    useState<MatchWithDetails[]>(initialDbMatches);
  const [selectedPhase, setSelectedPhase] = useState<TournamentPhaseKey>(() =>
    getActiveOrNextPhaseKey(
      initialDbMatches.length > 0 ? initialDbMatches : STITCH_REFERENCE_MATCHES,
      DEFAULT_REFERENCE_DATE
    )
  );
  const [userChangedPhase, setUserChangedPhase] =
    useState<boolean>(false);
  const [selectedSpotlightId, setSelectedSpotlightId] = useState<number | null>(
    null
  );
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showingPreview, setShowingPreview] = useState<boolean>(true);
  const [realtimeStatus, setRealtimeStatus] = useState<
    "CONNECTING" | "SUBSCRIBED" | "ERROR"
  >("CONNECTING");
  const [userPredictions, setUserPredictions] = useState<
    Record<number, { home: number; away: number }>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("pitchline_user_predictions");
      if (saved) {
        const parsed = JSON.parse(saved) as Record<
          number,
          { home: number; away: number }
        >;
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      }
    } catch {
      // Ignorar errores de almacenamiento local
    }
    return {};
  });

  const [referenceDate] = useState<Date>(DEFAULT_REFERENCE_DATE);

  // Función para recargar en caliente desde Supabase cuando se dispara una sincronización
  const reloadFromSupabaseClient = useCallback(async () => {
    try {
      const supabase = createClient();
      const [mRes, pRes, eRes] = await Promise.all([
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

      if (mRes.data && mRes.data.length > 0) {
        const predMap = new Map<number, PredictionRow>();
        for (const p of (pRes.data ?? []) as PredictionRow[]) {
          predMap.set(p.match_id, p);
        }
        const evtMap = new Map<number, MatchEventRow[]>();
        for (const e of (eRes.data ?? []) as MatchEventRow[]) {
          const list = evtMap.get(e.match_id) ?? [];
          list.push(e);
          evtMap.set(e.match_id, list);
        }
        const merged: MatchWithDetails[] = (mRes.data as MatchRow[]).map(
          (m) => ({
            ...m,
            prediction: predMap.get(m.id) ?? null,
            events: evtMap.get(m.id) ?? [],
          })
        );
        setDbMatches(merged);
      }
    } catch {
      // Ignorar errores de red temporales
    }
  }, []);

  // Suscripción WebSocket en Tiempo Real a las tablas `matches` y `match_events` de Supabase Realtime
  useEffect(() => {
    const supabase = createClient();

    const handleCustomSync = () => {
      void reloadFromSupabaseClient();
    };
    window.addEventListener("pitchline:synced", handleCustomSync);

    const channel = supabase
      .channel("pitchline-matches-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMatch = payload.new as MatchRow;
            setDbMatches((prev) => {
              if (prev.some((m) => m.id === newMatch.id)) return prev;
              return [...prev, { ...newMatch, events: [], prediction: null }];
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as MatchRow;
            setDbMatches((prev) =>
              prev.map((m) =>
                m.id === updated.id
                  ? {
                    ...m,
                    ...updated,
                    events: m.events,
                    prediction: m.prediction,
                  }
                  : m
              )
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id?: number })?.id;
            if (deletedId) {
              setDbMatches((prev) => prev.filter((m) => m.id !== deletedId));
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_events",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newEvent = payload.new as MatchEventRow;
            setDbMatches((prev) =>
              prev.map((m) =>
                m.id === newEvent.match_id
                  ? {
                    ...m,
                    events: [...(m.events ?? []), newEvent].sort(
                      (a, b) => a.minute - b.minute
                    ),
                  }
                  : m
              )
            );
          } else if (payload.eventType === "UPDATE") {
            const updatedEvt = payload.new as MatchEventRow;
            setDbMatches((prev) =>
              prev.map((m) =>
                m.id === updatedEvt.match_id
                  ? {
                    ...m,
                    events: (m.events ?? []).map((e) =>
                      e.id === updatedEvt.id ? updatedEvt : e
                    ),
                  }
                  : m
              )
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("SUBSCRIBED");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("ERROR");
        }
      });

    return () => {
      window.removeEventListener("pitchline:synced", handleCustomSync);
      supabase.removeChannel(channel);
    };
  }, [reloadFromSupabaseClient]);

  // Detector de Semana Vacía (Lunes a Domingo de la semana actual)
  const weekBounds = useMemo(
    () => getCurrentWeekBounds(referenceDate),
    [referenceDate]
  );
  const currentWeekMatches = useMemo(
    () => getMatchesInCurrentWeek(dbMatches, referenceDate),
    [dbMatches, referenceDate]
  );
  const isCurrentWeekEmpty = currentWeekMatches.length === 0;

  const nextMatchdayDate = useMemo(
    () =>
      getNextMatchdayDateLabel(
        dbMatches.length > 0 ? dbMatches : STITCH_REFERENCE_MATCHES,
        referenceDate
      ),
    [dbMatches, referenceDate]
  );

  const upcomingMatchesSummary = useMemo(
    () =>
      getUpcomingPhaseMatchesSummary(
        dbMatches.length > 0 ? dbMatches : STITCH_REFERENCE_MATCHES,
        referenceDate
      ),
    [dbMatches, referenceDate]
  );

  // Todos los partidos cargados desde Supabase (144 partidos de J1 a J8) o respaldo
  const allTournamentMatches = useMemo(() => {
    if (dbMatches.length > 0) {
      return dbMatches;
    }
    return showingPreview ? STITCH_REFERENCE_MATCHES : [];
  }, [dbMatches, showingPreview]);

  // Fase o Jornada activa/próxima calculada dinámicamente (J1..J8 en Fase de Liga o R16/QF/SF/FINAL en Eliminatorias)
  const activeOrNextPhaseKey = useMemo(
    () => getActiveOrNextPhaseKey(allTournamentMatches, referenceDate),
    [allTournamentMatches, referenceDate]
  );

  const allPhases = useMemo(
    () => getTournamentPhaseList(allTournamentMatches),
    [allTournamentMatches]
  );

  const leagueStageCompleted = useMemo(
    () => hasLeagueStageCompleted(allTournamentMatches),
    [allTournamentMatches]
  );

  const [prevActiveOrNext, setPrevActiveOrNext] = useState(activeOrNextPhaseKey);
  if (!userChangedPhase && prevActiveOrNext !== activeOrNextPhaseKey) {
    setPrevActiveOrNext(activeOrNextPhaseKey);
    setSelectedPhase(activeOrNextPhaseKey);
  }

  const phaseInfo = useMemo(
    () =>
      getPhaseDisplayInfo(
        allTournamentMatches,
        selectedPhase,
        activeOrNextPhaseKey
      ),
    [allTournamentMatches, selectedPhase, activeOrNextPhaseKey]
  );

  // Filtrar por la Jornada o Fase Eliminatoria seleccionada
  const activeSourceMatches = useMemo(() => {
    if (!showingPreview && isCurrentWeekEmpty) return [];
    const byPhase = allTournamentMatches.filter(
      (m) => getMatchPhaseKey(m) === selectedPhase
    );
    if (byPhase.length > 0 || phaseInfo.isKnockout) {
      return byPhase;
    }
    return allTournamentMatches;
  }, [
    allTournamentMatches,
    selectedPhase,
    phaseInfo.isKnockout,
    showingPreview,
    isCurrentWeekEmpty,
  ]);

  // Contadores para las píldoras de filtro de la jornada seleccionada
  const counts = useMemo(() => {
    const all = activeSourceMatches.length;
    const live = activeSourceMatches.filter(
      (m) => m.status === "IN_PLAY" || m.status === "HT"
    ).length;
    const finished = activeSourceMatches.filter(
      (m) => m.status === "FINISHED"
    ).length;
    const predicted = activeSourceMatches.filter((m) =>
      m.status === "SCHEDULED"
        ? Boolean(userPredictions[m.id]) || Boolean(m.prediction)
        : Boolean(userPredictions[m.id])
    ).length;
    return { all, live, finished, predicted };
  }, [activeSourceMatches, userPredictions]);

  // Filtrado por pestaña y búsqueda
  const filteredMatches = useMemo(() => {
    return activeSourceMatches.filter((m) => {
      if (activeFilter === "LIVE" && m.status !== "IN_PLAY" && m.status !== "HT")
        return false;
      if (activeFilter === "FINISHED" && m.status !== "FINISHED") return false;
      if (activeFilter === "PREDICTIONS") {
        const hasPred =
          m.status === "SCHEDULED"
            ? Boolean(userPredictions[m.id]) || Boolean(m.prediction)
            : Boolean(userPredictions[m.id]);
        if (!hasPred) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTeam =
          m.home_team_name.toLowerCase().includes(q) ||
          m.away_team_name.toLowerCase().includes(q) ||
          (m.venue ?? "").toLowerCase().includes(q);
        if (!matchesTeam) return false;
      }

      return true;
    });
  }, [activeSourceMatches, activeFilter, searchQuery, userPredictions]);

  // Separar el Partido Destacado de la Jornada (Spotlight) del resto de la jornada
  const spotlightMatch = useMemo(() => {
    if (filteredMatches.length === 0) return null;
    if (selectedSpotlightId != null) {
      const chosen = filteredMatches.find((m) => m.id === selectedSpotlightId);
      if (chosen) return chosen;
    }
    return (
      filteredMatches.find((m) => m.live_stats?.is_spotlight) ??
      filteredMatches.find(
        (m) => m.status === "IN_PLAY" || m.status === "HT"
      ) ??
      filteredMatches[0]
    );
  }, [filteredMatches, selectedSpotlightId]);

  const otherMatches = useMemo(() => {
    if (!spotlightMatch) return [];
    return filteredMatches.filter((m) => m.id !== spotlightMatch.id);
  }, [filteredMatches, spotlightMatch]);

  const handleSaveUserPrediction = (
    matchId: number,
    home: number,
    away: number
  ) => {
    setUserPredictions((prev) => {
      const next = {
        ...prev,
        [matchId]: { home, away },
      };
      try {
        localStorage.setItem(
          "pitchline_user_predictions",
          JSON.stringify(next)
        );
      } catch {
        // Ignorar errores de almacenamiento local
      }
      return next;
    });
  };

  const currentPhaseIndex = useMemo(() => {
    const idx = allPhases.findIndex((p) => p.key === selectedPhase);
    return idx >= 0 ? idx : 0;
  }, [allPhases, selectedPhase]);

  const quickPhaseButtons = useMemo(() => {
    if (phaseInfo.isKnockout || leagueStageCompleted) {
      return allPhases.filter((p) => p.isKnockout);
    }
    return allPhases.filter((p) => !p.isKnockout);
  }, [allPhases, phaseInfo.isKnockout, leagueStageCompleted]);

  return (
    <PitchlineShell
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      currentMatchdayLabel={phaseInfo.headerPillLabel}
    >
      <div className="flex flex-col w-full space-y-6">
        {/* Sub-header de Telemetría & Navegación de Jornada / Fase Eliminatoria */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 rounded-xl bg-surface-container shadow-sm border border-outline-variant/15">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Selector de Jornada (J1-J8) o Fase Eliminatoria (Octavos, Cuartos, Semis, Final) */}
            <div className="flex items-center justify-between w-full sm:w-auto bg-surface-container-low px-2 py-1 rounded-lg border border-outline-variant/15">
              <button
                type="button"
                onClick={() => {
                  setUserChangedPhase(true);
                  setSelectedSpotlightId(null);
                  const prevIdx = Math.max(0, currentPhaseIndex - 1);
                  setSelectedPhase(allPhases[prevIdx].key);
                  setActiveFilter("ALL");
                }}
                aria-label="Fase o jornada anterior"
                className="p-1 min-w-10 min-h-10 sm:min-w-0 sm:min-h-0 shrink-0 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_left
                </span>
              </button>
              <div className="px-2 sm:px-3 flex flex-col text-center flex-1 min-w-0 sm:flex-none sm:min-w-[165px]">
                <span className="font-label-sm text-[10px] uppercase tracking-wider text-brand-mint font-bold">
                  {phaseInfo.subtitle}
                </span>
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  {phaseInfo.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUserChangedPhase(true);
                  setSelectedSpotlightId(null);
                  const nextIdx = Math.min(
                    allPhases.length - 1,
                    currentPhaseIndex + 1
                  );
                  setSelectedPhase(allPhases[nextIdx].key);
                  setActiveFilter("ALL");
                }}
                aria-label="Fase o jornada siguiente"
                className="p-1 min-w-10 min-h-10 sm:min-w-0 sm:min-h-0 shrink-0 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </button>
            </div>

            {/* Botones rápidos dinámicos: J1..J8 en Fase de Liga, y Octavos/Cuartos/Semis/Final en Eliminatorias */}
            <div className="hidden sm:flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/10">
              {(phaseInfo.isKnockout || leagueStageCompleted) && (
                <button
                  type="button"
                  onClick={() => {
                    setUserChangedPhase(true);
                    setSelectedSpotlightId(null);
                    setSelectedPhase("J8");
                    setActiveFilter("ALL");
                  }}
                  className="px-2 py-1 rounded text-xs font-label-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  title="Ver Fase de Liga (J1-J8)"
                >
                  J1-J8
                </button>
              )}
              {quickPhaseButtons.map((phase) => (
                <button
                  key={phase.key}
                  type="button"
                  onClick={() => {
                    setUserChangedPhase(true);
                    setSelectedSpotlightId(null);
                    setSelectedPhase(phase.key);
                    setActiveFilter("ALL");
                  }}
                  className={`px-2 py-1 rounded text-xs font-label-sm transition-colors cursor-pointer ${
                    selectedPhase === phase.key
                      ? "bg-brand-mint text-brand-navy font-bold"
                      : phase.key === activeOrNextPhaseKey
                        ? "text-brand-mint hover:bg-surface-container-high font-semibold"
                        : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {phase.shortLabel}
                </button>
              ))}
            </div>

            {/* Filtros de Partido */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 w-full sm:w-auto min-w-0 -mx-3 px-3 sm:mx-0 sm:px-0 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setActiveFilter("ALL")}
                className={`px-3 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors cursor-pointer ${activeFilter === "ALL"
                    ? "bg-secondary-container text-on-secondary-container font-semibold shadow-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
              >
                Todos ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("LIVE")}
                className={`px-3 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${activeFilter === "LIVE"
                    ? "bg-secondary-container text-on-secondary-container font-semibold shadow-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-brand-mint animate-ping"></span>
                <span>En Vivo ({counts.live})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("FINISHED")}
                className={`px-3 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors cursor-pointer ${activeFilter === "FINISHED"
                    ? "bg-secondary-container text-on-secondary-container font-semibold shadow-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
              >
                Finalizados ({counts.finished})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("PREDICTIONS")}
                className={`px-3 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors cursor-pointer ${activeFilter === "PREDICTIONS"
                    ? "bg-secondary-container text-on-secondary-container font-semibold shadow-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
              >
                Pronósticos ({counts.predicted})
              </button>
            </div>
          </div>

          {/* Status en Tiempo Real */}
          <div className="flex items-center justify-between lg:justify-end gap-3 self-stretch lg:self-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low border border-brand-mint/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-mint opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-mint"></span>
              </span>
              <span className="font-label-sm text-label-sm text-brand-mint uppercase font-bold tracking-wider">
                Tiempo Real
              </span>
              <span className="text-outline-variant font-label-sm text-label-sm">
                •
              </span>
              <span className="font-tabular-stats text-tabular-stats text-on-surface-variant">
                {realtimeStatus === "SUBSCRIBED"
                  ? "En directo"
                  : realtimeStatus === "CONNECTING"
                    ? "Conectando..."
                    : "Actualizado"}
              </span>
            </div>
          </div>
        </div>

        {/* DETECTOR DE SEMANA VACÍA (AGENTS.md Regla de Negocio Pestaña 2) */}
        {isCurrentWeekEmpty && (
          <EmptyWeekCard
            weekRangeLabel={weekBounds.label}
            nextMatchdayDate={nextMatchdayDate}
            upcomingMatchesSummary={upcomingMatchesSummary}
            showingPreview={showingPreview}
            onTogglePreview={() => setShowingPreview((prev) => !prev)}
          />
        )}

        {/* PARTIDO DESTACADO DE LA JORNADA O FASE (Spotlight Card) */}
        {spotlightMatch && (
          <SpotlightMatchCard
            match={spotlightMatch}
            userPrediction={userPredictions[spotlightMatch.id]}
            onSaveUserPrediction={handleSaveUserPrediction}
          />
        )}

        {/* GRID DE OTROS PARTIDOS DE LA JORNADA O FASE ELIMINATORIA */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-brand-white">
              {phaseInfo.sectionHeading} ({phaseInfo.subtitle})
            </h2>
            {activeSourceMatches.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("ALL");
                  setSearchQuery("");
                  setShowingPreview(true);
                }}
                className="font-label-md text-label-md text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                Ver los {activeSourceMatches.length} partidos de{" "}
                {phaseInfo.shortLabel}
                <span className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
              </button>
            )}
          </div>

          {otherMatches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {otherMatches.map((match) => (
                <MatchGridCard
                  key={match.id}
                  match={match}
                  userPrediction={userPredictions[match.id]}
                  onSelectMatch={(id) => {
                    setSelectedSpotlightId(id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              ))}
            </div>
          ) : activeSourceMatches.length === 0 && phaseInfo.isKnockout ? (
            <div className="p-8 rounded-xl bg-surface-container-low border border-outline-variant/15 text-center space-y-2">
              <span className="material-symbols-outlined text-brand-mint text-[32px]">
                account_tree
              </span>
              <p className="font-headline-md text-headline-md text-brand-white">
                Cruces de {phaseInfo.title} ({phaseInfo.subtitle})
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Los enfrentamientos oficiales de {phaseInfo.title} se mostrarán aquí automáticamente en cuanto concluya la fase previa. Próxima cita en calendario: {nextMatchdayDate}.
              </p>
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-surface-container-low border border-outline-variant/15 text-center space-y-2">
              <span className="material-symbols-outlined text-brand-mint text-[32px]">
                sports_soccer
              </span>
              <p className="font-headline-md text-headline-md text-brand-white">
                No hay partidos para este filtro
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Próxima cita: {nextMatchdayDate}. Selecciona &ldquo;Todos&rdquo; o cambia de fase para explorar el resto de partidos.
              </p>
            </div>
          )}
        </div>
      </div>
    </PitchlineShell>
  );
}
