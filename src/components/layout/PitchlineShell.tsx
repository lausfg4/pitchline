"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CircleDot, ChartNoAxesColumnIncreasing, GitBranch, Newspaper, Sparkles, Search, X, UserRound, LogIn } from "lucide-react";
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
    displayName: string;
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

          displayName: row.full_name || row.username || fallbackName,

          avatarUrl: row.avatar_url || fallbackAvatar,
        });
      } else {
        setAuthUser({

          displayName: fallbackName,

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
  const navigation = [
    { href: "/partidos", label: "Partidos", icon: CircleDot },
    { href: "/clasificacion", label: "Clasificación", mobileLabel: "Tabla", icon: ChartNoAxesColumnIncreasing },
    { href: "/simulador", label: "Simulador", icon: GitBranch },
    { href: "/noticias", label: "Noticias", icon: Newspaper },
    { href: "/chatbot", label: "Asistente IA", mobileLabel: "Asistente", icon: Sparkles },
  ];
  const current = navigation.find(({ href }) => pathname === href || pathname.startsWith(href + "/")) ?? (pathname === "/" ? navigation[0] : undefined);
  const showSearch = !current || current.href === "/clasificacion" || current.href === "/noticias";
  const accountHref = authUser ? "/perfil" : "/login";
  const accountLabel = authUser?.displayName ?? "Iniciar sesión";
  const accountIcon = authUser?.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={authUser.avatarUrl} alt="" className="size-7 rounded-full object-cover" />
  ) : authUser ? <UserRound size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />;

  return (
    <div className="min-h-screen bg-brand-navy text-on-surface">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-56 flex-col overflow-y-auto border-r border-white/8 bg-surface-container-low px-4 py-6">
        <Link href="/partidos" className="mb-9 flex items-center gap-2.5 px-2 text-brand-white">
          <PitchlineLogo className="size-9 shrink-0" />
          <span className="font-headline-md text-xl font-bold tracking-tight">pitchline</span>
        </Link>
        <nav aria-label="Navegación principal" className="space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={current?.href === href ? "page" : undefined} className="pitchline-nav-link flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm">
              <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <Link href={accountHref} className="mt-auto flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm text-on-surface-variant hover:bg-white/5 hover:text-brand-white">
          <span className="shrink-0">{accountIcon}</span>
          <span className="truncate">{accountLabel}</span>
        </Link>
      </aside>

      <div className="min-h-screen lg:pl-56">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-white/8 bg-brand-navy/95 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:left-56">
          <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
            <Link href="/partidos" aria-label="Inicio Pitchline" className="flex shrink-0 items-center gap-2 lg:hidden">
              <PitchlineLogo className="size-8" />
              <span className={`font-headline-md text-lg font-bold tracking-tight text-brand-white ${showSearch ? "hidden min-[420px]:inline" : ""}`}>pitchline</span>
            </Link>
            <div className="hidden min-w-0 items-center gap-3 text-sm lg:flex">
              <span className="shrink-0 font-medium text-brand-white">{current?.label ?? "Mi cuenta"}</span>
              {(current?.href === "/partidos" || current?.href === "/clasificacion") && (
                <span className="truncate border-l border-white/10 pl-3 text-on-surface-variant">{currentMatchdayLabel}</span>
              )}
            </div>
            {showSearch && (
              <div className="ml-auto flex min-w-0 max-w-72 flex-1 items-center gap-2 rounded-lg border border-white/8 bg-surface-container-low px-3 focus-within:border-brand-mint/50">
                <Search size={16} aria-hidden="true" className="shrink-0 text-on-surface-variant" />
                <input type="text" value={searchQuery} onChange={event => onSearchChange(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="h-10 min-w-0 w-full bg-transparent text-base outline-none sm:text-sm" />
                {searchQuery && (
                  <button type="button" onClick={() => onSearchChange("")} aria-label="Limpiar búsqueda" className="grid size-8 shrink-0 place-items-center text-on-surface-variant hover:text-brand-white">
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            <Link href={accountHref} aria-label={authUser ? "Mi perfil" : accountLabel} className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/8 text-on-surface-variant hover:bg-white/5 hover:text-brand-white lg:hidden">
              {accountIcon}
            </Link>
          </div>
        </header>
        <main id="contenido" className="pitchline-content mx-auto min-w-0 max-w-[1360px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(5.5rem+env(safe-area-inset-top))] sm:px-6 lg:px-10 lg:pb-12 lg:pt-24">
          {children}
        </main>
      </div>

      <nav aria-label="Navegación principal móvil" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-white/8 bg-surface-container-low/95 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        {navigation.map(({ href, label, mobileLabel, icon: Icon }) => (
          <Link key={href} href={href} aria-label={label} aria-current={current?.href === href ? "page" : undefined} className="pitchline-nav-link flex min-h-13 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[10px] sm:text-xs">
            <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
            <span className="max-w-full truncate">{mobileLabel ?? label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
