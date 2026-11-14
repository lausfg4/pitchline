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
        <div className="flex justify-end">
          <Link href="/clasificacion" className="text-sm text-on-surface-variant hover:text-brand-mint">Ver clasificación y cruces →</Link>
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
