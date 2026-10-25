"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  KnockoutStageKey,
  KnockoutTeamSlot,
  KnockoutTieNode,
  MatchWithDetails,
  StandingRow,
  UserBracketData,
  UserBracketRow,
} from "@/types/database";
import {
  buildKnockoutBracketTies,
  isStillInLeagueStage,
  STITCH_REFERENCE_STANDINGS,
} from "@/data/stitch-standings";
import {
  getNextMatchdayDateLabel,
  getUpcomingPhaseMatchesSummary,
} from "@/lib/date-utils";

export interface KnockoutBracketProps {
  mode: "live" | "simulator";
  standings?: StandingRow[];
  matches?: MatchWithDetails[];
  focusedRound?: "ALL" | KnockoutStageKey;
  compact?: boolean;
  onSelectRoundTab?: (round: KnockoutStageKey) => void;
}

const STORAGE_KEY = "pitchline_user_bracket_v1";

const QF_FEEDERS: Record<string, [string, string]> = {
  "QF-1": ["R16-1", "R16-2"],
  "QF-2": ["R16-3", "R16-4"],
  "QF-3": ["R16-5", "R16-6"],
  "QF-4": ["R16-7", "R16-8"],
};

const SF_FEEDERS: Record<string, [string, string]> = {
  "SF-1": ["QF-1", "QF-2"],
  "SF-2": ["QF-3", "QF-4"],
};

const FINAL_FEEDERS: [string, string] = ["SF-1", "SF-2"];

function TeamBadge({
  team,
  isWinner,
}: {
  team: KnockoutTeamSlot | null;
  isWinner?: boolean;
}) {
  if (!team) {
    return (
      <div className="w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center font-label-sm text-[9px] text-on-surface-variant shrink-0">
        ?
      </div>
    );
  }

  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center p-0.5 shrink-0 font-bold text-[9px] ${
        isWinner
          ? "bg-brand-mint/20 text-brand-mint ring-1 ring-brand-mint/50"
          : "bg-surface-container-highest text-primary"
      }`}
    >
      {team.team_crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.team_crest}
          alt={team.team_name}
          className="w-full h-full object-contain"
        />
      ) : (
        <span>{team.team_short}</span>
      )}
    </div>
  );
}

export function KnockoutBracket({
  mode,
  standings = STITCH_REFERENCE_STANDINGS,
  matches = [],
  focusedRound = "ALL",
  compact = false,
  onSelectRoundTab,
}: KnockoutBracketProps) {
  const stillInLeagueStage = useMemo(
    () => isStillInLeagueStage(standings, matches),
    [standings, matches]
  );

  const liveTies = useMemo(
    () => buildKnockoutBracketTies(standings, matches),
    [standings, matches]
  );

  // Sub-filtro interno para el modo compacto o vista completa
  const [userRoundOverride, setUserRoundOverride] = useState<
    "ALL" | KnockoutStageKey | null
  >(null);
  const internalRoundFilter: "ALL" | KnockoutStageKey =
    userRoundOverride ?? focusedRound;
  const setInternalRoundFilter = (round: "ALL" | KnockoutStageKey) => {
    setUserRoundOverride(round);
  };

  // Estado del Simulador ("Arma tu Champions")
  const [bracketName, setBracketName] = useState<string>(
    "Mi Champions 2026/27"
  );
  const [r16Winners, setR16Winners] = useState<Record<string, number>>({});
  const [qfWinners, setQfWinners] = useState<Record<string, number>>({});
  const [sfWinners, setSfWinners] = useState<Record<string, number>>({});
  const [finalWinner, setFinalWinner] = useState<number | null>(null);

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [savedBrackets, setSavedBrackets] = useState<UserBracketRow[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    type: "success" | "info" | "error";
    message: string;
  } | null>(null);

  // Mapa de equipos por ID para resolver selecciones del simulador
  const teamsById = useMemo(() => {
    const map = new Map<number, KnockoutTeamSlot>();
    for (const tie of liveTies) {
      if (tie.homeTeam) map.set(tie.homeTeam.team_id, tie.homeTeam);
      if (tie.awayTeam) map.set(tie.awayTeam.team_id, tie.awayTeam);
    }
    return map;
  }, [liveTies]);

  // Cargar sesión de Supabase Auth y brackets guardados en `user_brackets` (RLS: auth.uid() = user_id)
  useEffect(() => {
    if (mode !== "simulator" || stillInLeagueStage) return;

    const loadUserAndBrackets = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setAuthUserId(null);
          setAuthEmail(null);
          return;
        }

        setAuthUserId(user.id);
        setAuthEmail(user.email ?? "Usuario Autenticado");

        const { data, error } = await supabase
          .from("user_brackets")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (!error && data && data.length > 0) {
          const rows = data as UserBracketRow[];
          setSavedBrackets(rows);
          const latest = rows[0];
          if (latest.bracket_name) setBracketName(latest.bracket_name);
          if (latest.bracket_data) {
            setR16Winners(latest.bracket_data.r16 ?? {});
            setQfWinners(latest.bracket_data.qf ?? {});
            setSfWinners(latest.bracket_data.sf ?? {});
            setFinalWinner(latest.bracket_data.final ?? null);
          }
        }
      } catch {
        // Sesión no iniciada o tabla en modo lectura local
      }
    };

    loadUserAndBrackets();
  }, [mode, stillInLeagueStage]);

  // Nodos base de Octavos para el simulador
  const r16Ties = useMemo(
    () => liveTies.filter((t) => t.stage === "R16"),
    [liveTies]
  );

  // En modo simulador, calculamos dinámicamente los cruces de Cuartos, Semis y Final según las elecciones del usuario
  const simulatorTies = useMemo(() => {
    const qfNodes: KnockoutTieNode[] = ["QF-1", "QF-2", "QF-3", "QF-4"].map(
      (slot, idx) => {
        const [feedA, feedB] = QF_FEEDERS[slot];
        const homeId = r16Winners[feedA] ?? null;
        const awayId = r16Winners[feedB] ?? null;
        const homeTeam = homeId ? (teamsById.get(homeId) ?? null) : null;
        const awayTeam = awayId ? (teamsById.get(awayId) ?? null) : null;
        return {
          slot,
          stage: "QF",
          routeLabel: `Cuartos ${idx + 1} • ${idx < 2 ? "Ruta Plata" : "Ruta Azul"}`,
          dateLabel: "Abril 2025 • Ida & Vuelta",
          status: "SCHEDULED",
          homeTeam,
          awayTeam,
          homeLeg1Score: null,
          awayLeg1Score: null,
          homeLeg2Score: null,
          awayLeg2Score: null,
          homeAggregate: null,
          awayAggregate: null,
          winnerTeamId: qfWinners[slot] ?? null,
        };
      }
    );

    const sfNodes: KnockoutTieNode[] = ["SF-1", "SF-2"].map((slot, idx) => {
      const [feedA, feedB] = SF_FEEDERS[slot];
      const homeId = qfWinners[feedA] ?? null;
      const awayId = qfWinners[feedB] ?? null;
      const homeTeam = homeId ? (teamsById.get(homeId) ?? null) : null;
      const awayTeam = awayId ? (teamsById.get(awayId) ?? null) : null;
      return {
        slot,
        stage: "SF",
        routeLabel: `Semifinal ${idx + 1} • ${idx === 0 ? "Ruta Plata" : "Ruta Azul"}`,
        dateLabel: "Mayo 2025 • Ida & Vuelta",
        status: "SCHEDULED",
        homeTeam,
        awayTeam,
        homeLeg1Score: null,
        awayLeg1Score: null,
        homeLeg2Score: null,
        awayLeg2Score: null,
        homeAggregate: null,
        awayAggregate: null,
        winnerTeamId: sfWinners[slot] ?? null,
      };
    });

    const finalHomeId = sfWinners[FINAL_FEEDERS[0]] ?? null;
    const finalAwayId = sfWinners[FINAL_FEEDERS[1]] ?? null;
    const finalNode: KnockoutTieNode = {
      slot: "FINAL",
      stage: "FINAL",
      routeLabel: "Gran Final • Múnich",
      dateLabel: "31 Mayo 2025 • Allianz Arena",
      venueLabel: "Allianz Arena, Múnich",
      status: "SCHEDULED",
      homeTeam: finalHomeId ? (teamsById.get(finalHomeId) ?? null) : null,
      awayTeam: finalAwayId ? (teamsById.get(finalAwayId) ?? null) : null,
      homeLeg1Score: null,
      awayLeg1Score: null,
      homeLeg2Score: null,
      awayLeg2Score: null,
      homeAggregate: null,
      awayAggregate: null,
      winnerTeamId: finalWinner,
    };

    const r16SimNodes: KnockoutTieNode[] = r16Ties.map((t) => ({
      ...t,
      winnerTeamId: r16Winners[t.slot] ?? null,
    }));

    return {
      r16: r16SimNodes,
      qf: qfNodes,
      sf: sfNodes,
      final: finalNode,
    };
  }, [r16Ties, r16Winners, qfWinners, sfWinners, finalWinner, teamsById]);

  const completedDecisionsCount = useMemo(() => {
    return (
      Object.keys(r16Winners).length +
      Object.keys(qfWinners).length +
      Object.keys(sfWinners).length +
      (finalWinner ? 1 : 0)
    );
  }, [r16Winners, qfWinners, sfWinners, finalWinner]);

  const championTeam = useMemo(() => {
    if (mode === "simulator") {
      return finalWinner ? (teamsById.get(finalWinner) ?? null) : null;
    }
    const finalTie = liveTies.find((t) => t.stage === "FINAL");
    return finalTie?.winnerTeamId
      ? (teamsById.get(finalTie.winnerTeamId) ?? finalTie.homeTeam)
      : null;
  }, [mode, finalWinner, liveTies, teamsById]);

  // Handlers de selección en cascada para el modo "simulator"
  const handlePickR16Winner = (slot: string, teamId: number) => {
    const prevWinner = r16Winners[slot];
    setR16Winners((prev) => ({ ...prev, [slot]: teamId }));

    if (prevWinner && prevWinner !== teamId) {
      // Limpiar selecciones posteriores si el equipo anterior había avanzado
      setQfWinners((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(next)) {
          if (v === prevWinner) delete next[k];
        }
        return next;
      });
      setSfWinners((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(next)) {
          if (v === prevWinner) delete next[k];
        }
        return next;
      });
      setFinalWinner((prev) => (prev === prevWinner ? null : prev));
    }
    setSaveFeedback(null);
  };

  const handlePickQfWinner = (slot: string, teamId: number) => {
    const prevWinner = qfWinners[slot];
    setQfWinners((prev) => ({ ...prev, [slot]: teamId }));

    if (prevWinner && prevWinner !== teamId) {
      setSfWinners((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(next)) {
          if (v === prevWinner) delete next[k];
        }
        return next;
      });
      setFinalWinner((prev) => (prev === prevWinner ? null : prev));
    }
    setSaveFeedback(null);
  };

  const handlePickSfWinner = (slot: string, teamId: number) => {
    const prevWinner = sfWinners[slot];
    setSfWinners((prev) => ({ ...prev, [slot]: teamId }));

    if (prevWinner && prevWinner !== teamId) {
      setFinalWinner((prev) => (prev === prevWinner ? null : prev));
    }
    setSaveFeedback(null);
  };

  const handlePickFinalWinner = (teamId: number) => {
    setFinalWinner(teamId);
    setSaveFeedback(null);
  };

  // Autocompletar con IA (Poisson / Ranking UEFA)
  const handleAutoFillWithAI = () => {
    const nextR16: Record<string, number> = {};
    for (const tie of r16Ties) {
      if (tie.homeTeam && tie.awayTeam) {
        const winner =
          tie.homeTeam.seed <= tie.awayTeam.seed
            ? tie.homeTeam.team_id
            : tie.awayTeam.team_id;
        nextR16[tie.slot] = tie.winnerTeamId ?? winner;
      }
    }

    const nextQf: Record<string, number> = {};
    for (const [qfSlot, [fA, fB]] of Object.entries(QF_FEEDERS)) {
      const tA = teamsById.get(nextR16[fA]);
      const tB = teamsById.get(nextR16[fB]);
      if (tA && tB) {
        nextQf[qfSlot] = tA.seed <= tB.seed ? tA.team_id : tB.team_id;
      }
    }

    const nextSf: Record<string, number> = {};
    for (const [sfSlot, [fA, fB]] of Object.entries(SF_FEEDERS)) {
      const tA = teamsById.get(nextQf[fA]);
      const tB = teamsById.get(nextQf[fB]);
      if (tA && tB) {
        nextSf[sfSlot] = tA.seed <= tB.seed ? tA.team_id : tB.team_id;
      }
    }

    const fHome = teamsById.get(nextSf["SF-1"]);
    const fAway = teamsById.get(nextSf["SF-2"]);
    const nextFinal =
      fHome && fAway
        ? fHome.seed <= fAway.seed
          ? fHome.team_id
          : fAway.team_id
        : (fHome?.team_id ?? null);

    setR16Winners(nextR16);
    setQfWinners(nextQf);
    setSfWinners(nextSf);
    setFinalWinner(nextFinal);
    setSaveFeedback({
      type: "info",
      message:
        "Bracket autocompletado con el modelo algorítmico de Pitchline (Sembrados UEFA & xG). ¡Puedes ajustar cualquier llave haciendo clic!",
    });
  };

  const handleResetBracket = () => {
    setR16Winners({});
    setQfWinners({});
    setSfWinners({});
    setFinalWinner(null);
    setSaveFeedback({
      type: "info",
      message: "Bracket reiniciado. Selecciona tus ganadores desde Octavos de Final.",
    });
  };

  // Guardar en `user_brackets` respetando Row Level Security (AGENTS.md Regla 2 y 3)
  const handleSaveBracketToSupabase = async () => {
    setIsSaving(true);
    setSaveFeedback(null);

    const payloadData: UserBracketData = {
      r16: r16Winners,
      qf: qfWinners,
      sf: sfWinners,
      final: finalWinner,
    };

    const champTeam = finalWinner ? (teamsById.get(finalWinner) ?? null) : null;

    // Guardar respaldo instantáneo en el navegador
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          bracketName,
          data: payloadData,
          championTeamName: champTeam?.team_name ?? null,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Ignorar si localStorage no está disponible
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSaveFeedback({
          type: "info",
          message: `Predicción "${bracketName}" guardada en este dispositivo${
            champTeam ? ` (Campeón: ${champTeam.team_name})` : ""
          }. Inicia sesión en /login para guardar tu predicción en tu cuenta.`,
        });
        setIsSaving(false);
        return;
      }

      const fullRecord = {
        user_id: user.id,
        season: 2025,
        bracket_name: bracketName.trim() || "Mi Champions 2026/27",
        bracket_data: payloadData,
        champion_team_id: champTeam?.team_id ?? null,
        champion_team_name: champTeam?.team_name ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data: inserted, error } = await supabase
        .from("user_brackets")
        .insert(fullRecord)
        .select("*");

      if (error) {
        const { error: fallbackError } = await supabase
          .from("user_brackets")
          .insert({
            user_id: user.id,
            bracket_data: payloadData,
          });

        if (fallbackError) {
          setSaveFeedback({
            type: "info",
            message: `Predicción "${bracketName}" guardada en este dispositivo (${
              champTeam ? `Campeón: ${champTeam.team_name}` : "En progreso"
            }).`,
          });
        } else {
          setSaveFeedback({
            type: "success",
            message: `¡Predicción "${bracketName}" guardada exitosamente!`,
          });
        }
      } else {
        if (inserted && inserted.length > 0) {
          setSavedBrackets((prev) => [inserted[0] as UserBracketRow, ...prev]);
        }
        setSaveFeedback({
          type: "success",
          message: `¡Predicción "${bracketName}" guardada exitosamente${
            champTeam ? ` con ${champTeam.team_name} como Campeón` : ""
          }!`,
        });
      }
    } catch {
      setSaveFeedback({
        type: "info",
        message: `Bracket "${bracketName}" guardado localmente en tu navegador.`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================================
  // SI EL TORNEO SIGUE EN FASE DE LIGA (AÚN NO HAY LLAVES DEFINIDAS DE OCTAVOS)
  // ============================================================================
  if (stillInLeagueStage) {
    const maxPlayed = standings.reduce(
      (acc, row) => Math.max(acc, row.played ?? 0),
      0
    );
    const nextMatchday = Math.min(8, maxPlayed + 1);
    const nextPhaseDateLabel = getNextMatchdayDateLabel(matches);
    const upcomingPhaseText = getUpcomingPhaseMatchesSummary(matches);

    // 1. MODO SIMULADOR (/simulador — "Arma tu Champions"):
    // No debe aparecer ningún cuadro ni predicción de llaves porque aún no ha empezado Octavos.
    if (mode === "simulator") {
      return (
        <div className="p-8 sm:p-10 rounded-2xl bg-surface-container border border-outline-variant/20 shadow-xl flex flex-col items-center text-center max-w-3xl mx-auto my-4 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-brand-mint/10 border border-brand-mint/30 flex items-center justify-center text-brand-mint shadow-[0_0_24px_rgba(25,211,146,0.2)]">
            <span className="material-symbols-outlined text-[34px]">lock_clock</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-container-high border border-outline-variant/20 font-label-sm text-label-sm uppercase tracking-wider text-brand-mint font-bold">
            <span className="w-2 h-2 rounded-full bg-brand-mint animate-pulse"></span>
            Fase de Liga en Curso • Jornada {maxPlayed} de 8 Jugadas
          </div>

          <div className="space-y-2">
            <h1 className="font-headline-lg text-headline-md sm:text-headline-lg text-brand-white font-bold">
              Predicciones de Eliminatorias aún no disponibles
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xl mx-auto leading-relaxed">
              La UEFA Champions League 2026/27 se encuentra actualmente en la{" "}
              <strong className="text-brand-white">Fase de Liga</strong> (próxima:{" "}
              <strong className="text-brand-mint">
                {nextPhaseDateLabel}
              </strong>
              ). Como aún no han comenzado los Octavos de Final ni están definidas
              las llaves, el simulador de eliminatorias se abrirá en cuanto se
              definan los 16 clubes clasificados.
            </p>
            <p className="font-label-md text-label-md text-brand-mint pt-1">
              {upcomingPhaseText}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left pt-2">
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/15">
              <span className="font-label-sm text-[11px] uppercase text-brand-mint font-bold block">
                Puestos 1 al 8
              </span>
              <span className="font-body-md text-label-md text-brand-white font-semibold block mt-0.5">
                Pase directo a Octavos
              </span>
              <span className="font-label-sm text-[11px] text-on-surface-variant block mt-0.5">
                En disputa (Jornadas 1–8)
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/15">
              <span className="font-label-sm text-[11px] uppercase text-primary font-bold block">
                Puestos 9 al 24
              </span>
              <span className="font-body-md text-label-md text-brand-white font-semibold block mt-0.5">
                Playoffs Eliminatorios
              </span>
              <span className="font-label-sm text-[11px] text-on-surface-variant block mt-0.5">
                Definen los otros 8 cupos
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/15">
              <span className="font-label-sm text-[11px] uppercase text-on-surface-variant font-bold block">
                Octavos a la Final
              </span>
              <span className="font-body-md text-label-md text-brand-white font-semibold block mt-0.5">
                Llaves por definir
              </span>
              <span className="font-label-sm text-[11px] text-on-surface-variant block mt-0.5">
                Se habilita tras el sorteo UEFA
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/partidos"
              className="px-5 py-2.5 rounded-xl bg-brand-mint text-brand-navy font-label-md text-label-md font-bold hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_18px_rgba(25,211,146,0.25)]"
            >
              <span className="material-symbols-outlined text-[18px]">
                analytics
              </span>
              <span>Ver Pronósticos de Jornada {nextMatchday}</span>
            </Link>
            <Link
              href="/clasificacion"
              className="px-5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-md text-label-md font-semibold transition-all flex items-center gap-2 border border-outline-variant/20"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">
                leaderboard
              </span>
              <span>Ver Tabla de Fase de Liga (36)</span>
            </Link>
          </div>
        </div>
      );
    }

    // 2. MODO LIVE COMPACTO (Columna derecha en /clasificacion durante la Fase de Liga):
    if (compact) {
      return (
        <div className="flex flex-col gap-3">
          <div className="p-3.5 bg-surface-container rounded-xl flex items-center justify-between shadow-sm border border-outline-variant/15">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-brand-mint text-[22px]">
                account_tree
              </span>
              <div>
                <h2 className="font-headline-md text-body-md font-bold text-brand-white leading-tight">
                  Fases Eliminatorias UEFA
                </h2>
                <p className="font-label-sm text-label-sm text-on-surface-variant font-normal">
                  Estado de las llaves de Octavos a la Final
                </p>
              </div>
            </div>
            <span className="font-label-sm text-label-sm uppercase bg-surface-container-highest text-brand-mint font-bold px-2.5 py-1 rounded-md border border-brand-mint/30">
              En espera
            </span>
          </div>

          <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-brand-mint/10 border border-brand-mint/25 flex items-center justify-center text-brand-mint">
              <span className="material-symbols-outlined text-[26px]">
                hourglass_top
              </span>
            </div>
            <h3 className="font-headline-md text-body-md font-bold text-brand-white">
              Llaves Eliminatorias Aún No Definidas
            </h3>
            <p className="font-body-md text-label-md text-on-surface-variant leading-relaxed">
              El torneo se encuentra en la{" "}
              <strong className="text-brand-white">
                Fase de Liga ({maxPlayed} de 8 jornadas jugadas)
              </strong>
              . Los cruces de Octavos, Cuartos, Semifinales y Final aparecerán
              únicamente cuando concluya la Fase de Liga y se definan las llaves
              oficiales.
            </p>
          </div>
        </div>
      );
    }

    // 3. MODO LIVE COMPLETO (Cuando el usuario entra a las pestañas Octavos, Cuartos, Semifinales o Final en /clasificacion):
    const roundTitleMap: Record<string, string> = {
      ALL: "Eliminatorias UEFA Champions League",
      R16: "Octavos de Final",
      QF: "Cuartos de Final",
      SF: "Semifinales",
      FINAL: "Gran Final",
    };

    return (
      <div className="p-8 sm:p-10 rounded-2xl bg-surface-container border border-outline-variant/20 shadow-xl flex flex-col items-center text-center max-w-2xl mx-auto my-4 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-surface-container-high border border-outline-variant/25 flex items-center justify-center text-brand-mint">
          <span className="material-symbols-outlined text-[30px]">
            event_busy
          </span>
        </div>
        <span className="px-3 py-1 rounded-full bg-brand-mint/15 text-brand-mint font-label-sm text-label-sm uppercase font-bold tracking-wider">
          Fase de Liga en Curso • Próxima: {nextPhaseDateLabel}
        </span>
        <h2 className="font-headline-lg text-headline-md text-brand-white font-bold">
          {roundTitleMap[focusedRound] ?? "Fase Eliminatoria"} — Sin llaves
          definidas
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          Actualmente se sigue disputando la{" "}
          <strong className="text-brand-white">Fase de Liga (36 clubes)</strong>{" "}
          con {maxPlayed} de 8 jornadas completadas. Cuando el torneo avance a{" "}
          <strong className="text-brand-white">
            {roundTitleMap[focusedRound] ?? "esta fase"}
          </strong>
          , aquí se mostrarán automáticamente los cruces y próximos partidos de{" "}
          {roundTitleMap[focusedRound] ?? "la ronda"}.
        </p>
        <p className="font-label-md text-label-md text-brand-mint">
          {upcomingPhaseText}
        </p>
      </div>
    );
  }

  // ============================================================================
  // VISTA COMPACTA (Columna Derecha en /clasificacion cuando Sub-pestaña = "Fase de Liga")
  // ============================================================================
  if (mode === "live" && compact) {
    const compactStage: KnockoutStageKey =
      internalRoundFilter === "ALL" ? "R16" : internalRoundFilter;
    const visibleTies = liveTies.filter((t) => t.stage === compactStage);

    return (
      <div className="flex flex-col gap-3">
        {/* Module Header Card */}
        <div className="p-3.5 bg-surface-container rounded-xl flex items-center justify-between shadow-sm border border-outline-variant/15">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-brand-mint text-[22px]">
              account_tree
            </span>
            <div>
              <h2 className="font-headline-md text-body-md font-bold text-brand-white leading-tight">
                Cuadro Eliminatorio (Bracket UEFA)
              </h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant font-normal">
                Cruces Oficiales en Vivo con Ida &amp; Vuelta
              </p>
            </div>
          </div>
          <span className="font-label-sm text-label-sm uppercase bg-brand-mint text-brand-navy font-bold px-2.5 py-1 rounded-md shadow-[0_0_12px_rgba(25,211,146,0.3)]">
            Allianz Arena
          </span>
        </div>

        {/* Munich Trophy Showcase Card */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-surface-container-low via-surface-container to-surface-container-high p-5 shadow-lg flex items-center justify-between border border-outline-variant/15">
          <div className="flex flex-col z-10 max-w-[68%]">
            <div className="flex items-center gap-1.5 text-brand-mint mb-1">
              <span className="material-symbols-outlined text-[16px]">
                stars
              </span>
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-bold">
                31 Mayo 2025 • Múnich
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md text-brand-white font-bold leading-tight">
              La Gran Final
            </h3>
            <p className="font-body-md text-label-md text-on-surface-variant mt-1 font-normal">
              El nuevo monarca continental se coronará en la capital bávara tras
              superar el camino directo.
            </p>
          </div>
          <div className="relative flex items-center justify-center p-3.5 rounded-full bg-brand-mint/10 shadow-[0_0_30px_rgba(25,211,146,0.2)] border border-brand-mint/20">
            <span className="material-symbols-outlined text-brand-mint text-[48px] select-none">
              emoji_events
            </span>
          </div>
        </div>

        {/* Selector Rápido de Fase dentro del Módulo Lateral */}
        <div className="flex items-center justify-between gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/15">
          {(
            [
              { key: "R16", label: "Octavos (8)" },
              { key: "QF", label: "Cuartos (4)" },
              { key: "SF", label: "Semis (2)" },
              { key: "FINAL", label: "Final (1)" },
            ] as const
          ).map((item) => {
            const active = compactStage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setInternalRoundFilter(item.key)}
                className={`flex-1 py-1.5 px-2 rounded-md font-label-sm text-label-sm transition-all cursor-pointer ${
                  active
                    ? "bg-brand-mint text-brand-navy font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Visual Bracket Arena (Interactive Vertical/Horizontal Tree Canvas) */}
        <div className="bg-surface-container-low rounded-xl p-3.5 shadow-inner border border-outline-variant/15 flex flex-col gap-3.5">
          <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
            {visibleTies.map((tie) => {
              const isHomeWinner = tie.winnerTeamId === tie.homeTeam?.team_id;
              const isAwayWinner = tie.winnerTeamId === tie.awayTeam?.team_id;
              const isLive = tie.status === "IN_PLAY" || tie.status === "HT";
              const winnerName = isHomeWinner
                ? tie.homeTeam?.team_name
                : isAwayWinner
                  ? tie.awayTeam?.team_name
                  : "Por definir";

              return (
                <div key={tie.slot} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-bold">
                      {tie.routeLabel}
                    </span>
                    {isLive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-mint/15 text-brand-mint font-label-sm text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-mint animate-ping"></span>
                        EN VIVO {tie.elapsed_minute}&apos;
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Match Card */}
                    <div className="col-span-7 bg-surface-container rounded-lg p-2.5 shadow hover:bg-surface-container-high transition-all border border-outline-variant/10">
                      <div className="flex items-center justify-between py-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-1 h-3.5 rounded ${
                              isHomeWinner ? "bg-brand-mint" : "bg-surface-bright"
                            }`}
                          ></span>
                          <span
                            className={`font-label-md text-body-md truncate ${
                              isHomeWinner
                                ? "font-bold text-brand-white"
                                : "text-on-surface-variant"
                            }`}
                          >
                            {tie.homeTeam?.team_name ?? "Por definir"}
                          </span>
                        </div>
                        <span
                          className={`font-tabular-stats text-body-md font-bold ${
                            isHomeWinner
                              ? "text-brand-mint"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {tie.homeLeg2Score ?? tie.homeAggregate ?? "-"}
                        </span>
                      </div>

                      <div className="h-px bg-surface-container-highest my-1"></div>

                      <div className="flex items-center justify-between py-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-1 h-3.5 rounded ${
                              isAwayWinner ? "bg-brand-mint" : "bg-surface-bright"
                            }`}
                          ></span>
                          <span
                            className={`font-label-md text-body-md truncate ${
                              isAwayWinner
                                ? "font-bold text-brand-white"
                                : "text-on-surface-variant"
                            }`}
                          >
                            {tie.awayTeam?.team_name ?? "Por definir"}
                          </span>
                        </div>
                        <span
                          className={`font-tabular-stats text-body-md font-bold ${
                            isAwayWinner
                              ? "text-brand-mint"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {tie.awayLeg2Score ?? tie.awayAggregate ?? "-"}
                        </span>
                      </div>
                    </div>

                    {/* Aggregate & Path Indicator */}
                    <div className="col-span-5 flex flex-col items-center justify-center bg-surface-container-high/70 rounded-lg p-2.5 text-center border border-outline-variant/10 h-full">
                      <span className="font-label-sm text-label-sm text-brand-mint uppercase font-bold">
                        {tie.homeAggregate !== null && tie.awayAggregate !== null
                          ? `AGG: ${tie.homeAggregate} - ${tie.awayAggregate}`
                          : "Partido Único"}
                      </span>
                      <span className="font-label-sm text-[11px] text-on-surface-variant font-normal mt-0.5 truncate max-w-full">
                        {tie.stage === "R16"
                          ? `${winnerName} a Cuartos`
                          : tie.stage === "QF"
                            ? `${winnerName} a Semis`
                            : tie.stage === "SF"
                              ? `${winnerName} a la Final`
                              : `Proyección: ${winnerName}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Projected Quarter Final Clash */}
          <div className="p-3 rounded-lg bg-surface-container-highest/80 flex flex-col gap-2 border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-brand-mint uppercase tracking-wider font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  flash_on
                </span>
                Cruce Proyectado • Cuartos de Final
              </span>
              <span className="font-tabular-stats text-label-sm text-on-surface-variant">
                Abril 2025
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded bg-surface-container flex items-center justify-between">
                <span className="font-label-md text-label-md font-bold text-brand-white truncate">
                  Liverpool FC
                </span>
                <span className="font-label-sm text-[10px] text-brand-mint uppercase font-bold shrink-0">
                  Sembrado 1
                </span>
              </div>
              <div className="p-2 rounded bg-surface-container flex items-center justify-between">
                <span className="font-label-md text-label-md font-bold text-brand-white truncate">
                  Real Madrid
                </span>
                <span className="font-label-sm text-[10px] text-primary uppercase font-bold shrink-0">
                  Sembrado 6
                </span>
              </div>
            </div>
          </div>

          {/* Bracket Stage Progression Visual Bar (Probabilidad de Campeón IA) */}
          <div className="p-3 bg-surface-container rounded-lg flex flex-col gap-2 border border-outline-variant/10">
            <div className="flex justify-between items-center font-tabular-stats text-label-md">
              <span className="text-on-surface-variant font-medium">
                Probabilidad de Campeón (Algoritmo IA)
              </span>
              <span className="text-brand-mint font-bold">Liverpool 26.4%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden flex">
              <div
                className="h-full bg-brand-mint"
                style={{ width: "26.4%" }}
              ></div>
              <div
                className="h-full bg-primary"
                style={{ width: "21.8%" }}
              ></div>
              <div
                className="h-full bg-error"
                style={{ width: "18.2%" }}
              ></div>
              <div
                className="h-full bg-surface-bright"
                style={{ width: "33.6%" }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] font-label-sm text-on-surface-variant uppercase">
              <span className="text-brand-mint font-bold">LIV 26%</span>
              <span className="text-primary font-bold">RMA 22%</span>
              <span className="text-error font-bold">FCB 18%</span>
              <span>Otros 34%</span>
            </div>
          </div>
        </div>

        {/* Fast Match Simulator Trigger Button */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {onSelectRoundTab && (
            <button
              type="button"
              onClick={() => onSelectRoundTab(compactStage)}
              className="w-full py-3 px-4 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-md text-body-md font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border border-outline-variant/20"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">
                open_in_full
              </span>
              <span>Ampliar Llaves</span>
            </button>
          )}
          <Link
            href="/simulador"
            className={`w-full py-3 px-4 rounded-xl bg-brand-mint hover:brightness-110 text-brand-navy font-label-md text-body-md font-bold transition-all duration-200 shadow-[0_0_20px_rgba(25,211,146,0.25)] flex items-center justify-center gap-2 ${
              onSelectRoundTab ? "" : "sm:col-span-2"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
            <span>Arma tu Champions (Simulador)</span>
          </Link>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VISTA COMPLETA (Modo "live" en pestañas Octavos/Cuartos/Semis/Final O Modo "simulator" en /simulador)
  // ============================================================================
  const r16List =
    mode === "simulator"
      ? simulatorTies.r16
      : liveTies.filter((t) => t.stage === "R16");
  const qfList =
    mode === "simulator"
      ? simulatorTies.qf
      : liveTies.filter((t) => t.stage === "QF");
  const sfList =
    mode === "simulator"
      ? simulatorTies.sf
      : liveTies.filter((t) => t.stage === "SF");
  const finalNode =
    mode === "simulator"
      ? simulatorTies.final
      : (liveTies.find((t) => t.stage === "FINAL") ?? simulatorTies.final);

  const stageLabelMap: Record<KnockoutStageKey, string> = {
    R16: "Octavos de Final (16 Clubes • Ida y Vuelta)",
    QF: "Cuartos de Final (8 Clubes • Ida y Vuelta)",
    SF: "Semifinales (4 Clubes • Ida y Vuelta)",
    FINAL: "Gran Final • Sede Oficial UEFA",
  };

  const stageShortNameMap: Record<KnockoutStageKey, string> = {
    R16: "Octavos de Final",
    QF: "Cuartos de Final",
    SF: "Semifinales",
    FINAL: "la Gran Final",
  };

  const activeRoundUpcomingText = useMemo(() => {
    const targetStage: KnockoutStageKey =
      internalRoundFilter === "ALL"
        ? !r16List.every((t) => t.status === "FINISHED")
          ? "R16"
          : !qfList.every((t) => t.status === "FINISHED")
            ? "QF"
            : !sfList.every((t) => t.status === "FINISHED")
              ? "SF"
              : "FINAL"
        : internalRoundFilter;

    const tiesForStage =
      targetStage === "R16"
        ? r16List
        : targetStage === "QF"
          ? qfList
          : targetStage === "SF"
            ? sfList
            : finalNode
              ? [finalNode]
              : [];

    const pendingWithTeams = tiesForStage.filter(
      (t) => t.homeTeam && t.awayTeam && t.status !== "FINISHED"
    );

    const roundName = stageShortNameMap[targetStage];

    if (pendingWithTeams.length > 0) {
      const pairs = pendingWithTeams
        .slice(0, 4)
        .map((t) => `${t.homeTeam!.team_name} vs ${t.awayTeam!.team_name}`)
        .join(", ");
      const extra =
        pendingWithTeams.length > 4
          ? ` y ${pendingWithTeams.length - 4} llaves más.`
          : ".";
      return `Los próximos partidos de ${roundName} son: ${pairs}${extra}`;
    }

    const definedWithTeams = tiesForStage.filter(
      (t) => t.homeTeam && t.awayTeam
    );
    if (
      definedWithTeams.length > 0 &&
      definedWithTeams.every((t) => t.status === "FINISHED")
    ) {
      return `Todos los encuentros de ${roundName} han finalizado. Cruces de la siguiente fase actualizados.`;
    }

    return getUpcomingPhaseMatchesSummary(matches);
  }, [internalRoundFilter, r16List, qfList, sfList, finalNode, matches]);

  return (
    <div className="flex flex-col space-y-6 w-full">
      {/* Cabecera de Control según el Modo ("live" vs "simulator") */}
      {mode === "simulator" ? (
        <div className="p-5 rounded-xl bg-surface-container-low border border-brand-mint/25 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-mint/15 text-brand-mint border border-brand-mint/30 font-label-sm text-label-sm uppercase font-bold tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px]">
                  tune
                </span>
                Simulador Interactivo • Arma tu Champions
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                {completedDecisionsCount} / 15 llaves decididas
              </span>
              {authEmail && (
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">
                  {authEmail}
                </span>
              )}
            </div>
            <h1 className="font-headline-lg text-headline-md sm:text-headline-lg text-brand-white">
              Elige a tus ganadores desde Octavos hasta el Campeón en Múnich
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Haz clic sobre cualquier club en cada cruce para clasificarlo a la
              siguiente ronda y guarda tu predicción oficial.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center bg-surface-container rounded-lg px-3 py-2 border border-outline-variant/25">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px] mr-2">
                bookmark_manager
              </span>
              <input
                type="text"
                value={bracketName}
                onChange={(e) => setBracketName(e.target.value)}
                placeholder="Nombre de tu predicción..."
                aria-label="Nombre de tu predicción de bracket"
                className="bg-transparent text-brand-white font-label-md text-label-md focus:outline-none w-44"
              />
            </div>

            <button
              type="button"
              onClick={handleAutoFillWithAI}
              className="px-3.5 py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary font-label-md text-label-md font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-outline-variant/20"
            >
              <span className="material-symbols-outlined text-[18px]">
                auto_awesome
              </span>
              <span>Autocompletar IA</span>
            </button>

            <button
              type="button"
              onClick={handleResetBracket}
              className="px-3 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                restart_alt
              </span>
              <span>Reiniciar</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveBracketToSupabase}
              className="px-4 py-2.5 rounded-lg bg-brand-mint hover:brightness-110 text-brand-navy font-label-md text-label-md font-bold transition-all shadow-[0_0_20px_rgba(25,211,146,0.3)] flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">
                cloud_upload
              </span>
              <span>
                {isSaving ? "Guardando..." : "Guardar Predicción"}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-mint/15 border border-brand-mint/30 flex items-center justify-center text-brand-mint shrink-0">
              <span className="material-symbols-outlined text-[22px]">
                account_tree
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline-md text-headline-md text-brand-white">
                  {internalRoundFilter === "ALL"
                    ? "Cuadro Eliminatorio Oficial • Camino a Múnich"
                    : stageLabelMap[internalRoundFilter]}
                </h2>
                <span className="px-2 py-0.5 rounded bg-brand-mint/15 text-brand-mint font-label-sm text-[10px] uppercase font-bold">
                  Modo En Vivo
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {activeRoundUpcomingText}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/simulador"
              className="px-4 py-2 rounded-lg bg-brand-mint text-brand-navy font-label-md text-label-md font-bold hover:brightness-110 transition-all shadow-md flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">
                tune
              </span>
              <span>Simular Mis Ganadores</span>
            </Link>
          </div>
        </div>
      )}

      {/* Notificación de Guardado RLS en `user_brackets` */}
      {saveFeedback && (
        <div
          role="status"
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            saveFeedback.type === "success"
              ? "bg-brand-mint/15 border-brand-mint/40 text-brand-white"
              : "bg-surface-container-high border-primary/30 text-on-surface"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-brand-mint text-[22px]">
              {saveFeedback.type === "success" ? "verified" : "info"}
            </span>
            <span className="font-body-md text-body-md">
              {saveFeedback.message}
            </span>
          </div>
          {!authUserId && (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container font-label-sm text-label-sm uppercase shrink-0 self-start sm:self-auto"
            >
              Iniciar Sesión (/login)
            </Link>
          )}
        </div>
      )}

      {/* En Modo Live con Fase Específica Seleccionada (Octavos, Cuartos, Semifinales o Final): Detalle Destacado de esa Ronda */}
      {mode === "live" && internalRoundFilter !== "ALL" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-label-md text-label-md uppercase tracking-wider text-brand-mint font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">
                filter_center_focus
              </span>
              Detalle de Llaves • {stageLabelMap[internalRoundFilter]}
            </h3>
            <button
              type="button"
              onClick={() => setInternalRoundFilter("ALL")}
              className="font-label-sm text-label-sm text-primary hover:underline cursor-pointer"
            >
              Ver todas las rondas simultáneamente
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {liveTies
              .filter((t) => t.stage === internalRoundFilter)
              .map((tie) => {
                const isHomeWin = tie.winnerTeamId === tie.homeTeam?.team_id;
                const isAwayWin = tie.winnerTeamId === tie.awayTeam?.team_id;
                const isLive =
                  tie.status === "IN_PLAY" || tie.status === "HT";

                return (
                  <div
                    key={`focus-${tie.slot}`}
                    className="p-4 rounded-xl bg-surface-container-low border border-brand-mint/25 shadow-lg flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-label-sm text-primary uppercase font-bold">
                        {tie.routeLabel}
                      </span>
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-mint/15 text-brand-mint font-label-sm text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-mint animate-ping"></span>
                          {tie.elapsed_minute}&apos; EN VIVO
                        </span>
                      ) : (
                        <span className="font-label-sm text-[10px] text-on-surface-variant">
                          {tie.dateLabel}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 bg-surface-container p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <TeamBadge
                            team={tie.homeTeam}
                            isWinner={isHomeWin}
                          />
                          <div className="flex flex-col min-w-0">
                            <span
                              className={`font-label-md text-body-md truncate ${
                                isHomeWin
                                  ? "text-brand-white font-bold"
                                  : "text-on-surface"
                              }`}
                            >
                              {tie.homeTeam?.team_name}
                            </span>
                            <span className="font-label-sm text-[10px] text-on-surface-variant">
                              Sembrado #{tie.homeTeam?.seed}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 font-tabular-stats">
                          {tie.homeLeg1Score !== null && (
                            <span className="text-xs text-on-surface-variant">
                              ({tie.homeLeg1Score}-{tie.homeLeg2Score})
                            </span>
                          )}
                          <span
                            className={`text-headline-md font-bold ${
                              isHomeWin
                                ? "text-brand-mint"
                                : "text-on-surface-variant"
                            }`}
                          >
                            {tie.homeAggregate ?? "-"}
                          </span>
                        </div>
                      </div>

                      <div className="h-px bg-surface-container-highest"></div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <TeamBadge
                            team={tie.awayTeam}
                            isWinner={isAwayWin}
                          />
                          <div className="flex flex-col min-w-0">
                            <span
                              className={`font-label-md text-body-md truncate ${
                                isAwayWin
                                  ? "text-brand-white font-bold"
                                  : "text-on-surface"
                              }`}
                            >
                              {tie.awayTeam?.team_name}
                            </span>
                            <span className="font-label-sm text-[10px] text-on-surface-variant">
                              Sembrado #{tie.awayTeam?.seed}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 font-tabular-stats">
                          {tie.awayLeg1Score !== null && (
                            <span className="text-xs text-on-surface-variant">
                              ({tie.awayLeg1Score}-{tie.awayLeg2Score})
                            </span>
                          )}
                          <span
                            className={`text-headline-md font-bold ${
                              isAwayWin
                                ? "text-brand-mint"
                                : "text-on-surface-variant"
                            }`}
                          >
                            {tie.awayAggregate ?? "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-on-surface-variant pt-1">
                      <span className="truncate">
                        {tie.venueLabel ?? "Sede UEFA"}
                      </span>
                      <span className="text-brand-mint font-bold shrink-0">
                        {tie.homeAggregate !== null
                          ? `Global: ${tie.homeAggregate}-${tie.awayAggregate}`
                          : "Final Única"}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ÁRBOL INTERACTIVO DE 4 COLUMNAS: OCTAVOS -> CUARTOS -> SEMIFINALES -> GRAN FINAL & CAMPEÓN */}
      <div className="bg-surface-container-low rounded-2xl p-4 lg:p-6 shadow-xl border border-outline-variant/15 overflow-x-auto">
        <div className="min-w-[980px] grid grid-cols-12 gap-5 items-stretch">
          {/* COLUMNA 1: OCTAVOS DE FINAL (8 Llaves) - 3 Cols */}
          <div
            className={`col-span-3 flex flex-col justify-between space-y-3 ${
              internalRoundFilter === "R16"
                ? "ring-2 ring-brand-mint/40 rounded-xl p-2 bg-surface-container/30"
                : ""
            }`}
          >
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-surface-container-high">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-brand-white font-bold">
                1. Octavos de Final
              </span>
              <span className="font-label-sm text-[10px] text-brand-mint font-bold">
                8 Llaves
              </span>
            </div>

            <div className="flex flex-col justify-between flex-1 space-y-2.5">
              {r16List.map((tie) => {
                const isHomeSelected =
                  tie.winnerTeamId !== null &&
                  tie.winnerTeamId === tie.homeTeam?.team_id;
                const isAwaySelected =
                  tie.winnerTeamId !== null &&
                  tie.winnerTeamId === tie.awayTeam?.team_id;
                const isLive =
                  tie.status === "IN_PLAY" || tie.status === "HT";

                return (
                  <div
                    key={tie.slot}
                    className="rounded-xl bg-surface-container p-2.5 border border-outline-variant/15 shadow-sm space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px] font-label-sm">
                      <span className="text-primary uppercase">
                        {tie.routeLabel}
                      </span>
                      {mode === "live" && isLive ? (
                        <span className="text-brand-mint font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-mint animate-ping"></span>
                          {tie.elapsed_minute}&apos;
                        </span>
                      ) : mode === "live" && tie.homeAggregate !== null ? (
                        <span className="text-brand-mint font-bold">
                          AGG {tie.homeAggregate}-{tie.awayAggregate}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant">
                          Elige ganador
                        </span>
                      )}
                    </div>

                    {/* Equipo Local */}
                    <button
                      type="button"
                      disabled={mode === "live" || !tie.homeTeam}
                      onClick={() =>
                        tie.homeTeam &&
                        handlePickR16Winner(tie.slot, tie.homeTeam.team_id)
                      }
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all ${
                        mode === "simulator"
                          ? "cursor-pointer hover:bg-surface-container-high"
                          : "cursor-default"
                      } ${
                        isHomeSelected
                          ? "bg-brand-mint/15 border border-brand-mint/50 text-brand-white"
                          : "bg-surface-container-low text-on-surface-variant border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamBadge
                          team={tie.homeTeam}
                          isWinner={isHomeSelected}
                        />
                        <span
                          className={`font-label-md text-xs truncate ${
                            isHomeSelected
                              ? "font-bold text-brand-white"
                              : "text-on-surface"
                          }`}
                        >
                          {tie.homeTeam?.team_name ?? "Por definir"}
                        </span>
                      </div>
                      {mode === "live" ? (
                        <span
                          className={`font-tabular-stats text-xs font-bold ${
                            isHomeSelected
                              ? "text-brand-mint"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {tie.homeAggregate ?? "-"}
                        </span>
                      ) : (
                        <span
                          className={`material-symbols-outlined text-[16px] ${
                            isHomeSelected
                              ? "text-brand-mint"
                              : "text-outline-variant"
                          }`}
                        >
                          {isHomeSelected
                            ? "check_circle"
                            : "radio_button_unchecked"}
                        </span>
                      )}
                    </button>

                    {/* Equipo Visitante */}
                    <button
                      type="button"
                      disabled={mode === "live" || !tie.awayTeam}
                      onClick={() =>
                        tie.awayTeam &&
                        handlePickR16Winner(tie.slot, tie.awayTeam.team_id)
                      }
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all ${
                        mode === "simulator"
                          ? "cursor-pointer hover:bg-surface-container-high"
                          : "cursor-default"
                      } ${
                        isAwaySelected
                          ? "bg-brand-mint/15 border border-brand-mint/50 text-brand-white"
                          : "bg-surface-container-low text-on-surface-variant border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamBadge
                          team={tie.awayTeam}
                          isWinner={isAwaySelected}
                        />
                        <span
                          className={`font-label-md text-xs truncate ${
                            isAwaySelected
                              ? "font-bold text-brand-white"
                              : "text-on-surface"
                          }`}
                        >
                          {tie.awayTeam?.team_name ?? "Por definir"}
                        </span>
                      </div>
                      {mode === "live" ? (
                        <span
                          className={`font-tabular-stats text-xs font-bold ${
                            isAwaySelected
                              ? "text-brand-mint"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {tie.awayAggregate ?? "-"}
                        </span>
                      ) : (
                        <span
                          className={`material-symbols-outlined text-[16px] ${
                            isAwaySelected
                              ? "text-brand-mint"
                              : "text-outline-variant"
                          }`}
                        >
                          {isAwaySelected
                            ? "check_circle"
                            : "radio_button_unchecked"}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMNA 2: CUARTOS DE FINAL (4 Llaves) - 3 Cols */}
          <div
            className={`col-span-3 flex flex-col justify-between space-y-3 ${
              internalRoundFilter === "QF"
                ? "ring-2 ring-brand-mint/40 rounded-xl p-2 bg-surface-container/30"
                : ""
            }`}
          >
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-surface-container-high">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-brand-white font-bold">
                2. Cuartos de Final
              </span>
              <span className="font-label-sm text-[10px] text-primary font-bold">
                4 Llaves
              </span>
            </div>

            <div className="flex flex-col justify-around flex-1 space-y-4 py-4">
              {qfList.map((tie) => {
                const isHomeSelected =
                  tie.winnerTeamId !== null &&
                  tie.winnerTeamId === tie.homeTeam?.team_id;
                const isAwaySelected =
                  tie.winnerTeamId !== null &&
                  tie.winnerTeamId === tie.awayTeam?.team_id;
                const canPick =
                  mode === "simulator" &&
                  Boolean(tie.homeTeam) &&
                  Boolean(tie.awayTeam);

                return (
                  <div
                    key={tie.slot}
                    className="rounded-xl bg-surface-container p-3 border border-outline-variant/15 shadow-md space-y-2"
                  >
                    <div className="flex items-center justify-between text-[10px] font-label-sm">
                      <span className="text-primary uppercase">
                        {tie.routeLabel}
                      </span>
                      <span className="text-on-surface-variant">
                        {mode === "live" && tie.homeAggregate !== null
                          ? `AGG ${tie.homeAggregate}-${tie.awayAggregate}`
                          : "Abril 2025"}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!canPick}
                      onClick={() =>
                        tie.homeTeam &&
                        handlePickQfWinner(tie.slot, tie.homeTeam.team_id)
                      }
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all ${
                        canPick
                          ? "cursor-pointer hover:bg-surface-container-high"
                          : "cursor-default opacity-80"
                      } ${
                        isHomeSelected
                          ? "bg-brand-mint/15 border border-brand-mint/50 text-brand-white"
                          : "bg-surface-container-low text-on-surface-variant border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamBadge
                          team={tie.homeTeam}
                          isWinner={isHomeSelected}
                        />
                        <span
                          className={`font-label-md text-xs truncate ${
                            isHomeSelected
                              ? "font-bold text-brand-white"
                              : "text-on-surface"
                          }`}
                        >
                          {tie.homeTeam?.team_name ?? "Ganador Octavos"}
                        </span>
                      </div>
                      {mode === "live" ? (
                        <span
                          className={`font-tabular-stats text-xs font-bold ${
                            isHomeSelected
                              ? "text-brand-mint"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {tie.homeAggregate ?? "-"}
                        </span>
                      ) : (
                        <span
                          className={`material-symbols-outlined text-[16px] ${
                            isHomeSelected
                              ? "text-brand-mint"
                              : "text-outline-variant"
                          }`}
                        >
                          {isHomeSelected
                            ? "check_circle"
                            : "radio_button_unchecked"}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={!canPick}
                      onClick={() =>
                        tie.awayTeam &&
                        handlePickQfWinner(tie.slot, tie.awayTeam.team_id)
                      }
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all ${
                        canPick
                          ? "cursor-pointer hover:bg-surface-container-high"
                          : "cursor-default opacity-80"
                      } ${
                        isAwaySelected
                          ? "bg-brand-mint/15 border border-brand-mint/50 text-brand-white"
                          : "bg-surface-container-low text-on-surface-variant border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamBadge
                          team={tie.awayTeam}
                          isWinner={isAwaySelected}
                        />
                        <span
                          className={`font-label-md text-xs truncate ${
                            isAwaySelected
                              ? "font-bold text-brand-white"
                              : "text-on-surface"
                          }`}
                        >
                          {tie.awayTeam?.team_name ?? "Ganador Octavos"}
                        </span>
                      </div>
                      {mode === "live" ? (
                        <span
                          className={`font-tabular-stats text-xs font-bold ${
                            isAwaySelected
                              ? "text-brand-mint"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {tie.awayAggregate ?? "-"}
                        </span>
                      ) : (
                        <span
                          className={`material-symbols-outlined text-[16px] ${
                            isAwaySelected
                              ? "text-brand-mint"
                              : "text-outline-variant"
                          }`}
                        >
                          {isAwaySelected
                            ? "check_circle"
                            : "radio_button_unchecked"}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMNA 3: SEMIFINALES (2 Llaves) - 3 Cols */}
          <div
            className={`col-span-3 flex flex-col justify-between space-y-3 ${
              internalRoundFilter === "SF"
                ? "ring-2 ring-brand-mint/40 rounded-xl p-2 bg-surface-container/30"
                : ""
            }`}
          >
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-surface-container-high">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-brand-white font-bold">
                3. Semifinales
              </span>
              <span className="font-label-sm text-[10px] text-primary font-bold">
                2 Llaves
              </span>
            </div>

            <div className="flex flex-col justify-around flex-1 space-y-6 py-10">
              {sfList.map((tie) => {
                const isHomeSelected =
                  tie.winnerTeamId !== null &&
                  tie.winnerTeamId === tie.homeTeam?.team_id;
                const isAwaySelected =
                  tie.winnerTeamId !== null &&
                  tie.winnerTeamId === tie.awayTeam?.team_id;
                const canPick =
                  mode === "simulator" &&
                  Boolean(tie.homeTeam) &&
                  Boolean(tie.awayTeam);

                return (
                  <div
                    key={tie.slot}
                    className="rounded-xl bg-surface-container p-3.5 border border-outline-variant/15 shadow-lg space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-[10px] font-label-sm">
                      <span className="text-brand-mint uppercase font-bold">
                        {tie.routeLabel}
                      </span>
                      <span className="text-on-surface-variant">
                        {mode === "live" && tie.homeAggregate !== null
                          ? `AGG ${tie.homeAggregate}-${tie.awayAggregate}`
                          : "Mayo 2025"}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!canPick}
                      onClick={() =>
                        tie.homeTeam &&
                        handlePickSfWinner(tie.slot, tie.homeTeam.team_id)
                      }
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all ${
                        canPick
                          ? "cursor-pointer hover:bg-surface-container-high"
                          : "cursor-default opacity-80"
                      } ${
                        isHomeSelected
                          ? "bg-brand-mint/15 border border-brand-mint/50 text-brand-white"
                          : "bg-surface-container-low text-on-surface-variant border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TeamBadge
                          team={tie.homeTeam}
                          isWinner={isHomeSelected}
                        />
                        <span
                          className={`font-label-md text-xs truncate ${
                            isHomeSelected
                              ? "font-bold text-brand-white"
                              : "text-on-surface"
                          }`}
                        >
                          {tie.homeTeam?.team_name ?? "Ganador Cuartos"}
                        </span>
                      </div>
                      {mode === "live" ? (
                        <span
                          className={`font-tabular-stats text-xs font-bold ${
                            isHomeSelected
                              ? "text-brand-mint"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {tie.homeAggregate ?? "-"}
                        </span>
                      ) : (
                        <span
                          className={`material-symbols-outlined text-[16px] ${
                            isHomeSelected
                              ? "text-brand-mint"
                              : "text-outline-variant"
                          }`}
                        >
                          {isHomeSelected
                            ? "check_circle"
                            : "radio_button_unchecked"}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={!canPick}
                      onClick={() =>
                        tie.awayTeam &&
                        handlePickSfWinner(tie.slot, tie.awayTeam.team_id)
                      }
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all ${
                        canPick
                          ? "cursor-pointer hover:bg-surface-container-high"
                          : "cursor-default opacity-80"
                      } ${
                        isAwaySelected
                          ? "bg-brand-mint/15 border border-brand-mint/50 text-brand-white"
                          : "bg-surface-container-low text-on-surface-variant border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TeamBadge
                          team={tie.awayTeam}
                          isWinner={isAwaySelected}
                        />
                        <span
                          className={`font-label-md text-xs truncate ${
                            isAwaySelected
                              ? "font-bold text-brand-white"
                              : "text-on-surface"
                          }`}
                        >
                          {tie.awayTeam?.team_name ?? "Ganador Cuartos"}
                        </span>
                      </div>
                      {mode === "live" ? (
                        <span
                          className={`font-tabular-stats text-xs font-bold ${
                            isAwaySelected
                              ? "text-brand-mint"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {tie.awayAggregate ?? "-"}
                        </span>
                      ) : (
                        <span
                          className={`material-symbols-outlined text-[16px] ${
                            isAwaySelected
                              ? "text-brand-mint"
                              : "text-outline-variant"
                          }`}
                        >
                          {isAwaySelected
                            ? "check_circle"
                            : "radio_button_unchecked"}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMNA 4: GRAN FINAL MÚNICH & TARJETA DE CAMPEÓN - 3 Cols */}
          <div
            className={`col-span-3 flex flex-col justify-between space-y-4 ${
              internalRoundFilter === "FINAL"
                ? "ring-2 ring-brand-mint/40 rounded-xl p-2 bg-surface-container/30"
                : ""
            }`}
          >
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-brand-mint text-brand-navy">
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-bold">
                4. Gran Final Múnich
              </span>
              <span className="material-symbols-outlined text-[16px]">
                emoji_events
              </span>
            </div>

            <div className="flex flex-col justify-center flex-1 space-y-5">
              {/* Tarjeta de la Final */}
              <div className="rounded-xl bg-gradient-to-b from-surface-container to-surface-container-high p-4 border border-brand-mint/30 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-brand-mint uppercase font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">
                      stadium
                    </span>
                    Allianz Arena
                  </span>
                  <span className="font-label-sm text-[10px] text-on-surface-variant">
                    31 Mayo 2025
                  </span>
                </div>

                {(
                  [
                    { team: finalNode.homeTeam, side: "home" },
                    { team: finalNode.awayTeam, side: "away" },
                  ] as const
                ).map(({ team, side }) => {
                  const isChamp =
                    finalNode.winnerTeamId !== null &&
                    finalNode.winnerTeamId === team?.team_id;
                  const canPickFinal =
                    mode === "simulator" &&
                    Boolean(finalNode.homeTeam) &&
                    Boolean(finalNode.awayTeam);

                  return (
                    <button
                      key={side}
                      type="button"
                      disabled={!canPickFinal}
                      onClick={() =>
                        team && handlePickFinalWinner(team.team_id)
                      }
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-left transition-all ${
                        canPickFinal
                          ? "cursor-pointer hover:bg-surface-bright"
                          : "cursor-default"
                      } ${
                        isChamp
                          ? "bg-brand-mint text-brand-navy font-bold shadow-[0_0_20px_rgba(25,211,146,0.35)]"
                          : "bg-surface-container-low text-on-surface border border-outline-variant/20"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TeamBadge team={team} isWinner={isChamp} />
                        <div className="flex flex-col min-w-0">
                          <span className="font-label-md text-xs font-bold truncate">
                            {team?.team_name ??
                              `Finalista ${side === "home" ? "Ruta Plata" : "Ruta Azul"}`}
                          </span>
                          <span
                            className={`text-[10px] ${
                              isChamp
                                ? "text-brand-navy/80 font-semibold"
                                : "text-on-surface-variant"
                            }`}
                          >
                            {team ? `Sembrado #${team.seed}` : "Por clasificar"}
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[18px]">
                        {isChamp ? "workspace_premium" : "trophy"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Podio del Campeón Elegido / Proyectado */}
              <div className="rounded-xl bg-surface-container p-5 border border-brand-mint/40 text-center space-y-3 shadow-[0_0_30px_rgba(25,211,146,0.12)]">
                <div className="w-14 h-14 mx-auto rounded-full bg-brand-mint/15 border border-brand-mint/40 flex items-center justify-center text-brand-mint">
                  <span className="material-symbols-outlined text-[32px]">
                    emoji_events
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="font-label-sm text-label-sm uppercase tracking-widest text-brand-mint font-bold block">
                    {mode === "simulator"
                      ? "Tu Campeón UEFA 2024/25"
                      : "Campeón Proyectado IA"}
                  </span>
                  <h4 className="font-headline-md text-headline-md text-brand-white font-bold">
                    {championTeam
                      ? championTeam.team_name
                      : "Selecciona los finalistas"}
                  </h4>
                  <p className="font-label-sm text-label-sm text-on-surface-variant font-normal">
                    {championTeam
                      ? `Sembrado #${championTeam.seed} de Fase de Liga`
                      : "Avanza las llaves para coronar al campeón"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de Predicciones Guardadas por el Usuario */}
      {mode === "simulator" && savedBrackets.length > 0 && (
        <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/15 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-brand-white font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-mint text-[18px]">
                history
              </span>
              Tus Predicciones Guardadas
            </span>
            <span className="font-label-sm text-label-sm text-brand-mint">
              Sincronizado con tu cuenta
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedBrackets.slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setBracketName(item.bracket_name);
                  if (item.bracket_data) {
                    setR16Winners(item.bracket_data.r16 ?? {});
                    setQfWinners(item.bracket_data.qf ?? {});
                    setSfWinners(item.bracket_data.sf ?? {});
                    setFinalWinner(item.bracket_data.final ?? null);
                  }
                }}
                className="p-3 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-left transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <span className="font-label-md text-label-md text-brand-white font-bold block">
                    {item.bracket_name}
                  </span>
                  <span className="font-label-sm text-label-sm text-brand-mint block">
                    Campeón: {item.champion_team_name ?? "En definición"}
                  </span>
                </div>
                <span className="material-symbols-outlined text-primary text-[18px]">
                  restore
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
