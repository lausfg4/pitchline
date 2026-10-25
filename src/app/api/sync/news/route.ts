import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { NewsArticleRow } from "@/types/database";
import { STITCH_REFERENCE_NEWS } from "@/data/stitch-news";

const UEFA_UCL_RSS_URL =
  "https://www.uefa.com/rssfeed/uefachampionsleague/rss.xml";

const CLUB_KEYWORDS: { tag: string; patterns: string[] }[] = [
  { tag: "Real Madrid", patterns: ["real madrid", "madrid", "bernabéu", "vinicius", "vinícius", "bellingham", "mbappé", "mbappe", "ancelotti"] },
  { tag: "FC Barcelona", patterns: ["barcelona", "barça", "lewandowski", "yamal", "pedri", "raphinha", "flick"] },
  { tag: "Liverpool FC", patterns: ["liverpool", "anfield", "salah", "van dijk", "slot"] },
  { tag: "Arsenal FC", patterns: ["arsenal", "saka", "ødegaard", "odegaard", "arteta", "gunners"] },
  { tag: "Manchester City", patterns: ["manchester city", "man city", "haaland", "de bruyne", "guardiola", "rodri"] },
  { tag: "Bayern München", patterns: ["bayern", "munich", "múnich", "kane", "musiala", "kompany"] },
  { tag: "Inter de Milán", patterns: ["inter", "milán", "milan", "lautaro", "inzaghi", "calhanoglu"] },
  { tag: "Borussia Dortmund", patterns: ["dortmund", "bvb", "guirassy", "adeyemi"] },
  { tag: "Paris Saint-Germain", patterns: ["paris", "psg", "dembélé", "hakimi", "luis enrique"] },
  { tag: "Bayer Leverkusen", patterns: ["leverkusen", "wirtz", "xabi alonso"] },
  { tag: "Atlético de Madrid", patterns: ["atlético", "atletico", "griezmann", "simeone", "julian alvarez"] },
  { tag: "Juventus FC", patterns: ["juventus", "juve", "vlahovic", "yildiz"] },
];

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80",
];

function cleanXmlText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTagValue(itemXml: string, tagName: string): string | null {
  const regex = new RegExp(
    `<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "i"
  );
  const match = itemXml.match(regex);
  return match ? cleanXmlText(match[1]) : null;
}

function extractMediaUrl(itemXml: string, index: number): string {
  const enclosureMatch = itemXml.match(
    /<(?:enclosure|media:content|media:thumbnail)[^>]+url=["']([^"']+)["']/i
  );
  if (enclosureMatch && enclosureMatch[1]) {
    return enclosureMatch[1];
  }
  const imgInDesc = itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgInDesc && imgInDesc[1]) {
    return imgInDesc[1];
  }
  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

function inferClubTag(text: string): string | null {
  const lower = text.toLowerCase();
  for (const club of CLUB_KEYWORDS) {
    if (club.patterns.some((p) => lower.includes(p))) {
      return club.tag;
    }
  }
  return null;
}

function inferCategory(text: string): string {
  const lower = text.toLowerCase();
  if (
    lower.includes("injur") ||
    lower.includes("lesión") ||
    lower.includes("baja") ||
    lower.includes("medical") ||
    lower.includes("squad") ||
    lower.includes("line-up")
  ) {
    return "Parte Médico";
  }
  if (
    lower.includes("stat") ||
    lower.includes("tactic") ||
    lower.includes("analysis") ||
    lower.includes("xg") ||
    lower.includes("record")
  ) {
    return "Táctica & xG";
  }
  if (
    lower.includes("preview") ||
    lower.includes("previa") ||
    lower.includes("draw") ||
    lower.includes("sorteo") ||
    lower.includes("when")
  ) {
    return "Previa";
  }
  if (
    lower.includes("highlight") ||
    lower.includes("goal") ||
    lower.includes("win") ||
    lower.includes("beat") ||
    lower.includes("report") ||
    lower.includes("crónica")
  ) {
    return "Crónica";
  }
  return "Oficial UEFA";
}

function parseUefaRssXml(xml: string): NewsArticleRow[] {
  const items: NewsArticleRow[] = [];
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (let i = 0; i < itemMatches.length; i++) {
    const itemXml = itemMatches[i];
    const title = extractTagValue(itemXml, "title");
    const link = extractTagValue(itemXml, "link");
    const description = extractTagValue(itemXml, "description");
    const pubDate = extractTagValue(itemXml, "pubDate");
    const guid = extractTagValue(itemXml, "guid");

    if (!title || !link) continue;

    // Filtrar exclusivamente noticias relevantes de la UEFA Champions League
    const combinedText = `${title} ${description ?? ""} ${link}`;
    const isUclRelevant =
      link.toLowerCase().includes("uefachampionsleague") ||
      combinedText.toLowerCase().includes("champions") ||
      inferClubTag(combinedText) !== null;

    if (!isUclRelevant) continue;

    const parsedDate = pubDate ? new Date(pubDate) : new Date();
    const isoDate = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString()
      : parsedDate.toISOString();

    items.push({
      id: guid
        ? `uefa-${guid.replace(/[^a-zA-Z0-9-_]/g, "").slice(-32)}`
        : `uefa-rss-${i + 1}`,
      title,
      summary:
        description && description.length > 10
          ? description
          : "Cobertura oficial verificada del torneo desde el feed RSS de UEFA Champions League.",
      url: link,
      image_url: extractMediaUrl(itemXml, i),
      source_name: "UEFA.com RSS Oficial",
      category: inferCategory(combinedText),
      club_tag: inferClubTag(combinedText),
      published_at: isoDate,
    });
  }

  return items.slice(0, 24);
}

async function handleSync(request: NextRequest) {
  // Validación de seguridad de Cron / Origen (AGENTS.md Regla 3.2)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const headerCronSecret = request.headers.get("x-cron-secret");
  const isInternalTrigger = request.headers.get("x-pitchline-sync") === "true";

  if (
    cronSecret &&
    !isInternalTrigger &&
    authHeader !== `Bearer ${cronSecret}` &&
    headerCronSecret !== cronSecret
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "No autorizado: cabecera CRON_SECRET inválida.",
      },
      { status: 401 }
    );
  }

  let parsedArticles: NewsArticleRow[] = [];
  let rssSourceStatus = "UEFA_RSS_LIVE";

  try {
    const rssResponse = await fetch(UEFA_UCL_RSS_URL, {
      headers: {
        "User-Agent": "Pitchline-UCL-Analytics/1.0 (+https://www.uefa.com)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (rssResponse.ok) {
      const xmlText = await rssResponse.text();
      parsedArticles = parseUefaRssXml(xmlText);
    }
  } catch {
    rssSourceStatus = "FALLBACK_CURATED_UEFA";
  }

  // Enriquecimiento opcional con NewsAPI.org si NEWS_API_KEY está configurada en el servidor (AGENTS.md Sección 1)
  const newsApiKey = process.env.NEWS_API_KEY ?? process.env.NEWSAPI_KEY;
  if (newsApiKey && newsApiKey.trim().length > 5) {
    try {
      const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
        '"UEFA Champions League"'
      )}&language=es&sortBy=publishedAt&pageSize=10`;
      const newsRes = await fetch(newsApiUrl, {
        headers: {
          "X-Api-Key": newsApiKey.trim(),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      if (newsRes.ok) {
        const newsJson = (await newsRes.json()) as {
          articles?: {
            title?: string;
            description?: string;
            url?: string;
            urlToImage?: string;
            publishedAt?: string;
            source?: { name?: string };
          }[];
        };
        for (const [idx, item] of (newsJson.articles ?? []).entries()) {
          if (!item.title || !item.url) continue;
          const combined = `${item.title} ${item.description ?? ""}`;
          if (
            !combined.toLowerCase().includes("champions") &&
            inferClubTag(combined) === null
          ) {
            continue;
          }
          if (!parsedArticles.some((a) => a.url === item.url)) {
            parsedArticles.push({
              id: `newsapi-${idx + 1}`,
              title: item.title,
              summary:
                item.description ??
                "Cobertura verificada de la UEFA Champions League.",
              url: item.url,
              image_url:
                item.urlToImage ??
                FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length],
              source_name: item.source?.name ?? "NewsAPI UCL",
              category: inferCategory(combined),
              club_tag: inferClubTag(combined),
              published_at: item.publishedAt ?? new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // Continuar con los artículos del RSS oficial de UEFA
    }
  }

  if (parsedArticles.length === 0) {
    parsedArticles = STITCH_REFERENCE_NEWS;
    rssSourceStatus = "FALLBACK_CURATED_UEFA";
  }

  // Escritura con privilegios de servidor (SUPABASE_SERVICE_ROLE_KEY vía createAdminClient)
  let upsertedCount = 0;
  let dbNote = "Sincronizado en public.news_articles";

  try {
    const adminSupabase = createAdminClient();

    const rowsToUpsert = parsedArticles.map((art) => ({
      external_url: art.url,
      title: art.title,
      summary: art.summary,
      image_url: art.image_url,
      source_name: art.source_name,
      published_at: art.published_at,
    }));

    const { data, error } = await adminSupabase
      .from("news_articles")
      .upsert(rowsToUpsert, { onConflict: "external_url" })
      .select("*");

    if (error) {
      dbNote = `Feed RSS procesado (${error.message})`;
    } else {
      upsertedCount = data?.length ?? rowsToUpsert.length;
    }
  } catch (err) {
    dbNote =
      err instanceof Error
        ? `Modo sin Service Role Key configurada (${err.message})`
        : "RSS procesado en memoria";
  }

  return NextResponse.json({
    ok: true,
    source: UEFA_UCL_RSS_URL,
    status: rssSourceStatus,
    upsertedCount,
    note: dbNote,
    articles: parsedArticles,
  });
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}
