"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  MatchEventRow,
  MatchRow,
  MatchWithDetails,
} from "@/types/database";
import {
  getCurrentWeekBounds,
  getMatchesInCurrentWeek,
  getNextMatchdayDateLabel,
} from "@/lib/date-utils";
import { STITCH_REFERENCE_MATCHES } from "@/data/stitch-matches";
import { PitchlineShell } from "@/components/layout/PitchlineShell";
import { EmptyWeekCard } from "@/components/partidos/EmptyWeekCard";
import { SpotlightMatchCard } from "@/components/partidos/SpotlightMatchCard";
import { MatchGridCard } from "@/components/partidos/MatchGridCard";
import { GeminiTacticalPanel } from "@/components/partidos/GeminiTacticalPanel";

type FilterTab = "ALL" | "LIVE" | "FINISHED" | "PREDICTIONS";

interface PartidosRealtimeViewProps {
  initialDbMatches: MatchWithDetails[];
}

export function PartidosRealtimeView({
  initialDbMatches,
}: PartidosRealtimeViewProps) {
  const [dbMatches, setDbMatches] =
    useState<MatchWithDetails[]>(initialDbMatches);
  const [selectedMatchday, setSelectedMatchday] = useState<number>(7);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showingPreview, setShowingPreview] = useState<boolean>(true);
  const [realtimeStatus, setRealtimeStatus] = useState<
    "CONNECTING" | "SUBSCRIBED" | "ERROR"
  >("CONNECTING");
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<string>(
    "Actualizado al segundo"
  );
  const [userPredictions, setUserPredictions] = useState<
    Record<number, { home: number; away: number }>
  >({
    1001: { home: 2, away: 2 },
    1003: { home: 2, away: 0 },
    1004: { home: 2, away: 1 },
    1005: { home: 2, away: 1 },
  });

  const [referenceDate, setReferenceDate] = useState<Date>(
    () => new Date("2026-10-22T18:00:00Z")
  );

  // Suscripción WebSocket en Tiempo Real a las tablas `matches` y `match_events` de Supabase Realtime
  useEffect(() => {
    setReferenceDate(new Date());
    const supabase = createClient();

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
          const timeNow = new Intl.DateTimeFormat("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date());
          setLastRealtimeUpdate(`Sync ${timeNow}`);

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
          const timeNow = new Intl.DateTimeFormat("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date());
          setLastRealtimeUpdate(`Incidencia ${timeNow}`);

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
      supabase.removeChannel(channel);
    };
  }, []);

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

  // Fuente activa de partidos: si la BD tiene registros usamos `dbMatches`, de lo contrario mostramos la vista Stitch si `showingPreview` está activo
  const activeSourceMatches = useMemo(() => {
    if (dbMatches.length > 0) {
      return dbMatches;
    }
    return showingPreview ? STITCH_REFERENCE_MATCHES : [];
  }, [dbMatches, showingPreview]);

  // Contadores para las píldoras de filtro
  const counts = useMemo(() => {
    const all = activeSourceMatches.length;
    const live = activeSourceMatches.filter(
      (m) => m.status === "IN_PLAY" || m.status === "HT"
    ).length;
    const finished = activeSourceMatches.filter(
      (m) => m.status === "FINISHED"
    ).length;
    const predicted = activeSourceMatches.filter(
      (m) => Boolean(userPredictions[m.id]) || Boolean(m.prediction)
    ).length;
    return { all, live, finished, predicted };
  }, [activeSourceMatches, userPredictions]);

  // Filtrado por pestaña y búsqueda
  const filteredMatches = useMemo(() => {
    return activeSourceMatches.filter((m) => {
      if (activeFilter === "LIVE" && m.status !== "IN_PLAY" && m.status !== "HT")
        return false;
      if (activeFilter === "FINISHED" && m.status !== "FINISHED") return false;
      if (
        activeFilter === "PREDICTIONS" &&
        !userPredictions[m.id] &&
        !m.prediction
      )
        return false;

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

  // Separar el Partido de la Noche (Spotlight) del resto de la jornada
  const spotlightMatch = useMemo(() => {
    if (filteredMatches.length === 0) return null;
    return (
      filteredMatches.find((m) => m.live_stats?.is_spotlight) ??
      filteredMatches.find(
        (m) => m.status === "IN_PLAY" || m.status === "HT"
      ) ??
      filteredMatches[0]
    );
  }, [filteredMatches]);

  const otherMatches = useMemo(() => {
    if (!spotlightMatch) return [];
    return filteredMatches.filter((m) => m.id !== spotlightMatch.id);
  }, [filteredMatches, spotlightMatch]);

  const handleSaveUserPrediction = (
    matchId: number,
    home: number,
    away: number
  ) => {
    setUserPredictions((prev) => ({
      ...prev,
      [matchId]: { home, away },
    }));
  };

  return (
    <PitchlineShell
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      currentMatchdayLabel={`${selectedMatchday} de 8 (Fase de Liga)`}
    >
      <div className="flex flex-col w-full space-y-6">
        {/* Sub-header de Telemetría & Navegación de Jornada */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 rounded-xl bg-surface-container shadow-sm border border-outline-variant/15">
          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de Jornada */}
            <div className="flex items-center bg-surface-container-low px-2 py-1 rounded-lg">
              <button
                type="button"
                onClick={() =>
                  setSelectedMatchday((prev) => Math.max(1, prev - 1))
                }
                aria-label="Jornada anterior"
                className="p-1 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_left
                </span>
              </button>
              <div className="px-3 flex flex-col text-center">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
                  Fase de Liga
                </span>
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Jornada {selectedMatchday} de 8
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSelectedMatchday((prev) => Math.min(8, prev + 1))
                }
                aria-label="Jornada siguiente"
                className="p-1 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </button>
            </div>

            {/* Filtros de Partido */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <button
                type="button"
                onClick={() => setActiveFilter("ALL")}
                className={`px-3 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === "ALL"
                    ? "bg-secondary-container text-on-secondary-container font-semibold shadow-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                Todos ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("LIVE")}
                className={`px-3 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeFilter === "LIVE"
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
                className={`px-3 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === "FINISHED"
                    ? "bg-secondary-container text-on-secondary-container font-semibold shadow-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                Finalizados ({counts.finished})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("PREDICTIONS")}
                className={`px-3 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === "PREDICTIONS"
                    ? "bg-secondary-container text-on-secondary-container font-semibold shadow-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                Mis Pronósticos ({counts.predicted})
              </button>
            </div>
          </div>

          {/* Status WebSocket / Telemetría */}
          <div className="flex items-center justify-between lg:justify-end gap-3 self-stretch lg:self-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low border border-brand-mint/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-mint opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-mint"></span>
              </span>
              <span className="font-label-sm text-label-sm text-brand-mint uppercase font-bold tracking-wider">
                Supabase Realtime
              </span>
              <span className="text-outline-variant font-label-sm text-label-sm">
                •
              </span>
              <span className="font-tabular-stats text-tabular-stats text-on-surface-variant">
                {realtimeStatus === "SUBSCRIBED"
                  ? "WS Activo (18ms)"
                  : realtimeStatus === "CONNECTING"
                    ? "Conectando WS..."
                    : "Modo Respaldo"}
              </span>
            </div>
            <div className="text-right hidden sm:block">
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {lastRealtimeUpdate}
              </span>
            </div>
          </div>
        </div>

        {/* DETECTOR DE SEMANA VACÍA (AGENTS.md Regla de Negocio Pestaña 2) */}
        {isCurrentWeekEmpty && (
          <EmptyWeekCard
            weekRangeLabel={weekBounds.label}
            nextMatchdayDate={nextMatchdayDate}
            showingPreview={showingPreview}
            onTogglePreview={() => setShowingPreview((prev) => !prev)}
          />
        )}

        {/* PARTIDO DE LA NOCHE (Epic Live Spotlight Card) */}
        {spotlightMatch && (
          <SpotlightMatchCard
            match={spotlightMatch}
            userPrediction={userPredictions[spotlightMatch.id]}
            onSaveUserPrediction={handleSaveUserPrediction}
          />
        )}

        {/* SECCIÓN DUAL: GRID DE OTROS PARTIDOS + ASISTENTE GEMINI RAG */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Grid de Otros Partidos de la Jornada (8 Cols on XL) */}
          <div className="xl:col-span-8 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-brand-white">
                Otros Partidos de la Jornada
              </h2>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("ALL");
                  setSearchQuery("");
                  setShowingPreview(true);
                }}
                className="font-label-md text-label-md text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                Ver fixture completo ({activeSourceMatches.length})
                <span className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
              </button>
            </div>

            {otherMatches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherMatches.map((match) => (
                  <MatchGridCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-surface-container-low border border-outline-variant/15 text-center space-y-2">
                <span className="material-symbols-outlined text-brand-mint text-[32px]">
                  sports_soccer
                </span>
                <p className="font-headline-md text-headline-md text-brand-white">
                  No hay partidos para esta semana
                </p>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Próxima jornada: {nextMatchdayDate}. Pulsa &ldquo;Ver Partidos de Jornada 7/8&rdquo; arriba para explorar los encuentros y pronósticos Poisson.
                </p>
              </div>
            )}
          </div>

          {/* Panel Integrado: Chatbot IA (Google Gemini RAG) (4 Cols on XL) */}
          <GeminiTacticalPanel matches={activeSourceMatches} />
        </div>
      </div>
    </PitchlineShell>
  );
}
