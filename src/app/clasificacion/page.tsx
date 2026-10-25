import { Suspense } from "react";
import {
  fetchInitialMatchesWithDetails,
  fetchInitialStandings,
} from "@/lib/supabase/queries";
import { ClasificacionRealtimeView } from "@/components/clasificacion/ClasificacionRealtimeView";
import { STITCH_REFERENCE_STANDINGS } from "@/data/stitch-standings";
import { STITCH_REFERENCE_MATCHES } from "@/data/stitch-matches";

async function ClasificacionDataLoader() {
  const [initialStandings, initialMatches] = await Promise.all([
    fetchInitialStandings(),
    fetchInitialMatchesWithDetails(),
  ]);

  return (
    <ClasificacionRealtimeView
      initialStandings={initialStandings}
      initialMatches={initialMatches}
    />
  );
}

export default function ClasificacionPage() {
  return (
    <Suspense
      fallback={
        <ClasificacionRealtimeView
          initialStandings={STITCH_REFERENCE_STANDINGS}
          initialMatches={STITCH_REFERENCE_MATCHES}
        />
      }
    >
      <ClasificacionDataLoader />
    </Suspense>
  );
}
