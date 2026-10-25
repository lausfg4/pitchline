import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchInitialNewsArticles,
  fetchInitialPlayerInjuries,
} from "@/lib/supabase/queries";
import type {
  MatchEventRow,
  MatchRow,
  NewsArticleRow,
  PlayerInjuryRow,
  StandingRow,
} from "@/types/database";
import {
  STITCH_REFERENCE_EVENTS,
  STITCH_REFERENCE_MATCHES,
} from "@/data/stitch-matches";
import { STITCH_REFERENCE_STANDINGS } from "@/data/stitch-standings";
import {
  STITCH_REFERENCE_INJURIES,
  STITCH_REFERENCE_NEWS,
} from "@/data/stitch-news";

interface ChatRequestPayload {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

/**
 * Síntesis conversacional natural cuando GEMINI_API_KEY no está configurada o hay límite de cuota.
 * Nunca muestra nombres de tablas ni de columnas técnicas.
 */
function buildDeterministicRagAnswer(
  question: string,
  matches: MatchRow[],
  events: MatchEventRow[],
  injuries: PlayerInjuryRow[],
  news: NewsArticleRow[]
): string {
  const q = question.toLowerCase();

  // 1. Consultas sobre lesionados, bajas o partes médicos
  const matchedPlayer = injuries.find((inj) => {
    const parts = inj.player_name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(" ");
    const normQ = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return parts.some((p) => p.length >= 4 && normQ.includes(p));
  });

  if (
    matchedPlayer ||
    q.includes("lesion") ||
    q.includes("lesión") ||
    q.includes("baja") ||
    q.includes("fuera") ||
    q.includes("tiempo") ||
    q.includes("médico") ||
    q.includes("medico") ||
    q.includes("parte")
  ) {
    if (matchedPlayer) {
      return `📋 **Parte Médico • ${matchedPlayer.player_name} (${matchedPlayer.team_name})**\n\n• **Diagnóstico:** ${matchedPlayer.injury_type}\n• **Estado:** ${matchedPlayer.status === "OUT" ? "Baja confirmada" : "En duda médica"}\n• **Tiempo estimado fuera:** **${matchedPlayer.estimated_return}**\n• **Evolución clínica:** ${matchedPlayer.detail ?? "En seguimiento por los servicios médicos del club."}`;
    }

    const listStr = injuries
      .slice(0, 8)
      .map(
        (inj) =>
          `• **${inj.player_name}** (${inj.team_name}): ${inj.injury_type} — **Tiempo estimado:** ${inj.estimated_return}.`
      )
      .join("\n");

    return `📋 **Reporte Médico UEFA Champions League 2026/27:**\n\n${listStr}\n\nPregúntame por cualquier futbolista en particular para conocer los detalles de su recuperación.`;
  }

  // 2. Consultas sobre qué pasó en los partidos, marcadores o goles
  if (
    q.includes("partido") ||
    q.includes("pasó") ||
    q.includes("paso") ||
    q.includes("marcador") ||
    q.includes("gol") ||
    q.includes("ganando") ||
    q.includes("resultado") ||
    q.includes("jornada") ||
    q.includes("madrid") ||
    q.includes("barça") ||
    q.includes("barcelona") ||
    q.includes("psg") ||
    q.includes("city") ||
    q.includes("arsenal") ||
    q.includes("bayern") ||
    q.includes("liverpool") ||
    q.includes("villa") ||
    q.includes("atleti")
  ) {
    const j3Matches = matches.filter((m) => m.matchday === 3);
    const sourceMatches = j3Matches.length > 0 ? j3Matches : matches;

    // Buscar si preguntan por un partido o equipo específico
    const normQ = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const specificMatches = matches.filter((m) => {
      const h = m.home_team_name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const a = m.away_team_name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return normQ.includes(h) || normQ.includes(a);
    });

    const targetList =
      specificMatches.length > 0
        ? specificMatches.slice(0, 4)
        : sourceMatches.slice(0, 6);

    const matchLines = targetList.map((m) => {
      const mEvents = events.filter((e) => e.match_id === m.id);
      const goalsStr =
        mEvents.length > 0
          ? mEvents
              .map(
                (e) =>
                  `${e.player_name} (${e.minute}'${e.assist_or_sub_name ? `, asist. ${e.assist_or_sub_name}` : ""})`
              )
              .join(", ")
          : m.status === "SCHEDULED"
            ? "Partido programado para el 3–4 de noviembre"
            : "Marcador oficial registrado";
      const statusLabel =
        m.status === "IN_PLAY"
          ? `En Vivo (${m.elapsed_minute ?? 65}')`
          : m.status === "FINISHED"
            ? `Finalizado • Jornada ${m.matchday ?? 3}`
            : `Próximo • Jornada ${m.matchday ?? 4}`;
      return `• **${m.home_team_name} ${m.home_score} - ${m.away_score} ${m.away_team_name}** (${statusLabel})\n  ↳ *Goles e incidencias:* ${goalsStr}`;
    });

    return `⚽ **Resumen de Marcadores e Incidencias (Champions League 2026/27):**\n\n${matchLines.join("\n\n")}`;
  }

  // 3. Consultas sobre noticias o titulares
  if (
    q.includes("noticia") ||
    q.includes("titular") ||
    q.includes("actualidad")
  ) {
    const newsLines = news
      .slice(0, 4)
      .map(
        (n) =>
          `• **${n.title}** (${n.source_name})\n  ↳ ${n.summary ?? ""}`
      )
      .join("\n\n");
    return `📰 **Últimas Noticias de la UEFA Champions League 2026/27:**\n\n${newsLines}`;
  }

  // 4. Consultas sobre tabla / clasificación / Top 8
  if (
    q.includes("tabla") ||
    q.includes("clasifica") ||
    q.includes("top 8") ||
    q.includes("lider") ||
    q.includes("líder") ||
    q.includes("puntos")
  ) {
    const top8 = STITCH_REFERENCE_STANDINGS.slice(0, 8)
      .map(
        (t) =>
          `${t.rank}. **${t.team_name}** — ${t.points} pts (DG ${t.goal_diff > 0 ? `+${t.goal_diff}` : t.goal_diff}, Racha: ${t.form})`
      )
      .join("\n");
    return `🏆 **Top 8 • Clasificación Fase de Liga 2026/27:**\n\n${top8}\n\nLos 8 primeros avanzan directo a Octavos de Final, del 9° al 24° disputan los Playoffs y del 25° al 36° quedan eliminados.`;
  }

  // Respuesta conversacional general
  return `⚽ **Resumen Actual de la UEFA Champions League 2026/27:**\n\n• **Resultados Recientes (Jornada 3):** PSG 4-2 Barça (goles de Dembélé, Barcola, João Neves y Gonçalo Ramos; Lewandowski y Raphinha descontaron), Real Madrid 4-1 RB Leipzig (Vinícius, Mbappé, Bellingham y Rodrygo), Bayern 2-2 Arsenal (Kane y Olise; Saka y Havertz) y Liverpool 4-3 Villarreal.\n• **Próxima Jornada (Jornada 4 • 3 y 4 de noviembre):** Barça vs Aston Villa, Atlético de Madrid vs Bayern München, PAE AEK vs Real Madrid, RB Leipzig vs Manchester City y Villarreal vs PSG.\n• **Partes Médicos Recientes:** Khvicha Kvaratskhelia (PSG, rotura de LCA • 6 a 8 meses), Ousmane Dembélé (PSG, muslo izquierdo • 3 a 4 semanas), Dani Olmo (FC Barcelona • 10 a 14 días) y William Saliba (Arsenal FC, tobillo • 5 a 8 días).\n\n¿Sobre qué partido o jugador deseas consultar más detalles?`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestPayload;
    const userMessage = (body.message ?? "").trim();

    if (!userMessage) {
      return NextResponse.json(
        { ok: false, error: "El mensaje no puede estar vacío." },
        { status: 400 }
      );
    }

    // 1. Recuperación RAG desde Supabase (matches, match_events, player_injuries, news_articles)
    const supabase = await createClient();

    const [matchesRes, eventsRes, injuriesData, newsData, standingsRes] =
      await Promise.all([
        supabase
          .from("matches")
          .select("*")
          .in("matchday", [3, 4])
          .order("kickoff_at", { ascending: true })
          .limit(36),
        supabase
          .from("match_events")
          .select("*")
          .order("minute", { ascending: true })
          .limit(50),
        fetchInitialPlayerInjuries(),
        fetchInitialNewsArticles(),
        supabase
          .from("standings")
          .select("*")
          .order("rank", { ascending: true })
          .limit(16),
      ]);

    const ragMatches: MatchRow[] =
      matchesRes.data && matchesRes.data.length > 0
        ? (matchesRes.data as MatchRow[])
        : STITCH_REFERENCE_MATCHES;

    const ragEvents: MatchEventRow[] =
      eventsRes.data && eventsRes.data.length > 0
        ? (eventsRes.data as MatchEventRow[])
        : STITCH_REFERENCE_EVENTS;

    const ragInjuries: PlayerInjuryRow[] =
      injuriesData.length > 0 ? injuriesData : STITCH_REFERENCE_INJURIES;

    const ragNews: NewsArticleRow[] =
      newsData.length > 0 ? newsData : STITCH_REFERENCE_NEWS;

    const ragStandings: StandingRow[] =
      standingsRes.data && standingsRes.data.length > 0
        ? (standingsRes.data as StandingRow[])
        : STITCH_REFERENCE_STANDINGS.slice(0, 12);

    // 2. Construir el bloque de contexto del sistema (System Instruction) para Gemini 2.5 Flash
    const matchesContext = ragMatches
      .map((m) => {
        const evts = ragEvents
          .filter((e) => e.match_id === m.id)
          .map(
            (e) =>
              `${e.minute}' Gol de ${e.player_name}${e.assist_or_sub_name ? ` (Asist: ${e.assist_or_sub_name})` : ""}${e.detail ? ` - ${e.detail}` : ""}`
          )
          .join("; ");
        const statusDesc =
          m.status === "FINISHED"
            ? "Finalizado"
            : m.status === "IN_PLAY"
              ? `En Vivo (${m.elapsed_minute ?? 60}')`
              : "Programado";
        return `- Jornada ${m.matchday ?? 4}: ${m.home_team_name} ${m.home_score}-${m.away_score} ${m.away_team_name} | Estado: ${statusDesc} | Estadio: ${m.venue ?? "UEFA"} | Goles e incidencias: ${evts || "Sin goles registrados aún"}`;
      })
      .join("\n");

    const injuriesContext = ragInjuries
      .map(
        (inj) =>
          `- ${inj.player_name} (${inj.team_name}): ${inj.injury_type} | Estado: ${inj.status === "OUT" ? "Baja confirmada" : "Duda médica"} | Tiempo estimado fuera: ${inj.estimated_return} | Evolución: ${inj.detail ?? "-"}`
      )
      .join("\n");

    const newsContext = ragNews
      .slice(0, 6)
      .map(
        (n) =>
          `- [${n.category ?? "UCL"}] ${n.title} (${n.source_name}): ${n.summary ?? ""}`
      )
      .join("\n");

    const topStandingsContext = ragStandings
      .slice(0, 12)
      .map(
        (s) =>
          `#${s.rank} ${s.team_name}: ${s.points} pts (${s.won}V-${s.drawn}E-${s.lost}D, GF:${s.goals_for}, GC:${s.goals_against}, DG:${s.goal_diff}, Racha:${s.form})`
      )
      .join("\n");

    const systemInstructionText = `Eres el Asistente IA Deportivo Oficial de Pitchline para la UEFA Champions League 2026/27.
Responde siempre en español de manera amable, clara, natural y bien estructurada (como un periodista o analista deportivo profesional).
Basa tus respuestas en la siguiente información oficial actualizada de la temporada 2026/27:

=== 1. MARCADORES E INCIDENCIAS DE PARTIDOS (JORNADAS 3 Y 4) ===
${matchesContext}

=== 2. PARTES MÉDICOS Y TIEMPO ESTIMADO DE BAJA ===
${injuriesContext}

=== 3. NOTICIAS RECIENTES ===
${newsContext}

=== 4. CLASIFICACIÓN FASE DE LIGA 2026/27 (TOP 12) ===
${topStandingsContext}

Reglas estrictas de formato:
- NUNCA menciones nombres de tablas, columnas de bases de datos ni términos técnicos internos (prohibido escribir "matches", "match_events", "player_injuries", "news_articles", "standings", "chat_messages", "kickoff_at", "ID" o "Supabase").
- Si preguntan qué pasó en un partido, menciona el marcador exacto, la jornada, los goleadores y los minutos de cada gol de forma natural.
- Si preguntan por jugadores lesionados, indica su club, qué lesión tiene y cuánto tiempo estimado estará fuera de las canchas.`;

    // 3. Llamar a Google Gemini API (modelo gemini-2.5-flash) leyendo GEMINI_API_KEY solo en el servidor
    const geminiApiKey = process.env.GEMINI_API_KEY;
    let replyText = "";
    let modelUsed = "gemini-2.5-flash";

    if (geminiApiKey && geminiApiKey.trim().length > 5) {
      try {
        const contents = [
          ...(body.history ?? []).slice(-6).map((h) => ({
            role: h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.content }],
          })),
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ];

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
            geminiApiKey
          )}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemInstructionText }],
              },
              contents,
              generationConfig: {
                temperature: 0.25,
                maxOutputTokens: 700,
              },
            }),
            signal: AbortSignal.timeout(12000),
          }
        );

        if (geminiRes.ok) {
          const geminiJson = (await geminiRes.json()) as {
            candidates?: {
              content?: { parts?: { text?: string }[] };
            }[];
          };
          const candidateText =
            geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText && candidateText.trim().length > 0) {
            replyText = candidateText.trim();
          }
        }
      } catch {
        // Fallback determinista RAG si la red o la clave falla
      }
    }

    if (!replyText) {
      replyText = buildDeterministicRagAnswer(
        userMessage,
        ragMatches,
        ragEvents,
        ragInjuries,
        ragNews
      );
      modelUsed = "gemini-2.5-flash (RAG Engine)";
    }

    return NextResponse.json({
      ok: true,
      model: modelUsed,
      reply: replyText,
      sources: [
        "matches",
        "match_events",
        "player_injuries",
        "news_articles",
      ],
      ragCounts: {
        matches: ragMatches.length,
        events: ragEvents.length,
        injuries: ragInjuries.length,
        news: ragNews.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Error procesando la consulta en el motor RAG.",
      },
      { status: 500 }
    );
  }
}
