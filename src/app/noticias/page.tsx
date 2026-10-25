import { Suspense } from "react";
import { fetchInitialNewsArticles } from "@/lib/supabase/queries";
import { NoticiasExclusivasView } from "@/components/noticias/NoticiasExclusivasView";
import { STITCH_REFERENCE_NEWS } from "@/data/stitch-news";

async function NoticiasDataLoader() {
  const initialArticles = await fetchInitialNewsArticles();
  return <NoticiasExclusivasView initialArticles={initialArticles} />;
}

export default function NoticiasPage() {
  return (
    <Suspense
      fallback={
        <NoticiasExclusivasView initialArticles={STITCH_REFERENCE_NEWS} />
      }
    >
      <NoticiasDataLoader />
    </Suspense>
  );
}
