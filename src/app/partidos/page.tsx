import { Suspense } from "react";
import { fetchInitialMatchesWithDetails } from "@/lib/supabase/queries";
import { PartidosRealtimeView } from "@/components/partidos/PartidosRealtimeView";

async function PartidosDataLoader() {
  const initialDbMatches = await fetchInitialMatchesWithDetails();
  return <PartidosRealtimeView initialDbMatches={initialDbMatches} />;
}

export default function PartidosPage() {
  return (
    <Suspense
      fallback={<PartidosRealtimeView initialDbMatches={[]} />}
    >
      <PartidosDataLoader />
    </Suspense>
  );
}

