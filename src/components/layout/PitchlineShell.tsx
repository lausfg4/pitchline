"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRow } from "@/types/database";

interface PitchlineShellProps {
  children: React.ReactNode;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  currentMatchdayLabel?: string;
  searchPlaceholder?: string;
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
  currentMatchdayLabel = "Fase de Liga UCL",
  searchPlaceholder = "Buscar club, llaves o estadísticas...",
}: PitchlineShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authUser, setAuthUser] = useState<{
    id: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
  } | null>(null);

  const loadSessionProfile = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAuthUser(null);
        return;
      }

      const fallbackName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email?.split("@")[0] ??
        "Analista Pitchline";
      const fallbackUsername =
        (user.user_metadata?.username as string | undefined) ??
        user.email?.split("@")[0] ??
        null;
      const fallbackAvatar =
        (user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        null;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData) {
        const row = profileData as ProfileRow;
        setAuthUser({
          id: user.id,
          displayName: row.full_name || row.username || fallbackName,
          username: row.username ?? fallbackUsername,
          avatarUrl: row.avatar_url || fallbackAvatar,
        });
      } else {
        setAuthUser({
          id: user.id,
          displayName: fallbackName,
          username: fallbackUsername,
          avatarUrl: fallbackAvatar,
        });
      }
    } catch {
      // Ignorar errores de red temporales
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      if (isMounted) {
        await loadSessionProfile();
      }
    };
    void fetchProfile();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadSessionProfile();
    });

    const handleProfileUpdated = () => {
      void loadSessionProfile();
    };
    window.addEventListener("pitchline:profile-updated", handleProfileUpdated);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener(
        "pitchline:profile-updated",
        handleProfileUpdated
      );
    };
  }, [loadSessionProfile]);
  const matchdayNumMatch = currentMatchdayLabel.match(/J(\d+)/);
  const isKnockoutLabel =
    /Octavos|Cuartos|Semifinal|Gran Final|Playoffs/i.test(
      currentMatchdayLabel
    );
  const sidebarStageTitle = isKnockoutLabel ? "Eliminatorias" : "Fase Liga";
  const sidebarMatchdayBadge = matchdayNumMatch
    ? `J${matchdayNumMatch[1]} / 8`
    : /Gran Final/i.test(currentMatchdayLabel)
      ? "Final"
      : /Semifinal/i.test(currentMatchdayLabel)
        ? "Semis"
        : /Cuartos/i.test(currentMatchdayLabel)
          ? "Cuartos"
          : /Octavos/i.test(currentMatchdayLabel)
            ? "Octavos"
            : /Playoffs/i.test(currentMatchdayLabel)
              ? "Playoffs"
              : "UCL 26/27";

  // Sincronización automática en segundo plano (sin botones manuales)
  useEffect(() => {
    let active = true;
    const AUTO_SYNC_KEY = "pitchline_auto_sync_ts";
    const SYNC_INTERVAL_MS = 5 * 60 * 1000; // cada 5 minutos

    const runSilentAutoSync = async (force = false) => {
      try {
        if (!force) {
          const lastSync = Number(sessionStorage.getItem(AUTO_SYNC_KEY) ?? "0");
          if (Date.now() - lastSync < SYNC_INTERVAL_MS) {
            return;
          }
        }
        sessionStorage.setItem(AUTO_SYNC_KEY, String(Date.now()));

        await Promise.allSettled([
          fetch("/api/sync/champions", {
            method: "POST",
            headers: { "x-pitchline-sync": "true" },
          }),
          fetch("/api/sync/news", {
            method: "POST",
            headers: { "x-pitchline-sync": "true" },
          }),
        ]);

        if (active) {
          window.dispatchEvent(new CustomEvent("pitchline:synced"));
          router.refresh();
        }
      } catch {
        // Ignorar errores de red en segundo plano
      }
    };

    void runSilentAutoSync(false);
    const intervalId = window.setInterval(() => {
      void runSilentAutoSync(true);
    }, SYNC_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [router]);

  const isPartidosActive =
    pathname === "/" || pathname.startsWith("/partidos");
  const isClasificacionActive = pathname.startsWith("/clasificacion");
  const isSimuladorActive = pathname.startsWith("/simulador");
  const isNoticiasActive = pathname.startsWith("/noticias");
  const isChatbotActive = pathname.startsWith("/chatbot");

  const activeNavClass =
    "flex items-center gap-3.5 px-3 py-2.5 transition-colors bg-secondary-container text-on-secondary-container font-semibold rounded-lg shadow-[0_0_16px_rgba(0,163,255,0.2)]";
  const inactiveNavClass =
    "flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors font-body-md text-body-md";

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
                {sidebarStageTitle}
              </span>
            </div>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold">
              {sidebarMatchdayBadge}
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 px-1">
          <Link
            aria-current={isPartidosActive ? "page" : undefined}
            href="/partidos"
            className={isPartidosActive ? activeNavClass : inactiveNavClass}
          >
            <span className="material-symbols-outlined text-[20px]">
              sports_soccer
            </span>
            <span>Marcadores en Vivo</span>
          </Link>
          <Link
            aria-current={isClasificacionActive ? "page" : undefined}
            href="/clasificacion"
            className={isClasificacionActive ? activeNavClass : inactiveNavClass}
          >
            <span className="material-symbols-outlined text-[20px]">
              leaderboard
            </span>
            <span>Tabla y Clasificación</span>
          </Link>
          <Link
            aria-current={isSimuladorActive ? "page" : undefined}
            href="/simulador"
            className={isSimuladorActive ? activeNavClass : inactiveNavClass}
          >
            <span className="material-symbols-outlined text-[20px]">
              account_tree
            </span>
            <span>Arma tu Champions</span>
          </Link>
          <Link
            aria-current={isNoticiasActive ? "page" : undefined}
            href="/noticias"
            className={isNoticiasActive ? activeNavClass : inactiveNavClass}
          >
            <span className="material-symbols-outlined text-[20px]">
              newspaper
            </span>
            <span>Noticias Exclusivas</span>
          </Link>
          <Link
            aria-current={isChatbotActive ? "page" : undefined}
            href="/chatbot"
            className={isChatbotActive ? activeNavClass : inactiveNavClass}
          >
            <span className="material-symbols-outlined text-brand-mint text-[20px]">
              neurology
            </span>
            <span className="text-brand-mint font-medium">Asistente IA</span>
          </Link>
        </nav>

        <div className="mt-auto pt-4 px-2">
          {authUser ? (
            <Link
              href="/perfil"
              className="p-3 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-between group border border-outline-variant/15"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#0A1124] border border-[#19D392]/60 flex items-center justify-center shrink-0 overflow-hidden">
                  {authUser.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={authUser.avatarUrl}
                      alt={authUser.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[#19D392] text-[18px]">
                      person
                    </span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-md text-label-md text-brand-white font-semibold truncate group-hover:text-[#19D392] transition-colors">
                    {authUser.displayName}
                  </span>
                  <span className="font-label-sm text-label-sm text-brand-mint truncate">
                    {authUser.username ? `@${authUser.username}` : "Ver perfil"}
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface text-[20px]">
                settings
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-xl bg-[#19D392] hover:bg-[#19D392]/90 text-[#0A1124] font-label-md text-label-md font-bold shadow-[0_0_16px_rgba(25,211,146,0.25)] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">
                login
              </span>
              <span>Iniciar Sesión</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="fixed top-0 left-0 lg:left-64 right-0 z-40 bg-brand-navy/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.2)] border-b border-outline-variant/10 pt-[env(safe-area-inset-top)]">
          <div className="h-16 w-full px-3 sm:px-4 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
            {/* Mobile Logo */}
            <Link
              href="/partidos"
              aria-label="Inicio Pitchline"
              className="flex items-center gap-2 sm:gap-3 lg:hidden shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center p-1 shadow-sm shrink-0">
                <PitchlineLogo />
              </div>
              <div
                className={`items-center gap-2 ${
                  !isPartidosActive && !isSimuladorActive && !isChatbotActive
                    ? "hidden min-[400px]:flex"
                    : "flex"
                }`}
              >
                <span className="font-headline-md text-headline-md tracking-tight text-brand-white lowercase font-bold">
                  pitchline
                </span>
                <span className="hidden sm:inline font-label-sm text-label-sm uppercase text-brand-mint font-bold px-1.5 py-0.5 rounded bg-surface-container text-[9px]">
                  UCL AI
                </span>
              </div>
            </Link>

            {/* Jornada / Fase Pill (Solo en Marcadores y Clasificación) */}
            {!isSimuladorActive && !isNoticiasActive && !isChatbotActive && (
              <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  calendar_month
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  {isKnockoutLabel ? "Fase:" : "Jornada:"}
                </span>
                <span className="font-label-md text-label-md text-primary font-bold">
                  {currentMatchdayLabel}
                </span>
              </div>
            )}

            {/* Search & Live Status */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto min-w-0">
              {!isPartidosActive && !isSimuladorActive && !isChatbotActive && (
                <div className="relative flex items-center min-w-0 flex-1 sm:flex-none rounded-full bg-surface-container hover:bg-surface-container-high transition-colors px-3 py-2 sm:py-1.5">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant mr-1.5 shrink-0">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label="Buscar equipos o estadísticas"
                    className="bg-transparent text-on-surface placeholder:text-on-surface-variant font-label-md text-base sm:text-label-md focus:outline-none w-full min-w-0 sm:w-48"
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
              )}

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-mint/10 border border-brand-mint/25 shrink-0">
                <div className="w-2 h-2 rounded-full bg-brand-mint animate-pulse"></div>
                <span className="hidden sm:inline font-label-sm text-label-sm text-brand-mint uppercase font-bold">
                  En Directo
                </span>
              </div>

              {authUser ? (
                <Link
                  href="/perfil"
                  aria-label="Perfil de usuario"
                  className="flex items-center gap-2 p-1 sm:pl-1.5 sm:pr-3 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 transition-colors shrink-0"
                >
                  <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-[#0A1124] border border-[#19D392]/60 flex items-center justify-center shrink-0 overflow-hidden">
                    {authUser.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={authUser.avatarUrl}
                        alt={authUser.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[#19D392] text-[16px]">
                        person
                      </span>
                    )}
                  </div>
                  <span className="font-label-md text-label-md text-brand-white font-semibold max-w-[120px] truncate hidden sm:inline">
                    {authUser.displayName}
                  </span>
                </Link>
              ) : (
                <Link
                  href="/login"
                  aria-label="Iniciar Sesión"
                  className="inline-flex items-center justify-center gap-1.5 h-10 w-10 sm:h-auto sm:w-auto sm:px-3.5 sm:py-1.5 rounded-full bg-[#19D392] hover:bg-[#19D392]/90 text-[#0A1124] font-label-md text-label-md font-bold shadow-[0_0_12px_rgba(25,211,146,0.25)] transition-all shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px] sm:text-[16px]">
                    login
                  </span>
                  <span className="hidden sm:inline">Iniciar Sesión</span>
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Page Main Container */}
        <main className="flex-1 pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10 w-full min-w-0 px-3 sm:px-4 lg:px-8 bg-brand-navy">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (5 Official Tabs) */}
      <nav
        aria-label="Navegación principal móvil"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.5)] border-t border-outline-variant/15 flex items-stretch justify-around pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] px-1"
      >
        <Link
          aria-current={isPartidosActive ? "page" : undefined}
          href="/partidos"
          className={`flex-1 min-w-0 min-h-[52px] flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-lg transition-colors ${
            isPartidosActive
              ? "text-brand-mint font-bold"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">
            sports_soccer
          </span>
          <span className="font-label-sm text-[10px] min-[380px]:text-label-sm max-w-full truncate">En Vivo</span>
        </Link>
        <Link
          aria-current={isClasificacionActive ? "page" : undefined}
          href="/clasificacion"
          className={`flex-1 min-w-0 min-h-[52px] flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-lg transition-colors ${
            isClasificacionActive
              ? "text-brand-mint font-bold"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">
            leaderboard
          </span>
          <span className="font-label-sm text-[10px] min-[380px]:text-label-sm max-w-full truncate">Tabla 36</span>
        </Link>
        <Link
          aria-current={isSimuladorActive ? "page" : undefined}
          href="/simulador"
          className={`flex-1 min-w-0 min-h-[52px] flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-lg transition-colors ${
            isSimuladorActive
              ? "text-brand-mint font-bold"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">
            account_tree
          </span>
          <span className="font-label-sm text-[10px] min-[380px]:text-label-sm max-w-full truncate">Simulador</span>
        </Link>
        <Link
          aria-current={isNoticiasActive ? "page" : undefined}
          href="/noticias"
          className={`flex-1 min-w-0 min-h-[52px] flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-lg transition-colors ${
            isNoticiasActive
              ? "text-brand-mint font-bold"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">
            newspaper
          </span>
          <span className="font-label-sm text-[10px] min-[380px]:text-label-sm max-w-full truncate">Noticias</span>
        </Link>
        <Link
          aria-current={isChatbotActive ? "page" : undefined}
          href="/chatbot"
          className={`flex-1 min-w-0 min-h-[52px] flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-lg transition-colors ${
            isChatbotActive
              ? "text-brand-mint font-bold"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[22px] text-brand-mint">
            neurology
          </span>
          <span className="font-label-sm text-[10px] min-[380px]:text-label-sm max-w-full truncate text-brand-mint">
            Gemini IA
          </span>
        </Link>
      </nav>
    </div>
  );
}
