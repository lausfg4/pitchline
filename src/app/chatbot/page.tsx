import { Suspense } from "react";
import {
  fetchInitialMatchesWithDetails,
  fetchInitialNewsArticles,
  fetchInitialPlayerInjuries,
} from "@/lib/supabase/queries";
import { ChatbotDeportivoView } from "@/components/chatbot/ChatbotDeportivoView";
import { STITCH_REFERENCE_MATCHES } from "@/data/stitch-matches";
import {
  STITCH_REFERENCE_INJURIES,
  STITCH_REFERENCE_NEWS,
} from "@/data/stitch-news";

async function ChatbotDataLoader() {
  const [initialMatches, initialInjuries, initialNews] = await Promise.all([
    fetchInitialMatchesWithDetails(),
    fetchInitialPlayerInjuries(),
    fetchInitialNewsArticles(),
  ]);

  return (
    <ChatbotDeportivoView
      initialMatches={initialMatches}
      initialInjuries={initialInjuries}
      initialNews={initialNews}
    />
  );
}

export default function ChatbotPage() {
  return (
    <Suspense
      fallback={
        <ChatbotDeportivoView
          initialMatches={STITCH_REFERENCE_MATCHES}
          initialInjuries={STITCH_REFERENCE_INJURIES}
          initialNews={STITCH_REFERENCE_NEWS}
        />
      }
    >
      <ChatbotDataLoader />
    </Suspense>
  );
}
