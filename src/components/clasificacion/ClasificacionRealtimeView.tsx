"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  KnockoutStageKey,
  MatchRow,
  MatchWithDetails,
  StandingRow,
} from "@/types/database";
import {
  isStillInLeagueStage,
  STITCH_REFERENCE_STANDINGS,
} from "@/data/stitch-standings";
import { STITCH_REFERENCE_MATCHES } from "@/data/stitch-matches";
import {
  getActiveOrNextPhaseKey,
  getPhaseDisplayInfo,
} from "@/lib/date-utils";
import { PitchlineShell } from "@/components/layout/PitchlineShell";
import { KnockoutBracket } from "@/components/brackets/KnockoutBracket";

export type ClasificacionSubTab = "LIGA" | KnockoutStageKey;
type ZoneFilter = "ALL" | "DIRECT_R16" | "PLAYOFF" | "ELIMINATED";
type PageSlice = "ALL" | "1-16" | "17-36";

interface ClasificacionRealtimeViewProps {
  initialStandings: StandingRow[];
  initialMatches: MatchWithDetails[];
}

export function ClasificacionRealtimeView({
  initialStandings,
  initialMatches,
}: ClasificacionRealtimeViewProps) {
  const [dbStandings, setDbStandings] =
    useState<StandingRow[]>(initialStandings);
  const [dbMatches, setDbMatches] =
    useState<MatchWithDetails[]>(initialMatches);

  const [activeSubTab, setActiveSubTab] =
    useState<ClasificacionSubTab>("LIGA");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>("ALL");
  const [pageSlice, setPageSlice] = useState<PageSlice>("ALL");

  const [realtimeStatus, setRealtimeStatus] = useState<
    "CONNECTING" | "SUBSCRIBED" | "ERROR"
  >("CONNECTING");
  const [lastSyncLabel, setLastSyncLabel] = useState<string>(
    "Sincronizado en vivo"
  );

  // Suscripción WebSocket en Tiempo Real a las tablas `standings` y `matches` de Supabase Realtime
  useEffect(() => {
    const supabase = createClient();

    const handleCustomSync = async () => {
      const [stRes, mRes] = await Promise.all([
        supabase.from("standings").select("*").order("rank", { ascending: true }),
        supabase.from("matches").select("*").order("kickoff_at", { ascending: true }),
      ]);
      if (stRes.data && stRes.data.length > 0) {
        setDbStandings(stRes.data as StandingRow[]);
      }
      if (mRes.data && mRes.data.length > 0) {
        setDbMatches(mRes.data as MatchWithDetails[]);
      }
      const nowLabel = new Intl.DateTimeFormat("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date());
      setLastSyncLabel(`Sync ${nowLabel}`);
    };

    window.addEventListener("pitchline:synced", handleCustomSync);

    const channel = supabase
      .channel("pitchline-clasificacion-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "standings",
        },
        (payload) => {
          const nowLabel = new Intl.DateTimeFormat("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date());
          setLastSyncLabel(`Tabla Sync ${nowLabel}`);

          if (payload.eventType === "INSERT") {
            const added = payload.new as StandingRow;
            setDbStandings((prev) => {
              const filtered = prev.filter((r) => r.team_id !== added.team_id);
              return [...filtered, added].sort((a, b) => a.rank - b.rank);
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as StandingRow;
            setDbStandings((prev) =>
              prev
                .map((r) =>
                  r.team_id === updated.team_id ? { ...r, ...updated } : r
                )
                .sort((a, b) => a.rank - b.rank)
            );
          } else if (payload.eventType === "DELETE") {
            const deletedTeamId = (payload.old as { team_id?: number })
              ?.team_id;
            if (deletedTeamId) {
              setDbStandings((prev) =>
                prev.filter((r) => r.team_id !== deletedTeamId)
              );
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        (payload) => {
          const nowLabel = new Intl.DateTimeFormat("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date());
          setLastSyncLabel(`Llaves Sync ${nowLabel}`);

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
  }, []);

  // Fuente activa de los 36 clubes: si la tabla `standings` de Supabase tiene registros los usamos; si está vacía usamos los 36 clubes oficiales de referencia
  const activeStandings = useMemo(() => {
    if (dbStandings.length > 0) {
      return [...dbStandings].sort((a, b) => a.rank - b.rank);
    }
    return STITCH_REFERENCE_STANDINGS;
  }, [dbStandings]);

  const activeMatches = useMemo(() => {
    if (dbMatches.length > 0) {
      return dbMatches;
    }
    return STITCH_REFERENCE_MATCHES;
  }, [dbMatches]);

  const stillInLeagueStage = useMemo(
    () => isStillInLeagueStage(activeStandings, activeMatches),
    [activeStandings, activeMatches]
  );

  const leagueMetrics = useMemo(() => {
    const totalGoals = activeStandings.reduce(
      (acc, r) => acc + (r.goals_for ?? 0),
      0
    );
    const totalPlayedHalf =
      activeStandings.reduce((acc, r) => acc + (r.played ?? 0), 0) / 2;
    const avgPerMatch =
      totalPlayedHalf > 0 ? (totalGoals / totalPlayedHalf).toFixed(2) : "0.00";
    const leader = activeStandings[0] ?? null;
    return {
      totalGoals,
      avgPerMatch,
      leaderName: leader?.team_name ?? "Por definir",
      leaderPoints: leader?.points ?? 0,
    };
  }, [activeStandings]);

  // Filtrado de la tabla de 36 clubes por búsqueda, zona y paginación
  const filteredStandings = useMemo(() => {
    return activeStandings.filter((team) => {
      if (zoneFilter === "DIRECT_R16" && team.rank > 8) return false;
      if (zoneFilter === "PLAYOFF" && (team.rank < 9 || team.rank > 24))
        return false;
      if (zoneFilter === "ELIMINATED" && team.rank < 25) return false;

      if (pageSlice === "1-16" && team.rank > 16) return false;
      if (pageSlice === "17-36" && team.rank < 17) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName =
          team.team_name.toLowerCase().includes(q) ||
          (team.team_short_name ?? "").toLowerCase().includes(q);
        if (!matchesName) return false;
      }

      return true;
    });
  }, [activeStandings, zoneFilter, pageSlice, searchQuery]);

  // Exportar CSV de la clasificación de 36 equipos
  const handleExportCSV = () => {
    const headers = [
      "Pos",
      "Club",
      "Abrev",
      "PJ",
      "V",
      "E",
      "D",
      "GF",
      "GC",
      "DG",
      "Pts",
      "Racha",
      "Zona",
    ];
    const rows = activeStandings.map((t) => [
      t.rank,
      `"${t.team_name}"`,
      t.team_short_name ?? "",
      t.played,
      t.won,
      t.drawn,
      t.lost,
      t.goals_for,
      t.goals_against,
      t.goal_diff,
      t.points,
      `"${t.form ?? ""}"`,
      t.rank <= 8
        ? "Octavos Directo"
        : t.rank <= 24
          ? "Playoffs"
          : "Eliminado",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "pitchline_ucl_clasificacion_36.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [showAllStats, setShowAllStats] = useState(false);

  const subTabs: {
    id: ClasificacionSubTab;
    label: string;
  }[] = [
    {
      id: "LIGA",
      label: "Fase de Liga",
    },
    {
      id: "R16",
      label: "Octavos",
    },
    {
      id: "QF",
      label: "Cuartos",
    },
    {
      id: "SF",
      label: "Semifinales",
    },
    {
      id: "FINAL",
      label: "Final",
    },
  ];

  const maxPlayedMd = useMemo(() => {
    const maxPlayed = activeStandings.reduce(
      (max, s) => (s.played > max ? s.played : max),
      0
    );
    return Math.min(8, Math.max(1, maxPlayed));
  }, [activeStandings]);

  const dynamicMatchdayLabel = useMemo(() => {
    const activePhase = getActiveOrNextPhaseKey(activeMatches);
    if (activeSubTab !== "LIGA") {
      const info = getPhaseDisplayInfo(activeMatches, activeSubTab, activePhase);
      return info.headerPillLabel;
    }
    if (!stillInLeagueStage) {
      const info = getPhaseDisplayInfo(activeMatches, activePhase, activePhase);
      return info.headerPillLabel;
    }
    if (maxPlayedMd >= 8) {
      return "J8 Finalizada (Fase de Liga Completa)";
    }
    return `J${maxPlayedMd} Jugada • Próxima J${maxPlayedMd + 1}`;
  }, [activeMatches, activeSubTab, stillInLeagueStage, maxPlayedMd]);

  return (
    <PitchlineShell
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      currentMatchdayLabel={dynamicMatchdayLabel}
      searchPlaceholder="Buscar clubes, llaves o jugadores..."
    >
      <div className="flex flex-col w-full space-y-5">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-on-surface-variant">UEFA Champions League</p>
            <h1 className="font-headline-lg text-headline-lg text-brand-white">Clasificación</h1>
            <p className="text-sm text-on-surface-variant">{realtimeStatus === "SUBSCRIBED" ? "Conexión activa" : lastSyncLabel}</p>
          </div>
          <button type="button" onClick={handleExportCSV} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-on-surface-variant hover:bg-white/5 hover:text-brand-white">
            <span aria-hidden="true" className="material-symbols-outlined text-[17px]">download</span>
            Descargar CSV
          </button>
        </section>
        <div role="tablist" aria-label="Fases de la Champions League" className="flex gap-1 overflow-x-auto border-b border-white/8 no-scrollbar">
          {subTabs.map(tab => (
            <button key={tab.id} role="tab" aria-selected={activeSubTab === tab.id} type="button" onClick={() => setActiveSubTab(tab.id)} className="pitchline-tab shrink-0 px-3 py-3 text-sm sm:px-4">
              {tab.label}
            </button>
          ))}
        </div>
        {activeSubTab === "LIGA" && (
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-surface-variant">
            <span>Líder · <strong className="font-medium text-brand-white">{leagueMetrics.leaderName}</strong> · {leagueMetrics.leaderPoints} pts</span>
            <span>{leagueMetrics.totalGoals} goles · {leagueMetrics.avgPerMatch} por partido</span>
          </p>
        )}

        {/* CONTENIDO PRINCIPAL SEGÚN LA SUB-PESTAÑA ACTIVA */}
        {activeSubTab === "LIGA" ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* TABLA DE FASE DE LIGA DE 36 EQUIPOS (12 COLS SI SIGUE EN FASE DE LIGA, 7 COLS SI YA HAY ELIMINATORIAS) */}
            <section
              className={`${
                stillInLeagueStage ? "xl:col-span-12" : "xl:col-span-7"
              } flex flex-col gap-3`}
            >
              {/* Classification Zone Legend Pill Bar & Fast Filter */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    aria-pressed={zoneFilter === "DIRECT_R16"}
                    onClick={() =>
                      setZoneFilter((prev) =>
                        prev === "DIRECT_R16" ? "ALL" : "DIRECT_R16"
                      )
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 min-h-9 rounded-lg transition-colors cursor-pointer ${
                      zoneFilter === "DIRECT_R16"
                        ? "bg-brand-mint/20 ring-1 ring-brand-mint text-brand-white"
                        : "text-on-surface-variant hover:bg-white/5"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#19D392] "></span>
                    <span className="font-label-sm text-xs font-medium">
                      1–8 Octavos
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={zoneFilter === "PLAYOFF"}
                    onClick={() =>
                      setZoneFilter((prev) =>
                        prev === "PLAYOFF" ? "ALL" : "PLAYOFF"
                      )
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      zoneFilter === "PLAYOFF"
                        ? "bg-primary/20 ring-1 ring-primary text-brand-white"
                        : "text-on-surface-variant hover:bg-white/5"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-primary "></span>
                    <span className="font-label-sm text-xs">
                      9–24 Playoffs
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={zoneFilter === "ELIMINATED"}
                    onClick={() =>
                      setZoneFilter((prev) =>
                        prev === "ELIMINATED" ? "ALL" : "ELIMINATED"
                      )
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      zoneFilter === "ELIMINATED"
                        ? "bg-error/20 ring-1 ring-error text-brand-white"
                        : "text-on-surface-variant hover:bg-white/5"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
                    <span className="font-label-sm text-xs">
                      25–36 Eliminados
                    </span>
                  </button>
                </div>

                <button type="button" aria-pressed={showAllStats} onClick={() => setShowAllStats(value => !value)} className="min-h-10 rounded-lg px-2 text-xs text-on-surface-variant hover:bg-white/5 hover:text-brand-white sm:hidden">
                  {showAllStats ? "Vista compacta" : "Todas las estadísticas"}
                </button>
              </div>

              {/* Table Container Card (PJ, V, E, D, GF, GC, DG, Pts y Racha de últimos 5 partidos) */}
              <div className="bg-surface-container-low rounded-xl overflow-hidden  border border-white/8 flex flex-col">
                <div className="overflow-x-auto" role="region" aria-label="Tabla de posiciones" tabIndex={0}>
                  <div className={showAllStats ? "min-w-[660px]" : "standings-compact sm:min-w-[660px]"}>
                    {/* Standings Header Row */}
                    <div className="standings-row grid grid-cols-12 px-3 py-3 bg-white/3 text-on-surface-variant font-label-sm text-[11px] uppercase tracking-wider items-center select-none border-b border-white/10">
                      <div className="col-span-1 text-center font-bold">#</div>
                      <div className="standings-team col-span-3 pl-1">Club</div>
                      <div className="standings-stats col-span-6 grid grid-cols-8 text-center items-center">
                        <span title="Partidos Jugados">PJ</span>
                        <span title="Victorias">V</span>
                        <span title="Empates">E</span>
                        <span title="Derrotas">D</span>
                        <span title="Goles a Favor">GF</span>
                        <span title="Goles en Contra">GC</span>
                        <span title="Diferencia de Gol" className="font-bold">
                          DG
                        </span>
                        <span
                          title="Puntos"
                          className="text-brand-mint font-bold"
                        >
                          Pts
                        </span>
                      </div>
                      <div className="standings-form col-span-2 text-right pr-2">
                        Racha (5)
                      </div>
                    </div>

                    {/* Table Body Rows Container */}
                    <div className="divide-y divide-white/6">
                      {filteredStandings.length === 0 && <p className="px-4 py-6 text-sm text-on-surface-variant">No hay clubes que coincidan con los filtros.</p>}
                      {filteredStandings.map((team) => {
                        const isDirectR16 = team.rank >= 1 && team.rank <= 8;
                        const isPlayoff = team.rank >= 9 && team.rank <= 24;

                        const formItems = (team.form ?? "V,E,V,E,V")
                          .split(",")
                          .map((s) => s.trim().toUpperCase())
                          .filter(Boolean)
                          .slice(0, 5);

                        const zoneBarColor = isDirectR16
                          ? "bg-[#19D392] "
                          : isPlayoff
                            ? "bg-primary "
                            : "bg-error";

                        const rankTextColor = isDirectR16
                          ? "text-[#19D392]"
                          : isPlayoff
                            ? "text-primary"
                            : "text-error";

                        const dgFormatted =
                          team.goal_diff > 0
                            ? `+${team.goal_diff}`
                            : `${team.goal_diff}`;

                        const showDirectCutoffAfter =
                          team.rank === 8 &&
                          zoneFilter === "ALL" &&
                          !searchQuery.trim();
                        const showPlayoffCutoffAfter =
                          team.rank === 24 &&
                          zoneFilter === "ALL" &&
                          !searchQuery.trim();

                        return (
                          <React.Fragment key={team.team_id}>
                            <div
                              className="standings-row group relative grid grid-cols-12 items-center px-3 py-3 transition-colors hover:bg-white/4"
                            >
                              {/* Indicador Lateral de Zona (1-8 #19D392, 9-24 Playoffs, 25-36 Eliminados) */}
                              <div
                                className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${zoneBarColor}`}
                              ></div>

                              {/* Posición (#) */}
                              <div
                                className={`col-span-1 text-center font-headline-md text-body-md font-bold ${rankTextColor}`}
                              >
                                {team.rank}
                              </div>

                              {/* Club (Escudo / Código + Nombre) */}
                              <div className="standings-team col-span-3 flex items-center gap-2 min-w-0 pl-1">
                                <div
                                  className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden p-0.5 ${rankTextColor}`}
                                >
                                  {team.team_crest_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={team.team_crest_url}
                                      alt={team.team_name}
                                      className="w-full h-full object-contain"
                                    />
                                  ) : (
                                    <span>
                                      {team.team_short_name ??
                                        team.team_name
                                          .slice(0, 3)
                                          .toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <span className="font-label-md text-body-md font-semibold text-brand-white truncate group-hover:text-brand-mint transition-colors">
                                  {team.team_name}
                                </span>
                              </div>

                              {/* Estadísticas: PJ, V, E, D, GF, GC, DG, Pts */}
                              <div className="standings-stats col-span-6 grid grid-cols-8 text-center items-center font-tabular-stats text-tabular-stats">
                                <span className="text-on-surface-variant">
                                  {team.played}
                                </span>
                                <span className="text-on-surface font-medium">
                                  {team.won}
                                </span>
                                <span className="text-on-surface-variant">
                                  {team.drawn}
                                </span>
                                <span className="text-on-surface-variant">
                                  {team.lost}
                                </span>
                                <span className="text-on-surface-variant">
                                  {team.goals_for}
                                </span>
                                <span className="text-on-surface-variant">
                                  {team.goals_against}
                                </span>
                                <span
                                  className={`font-semibold ${rankTextColor}`}
                                >
                                  {dgFormatted}
                                </span>
                                <span
                                  className={`font-headline-md text-body-md font-bold ${rankTextColor}`}
                                >
                                  {team.points}
                                </span>
                              </div>

                              {/* Racha de últimos 5 partidos */}
                              <div className="standings-form col-span-2 flex items-center justify-end gap-1 pr-1">
                                {formItems.map((res, fIdx) => {
                                  const isWin = res === "V" || res === "W";
                                  const isDraw = res === "E" || res === "D_DRAW";
                                  const label = isWin
                                    ? "V"
                                    : res === "E"
                                      ? "E"
                                      : "D";

                                  const badgeStyle = isWin
                                    ? "bg-brand-mint/12 text-brand-mint"
                                    : isDraw
                                      ? "bg-surface-bright text-on-surface"
                                      : "bg-error/10 text-error";

                                  return (
                                    <span
                                      key={`${team.team_id}-f-${fIdx}`}
                                      className={`w-4 h-4 rounded font-label-sm text-[9px] flex items-center justify-center font-bold ${badgeStyle}`}
                                    >
                                      {label}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {(showDirectCutoffAfter || showPlayoffCutoffAfter) && (
                              <div className="border-t border-white/10 px-4 py-2 text-xs text-on-surface-variant">
                                {showDirectCutoffAfter ? "Playoffs · puestos 9–24" : "Eliminados · puestos 25–36"}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Table Footer Navigation / Status Bar */}
                <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/8">
                  <span className="text-on-surface-variant font-tabular-stats text-xs">
                    Mostrando {filteredStandings.length} de{" "}
                    {activeStandings.length} clubes cargados
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setZoneFilter("ALL");
                        setPageSlice("1-16");
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-label-sm cursor-pointer transition-colors ${
                        pageSlice === "1-16"
                          ? "bg-brand-mint/10 text-brand-mint font-semibold"
                          : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      1-16
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZoneFilter("ALL");
                        setPageSlice("17-36");
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-label-sm cursor-pointer transition-colors ${
                        pageSlice === "17-36"
                          ? "bg-brand-mint/10 text-brand-mint font-semibold"
                          : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      17-36
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZoneFilter("ALL");
                        setPageSlice("ALL");
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-label-sm cursor-pointer transition-colors ${
                        pageSlice === "ALL"
                          ? "bg-brand-mint/10 text-brand-mint font-semibold"
                          : "bg-surface-container-high text-brand-mint font-semibold"
                      }`}
                    >
                      Ver Todos (36)
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* COLUMNA DERECHA (5 COLS XL): CUADRO ELIMINATORIO EN VIVO (Solo cuando ya inició fase eliminatoria) */}
            {!stillInLeagueStage && (
              <section className="xl:col-span-5">
                <KnockoutBracket
                  mode="live"
                  standings={activeStandings}
                  matches={activeMatches}
                  compact
                  onSelectRoundTab={(round) => setActiveSubTab(round)}
                />
              </section>
            )}
          </div>
        ) : (
          /* VISTA DE ELIMINATORIAS COMPLETA (Octavos, Cuartos, Semifinales o Final) */
          <section className="w-full">
            <KnockoutBracket
              mode="live"
              standings={activeStandings}
              matches={activeMatches}
              focusedRound={activeSubTab}
            />
          </section>
        )}
      </div>
    </PitchlineShell>
  );
}
