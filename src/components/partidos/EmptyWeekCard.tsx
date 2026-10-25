"use client";

import React from "react";

interface EmptyWeekCardProps {
  weekRangeLabel: string;
  nextMatchdayDate: string;
  upcomingMatchesSummary?: string;
  showingPreview?: boolean;
  onTogglePreview?: () => void;
}

/**
 * Detector de Semana Vacía (AGENTS.md - Pestaña 2):
 * Si no hay partidos programados en la semana actual (lunes a domingo),
 * muestra la tarjeta oficial: "No hay partidos para esta semana — Próxima jornada: [Fecha]".
 */
export function EmptyWeekCard({
  weekRangeLabel,
  nextMatchdayDate,
  upcomingMatchesSummary,
}: EmptyWeekCardProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative overflow-hidden rounded-xl bg-surface-container-low border border-brand-mint/30 p-5 lg:p-6 shadow-lg"
    >
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-mint/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-mint/15 border border-brand-mint/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-brand-mint text-[26px]">
              event_busy
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-highest text-brand-mint font-label-sm text-label-sm uppercase tracking-wider">
                Detector de Semana Activo ({weekRangeLabel})
              </span>
            </div>
            <h2 className="font-headline-md text-headline-md text-brand-white">
              No hay partidos para esta semana — Próxima jornada:{" "}
              <span className="text-brand-mint capitalize">{nextMatchdayDate}</span>
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {upcomingMatchesSummary ??
                "El calendario oficial de la UEFA Champions League no registra encuentros entre lunes y domingo de la semana en curso."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
