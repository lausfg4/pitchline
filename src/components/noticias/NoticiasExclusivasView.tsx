"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NewsArticleRow } from "@/types/database";
import { STITCH_REFERENCE_NEWS } from "@/data/stitch-news";
import { PitchlineShell } from "@/components/layout/PitchlineShell";

interface NoticiasExclusivasViewProps {
  initialArticles: NewsArticleRow[];
}

const CATEGORIES = [
  "Todas",
  "Crónica",
  "Táctica & xG",
  "Parte Médico",
  "Previa",
  "Oficial UEFA",
];

const CLUB_FILTERS = [
  "Todos",
  "Real Madrid",
  "Liverpool FC",
  "FC Barcelona",
  "Arsenal FC",
  "Manchester City",
  "Bayern München",
  "Inter de Milán",
  "Borussia Dortmund",
  "Bayer Leverkusen",
];

function formatArticleDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "Reciente";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "Reciente";
  }
}

export function NoticiasExclusivasView({
  initialArticles,
}: NoticiasExclusivasViewProps) {
  const [dbArticles, setDbArticles] =
    useState<NewsArticleRow[]>(initialArticles);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [selectedClub, setSelectedClub] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Suscripción en tiempo real a `public.news_articles` (solo lectura en cliente)
  useEffect(() => {
    const supabase = createClient();

    const handleCustomSync = async () => {
      const { data } = await supabase
        .from("news_articles")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(40);
      if (data && data.length > 0) {
        const mapped: NewsArticleRow[] = (
          data as Record<string, unknown>[]
        ).map((raw, idx) => ({
          id: String(raw.id ?? `sync-${idx}`),
          title: String(raw.title ?? "Noticia UEFA Champions League"),
          summary: raw.summary ? String(raw.summary) : null,
          url: String(
            raw.external_url ??
              raw.url ??
              "https://www.uefa.com/uefachampionsleague/news/"
          ),
          image_url: raw.image_url ? String(raw.image_url) : null,
          source_name: String(raw.source_name ?? "UEFA.com Oficial"),
          category: raw.category ? String(raw.category) : "Oficial UEFA",
          club_tag: raw.club_tag ? String(raw.club_tag) : null,
          published_at: String(raw.published_at ?? new Date().toISOString()),
        }));
        setDbArticles(mapped);
      }
    };

    window.addEventListener("pitchline:synced", handleCustomSync);

    const channel = supabase
      .channel("pitchline-news-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "news_articles",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const raw = payload.new as Record<string, unknown>;
            const newArt: NewsArticleRow = {
              id: String(raw.id ?? `rt-${Date.now()}`),
              title: String(raw.title ?? "Noticia UEFA Champions League"),
              summary: raw.summary ? String(raw.summary) : null,
              url: String(
                raw.external_url ??
                  raw.url ??
                  "https://www.uefa.com/uefachampionsleague/news/"
              ),
              image_url: raw.image_url ? String(raw.image_url) : null,
              source_name: String(raw.source_name ?? "UEFA.com Oficial"),
              category: raw.category ? String(raw.category) : "Oficial UEFA",
              club_tag: raw.club_tag ? String(raw.club_tag) : null,
              published_at: String(
                raw.published_at ?? new Date().toISOString()
              ),
            };
            setDbArticles((prev) => {
              if (prev.some((a) => a.url === newArt.url)) return prev;
              return [newArt, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("pitchline:synced", handleCustomSync);
      supabase.removeChannel(channel);
    };
  }, []);

  const activeArticles = useMemo(() => {
    const cleanDb = dbArticles.filter(
      (a) =>
        !a.title.includes("Ter Stegen") &&
        !a.title.includes("De Bruyne") &&
        !a.title.includes("22 puntos") &&
        !(a.summary ?? "").includes("Xabi Alonso")
    );

    const merged = [...STITCH_REFERENCE_NEWS];
    for (const art of cleanDb) {
      if (!merged.some((m) => m.title === art.title || m.url === art.url)) {
        merged.push(art);
      }
    }

    return merged.sort(
      (a, b) =>
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  }, [dbArticles]);

  const filteredArticles = useMemo(() => {
    return activeArticles.filter((art) => {
      if (selectedCategory !== "Todas") {
        const cat = (art.category ?? "Oficial UEFA").toLowerCase();
        if (!cat.includes(selectedCategory.toLowerCase())) return false;
      }

      if (selectedClub !== "Todos") {
        const clubMatch =
          (art.club_tag ?? "")
            .toLowerCase()
            .includes(selectedClub.toLowerCase()) ||
          art.title.toLowerCase().includes(selectedClub.toLowerCase()) ||
          (art.summary ?? "").toLowerCase().includes(selectedClub.toLowerCase());
        if (!clubMatch) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const textMatch =
          art.title.toLowerCase().includes(q) ||
          (art.summary ?? "").toLowerCase().includes(q) ||
          (art.club_tag ?? "").toLowerCase().includes(q) ||
          art.source_name.toLowerCase().includes(q);
        if (!textMatch) return false;
      }

      return true;
    });
  }, [activeArticles, selectedCategory, selectedClub, searchQuery]);

  const heroArticle = filteredArticles[0] ?? null;
  const gridArticles = filteredArticles.slice(1);

  return (
    <PitchlineShell
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      currentMatchdayLabel="Cobertura Exclusiva UCL"
      searchPlaceholder="Buscar noticias por club, jugador o lesión..."
    >
      <div className="flex flex-col w-full space-y-6">
        {/* Cabecera Editorial (Sincronización Automática en Tiempo Real) */}
        <section className="p-5 rounded-xl bg-surface-container border border-outline-variant/15 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-brand-mint text-brand-navy font-label-sm text-label-sm uppercase font-bold tracking-wider">
                <span className="material-symbols-outlined text-[15px]">
                  newspaper
                </span>
                Noticias Exclusivas UCL
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm">
                UEFA Champions League 2026/27
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-md sm:text-headline-lg text-brand-white">
              Actualidad Verificada de la UEFA Champions League
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Crónicas de la última jornada, análisis táctico xG y partes médicos actualizados automáticamente en tiempo real.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-container-low border border-brand-mint/25 shrink-0 self-start lg:self-auto">
            <span className="w-2 h-2 rounded-full bg-brand-mint animate-pulse"></span>
            <span className="font-label-sm text-xs text-brand-mint font-bold uppercase tracking-wider">
              Actualizado en directo
            </span>
          </div>
        </section>

        {/* Barra Doble de Filtros: Categoría y Club */}
        <section className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/15 space-y-3">
          {/* Filtro por Categoría */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant shrink-0 mr-1">
              Categoría:
            </span>
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? "bg-brand-mint text-brand-navy font-bold shadow-sm"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Filtro por Club */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-outline-variant/15">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant shrink-0 mr-1">
              Club:
            </span>
            {CLUB_FILTERS.map((club) => {
              const active = selectedClub === club;
              return (
                <button
                  key={club}
                  type="button"
                  onClick={() => setSelectedClub(club)}
                  className={`px-3 py-1 rounded-lg font-label-sm text-label-sm whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? "bg-secondary-container text-on-secondary-container font-bold"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  {club}
                </button>
              );
            })}
          </div>
        </section>

        {/* Noticia Principal Destacada (Hero Card) */}
        {heroArticle ? (
          <article className="relative overflow-hidden rounded-2xl bg-surface-container-low border border-outline-variant/20 shadow-xl grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-7 relative min-h-[260px] sm:min-h-[340px] bg-surface-container-highest overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  heroArticle.image_url ??
                  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80"
                }
                alt={heroArticle.title}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/30 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-surface-container-low"></div>
              <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-brand-mint text-brand-navy font-label-sm text-label-sm uppercase font-bold shadow-md">
                  {heroArticle.category ?? "Destacado UCL"}
                </span>
                {heroArticle.club_tag && (
                  <span className="px-3 py-1 rounded-full bg-brand-navy/85 backdrop-blur-md text-brand-white border border-outline-variant/30 font-label-sm text-label-sm uppercase font-bold">
                    {heroArticle.club_tag}
                  </span>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 p-6 lg:p-8 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-on-surface-variant font-label-sm">
                  <span className="flex items-center gap-1.5 text-primary font-bold">
                    <span className="material-symbols-outlined text-[16px]">
                      verified
                    </span>
                    {heroArticle.source_name}
                  </span>
                  <span>{formatArticleDate(heroArticle.published_at)}</span>
                </div>

                <h2 className="font-headline-lg text-headline-md sm:text-headline-lg text-brand-white leading-snug">
                  {heroArticle.title}
                </h2>

                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  {heroArticle.summary ??
                    "Cobertura oficial verificada de la UEFA Champions League."}
                </p>
              </div>

              <div className="pt-4 border-t border-outline-variant/15 flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-brand-mint uppercase">
                  Cobertura Verificada
                </span>
                <a
                  href={heroArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg bg-brand-mint text-brand-navy font-label-md text-label-md font-bold hover:brightness-110 transition-all flex items-center gap-1.5"
                >
                  <span>Leer Nota Oficial</span>
                  <span className="material-symbols-outlined text-[16px]">
                    open_in_new
                  </span>
                </a>
              </div>
            </div>
          </article>
        ) : (
          <div className="p-10 rounded-xl bg-surface-container-low border border-outline-variant/15 text-center space-y-3">
            <span className="material-symbols-outlined text-brand-mint text-[36px]">
              newspaper
            </span>
            <h2 className="font-headline-md text-headline-md text-brand-white">
              No se encontraron noticias para este filtro
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Prueba seleccionando &ldquo;Todas&rdquo; las categorías o{" "}
              &ldquo;Todos&rdquo; los clubes.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("Todas");
                setSelectedClub("Todos");
                setSearchQuery("");
              }}
              className="px-4 py-2 rounded-lg bg-brand-mint text-brand-navy font-label-md text-label-md font-bold cursor-pointer"
            >
              Restablecer Filtros
            </button>
          </div>
        )}

        {/* Grid de Artículos de la UEFA Champions League */}
        {gridArticles.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-brand-white">
                Últimas Notas del Torneo ({gridArticles.length})
              </h3>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Cobertura Oficial UEFA
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {gridArticles.map((art) => (
                <article
                  key={art.id}
                  className="rounded-xl bg-surface-container-low hover:bg-surface-container transition-all border border-outline-variant/15 shadow-md overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    <div className="relative h-48 w-full bg-surface-container-highest overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          art.image_url ??
                          "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80"
                        }
                        alt={art.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-brand-navy/90 backdrop-blur-md text-brand-mint border border-brand-mint/30 font-label-sm text-[10px] uppercase font-bold">
                          {art.category ?? "Oficial UEFA"}
                        </span>
                        {art.club_tag && (
                          <span className="px-2.5 py-0.5 rounded-full bg-secondary-container/90 text-on-secondary-container font-label-sm text-[10px] uppercase font-bold">
                            {art.club_tag}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-label-sm">
                        <span className="text-primary font-semibold truncate">
                          {art.source_name}
                        </span>
                        <span className="shrink-0">
                          {formatArticleDate(art.published_at)}
                        </span>
                      </div>

                      <h4 className="font-headline-md text-body-md font-bold text-brand-white group-hover:text-brand-mint transition-colors line-clamp-2">
                        {art.title}
                      </h4>

                      <p className="font-body-md text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                        {art.summary ??
                          "Actualidad oficial de la UEFA Champions League."}
                      </p>
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-surface-container/60 border-t border-outline-variant/10 flex items-center justify-between">
                    <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">
                      UEFA Champions League
                    </span>
                    <a
                      href={art.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-label-md text-xs text-brand-mint font-bold hover:underline flex items-center gap-1"
                    >
                      <span>Leer artículo</span>
                      <span className="material-symbols-outlined text-[15px]">
                        arrow_outward
                      </span>
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </PitchlineShell>
  );
}
