"use client";

import type { MatchRow } from "@/types/database";
import { isMatchLive } from "@/lib/date-utils";
import { useClientClock } from "@/lib/use-client-clock";

export function MatchFreshness({ match }: { match: MatchRow }) {
  const now = useClientClock();
  if (!isMatchLive(match.status)) return null;
  const fetched = Date.parse(match.live_stats?.source_updated_at ?? "");
  const age = now !== null && Number.isFinite(fetched) ? Math.max(0, Math.floor((now - fetched) / 60_000)) : null;
  return (
    <p className="text-[11px] text-on-surface-variant" role="status">
      {match.live_stats?.source === "api-football" ? "Actualización cada 5 min" : "Fuente gratuita · marcador con retraso"}
      {age === null ? " · Sin actualización verificada" : ` · Consultado ${age === 0 ? "hace menos de 1 min" : `hace ${age} min`}`}
      {age !== null && age >= 10 ? " · Datos atrasados" : ""}
    </p>
  );
}
