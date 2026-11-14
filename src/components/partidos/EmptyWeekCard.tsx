"use client";

import { CalendarDays } from "lucide-react";

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
    <section aria-label="Calendario semanal" className="flex items-start gap-3 rounded-xl border border-white/8 bg-surface-container-low px-4 py-4 sm:px-5">
      <CalendarDays size={20} strokeWidth={1.7} aria-hidden="true" className="mt-0.5 shrink-0 text-on-surface-variant" />
      <div className="space-y-1">
        <p className="text-xs text-on-surface-variant">{weekRangeLabel}</p>
        <h2 className="font-headline-md text-base font-semibold text-brand-white">No hay partidos para esta semana</h2>
        <p className="text-sm text-on-surface-variant">Próxima jornada · <span className="text-brand-white">{nextMatchdayDate}</span></p>
        {upcomingMatchesSummary && <p className="text-sm text-on-surface-variant">{upcomingMatchesSummary}</p>}
      </div>
    </section>
  );
}
