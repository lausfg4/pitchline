"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  ChatMessageRow,
  MatchEventRow,
  MatchRow,
  MatchWithDetails,
  NewsArticleRow,
  PlayerInjuryRow,
} from "@/types/database";
import {
  STITCH_REFERENCE_EVENTS,
  STITCH_REFERENCE_MATCHES,
} from "@/data/stitch-matches";
import { STITCH_REFERENCE_INJURIES } from "@/data/stitch-news";
import { PitchlineShell } from "@/components/layout/PitchlineShell";

interface ChatbotDeportivoViewProps {
  initialMatches: MatchWithDetails[];
  initialInjuries: PlayerInjuryRow[];
  initialNews: NewsArticleRow[];
}

interface UiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timeLabel: string;
}

const CHAT_STORAGE_KEY = "pitchline_chat_history_v2";

const QUICK_SUGGESTIONS = [
  "¿Cuáles fueron los resultados y goles de la última jornada?",
  "¿Qué jugadores están lesionados y cuánto tiempo estarán fuera?",
  "¿Qué partidos se juegan en la próxima jornada?",
  "¿Cómo va el Top 8 de la tabla de clasificación?",
  "¿Cuáles son las noticias más recientes de la Champions?",
];

/**
 * Limpia cualquier referencia residual a nombres de tablas o columnas técnicas
 * en mensajes antiguos almacenados.
 */
function sanitizeChatContent(text: string): string {
  return text
    .replace(/\(\s*`?public\.[a-z_]+`?\s*\)/gi, "")
    .replace(/\(\s*Tabla\s+`?[a-z_]+`?\s*\)/gi, "")
    .replace(/\(\s*`?matches`?\s*\+\s*`?match_events`?\s*\)/gi, "")
    .replace(/\(\s*`?match_events`?\s*\)/gi, "")
    .replace(/\(\s*`?player_injuries`?\s*\)/gi, "")
    .replace(/\(\s*`?news_articles`?\s*\)/gi, "")
    .replace(/\(\s*`?standings`?\s*\)/gi, "");
}

/**
 * Formatea negritas simples (**texto**) para que el chat luzca limpio y legible.
 */
function renderFormattedText(content: string) {
  const clean = sanitizeChatContent(content);
  const parts = clean.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="text-brand-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function ChatbotDeportivoView({
  initialMatches,
  initialInjuries,
}: ChatbotDeportivoViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [inputText, setInputText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  const [dbMatches, setDbMatches] =
    useState<MatchWithDetails[]>(initialMatches);
  const [dbInjuries, setDbInjuries] =
    useState<PlayerInjuryRow[]>(initialInjuries);

  const [messages, setMessages] = useState<UiChatMessage[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      content:
        "¡Hola! Soy tu Asistente Deportivo de Pitchline para la UEFA Champions League 2026/27.\n\nPuedes preguntarme cómo quedaron los partidos, quiénes anotaron los goles, qué encuentros vienen en la próxima jornada o cuánto tiempo estimado estará fuera cualquier jugador lesionado.",
      timeLabel: "En línea",
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const msgSeqRef = useRef<number>(1);

  // Asegurar que todos los partidos tengan sus incidencias de Jornada 3 (goles y asistencias)
  const activeMatches = useMemo(() => {
    const base =
      dbMatches.length > 0 ? dbMatches : STITCH_REFERENCE_MATCHES;
    const refEventsByMatch = new Map<number, MatchEventRow[]>();
    for (const ev of STITCH_REFERENCE_EVENTS) {
      const list = refEventsByMatch.get(ev.match_id) ?? [];
      list.push(ev);
      refEventsByMatch.set(ev.match_id, list);
    }

    return base.map((m) => ({
      ...m,
      events: refEventsByMatch.get(m.id) ?? m.events ?? [],
    }));
  }, [dbMatches]);

  // Asegurar que el monitor de lesionados muestre solo las bajas activas actuales con sus clubes y logos correctos
  const activeInjuries = useMemo(() => {
    const hasOutdated = dbInjuries.some(
      (inj) =>
        inj.player_name.includes("Ter Stegen") ||
        inj.player_name.includes("Carvajal") ||
        inj.player_name.includes("De Bruyne") ||
        inj.player_name.includes("Lamine Yamal") ||
        inj.estimated_return.includes("Cuartos de Final")
    );
    if (dbInjuries.length === 0 || hasOutdated) {
      return STITCH_REFERENCE_INJURIES;
    }
    return dbInjuries;
  }, [dbInjuries]);

  // Mostrar únicamente los partes médicos y bajas más recientes (última jornada)
  const filteredInjuries = useMemo(() => {
    const sorted = [...activeInjuries].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    if (!searchQuery.trim()) {
      return sorted.slice(0, 4);
    }
    const q = searchQuery.toLowerCase();
    return sorted
      .filter(
        (inj) =>
          inj.player_name.toLowerCase().includes(q) ||
          inj.team_name.toLowerCase().includes(q) ||
          inj.injury_type.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [activeInjuries, searchQuery]);

  // Mostrar únicamente los partidos más recientes (en vivo o recién finalizados en la última jornada)
  const recentMatches = useMemo(() => {
    const playedOrLive = activeMatches.filter(
      (m) =>
        m.status === "IN_PLAY" ||
        m.status === "HT" ||
        m.status === "FINISHED"
    );
    const source = playedOrLive.length > 0 ? playedOrLive : activeMatches;

    return [...source]
      .sort((a, b) => {
        // Primero por fecha más reciente (descendente) y luego priorizando partidos con goles/incidencias registradas
        const timeDiff =
          new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime();
        const aHasEvents = (a.events?.length ?? 0) > 0 ? 1 : 0;
        const bHasEvents = (b.events?.length ?? 0) > 0 ? 1 : 0;
        if (bHasEvents !== aHasEvents) return bHasEvents - aHasEvents;
        return timeDiff;
      })
      .slice(0, 4);
  }, [activeMatches]);

  // Cargar sesión activa de Supabase Auth y mensajes previos, más suscripción en vivo
  useEffect(() => {
    const supabase = createClient();

    const reloadDataFromSupabase = async () => {
      const [mRes, eRes, injRes] = await Promise.all([
        supabase
          .from("matches")
          .select("*")
          .order("kickoff_at", { ascending: true }),
        supabase
          .from("match_events")
          .select("*")
          .order("minute", { ascending: true }),
        supabase
          .from("player_injuries")
          .select("*")
          .order("updated_at", { ascending: false }),
      ]);

      if (mRes.data && mRes.data.length > 0) {
        const evtMap = new Map<number, MatchEventRow[]>();
        const evSource =
          eRes.data && eRes.data.length > 0
            ? (eRes.data as MatchEventRow[])
            : STITCH_REFERENCE_EVENTS;
        for (const e of evSource) {
          const list = evtMap.get(e.match_id) ?? [];
          list.push(e);
          evtMap.set(e.match_id, list);
        }
        setDbMatches(
          (mRes.data as MatchRow[]).map((m) => ({
            ...m,
            prediction: null,
            events: evtMap.get(m.id) ?? [],
          }))
        );
      }

      if (injRes.data && injRes.data.length > 0) {
        const mappedInj: PlayerInjuryRow[] = (
          injRes.data as Record<string, unknown>[]
        ).map((row, idx) => ({
          id: String(row.id ?? `inj-${idx}`),
          player_name: String(row.player_name ?? "Jugador"),
          team_id: typeof row.team_id === "number" ? row.team_id : null,
          team_name: String(row.team_name ?? "Club UEFA"),
          team_short_name:
            typeof row.team_short_name === "string"
              ? row.team_short_name
              : null,
          team_crest_url:
            typeof row.team_crest_url === "string"
              ? row.team_crest_url
              : typeof row.team_id === "number"
                ? `https://crests.football-data.org/${row.team_id}.png`
                : null,
          injury_type: String(
            row.injury_type ?? row.reason ?? "Molestia muscular en evaluación"
          ),
          status: String(row.status_reason ?? row.status ?? "OUT"),
          estimated_return: String(
            row.estimated_out_duration ??
              row.estimated_return ??
              "En evaluación médica"
          ),
          expected_return_date:
            typeof row.estimated_return_date === "string"
              ? row.estimated_return_date
              : null,
          detail:
            typeof row.medical_notes === "string"
              ? row.medical_notes
              : typeof row.detail === "string"
                ? row.detail
                : null,
          updated_at: String(row.updated_at ?? ""),
        }));
        setDbInjuries(mappedInj);
      }
    };

    const initSessionAndMessages = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setAuthUserId(null);
          setAuthEmail(null);

          const cached = localStorage.getItem(CHAT_STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as UiChatMessage[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
            }
          }
          return;
        }

        setAuthUserId(user.id);
        setAuthEmail(user.email ?? "Analista");

        const { data, error } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(40);

        if (!error && data && data.length > 0) {
          const loaded: UiChatMessage[] = (data as ChatMessageRow[]).map(
            (row) => ({
              id: String(row.id),
              role: row.role === "user" ? "user" : "assistant",
              content: sanitizeChatContent(String(row.content ?? "")),
              timeLabel: new Intl.DateTimeFormat("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(row.created_at)),
            })
          );
          setMessages((prev) => [prev[0], ...loaded]);
        }
      } catch {
        // Continuar con historial en memoria
      }
    };

    void initSessionAndMessages();

    const handleCustomSync = () => {
      void reloadDataFromSupabase();
    };
    window.addEventListener("pitchline:synced", handleCustomSync);

    const channel = supabase
      .channel("pitchline-chatbot-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => {
          void reloadDataFromSupabase();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_events" },
        () => {
          void reloadDataFromSupabase();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_injuries" },
        () => {
          void reloadDataFromSupabase();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("pitchline:synced", handleCustomSync);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const persistMessageToSupabase = async (
    role: "user" | "assistant",
    content: string
  ) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase.from("chat_messages").insert({
        user_id: user.id,
        role,
        content,
      });

      if (error) {
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role,
          message: content,
        });
      }
    } catch {
      // Ignorar si no hay sesión iniciada
    }
  };

  const handleSendQuestion = async (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isLoading) return;

    const nowTime = new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    msgSeqRef.current += 1;
    const userMsg: UiChatMessage = {
      id: `user-${msgSeqRef.current}`,
      role: "user",
      content: trimmed,
      timeLabel: nowTime,
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputText("");
    setIsLoading(true);

    void persistMessageToSupabase("user", trimmed);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          history: updatedHistory.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        reply?: string;
      };

      const replyContent = sanitizeChatContent(
        data.reply ??
          "No pude procesar tu consulta en este momento. Intenta preguntarme nuevamente sobre un partido o jugador."
      );

      msgSeqRef.current += 1;
      const botMsg: UiChatMessage = {
        id: `bot-${msgSeqRef.current}`,
        role: "assistant",
        content: replyContent,
        timeLabel: new Intl.DateTimeFormat("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      };

      setMessages((prev) => {
        const next = [...prev, botMsg];
        try {
          localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignorar
        }
        return next;
      });

      void persistMessageToSupabase("assistant", replyContent);
    } catch {
      msgSeqRef.current += 1;
      const fallbackMsg: UiChatMessage = {
        id: `bot-err-${msgSeqRef.current}`,
        role: "assistant",
        content:
          "Hubo un inconveniente temporal de conexión. Por favor intenta enviar tu pregunta de nuevo.",
        timeLabel: nowTime,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    const resetList: UiChatMessage[] = [messages[0]];
    setMessages(resetList);
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // Ignorar
    }
  };

  return (
    <PitchlineShell
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      currentMatchdayLabel="Asistente IA • Champions 2026/27"
      searchPlaceholder="Buscar jugador lesionado o club..."
    >
      <div className="flex flex-col w-full space-y-6">
        {/* Cabecera limpia y deportiva */}
        <section className="p-5 rounded-2xl bg-surface-container border border-outline-variant/15 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-brand-mint text-brand-navy font-label-sm text-label-sm uppercase font-bold tracking-wider">
                <span className="material-symbols-outlined text-[15px]">
                  auto_awesome
                </span>
                Asistente Deportivo IA
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm font-bold">
                UEFA Champions League 2026/27
              </span>
              {authEmail && (
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">
                  {authEmail}
                </span>
              )}
            </div>
            <h1 className="font-headline-lg text-headline-md sm:text-headline-lg text-brand-white">
              Analista Conversacional de Partidos y Partes Médicos
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Pregunta al instante por resultados, goleadores, próximas jornadas y
              tiempos de recuperación de jugadores lesionados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!authUserId && (
              <Link
                href="/login"
                className="px-3.5 py-2 rounded-xl bg-secondary-container text-on-secondary-container font-label-sm text-label-sm uppercase font-bold"
              >
                Iniciar Sesión
              </Link>
            )}
            <button
              type="button"
              onClick={handleClearChat}
              className="px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                refresh
              </span>
              <span>Nueva conversación</span>
            </button>
          </div>
        </section>

        {/* Layout Principal de 2 Columnas: Chat (8 Cols) + Monitor de Lesionados y Marcadores (4 Cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* COLUMNA IZQUIERDA (8 COLS XL): CHAT LIMPIO Y NATURAL */}
          <section className="xl:col-span-8 rounded-2xl bg-surface-container-low border border-outline-variant/15 shadow-xl flex flex-col overflow-hidden">
            {/* Cabecera superior de la ventana de chat */}
            <div className="px-5 py-3.5 bg-surface-container border-b border-outline-variant/15 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-brand-mint/15 border border-brand-mint/30 text-brand-mint">
                  <span className="material-symbols-outlined text-[20px]">
                    sports_soccer
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand-mint ring-2 ring-surface-container"></span>
                </div>
                <div>
                  <span className="font-label-md text-body-md font-bold text-brand-white block leading-tight">
                    Pitchline AI
                  </span>
                  <span className="font-label-sm text-[11px] text-brand-mint">
                    En línea • Temporada 2026/27
                  </span>
                </div>
              </div>
              <span className="font-label-sm text-xs text-on-surface-variant hidden sm:inline">
                Respuestas en tiempo real
              </span>
            </div>

            {/* Historial de Mensajes */}
            <div className="p-5 space-y-4 overflow-y-auto h-[460px] sm:h-[520px]">
              {messages.map((msg) =>
                msg.role === "assistant" ? (
                  <div key={msg.id} className="flex gap-3 items-start">
                    <div className="w-9 h-9 rounded-xl bg-brand-mint/15 border border-brand-mint/40 flex items-center justify-center shrink-0 text-brand-mint mt-0.5">
                      <span className="material-symbols-outlined text-[19px]">
                        smart_toy
                      </span>
                    </div>
                    <div className="max-w-[86%] rounded-2xl rounded-tl-sm bg-surface-container px-4 py-3.5 border border-outline-variant/15 shadow-sm space-y-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-label-sm text-xs text-brand-mint font-bold">
                          Asistente Pitchline
                        </span>
                        <span className="font-label-sm text-[11px] text-on-surface-variant">
                          {msg.timeLabel}
                        </span>
                      </div>
                      <div className="font-body-md text-body-md text-on-surface whitespace-pre-line leading-relaxed">
                        {renderFormattedText(msg.content)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={msg.id}
                    className="flex gap-3 items-start justify-end"
                  >
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-secondary-container px-4 py-3 text-on-secondary-container shadow-md space-y-1">
                      <div className="font-body-md text-body-md whitespace-pre-line leading-relaxed">
                        {msg.content}
                      </div>
                      <span className="font-label-sm text-[10px] text-on-secondary-container/70 block text-right">
                        {msg.timeLabel}
                      </span>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 text-on-primary mt-0.5">
                      <span className="material-symbols-outlined text-[19px]">
                        person
                      </span>
                    </div>
                  </div>
                )
              )}

              {isLoading && (
                <div className="flex gap-3 items-start">
                  <div className="w-9 h-9 rounded-xl bg-brand-mint/15 border border-brand-mint/40 flex items-center justify-center shrink-0 text-brand-mint animate-pulse">
                    <span className="material-symbols-outlined text-[19px]">
                      smart_toy
                    </span>
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-surface-container px-4 py-3 border border-brand-mint/30 flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-brand-mint animate-ping"></span>
                    <span className="font-body-md text-xs text-on-surface">
                      Analizando partidos y partes médicos de la Champions...
                    </span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Sugerencias Rápidas de Preguntas */}
            <div className="px-5 py-3 bg-surface-container/60 border-t border-outline-variant/15 space-y-2">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant block">
                Preguntas sugeridas:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {QUICK_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={isLoading}
                    onClick={() => void handleSendQuestion(suggestion)}
                    className="px-3.5 py-1.5 rounded-full bg-surface-container-high hover:bg-brand-mint hover:text-brand-navy text-on-surface font-label-md text-xs whitespace-nowrap transition-all cursor-pointer border border-outline-variant/20 shrink-0"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Formulario de Envío */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendQuestion(inputText);
              }}
              className="p-4 bg-surface-container border-t border-outline-variant/20"
            >
              <div className="flex items-center gap-2 bg-surface-container-low rounded-xl p-1.5 border border-outline-variant/25 focus-within:border-brand-mint transition-colors">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isLoading}
                  placeholder="Escribe tu pregunta sobre un partido, goleador o jugador lesionado..."
                  aria-label="Escribe tu pregunta para el asistente deportivo"
                  className="w-full bg-transparent px-3.5 py-2 text-brand-white placeholder:text-on-surface-variant focus:outline-none font-body-md text-body-md"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="px-4 py-2 rounded-lg bg-brand-mint hover:brightness-110 text-brand-navy font-label-md text-label-md font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <span>Enviar</span>
                  <span className="material-symbols-outlined text-[18px]">
                    send
                  </span>
                </button>
              </div>
            </form>
          </section>

          {/* COLUMNA DERECHA (4 COLS XL): MONITOR DE LESIONADOS RECIENTES Y PARTIDOS RECIENTES */}
          <aside className="xl:col-span-4 flex flex-col space-y-5">
            {/* Tarjeta 1: Partes Médicos y Bajas Más Recientes */}
            <div className="rounded-2xl bg-surface-container-low border border-outline-variant/15 p-4 shadow-xl space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[20px]">
                    medical_services
                  </span>
                  <h2 className="font-headline-md text-body-md font-bold text-brand-white">
                    Partes Médicos y Bajas
                  </h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-error/15 text-error font-label-sm text-[10px] uppercase font-bold">
                  Más recientes
                </span>
              </div>

              <p className="font-body-md text-xs text-on-surface-variant">
                Últimas bajas reportadas tras la jornada más reciente:
              </p>

              <div className="space-y-2.5">
                {filteredInjuries.map((inj) => {
                  const isOut = inj.status === "OUT";
                  return (
                    <button
                      key={inj.id}
                      type="button"
                      onClick={() =>
                        void handleSendQuestion(
                          `¿Qué lesión tiene ${inj.player_name} (${inj.team_name}) y cuánto tiempo estimado estará fuera?`
                        )
                      }
                      className="w-full text-left p-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/15 transition-all cursor-pointer space-y-1.5 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {inj.team_crest_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={inj.team_crest_url}
                              alt={inj.team_name}
                              className="w-5 h-5 object-contain shrink-0"
                            />
                          )}
                          <span className="font-label-md text-body-md font-bold text-brand-white group-hover:text-brand-mint transition-colors truncate">
                            {inj.player_name}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full font-label-sm text-[10px] uppercase font-bold shrink-0 ${
                            isOut
                              ? "bg-error/20 text-error"
                              : "bg-primary/20 text-primary"
                          }`}
                        >
                          {isOut ? "Baja" : "En Duda"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-primary font-semibold truncate">
                          {inj.team_name}
                        </span>
                        <span className="text-brand-mint font-bold font-tabular-stats text-right">
                          ⏱ {inj.estimated_return}
                        </span>
                      </div>

                      <p className="font-body-md text-xs text-on-surface-variant line-clamp-2">
                        {inj.injury_type}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tarjeta 2: Partidos Más Recientes */}
            <div className="rounded-2xl bg-surface-container-low border border-outline-variant/15 p-4 shadow-xl space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-brand-mint text-[20px]">
                    sports_soccer
                  </span>
                  <h3 className="font-headline-md text-body-md font-bold text-brand-white">
                    Partidos Recientes
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-brand-mint/15 text-brand-mint font-label-sm text-[10px] uppercase font-bold">
                  Última jornada
                </span>
              </div>

              <p className="font-body-md text-xs text-on-surface-variant">
                Marcadores e incidencias de los encuentros más recientes:
              </p>

              <div className="space-y-2.5">
                {recentMatches.map((m) => {
                  const goalEvents = (m.events ?? []).filter(
                    (e) => e.event_type === "GOAL"
                  );
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        void handleSendQuestion(
                          `¿Qué pasó en el partido ${m.home_team_name} vs ${m.away_team_name} y quiénes metieron los goles?`
                        )
                      }
                      className="w-full p-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-left transition-all cursor-pointer border border-outline-variant/15 space-y-1.5 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {m.home_team_crest && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.home_team_crest}
                              alt={m.home_team_name}
                              className="w-4 h-4 object-contain shrink-0"
                            />
                          )}
                          <span className="font-label-md text-xs text-brand-white font-bold group-hover:text-brand-mint transition-colors truncate">
                            {m.home_team_name} vs {m.away_team_name}
                          </span>
                          {m.away_team_crest && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.away_team_crest}
                              alt={m.away_team_name}
                              className="w-4 h-4 object-contain shrink-0"
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded bg-brand-mint/15 text-brand-mint font-tabular-stats text-xs font-bold">
                            {m.home_score} - {m.away_score}
                          </span>
                        </div>
                      </div>

                      {goalEvents.length > 0 ? (
                        <p className="font-body-md text-[11px] text-on-surface-variant line-clamp-2">
                          ⚽{" "}
                          {goalEvents
                            .map((g) => `${g.player_name} (${g.minute}')`)
                            .join(", ")}
                        </p>
                      ) : (
                        <p className="font-body-md text-[11px] text-on-surface-variant truncate">
                          Finalizado • Jornada {m.matchday ?? 3}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PitchlineShell>
  );
}
