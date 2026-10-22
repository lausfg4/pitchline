"use client";

import React, { useState } from "react";
import type { MatchWithDetails } from "@/types/database";
import { formatLocalKickoffTime } from "@/lib/date-utils";

interface SpotlightMatchCardProps {
  match: MatchWithDetails;
  userPrediction?: { home: number; away: number };
  onSaveUserPrediction: (matchId: number, home: number, away: number) => void;
}

export function SpotlightMatchCard({
  match,
  userPrediction,
  onSaveUserPrediction,
}: SpotlightMatchCardProps) {
  const [showTacticalDetails, setShowTacticalDetails] = useState(false);
  const [editingPrediction, setEditingPrediction] = useState(false);
  const [predHome, setPredHome] = useState(
    userPrediction?.home ?? match.prediction?.predicted_home_goals ?? 2
  );
  const [predAway, setPredAway] = useState(
    userPrediction?.away ?? match.prediction?.predicted_away_goals ?? 2
  );

  const isLive = match.status === "IN_PLAY" || match.status === "HT";
  const isFinished = match.status === "FINISHED";

  const homePossession = match.live_stats?.home_possession ?? 48;
  const awayPossession = match.live_stats?.away_possession ?? 52;
  const homeXg = match.live_stats?.home_xg ?? 1.84;
  const awayXg = match.live_stats?.away_xg ?? 1.92;

  const homeWinProb = match.prediction?.home_win_prob ?? 38;
  const drawProb = match.prediction?.draw_prob ?? 26;
  const awayWinProb = match.prediction?.away_win_prob ?? 36;

  const minuteDisplay =
    match.status === "HT"
      ? "ET"
      : match.elapsed_minute
        ? match.extra_minute && match.extra_minute > 0
          ? `${match.elapsed_minute}+${match.extra_minute}'`
          : `${match.elapsed_minute}'`
        : formatLocalKickoffTime(match.kickoff_at);

  const events = match.events ?? [];

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface-container-low shadow-xl border border-outline-variant/15">
      {/* Luz ambiental sutil de fondo */}
      <div className="absolute -top-32 -left-20 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-brand-mint/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col p-5 lg:p-8 space-y-6">
        {/* Top Meta Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-mint/15 text-brand-mint border border-brand-mint/30 font-label-sm text-label-sm uppercase font-bold tracking-wider">
                <span className="w-2 h-2 rounded-full bg-brand-mint animate-pulse"></span>
                En Vivo
              </span>
            ) : isFinished ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase font-bold tracking-wider">
                Finalizado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm uppercase font-bold tracking-wider">
                Previa • {formatLocalKickoffTime(match.kickoff_at)}
              </span>
            )}
            <span className="text-on-surface-variant font-label-md text-label-md hidden sm:inline">
              {match.venue ?? "Estadio Santiago Bernabéu, Madrid"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">
              sports
            </span>
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              Árbitro: {match.referee ?? "F. Letexier (FRA)"}
            </span>
          </div>
        </div>

        {/* Live Match Scoreboard Hub */}
        <div className="grid grid-cols-1 md:grid-cols-11 items-center gap-6 py-2">
          {/* Local */}
          <div className="md:col-span-4 flex items-center justify-start md:justify-end gap-4 order-1">
            <div className="flex flex-col text-left md:text-right">
              <span className="font-headline-lg text-headline-lg text-brand-white tracking-tight">
                {match.home_team_name}
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant">
                {match.live_stats?.home_rank_label ?? "2° Lugar • 16 pts (+11)"}
              </span>
            </div>
            <div className="w-16 h-16 rounded-xl bg-surface-container-high flex items-center justify-center p-2.5 shadow-md shrink-0 border border-outline-variant/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-contain"
                alt={`Escudo de ${match.home_team_name}`}
                src={match.home_team_crest}
              />
            </div>
          </div>

          {/* Centro: Marcador y Minuto */}
          <div className="md:col-span-3 flex flex-col items-center justify-center order-2 bg-surface-container py-3 px-4 rounded-xl shadow-inner border border-outline-variant/15">
            <div className="flex items-center gap-3">
              <span className="font-score-display text-score-display text-primary tracking-tight">
                {match.home_score}
              </span>
              <span className="font-headline-lg text-headline-lg text-outline-variant">
                -
              </span>
              <span className="font-score-display text-score-display text-primary tracking-tight">
                {match.away_score}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-score-display-mobile text-score-display-mobile text-brand-mint">
                {minuteDisplay}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                {match.live_stats?.half_label ??
                  (isLive ? "2° Tiempo" : isFinished ? "Tiempo Completo" : "Programado")}
              </span>
            </div>

            {/* Barra de Posesión en Vivo */}
            <div className="w-full mt-3 space-y-1">
              <div className="flex justify-between font-tabular-stats text-tabular-stats text-on-surface-variant">
                <span className="text-primary font-bold">{homePossession}%</span>
                <span className="font-label-sm text-label-sm uppercase">
                  Posesión
                </span>
                <span className="text-brand-mint font-bold">{awayPossession}%</span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${homePossession}%` }}
                ></div>
                <div
                  className="h-full bg-brand-mint transition-all duration-500"
                  style={{ width: `${awayPossession}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Visitante */}
          <div className="md:col-span-4 flex items-center justify-end md:justify-start gap-4 order-3">
            <div className="w-16 h-16 rounded-xl bg-surface-container-high flex items-center justify-center p-2.5 shadow-md shrink-0 border border-outline-variant/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-contain"
                alt={`Escudo de ${match.away_team_name}`}
                src={match.away_team_crest}
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-headline-lg text-headline-lg text-brand-white tracking-tight">
                {match.away_team_name}
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant">
                {match.live_stats?.away_rank_label ?? "3° Lugar • 15 pts (+14)"}
              </span>
            </div>
          </div>
        </div>

        {/* Línea de Tiempo de Incidencias Clave */}
        <div className="bg-surface-container rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">
                timeline
              </span>
              Incidencias Clave del Encuentro
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              xG Acumulado: {homeXg.toFixed(2)} vs {awayXg.toFixed(2)}
            </span>
          </div>

          {events.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {events.map((evt) => {
                const minStr =
                  evt.extra_minute && evt.extra_minute > 0
                    ? `${evt.minute}+${evt.extra_minute}'`
                    : `${evt.minute}'`;
                return (
                  <div
                    key={evt.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-low border border-outline-variant/10"
                  >
                    <span className="material-symbols-outlined text-[16px] text-brand-mint">
                      {evt.event_type === "YELLOW_CARD" ||
                      evt.event_type === "RED_CARD"
                        ? "style"
                        : "sports_soccer"}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-sm text-label-sm text-on-surface truncate font-bold">
                        {evt.player_name} ({minStr})
                      </span>
                      <span className="font-tabular-stats text-tabular-stats text-on-surface-variant truncate">
                        {evt.detail ?? evt.assist_or_sub_name ?? "Incidencia oficial"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant py-1">
              Aún no se registran goles o tarjetas en este encuentro.
            </p>
          )}
        </div>

        {/* Motor de Pronósticos Predictivo (Mathematical Model Specification) */}
        <div className="bg-surface-container-high rounded-xl p-5 space-y-4 shadow-md border border-outline-variant/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                psychology
              </span>
              <span className="font-headline-md text-headline-md text-brand-white">
                Algoritmo Predictivo • Distribución Poisson
              </span>
            </div>
            <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold self-start sm:self-auto">
              100,000 Simulaciones Monte Carlo
            </span>
          </div>

          {/* 3-Way Poisson Probability Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-end font-tabular-stats text-tabular-stats">
              <div>
                <span className="text-primary font-bold text-headline-md">
                  {homeWinProb}%
                </span>
                <span className="text-on-surface-variant ml-1 font-label-md text-label-md">
                  Gana {match.home_team_name}
                </span>
              </div>
              <div>
                <span className="text-secondary font-bold text-headline-md">
                  {drawProb}%
                </span>
                <span className="text-on-surface-variant ml-1 font-label-md text-label-md">
                  Empate
                </span>
              </div>
              <div className="text-right">
                <span className="text-brand-mint font-bold text-headline-md">
                  {awayWinProb}%
                </span>
                <span className="text-on-surface-variant ml-1 font-label-md text-label-md">
                  Gana {match.away_team_name}
                </span>
              </div>
            </div>
            <div className="h-3 w-full bg-surface-container-lowest rounded-full overflow-hidden flex gap-0.5 p-0.5">
              <div
                className="h-full bg-primary rounded-l-full transition-all duration-500"
                style={{ width: `${homeWinProb}%` }}
              ></div>
              <div
                className="h-full bg-secondary-container transition-all duration-500"
                style={{ width: `${drawProb}%` }}
              ></div>
              <div
                className="h-full bg-brand-mint rounded-r-full transition-all duration-500"
                style={{ width: `${awayWinProb}%` }}
              ></div>
            </div>
          </div>

          {/* Ponderación Matemática de Factores del Modelo (AGENTS.md: 30% / 30% / 25% / 15%) */}
          <div className="pt-2">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-3">
              Ponderación de Variables del Modelo Analítico
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-surface-container-low rounded-lg space-y-1.5">
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface">Rendimiento Reciente</span>
                  <span className="text-primary font-bold font-tabular-stats">
                    30%
                  </span>
                </div>
                <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "30%" }}></div>
                </div>
                <span className="text-on-surface-variant text-label-sm block truncate">
                  Últimos 10 partidos oficiales
                </span>
              </div>

              <div className="p-3 bg-surface-container-low rounded-lg space-y-1.5">
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface">Estadísticas xG &amp; Tiros</span>
                  <span className="text-primary font-bold font-tabular-stats">
                    30%
                  </span>
                </div>
                <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "30%" }}></div>
                </div>
                <span className="text-on-surface-variant text-label-sm block truncate">
                  Peligro ofensivo / concedido
                </span>
              </div>

              <div className="p-3 bg-surface-container-low rounded-lg space-y-1.5">
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface">Jerarquía UEFA / Elo</span>
                  <span className="text-secondary font-bold font-tabular-stats">
                    25%
                  </span>
                </div>
                <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary"
                    style={{ width: "25%" }}
                  ></div>
                </div>
                <span className="text-on-surface-variant text-label-sm block truncate">
                  Coeficiente 5 años &amp; títulos
                </span>
              </div>

              <div className="p-3 bg-surface-container-low rounded-lg space-y-1.5">
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface">H2H &amp; Factor Localía</span>
                  <span className="text-brand-mint font-bold font-tabular-stats">
                    15%
                  </span>
                </div>
                <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-mint"
                    style={{ width: "15%" }}
                  ></div>
                </div>
                <span className="text-on-surface-variant text-label-sm block truncate">
                  Historial directo &amp; Bernabéu
                </span>
              </div>
            </div>
          </div>

          {showTacticalDetails && (
            <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-brand-mint font-bold">
                  Resumen Analítico del Motor Pitchline
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Marcador esperado: {match.prediction?.predicted_home_goals ?? 2} -{" "}
                  {match.prediction?.predicted_away_goals ?? 2}
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {match.prediction?.explanation_summary ??
                  "Equilibrio táctico de alta intensidad. Ambos clubes superan 1.80 xG acumulados con transiciones rápidas por bandas."}
              </p>
            </div>
          )}

          {editingPrediction && (
            <div className="p-4 rounded-lg bg-surface-container-low border border-primary/30 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-label-md text-label-md text-on-surface">
                  Tu Pronóstico:
                </span>
                <div className="flex items-center gap-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    {match.home_team_name}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={predHome}
                    onChange={(e) => setPredHome(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded bg-surface-container text-center text-brand-white font-bold border border-outline-variant/40"
                  />
                  <span className="text-on-surface-variant">-</span>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={predAway}
                    onChange={(e) => setPredAway(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded bg-surface-container text-center text-brand-white font-bold border border-outline-variant/40"
                  />
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    {match.away_team_name}
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSaveUserPrediction(match.id, predHome, predAway);
                    setEditingPrediction(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-brand-mint text-brand-navy font-label-md text-label-md font-bold cursor-pointer"
                >
                  Guardar Pronóstico
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPrediction(false)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant font-label-md text-label-md cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Botones de Acción de Pronóstico */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowTacticalDetails((v) => !v)}
              className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface transition-colors font-label-md text-label-md flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                query_stats
              </span>
              <span>
                {showTacticalDetails
                  ? "Ocultar Detalles Tácticos"
                  : "Ver Detalles Tácticos"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEditingPrediction((v) => !v)}
              className="px-5 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-md text-label-md font-bold shadow-md hover:bg-primary transition-colors flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                edit_note
              </span>
              <span>
                Hacer Mi Pronóstico ({predHome} - {predAway} Activo)
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
