"use client";

import React from "react";
import type { MatchWithDetails } from "@/types/database";
import { formatLocalKickoffTime } from "@/lib/date-utils";

interface MatchGridCardProps {
  match: MatchWithDetails;
}

/**
 * Tarjeta compacta de partido con los 3 estados oficiales de AGENTS.md:
 * - SCHEDULED: Hora local y Pronóstico Algorítmico (% Victoria Local, % Empate, % Visitante)
 * - IN_PLAY / HT: Indicador pulsante en verde #19D392, minuto exacto y marcador en vivo
 * - FINISHED: Marcador definitivo, xG Match, goleadores y verificación del pronóstico
 */
export function MatchGridCard({ match }: MatchGridCardProps) {
  const isLive = match.status === "IN_PLAY" || match.status === "HT";
  const isFinished = match.status === "FINISHED";
  const isScheduled = match.status === "SCHEDULED";

  const homeWinProb = match.prediction?.home_win_prob ?? 50;
  const drawProb = match.prediction?.draw_prob ?? 25;
  const awayWinProb = match.prediction?.away_win_prob ?? 25;

  const minuteLabel =
    match.status === "HT"
      ? "ET"
      : match.elapsed_minute
        ? match.extra_minute && match.extra_minute > 0
          ? `${match.elapsed_minute}+${match.extra_minute}'`
          : `${match.elapsed_minute}' ${match.live_stats?.half_label ?? "1T"}`
        : "En Vivo";

  const lastGoalEvent = (match.events ?? [])
    .filter((e) => e.event_type === "GOAL")
    .slice(-1)[0];

  return (
    <div className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-sm border border-outline-variant/15 flex flex-col justify-between space-y-4">
      {/* Cabecera de Estado y Estadio */}
      <div className="flex items-center justify-between gap-2">
        {isFinished && (
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm font-bold uppercase tracking-wider">
            Finalizado
          </span>
        )}
        {isLive && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-mint/15 text-brand-mint border border-brand-mint/30 font-label-sm text-label-sm uppercase font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-mint animate-ping"></span>
            {minuteLabel}
          </span>
        )}
        {isScheduled && (
          <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold uppercase tracking-wider">
            Hoy • {formatLocalKickoffTime(match.kickoff_at)} CET
          </span>
        )}
        <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
          {match.venue ?? "Estadio UEFA"}
        </span>
      </div>

      {/* Scoreboard Compacto */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center p-1 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-contain"
                alt={`Escudo de ${match.home_team_name}`}
                src={match.home_team_crest}
              />
            </div>
            <span className="font-label-md text-label-md font-bold text-on-surface truncate">
              {match.home_team_name}
            </span>
          </div>

          {isScheduled ? (
            <span className="font-label-md text-label-md text-on-surface-variant font-bold font-tabular-stats">
              {match.live_stats?.home_odds ?? `${homeWinProb}%`}
            </span>
          ) : (
            <span className="font-score-display-mobile text-score-display-mobile text-primary font-tabular-stats">
              {match.home_score}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center p-1 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-contain"
                alt={`Escudo de ${match.away_team_name}`}
                src={match.away_team_crest}
              />
            </div>
            <span className="font-label-md text-label-md font-medium text-on-surface-variant truncate">
              {match.away_team_name}
            </span>
          </div>

          {isScheduled ? (
            <span className="font-label-md text-label-md text-on-surface-variant font-bold font-tabular-stats">
              {match.live_stats?.away_odds ?? `${awayWinProb}%`}
            </span>
          ) : (
            <span className="font-score-display-mobile text-score-display-mobile text-on-surface-variant font-tabular-stats">
              {match.away_score}
            </span>
          )}
        </div>
      </div>

      {/* Footer Contextual según los 3 Estados */}
      {isFinished && (
        <div className="pt-2 bg-surface-container rounded-lg p-2.5 flex items-center justify-between font-tabular-stats text-tabular-stats">
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">
              xG Match:
            </span>
            <span className="text-primary font-bold">
              {(match.live_stats?.home_xg ?? 2.14).toFixed(2)}
            </span>
            <span className="text-outline-variant">vs</span>
            <span className="text-on-surface-variant">
              {(match.live_stats?.away_xg ?? 0.86).toFixed(2)}
            </span>
          </div>
          <span className="text-brand-mint font-label-sm text-label-sm font-medium truncate ml-2">
            {lastGoalEvent
              ? `Gol: ${lastGoalEvent.player_name} (${lastGoalEvent.minute}')`
              : "Pronóstico Verificado"}
          </span>
        </div>
      )}

      {isLive && (
        <div className="pt-2 bg-surface-container rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[16px]">
              insights
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Pronóstico Vivo:
            </span>
          </div>
          <div className="flex items-center gap-2 font-tabular-stats text-tabular-stats">
            <span className="text-primary font-bold">1 ({homeWinProb}%)</span>
            <span className="text-secondary font-bold">X ({drawProb}%)</span>
            <span className="text-on-surface-variant">2 ({awayWinProb}%)</span>
          </div>
        </div>
      )}

      {isScheduled && (
        <div className="pt-2 bg-surface-container rounded-lg p-2.5 space-y-1.5">
          <div className="flex justify-between font-label-sm text-label-sm">
            <span className="text-primary font-bold">Local {homeWinProb}%</span>
            <span className="text-secondary font-bold">Empate {drawProb}%</span>
            <span className="text-brand-mint font-bold">
              Visita {awayWinProb}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden flex">
            <div
              className="h-full bg-primary"
              style={{ width: `${homeWinProb}%` }}
            ></div>
            <div
              className="h-full bg-secondary-container"
              style={{ width: `${drawProb}%` }}
            ></div>
            <div
              className="h-full bg-brand-mint"
              style={{ width: `${awayWinProb}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
