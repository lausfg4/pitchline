import { Suspense } from "react";
import {
  fetchInitialMatchesWithDetails,
  fetchInitialStandings,
} from "@/lib/supabase/queries";
import { SimuladorInteractiveView } from "@/components/simulador/SimuladorInteractiveView";
import { STITCH_REFERENCE_STANDINGS } from "@/data/stitch-standings";
import { STITCH_REFERENCE_MATCHES } from "@/data/stitch-matches";

async function SimuladorDataLoader() {
  const [initialStandings, initialMatches] = await Promise.all([
    fetchInitialStandings(),
    fetchInitialMatchesWithDetails(),
  ]);

  return (
    <SimuladorInteractiveView
      initialStandings={initialStandings}
      initialMatches={initialMatches}
    />
  );
}

export default function SimuladorPage() {
  return (
    <Suspense
      fallback={
        <SimuladorInteractiveView
          initialStandings={STITCH_REFERENCE_STANDINGS}
          initialMatches={STITCH_REFERENCE_MATCHES}
        />
      }
    >
      <SimuladorDataLoader />
    </Suspense>
  );
}
