"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { MatchWithDetails, StandingRow } from "@/types/database";
import { PitchlineShell } from "@/components/layout/PitchlineShell";
import { KnockoutBracket } from "@/components/brackets/KnockoutBracket";

interface SimuladorInteractiveViewProps {
  initialStandings: StandingRow[];
  initialMatches: MatchWithDetails[];
}

export function SimuladorInteractiveView({
  initialStandings,
  initialMatches,
}: SimuladorInteractiveViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <PitchlineShell
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      currentMatchdayLabel="Simulador Oficial • Arma tu Champions"
      searchPlaceholder="Buscar club en el cuadro eliminatorio..."
    >
      <div className="flex flex-col w-full space-y-5">
        {/* Barra Superior de Contexto Pestaña 3 */}
        <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/15 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-mint text-brand-navy font-label-sm text-label-sm uppercase font-bold">
              <span className="material-symbols-outlined text-[16px]">
                account_tree
              </span>
              Pestaña 3 • Arma tu Champions
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant hidden sm:inline">
              Simulador de Eliminatorias UEFA (Octavos → Cuartos → Semifinales →
              Campeón)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/clasificacion"
              className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-sm text-label-sm transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">
                leaderboard
              </span>
              <span>Ver Tabla 36 y Llaves en Vivo</span>
            </Link>
          </div>
        </div>

        {/* Componente Reutilizable <KnockoutBracket mode="simulator" /> */}
        <KnockoutBracket
          mode="simulator"
          standings={initialStandings}
          matches={initialMatches}
        />
      </div>
    </PitchlineShell>
  );
}
