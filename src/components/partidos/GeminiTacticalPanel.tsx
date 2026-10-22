"use client";

import React, { useState } from "react";
import type { MatchWithDetails } from "@/types/database";

interface ChatMessageItem {
  id: string;
  role: "assistant" | "user";
  text: string;
  timeLabel: string;
}

interface GeminiTacticalPanelProps {
  matches: MatchWithDetails[];
}

export function GeminiTacticalPanel({ matches }: GeminiTacticalPanelProps) {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: "msg-1",
      role: "assistant",
      text: "Hola Analista. Monitorizo 18 encuentros de UCL en tiempo real y el motor de Poisson. ¿Qué deseas consultar?",
      timeLabel: "Hace 1 min",
    },
    {
      id: "msg-2",
      role: "user",
      text: "¿Quién va ganando hoy y quiénes metieron los goles?",
      timeLabel: "Hace 30s",
    },
    {
      id: "msg-3",
      role: "assistant",
      text: "En el Santiago Bernabéu empatan 2-2 Real Madrid (Vinícius 24', Bellingham 55') y Man City (Haaland 38', De Bruyne 62'). En Londres, Arsenal 1-0 Inter (Saka 19'). Bayern derrotó 1-0 a PSG.",
      timeLabel: "Ahora mismo",
    },
  ]);

  const handleAskQuestion = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const userMsg: ChatMessageItem = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
      timeLabel: "Ahora mismo",
    };

    let reply =
      "Consultando tablas matches, match_events y player_injuries en Supabase...";
    const lower = trimmed.toLowerCase();

    if (lower.includes("mbappé") || lower.includes("baja") || lower.includes("lesion")) {
      reply =
        "Según el reporte médico en player_injuries, Kylian Mbappé presenta sobrecarga muscular en el bíceps femoral. Tiempo estimado de baja: 7 a 10 días (duda para la próxima jornada).";
    } else if (lower.includes("probabilidad") || lower.includes("liderar")) {
      reply =
        "Según las 100,000 simulaciones Monte Carlo (30% Rendimiento, 30% xG, 25% UEFA Elo, 15% H2H), Liverpool FC (58% victoria hoy) y Arsenal FC (64% en vivo) lideran la proyección al Top 8 directo.";
    } else {
      const liveMatches = matches.filter(
        (m) => m.status === "IN_PLAY" || m.status === "HT"
      );
      if (liveMatches.length > 0) {
        const summary = liveMatches
          .map(
            (m) =>
              `${m.home_team_name} ${m.home_score}-${m.away_score} ${m.away_team_name} (${m.elapsed_minute ?? 45}')`
          )
          .join(" • ");
        reply = `Marcadores en tiempo real vía Supabase Realtime: ${summary}.`;
      } else {
        reply =
          "Actualmente no hay partidos en juego en la semana actual. Puedes revisar las probabilidades pre-partido del modelo Poisson en cada tarjeta.";
      }
    }

    const botMsg: ChatMessageItem = {
      id: `b-${Date.now() + 1}`,
      role: "assistant",
      text: reply,
      timeLabel: "Ahora mismo",
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInputText("");
  };

  return (
    <div className="xl:col-span-4 flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-mint text-[22px]">
            neurology
          </span>
          <h2 className="font-headline-md text-headline-md text-brand-white">
            Asistente Táctico Gemini
          </h2>
        </div>
        <span className="w-2 h-2 rounded-full bg-brand-mint animate-pulse"></span>
      </div>

      {/* Card Central Asistente RAG */}
      <div className="rounded-xl bg-surface-container-low p-4 flex-1 flex flex-col justify-between space-y-4 shadow-xl border border-outline-variant/15">
        {/* Header Info del Modelo */}
        <div className="flex items-center justify-between pb-3 bg-surface-container rounded-lg p-2.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">
              verified
            </span>
            <span className="font-label-sm text-label-sm text-on-surface font-semibold">
              Gemini 2.5 Flash • RAG
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-brand-mint font-bold">
            API-Football Online
          </span>
        </div>

        {/* Chat Stream Preview */}
        <div className="space-y-3 overflow-y-auto max-h-80 pr-1">
          {messages.map((msg) =>
            msg.role === "assistant" ? (
              <div key={msg.id} className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full bg-tertiary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[15px] text-on-tertiary-container">
                    smart_toy
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-container text-body-md font-body-md text-on-surface space-y-1 shadow-sm">
                  <p>{msg.text}</p>
                  <span className="font-label-sm text-label-sm text-on-surface-variant block">
                    {msg.timeLabel}
                  </span>
                </div>
              </div>
            ) : (
              <div
                key={msg.id}
                className="flex gap-2.5 items-start justify-end"
              >
                <div className="p-3 rounded-xl bg-secondary-container text-body-md font-body-md text-on-secondary-container space-y-1 shadow-sm max-w-[85%]">
                  <p>{msg.text}</p>
                  <span className="font-label-sm text-label-sm text-on-secondary-container/70 block text-right">
                    {msg.timeLabel}
                  </span>
                </div>
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[15px] text-on-primary">
                    person
                  </span>
                </div>
              </div>
            )
          )}
        </div>

        {/* Preguntas Rápidas Sugeridas */}
        <div className="space-y-1.5 pt-2">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">
            Consultas Rápidas Sugeridas
          </span>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() =>
                handleAskQuestion(
                  "¿Cuánto tiempo estará de baja Mbappé por su sobrecarga?"
                )
              }
              className="w-full text-left p-2 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface font-label-md text-label-md flex items-center justify-between group cursor-pointer"
            >
              <span className="truncate">
                ¿Cuánto tiempo estará de baja Mbappé por su sobrecarga?
              </span>
              <span className="material-symbols-outlined text-[16px] text-primary group-hover:translate-x-0.5 transition-transform shrink-0">
                arrow_outward
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                handleAskQuestion(
                  "¿Qué equipo tiene mayor probabilidad de liderar la Fase Liga?"
                )
              }
              className="w-full text-left p-2 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface font-label-md text-label-md flex items-center justify-between group cursor-pointer"
            >
              <span className="truncate">
                ¿Qué equipo tiene mayor probabilidad de liderar la Fase Liga?
              </span>
              <span className="material-symbols-outlined text-[16px] text-primary group-hover:translate-x-0.5 transition-transform shrink-0">
                arrow_outward
              </span>
            </button>
          </div>
        </div>

        {/* Input Box Interactivo */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskQuestion(inputText);
          }}
          className="pt-2"
        >
          <div className="relative flex items-center bg-surface-container rounded-xl p-1 shadow-inner">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-transparent px-3 py-2 text-on-surface placeholder:text-on-surface-variant focus:outline-none font-body-md text-body-md"
              placeholder="Pregunta a Gemini sobre tácticas, xG, lesiones..."
              type="text"
            />
            <button
              type="submit"
              aria-label="Enviar pregunta"
              className="p-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                send
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
