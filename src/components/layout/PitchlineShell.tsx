"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CircleDot, ChartNoAxesColumnIncreasing, GitBranch, Newspaper, Sparkles, CalendarDays, Search, X, UserRound, Settings, LogIn } from "lucide-react";
import { usePathname } from "next/navigation";
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

  const isPartidosActive =
    pathname === "/" || pathname.startsWith("/partidos");
  const isClasificacionActive = pathname.startsWith("/clasificacion");
  const isSimuladorActive = pathname.startsWith("/simulador");
  const isNoticiasActive = pathname.startsWith("/noticias");
  const isChatbotActive = pathname.startsWith("/chatbot");

  const activeNavClass =
    "flex items-center gap-3.5 px-3 py-3 transition-colors bg-brand-mint/8 text-brand-mint font-medium rounded-lg";
  const inactiveNavClass =
    "flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors font-body-md text-body-md";

  return (
    <div className="pitchline-app min-h-screen bg-brand-navy text-on-surface">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 pitchline-sidebar bg-brand-navy z-50 flex-col py-8 px-5  border-r border-white/8">
        <div className="flex items-center gap-3 px-3 mb-12">
          <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center p-1.5  border border-outline-variant/30 shrink-0">
            <PitchlineLogo />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-headline-md text-headline-md tracking-tight text-brand-white lowercase font-bold leading-none">
                pitchline
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-mint"></span>
            </div>
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider font-medium text-[10px]">
              Champions League
            </span>
          </div>
        </div>

        <div className="px-3 mb-6">
          <div className="bg-surface-container rounded-lg p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} strokeWidth={1.6} aria-hidden="true" className="text-primary " />
              <span className="font-label-md text-label-md text-on-surface">
                {sidebarStageTitle}
              </span>
            </div>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant font-bold">
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
            <CircleDot size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
            <span>Partidos</span>
          </Link>
          <Link
            aria-current={isClasificacionActive ? "page" : undefined}
            href="/clasificacion"
            className={isClasificacionActive ? activeNavClass : inactiveNavClass}
          >
            <ChartNoAxesColumnIncreasing size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
            <span>Clasificación</span>
          </Link>
          <Link
            aria-current={isSimuladorActive ? "page" : undefined}
            href="/simulador"
            className={isSimuladorActive ? activeNavClass : inactiveNavClass}
          >
            <GitBranch size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
            <span>Simulador</span>
          </Link>
          <Link
            aria-current={isNoticiasActive ? "page" : undefined}
            href="/noticias"
            className={isNoticiasActive ? activeNavClass : inactiveNavClass}
          >
            <Newspaper size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
            <span>Noticias</span>
          </Link>
          <Link
            aria-current={isChatbotActive ? "page" : undefined}
            href="/chatbot"
            className={isChatbotActive ? activeNavClass : inactiveNavClass}
          >
            <Sparkles size={18} strokeWidth={1.6} aria-hidden="true" className="text-brand-mint " />
            <span className="text-brand-mint font-medium">Asistente IA</span>
          </Link>
        </nav>

        <div className="mt-auto pt-4 px-2">
          {authUser ? (
            <Link
              href="/perfil"
              className="p-3 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-between group border border-white/8"
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
                    <UserRound size={18} strokeWidth={1.6} aria-hidden="true" className="text-[#19D392] " />
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
              <Settings size={18} strokeWidth={1.6} aria-hidden="true" className="text-on-surface-variant group-hover:text-on-surface " />
            </Link>
          ) : (
            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-xl bg-[#19D392] hover:bg-[#19D392]/90 text-[#0A1124] font-label-md text-label-md font-bold  transition-all flex items-center justify-center gap-2"
            >
              <LogIn size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
              <span>Iniciar Sesión</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="fixed top-0 left-0 lg:left-64 right-0 z-40 pitchline-header bg-brand-navy/95 backdrop-blur-md  border-b border-outline-variant/10 pt-[env(safe-area-inset-top)]">
          <div className="h-16 w-full px-3 sm:px-4 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
            {/* Mobile Logo */}
            <Link
              href="/partidos"
              aria-label="Inicio Pitchline"
              className="flex items-center gap-2 sm:gap-3 lg:hidden shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center p-1  shrink-0">
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
                <CalendarDays size={18} strokeWidth={1.6} aria-hidden="true" className="text-primary " />
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
                  <Search size={18} strokeWidth={1.6} aria-hidden="true" className=" text-on-surface-variant mr-1.5 shrink-0" />
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
                      <X size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-transparent shrink-0">
                <div className="w-2 h-2 rounded-full bg-brand-mint animate-pulse"></div>
                <span className="hidden sm:inline font-label-sm text-label-sm text-brand-mint uppercase font-bold">
                  Champions
                </span>
              </div>

              {authUser ? (
                <Link
                  href="/perfil"
                  aria-label="Perfil de usuario"
                  className="flex items-center gap-2 p-1 sm:pl-1.5 sm:pr-3 rounded-full bg-surface-container hover:bg-surface-container-high border border-white/10 transition-colors shrink-0"
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
                      <UserRound size={18} strokeWidth={1.6} aria-hidden="true" className="text-[#19D392] " />
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
                  className="inline-flex items-center justify-center gap-1.5 h-10 w-10 sm:h-auto sm:w-auto sm:px-3.5 sm:py-1.5 rounded-full bg-[#19D392] hover:bg-[#19D392]/90 text-[#0A1124] font-label-md text-label-md font-bold  transition-all shrink-0"
                >
                  <LogIn size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
                  <span className="hidden sm:inline">Iniciar Sesión</span>
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Page Main Container */}
        <main id="contenido" className="pitchline-content flex-1 mx-auto max-w-[1520px] pt-[calc(6rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10 w-full min-w-0 px-3 sm:px-4 lg:px-8 bg-brand-navy">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (5 Official Tabs) */}
      <nav
        aria-label="Navegación principal móvil"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pitchline-mobile-nav bg-brand-navy/95 backdrop-blur-md  border-t border-white/8 flex items-stretch justify-around pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] px-1"
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
          <CircleDot size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
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
          <ChartNoAxesColumnIncreasing size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
          <span className="font-label-sm text-[10px] min-[380px]:text-label-sm max-w-full truncate">Tabla</span>
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
          <GitBranch size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
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
          <Newspaper size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
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
          <Sparkles size={18} strokeWidth={1.6} aria-hidden="true" className=" text-brand-mint" />
          <span className="font-label-sm text-[10px] min-[380px]:text-label-sm max-w-full truncate text-brand-mint">
            Asistente IA
          </span>
        </Link>
      </nav>
    </div>
  );
}
