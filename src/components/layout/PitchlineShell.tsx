"use client";

import React from "react";
import Link from "next/link";

interface PitchlineShellProps {
  children: React.ReactNode;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  currentMatchdayLabel?: string;
}

export function PitchlineLogo({ className = "w-full h-full" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Logo de Pitchline"
    >
      <rect width="40" height="40" rx="10" fill="#0A1124" />
      <circle
        cx="20"
        cy="20"
        r="10"
        stroke="#19D392"
        strokeWidth="2.5"
        strokeDasharray="31.4 31.4"
        strokeDashoffset="31.4"
      />
      <circle
        cx="20"
        cy="20"
        r="10"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeDasharray="31.4 31.4"
        strokeDashoffset="0"
      />
      <line
        x1="20"
        y1="5"
        x2="20"
        y2="35"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="20" r="2.5" fill="#19D392" />
    </svg>
  );
}

export function PitchlineShell({
  children,
  searchQuery,
  onSearchChange,
  currentMatchdayLabel = "8 de 8 (Partidos de Vuelta)",
}: PitchlineShellProps) {
  return (
    <div className="min-h-screen bg-brand-navy text-on-surface">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-surface-container-low/90 backdrop-blur-xl z-50 flex-col py-6 px-4 shadow-[0_1px_8px_rgba(0,0,0,0.2)] border-r border-outline-variant/15">
        <div className="flex items-center gap-3 px-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center p-1.5 shadow-sm border border-outline-variant/30 shrink-0">
            <PitchlineLogo />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-headline-md text-headline-md tracking-tight text-brand-white lowercase font-bold leading-none">
                pitchline
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-mint"></span>
            </div>
            <span className="font-label-sm text-label-sm uppercase text-brand-mint tracking-wider font-semibold text-[10px]">
              UCL Predict &amp; AI
            </span>
          </div>
        </div>

        <div className="px-3 mb-6">
          <div className="bg-surface-container rounded-lg p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">
                event_available
              </span>
              <span className="font-label-md text-label-md text-on-surface">
                Fase Liga
              </span>
            </div>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold">
              J8 / 8
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 px-1">
          <Link
            aria-current="page"
            href="/partidos"
            className="flex items-center gap-3.5 px-3 py-2.5 transition-colors bg-secondary-container text-on-secondary-container font-semibold rounded-lg shadow-[0_0_16px_rgba(0,163,255,0.2)]"
          >
            <span className="material-symbols-outlined text-[20px]">
              sports_soccer
            </span>
            <span>Marcadores en Vivo</span>
          </Link>
          <Link
            href="/clasificacion"
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors font-body-md text-body-md"
          >
            <span className="material-symbols-outlined text-[20px]">
              leaderboard
            </span>
            <span>Tabla y Clasificación</span>
          </Link>
          <Link
            href="/simulador"
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors font-body-md text-body-md"
          >
            <span className="material-symbols-outlined text-[20px]">
              account_tree
            </span>
            <span>Arma tu Champions</span>
          </Link>
          <Link
            href="/noticias"
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors font-body-md text-body-md"
          >
            <span className="material-symbols-outlined text-[20px]">
              newspaper
            </span>
            <span>Noticias Exclusivas</span>
          </Link>
          <Link
            href="/chatbot"
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors font-body-md text-body-md"
          >
            <span className="material-symbols-outlined text-brand-mint text-[20px]">
              neurology
            </span>
            <span className="text-brand-mint font-medium">Asistente IA</span>
          </Link>
        </nav>

        <div className="mt-auto pt-4 px-2">
          <div className="p-3 rounded-xl bg-surface-container flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-primary text-[18px]">
                  person
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-md text-label-md text-on-surface truncate">
                  Analista Pitchline
                </span>
                <span className="font-label-sm text-label-sm text-brand-mint truncate">
                  Supabase Auth
                </span>
              </div>
            </div>
            <Link
              href="/perfil"
              aria-label="Opciones de sesión"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                settings
              </span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="fixed top-0 left-0 lg:left-64 right-0 z-40 bg-brand-navy/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.2)] border-b border-outline-variant/10">
          <div className="h-16 w-full px-4 lg:px-8 flex items-center justify-between gap-4">
            {/* Mobile Logo */}
            <div className="flex items-center gap-3 lg:hidden">
              <div className="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center p-1 shadow-sm shrink-0">
                <PitchlineLogo />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-headline-md text-headline-md tracking-tight text-brand-white lowercase font-bold">
                  pitchline
                </span>
                <span className="font-label-sm text-label-sm uppercase text-brand-mint font-bold px-1.5 py-0.5 rounded bg-surface-container text-[9px]">
                  UCL AI
                </span>
              </div>
            </div>

            {/* Jornada Pill */}
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-primary text-[18px]">
                calendar_month
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant">
                Jornada:
              </span>
              <span className="font-label-md text-label-md text-primary font-bold">
                {currentMatchdayLabel}
              </span>
            </div>

            {/* Search & Live Status */}
            <div className="flex items-center gap-3 ml-auto">
              <div className="relative flex items-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors px-3 py-1.5">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant mr-1.5">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Buscar club, xG, estadio..."
                  aria-label="Buscar equipos o estadísticas"
                  className="bg-transparent text-on-surface placeholder:text-on-surface-variant font-label-md text-label-md focus:outline-none w-28 sm:w-48"
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange("")}
                    aria-label="Limpiar búsqueda"
                    className="text-on-surface-variant hover:text-on-surface ml-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      close
                    </span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-mint/10 border border-brand-mint/25">
                <div className="w-2 h-2 rounded-full bg-brand-mint animate-pulse"></div>
                <span className="hidden sm:inline font-label-sm text-label-sm text-brand-mint uppercase font-bold">
                  En Directo
                </span>
              </div>

              <Link
                href="/perfil"
                aria-label="Perfil de usuario"
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0"
              >
                <span className="material-symbols-outlined text-on-primary text-[18px]">
                  person
                </span>
              </Link>
            </div>
          </div>
        </header>

        {/* Page Main Container */}
        <main className="flex-1 pt-20 pb-24 lg:pb-10 w-full px-4 lg:px-8 bg-brand-navy">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (5 Official Tabs) */}
      <nav
        aria-label="Navegación principal móvil"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.5)] border-t border-outline-variant/15 flex items-center justify-around py-2 px-1"
      >
        <Link
          aria-current="page"
          href="/partidos"
          className="flex flex-col items-center gap-1 py-1 px-2 transition-colors text-brand-mint font-bold"
        >
          <span className="material-symbols-outlined text-[22px]">
            sports_soccer
          </span>
          <span className="font-label-sm text-label-sm">En Vivo</span>
        </Link>
        <Link
          href="/clasificacion"
          className="flex flex-col items-center gap-1 py-1 px-2 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[22px]">
            leaderboard
          </span>
          <span className="font-label-sm text-label-sm">Tabla 36</span>
        </Link>
        <Link
          href="/simulador"
          className="flex flex-col items-center gap-1 py-1 px-2 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[22px]">
            account_tree
          </span>
          <span className="font-label-sm text-label-sm">Simulador</span>
        </Link>
        <Link
          href="/noticias"
          className="flex flex-col items-center gap-1 py-1 px-2 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[22px]">
            newspaper
          </span>
          <span className="font-label-sm text-label-sm">Noticias</span>
        </Link>
        <Link
          href="/chatbot"
          className="flex flex-col items-center gap-1 py-1 px-2 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[22px] text-brand-mint">
            neurology
          </span>
          <span className="font-label-sm text-label-sm text-brand-mint">
            Gemini IA
          </span>
        </Link>
      </nav>
    </div>
  );
}
