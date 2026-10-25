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
      text: "¡Hola! Analizo los partidos, pronósticos y partes médicos de la UEFA Champions League 2026/27. ¿Qué deseas consultar?",
      timeLabel: "Hace 1 min",
    },
    {
      id: "msg-2",
      role: "user",
      text: "¿Cómo quedaron los partidazos de la Jornada 3 y quiénes anotaron?",
      timeLabel: "Hace 30s",
    },
    {
      id: "msg-3",
      role: "assistant",
      text: "En París, PSG venció 4-2 al Barça (Dembélé 12', Barcola 44', João Neves 76', Ramos 89'; Lewandowski 27', Raphinha 61'). En el Bernabéu, Real Madrid superó 4-1 a RB Leipzig, mientras que Bayern y Arsenal empataron 2-2.",
      timeLabel: "Ahora mismo",
    },
  ]);

  const handleAskQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const userMsg: ChatMessageItem = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
      timeLabel: "Ahora mismo",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const json = (await res.json()) as { reply?: string };
      const botMsg: ChatMessageItem = {
        id: `b-${Date.now() + 1}`,
        role: "assistant",
        text:
          json.reply ??
          "Marcadores y partes médicos actualizados en tiempo real.",
        timeLabel: "Ahora mismo",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const liveMatches = matches.filter(
        (m) => m.status === "IN_PLAY" || m.status === "HT"
      );
      const summary =
        liveMatches.length > 0
          ? liveMatches
              .map(
                (m) =>
                  `${m.home_team_name} ${m.home_score}-${m.away_score} ${m.away_team_name} (${m.elapsed_minute ?? 45}')`
              )
              .join(" • ")
          : "Consulta el centro completo en /chatbot.";
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now() + 1}`,
          role: "assistant",
          text: `Marcadores en tiempo real: ${summary}`,
          timeLabel: "Ahora mismo",
        },
      ]);
    }
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
        {/* Header Info del Asistente */}
        <div className="flex items-center justify-between pb-3 bg-surface-container rounded-lg p-2.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">
              verified
            </span>
            <span className="font-label-sm text-label-sm text-on-surface font-semibold">
              Asistente Pitchline
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-brand-mint font-bold">
            En línea
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
                  "¿Qué jugadores están lesionados y cuánto tiempo estarán fuera?"
                )
              }
              className="w-full text-left p-2 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface font-label-md text-label-md flex items-center justify-between group cursor-pointer"
            >
              <span className="truncate">
                ¿Qué jugadores están lesionados y cuánto tiempo estarán fuera?
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
