"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRow } from "@/types/database";
import { STITCH_REFERENCE_STANDINGS } from "@/data/stitch-standings";
import { PitchlineShell } from "@/components/layout/PitchlineShell";

interface PredefinedAvatarOption {
  id: string;
  label: string;
  url: string;
}

function makeSvgAvatarDataUri(
  bgHex: string,
  accentHex: string,
  symbolText: string,
  subText: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <rect width="256" height="256" rx="128" fill="${bgHex}"/>
    <circle cx="128" cy="128" r="108" fill="none" stroke="${accentHex}" stroke-width="6" stroke-dasharray="28 14" opacity="0.65"/>
    <circle cx="128" cy="128" r="86" fill="${accentHex}" fill-opacity="0.14" stroke="${accentHex}" stroke-width="3"/>
    <text x="128" y="138" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="64" fill="#FFFFFF">${symbolText}</text>
    <text x="128" y="182" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="20" letter-spacing="2" fill="${accentHex}">${subText}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PREDEFINED_FOOTBALL_AVATARS: PredefinedAvatarOption[] = [
  {
    id: "capitan-10",
    label: "El 10 Creativo",
    url: makeSvgAvatarDataUri("#0A1124", "#19D392", "10", "CAPITÁN"),
  },
  {
    id: "goleador-9",
    label: "Nueve de Área",
    url: makeSvgAvatarDataUri("#0F1D3A", "#38BDF8", "9", "KILLER"),
  },
  {
    id: "extremo-7",
    label: "Extremo Eléctrico",
    url: makeSvgAvatarDataUri("#121829", "#F59E0B", "7", "WING"),
  },
  {
    id: "portero-1",
    label: "Muro Bajo Palos",
    url: makeSvgAvatarDataUri("#091E1A", "#19D392", "1", "GK PRO"),
  },
  {
    id: "pivote-5",
    label: "Maestro Táctico",
    url: makeSvgAvatarDataUri("#1A1433", "#A78BFA", "5", "MVP"),
  },
  {
    id: "dt-ucl",
    label: "Director Técnico",
    url: makeSvgAvatarDataUri("#0A1124", "#19D392", "DT", "UCL AI"),
  },
  {
    id: "central-4",
    label: "Líder Defensivo",
    url: makeSvgAvatarDataUri("#1F1224", "#F43F5E", "4", "WALL"),
  },
  {
    id: "box-to-box-8",
    label: "Todocampista 8",
    url: makeSvgAvatarDataUri("#0D2137", "#22D3EE", "8", "ENGINE"),
  },
];

const ALLOWED_MIME_TYPES = ["image/webp", "image/png", "image/jpeg"];
const MAX_WEBP_BYTES = 2 * 1024 * 1024; // 2 MB según AGENTS.md Regla 3.3

/**
 * Redimensiona y recorta centrada una imagen en cliente usando un canvas HTML5
 * a exactamente 256x256 px en formato WebP (< 2 MB).
 */
async function resizeImageToWebP256(file: File): Promise<Blob> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(
      "Formato no permitido. Usa una imagen WebP, PNG o JPEG."
    );
  }

  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("No se pudo leer el archivo de imagen."));
      image.src = bitmapUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Tu navegador no soporta procesamiento en Canvas HTML5.");
    }

    // Recorte cuadrado centrado (aspect-fill a 256x256)
    const minSide = Math.min(img.width, img.height);
    const sx = (img.width - minSide) / 2;
    const sy = (img.height - minSide) / 2;

    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, 256, 256);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", 0.88)
    );

    if (!blob) {
      throw new Error("No se pudo convertir la imagen a formato WebP.");
    }

    if (blob.size > MAX_WEBP_BYTES) {
      throw new Error("La imagen comprimida supera el límite de 2 MB.");
    }

    return blob;
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

export default function PerfilPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>(
    PREDEFINED_FOOTBALL_AVATARS[0].url
  );
  const [favoriteTeamId, setFavoriteTeamId] = useState<number | null>(null);

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadUserProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUserId(null);
        setLoadingProfile(false);
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? "");

      const fallbackName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        "";
      const fallbackUsername =
        (user.user_metadata?.username as string | undefined) ??
        user.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "") ??
        "analista_ucl";
      const fallbackAvatar =
        (user.user_metadata?.avatar_url as string | undefined) ??
        PREDEFINED_FOOTBALL_AVATARS[0].url;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData) {
        const row = profileData as ProfileRow;
        setFullName(row.full_name ?? fallbackName);
        setUsername(row.username ?? fallbackUsername);
        setAvatarUrl(row.avatar_url || fallbackAvatar);
        setFavoriteTeamId(row.favorite_team_id ?? null);
      } else {
        setFullName(fallbackName);
        setUsername(fallbackUsername);
        setAvatarUrl(fallbackAvatar);
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "No se pudo cargar la información del perfil.",
      });
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      if (isMounted) {
        await loadUserProfile();
      }
    };
    void fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [loadUserProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setStatusMessage(null);
    const cleanName = fullName.trim();
    const cleanUsername = username.trim().replace(/\s+/g, "_");

    if (!cleanName) {
      setStatusMessage({
        type: "error",
        text: "El nombre completo no puede estar vacío.",
      });
      return;
    }

    if (!cleanUsername || cleanUsername.length < 3) {
      setStatusMessage({
        type: "error",
        text: "El nombre de usuario debe tener al menos 3 caracteres.",
      });
      return;
    }

    setSavingProfile(true);
    try {
      const supabase = createClient();
      const nowIso = new Date().toISOString();

      const { error } = await supabase.from("profiles").upsert(
        {
          id: userId,
          full_name: cleanName,
          username: cleanUsername,
          avatar_url: avatarUrl,
          favorite_team_id: favoriteTeamId,
          updated_at: nowIso,
        },
        { onConflict: "id" }
      );

      if (error) {
        setStatusMessage({
          type: "error",
          text:
            error.code === "23505"
              ? "Ese nombre de usuario (@username) ya está en uso. Elige otro."
              : error.message,
        });
        return;
      }

      await supabase.auth.updateUser({
        data: {
          full_name: cleanName,
          username: cleanUsername,
          avatar_url: avatarUrl,
        },
      });

      window.dispatchEvent(new CustomEvent("pitchline:profile-updated"));
      setStatusMessage({
        type: "success",
        text: "Perfil actualizado y sincronizado correctamente.",
      });
    } catch {
      setStatusMessage({
        type: "error",
        text: "Ocurrió un error al guardar los cambios.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSelectPredefinedAvatar = async (presetUrl: string) => {
    setAvatarUrl(presetUrl);
    if (!userId) return;

    setStatusMessage(null);
    try {
      const supabase = createClient();
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from("profiles").upsert(
        {
          id: userId,
          full_name: fullName.trim() || null,
          username: username.trim() || null,
          avatar_url: presetUrl,
          favorite_team_id: favoriteTeamId,
          updated_at: nowIso,
        },
        { onConflict: "id" }
      );

      if (!error) {
        await supabase.auth.updateUser({
          data: { avatar_url: presetUrl },
        });
        window.dispatchEvent(new CustomEvent("pitchline:profile-updated"));
        setStatusMessage({
          type: "success",
          text: "Avatar predefinido aplicado a tu perfil.",
        });
      }
    } catch {
      // El usuario también puede confirmar con el botón Guardar
    }
  };

  const handleFileUploadChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setStatusMessage(null);
    setUploadingAvatar(true);

    try {
      // 1. Validar y redimensionar en cliente a WebP 256x256 px (< 2 MB) según AGENTS.md Regla 3.3
      const webpBlob = await resizeImageToWebP256(file);

      // 2. Subir a la ruta ${user.id}/avatar.webp en el bucket `avatars` de Supabase Storage
      const supabase = createClient();
      const storagePath = `${userId}/avatar.webp`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(storagePath, webpBlob, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(storagePath);

      const cacheBustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(cacheBustedUrl);

      // 3. Persistir URL en public.profiles
      const nowIso = new Date().toISOString();
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: userId,
          full_name: fullName.trim() || null,
          username: username.trim() || null,
          avatar_url: cacheBustedUrl,
          favorite_team_id: favoriteTeamId,
          updated_at: nowIso,
        },
        { onConflict: "id" }
      );

      if (profileError) {
        throw new Error(profileError.message);
      }

      await supabase.auth.updateUser({
        data: { avatar_url: cacheBustedUrl },
      });

      window.dispatchEvent(new CustomEvent("pitchline:profile-updated"));
      setStatusMessage({
        type: "success",
        text: "Foto redimensionada a WebP (256×256 px) y subida con éxito.",
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "No se pudo subir la imagen de perfil.",
      });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.dispatchEvent(new CustomEvent("pitchline:profile-updated"));
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <PitchlineShell
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      currentMatchdayLabel="Perfil de Analista"
    >
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Encabezado de Sección */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-surface-container border border-outline-variant/15 shadow-md">
          <div className="space-y-1">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-[#19D392] font-bold">
              Cuenta &amp; Personalización
            </span>
            <h1 className="font-headline-lg text-headline-lg text-brand-white font-bold">
              Perfil de Usuario Pitchline
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Personaliza tu identidad de analista, tu avatar futbolístico y gestiona tu sesión.
            </p>
          </div>

          {userId && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-error/15 hover:bg-error/25 text-error border border-error/30 font-label-md text-label-md font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">
                logout
              </span>
              <span>{signingOut ? "Cerrando sesión..." : "Cerrar Sesión"}</span>
            </button>
          )}
        </div>

        {loadingProfile ? (
          <div className="p-12 rounded-2xl bg-surface-container-low border border-outline-variant/15 text-center space-y-3">
            <span className="material-symbols-outlined text-[#19D392] text-[36px] animate-spin">
              progress_activity
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Cargando tu perfil de analista...
            </p>
          </div>
        ) : !userId ? (
          /* Estado sin sesión activa: Invitación clara a Iniciar Sesión */
          <div className="p-8 sm:p-10 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center space-y-5 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-[#19D392]/15 border border-[#19D392]/30 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[#19D392] text-[32px]">
                person_Add
              </span>
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h2 className="font-headline-md text-headline-md text-brand-white font-bold">
                Inicia sesión para gestionar tu perfil
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Accede con tu cuenta de Google o correo electrónico para elegir tu avatar, guardar tu nombre de usuario y conservar tus predicciones de la UEFA Champions League.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/login"
                className="px-6 py-3 rounded-xl bg-[#19D392] hover:bg-[#19D392]/90 text-[#0A1124] font-label-md text-label-md font-bold shadow-[0_0_20px_rgba(25,211,146,0.3)] transition-all inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">
                  login
                </span>
                <span>Ir a Iniciar Sesión / Crear Cuenta</span>
              </Link>
              <Link
                href="/partidos"
                className="px-5 py-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors border border-outline-variant/20"
              >
                Explorar Marcadores en Vivo
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Foto de Perfil Actual + Subida WebP 256x256 + Galería Futbolística */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/15 space-y-5 shadow-md">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="relative group">
                    <div className="w-28 h-28 rounded-full overflow-hidden bg-[#0A1124] border-2 border-[#19D392] shadow-[0_0_24px_rgba(25,211,146,0.25)] flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarUrl}
                        alt={fullName || username || "Avatar de usuario"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      title="Subir foto desde tu dispositivo"
                      className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#19D392] text-[#0A1124] shadow-lg flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        photo_camera
                      </span>
                    </button>
                  </div>

                  <div>
                    <h2 className="font-headline-md text-headline-md text-brand-white font-bold">
                      {fullName || "Analista Pitchline"}
                    </h2>
                    <p className="font-label-md text-label-md text-[#19D392]">
                      @{username || "analista"}
                    </p>
                    {userEmail && (
                      <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                        {userEmail}
                      </p>
                    )}
                  </div>
                </div>

                {/* Subida de foto propia (Canvas HTML5 -> WebP 256x256) */}
                <div className="pt-2 border-t border-outline-variant/15 space-y-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/webp,image/png,image/jpeg"
                    onChange={handleFileUploadChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="w-full py-2.5 px-4 rounded-xl bg-surface-container-high hover:bg-surface-bright text-brand-white font-label-md text-label-md font-semibold border border-outline-variant/25 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[#19D392] text-[18px]">
                      upload
                    </span>
                    <span>
                      {uploadingAvatar
                        ? "Optimizando a WebP 256×256..."
                        : "Subir Foto desde Dispositivo"}
                    </span>
                  </button>
                  <p className="font-label-sm text-[11px] text-on-surface-variant text-center">
                    Se redimensiona automáticamente en tu navegador a formato{" "}
                    <span className="text-brand-white font-semibold">
                      WebP (256×256 px, &lt; 2 MB)
                    </span>
                    .
                  </p>
                </div>

                {/* Galería de Avatares Futbolísticos Predefinidos */}
                <div className="pt-2 border-t border-outline-variant/15 space-y-3">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold block">
                    Galería de Avatares Futbolísticos
                  </span>
                  <div className="grid grid-cols-4 gap-2.5">
                    {PREDEFINED_FOOTBALL_AVATARS.map((preset) => {
                      const isSelected = avatarUrl === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            handleSelectPredefinedAvatar(preset.url)
                          }
                          title={preset.label}
                          className={`group relative rounded-xl p-1.5 flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-[#19D392]/15 border-[#19D392] shadow-[0_0_12px_rgba(25,211,146,0.3)]"
                              : "bg-surface-container hover:bg-surface-container-high border-outline-variant/15"
                          }`}
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={preset.url}
                              alt={preset.label}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="font-label-sm text-[10px] text-on-surface-variant group-hover:text-brand-white truncate max-w-full">
                            {preset.label.split(" ")[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Formulario de Datos del Perfil (full_name, username, club favorito) */}
            <div className="lg:col-span-7">
              <form
                onSubmit={handleSaveProfile}
                className="p-6 sm:p-8 rounded-2xl bg-surface-container-low border border-outline-variant/15 space-y-5 shadow-md"
              >
                <div className="flex items-center gap-2.5 pb-2 border-b border-outline-variant/15">
                  <span className="material-symbols-outlined text-[#19D392] text-[22px]">
                    manage_accounts
                  </span>
                  <h2 className="font-headline-md text-headline-md text-brand-white font-bold">
                    Datos del Perfil
                  </h2>
                </div>

                {statusMessage && (
                  <div
                    className={`p-3.5 rounded-xl border font-body-md text-body-md flex items-start gap-2.5 ${
                      statusMessage.type === "success"
                        ? "bg-[#19D392]/15 border-[#19D392]/40 text-[#19D392]"
                        : "bg-error/15 border-error/40 text-error"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                      {statusMessage.type === "success"
                        ? "check_circle"
                        : "error"}
                    </span>
                    <span>{statusMessage.text}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="profile-full-name"
                    className="block font-label-md text-label-md text-on-surface font-semibold"
                  >
                    Nombre Completo (`full_name`)
                  </label>
                  <input
                    id="profile-full-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tu nombre y apellido"
                    className="w-full px-4 py-2.5 min-h-[44px] rounded-xl bg-[#0A1124] border border-outline-variant/25 text-brand-white placeholder:text-on-surface-variant/60 font-body-md text-base sm:text-body-md focus:outline-none focus:border-[#19D392]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="profile-username"
                    className="block font-label-md text-label-md text-on-surface font-semibold"
                  >
                    Nombre de Usuario (`username`)
                  </label>
                  <div className="relative flex items-center">
                    <span className="text-on-surface-variant font-label-md absolute left-3.5">
                      @
                    </span>
                    <input
                      id="profile-username"
                      type="text"
                      required
                      minLength={3}
                      maxLength={30}
                      value={username}
                      onChange={(e) =>
                        setUsername(
                          e.target.value.replace(/[^a-zA-Z0-9_.-]/g, "")
                        )
                      }
                      placeholder="analista_ucl"
                      className="w-full pl-8 pr-4 py-2.5 min-h-[44px] rounded-xl bg-[#0A1124] border border-outline-variant/25 text-brand-white placeholder:text-on-surface-variant/60 font-body-md text-base sm:text-body-md focus:outline-none focus:border-[#19D392]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="profile-favorite-team"
                    className="block font-label-md text-label-md text-on-surface font-semibold"
                  >
                    Club Favorito de la Champions League
                  </label>
                  <select
                    id="profile-favorite-team"
                    value={favoriteTeamId ?? ""}
                    onChange={(e) =>
                      setFavoriteTeamId(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="w-full px-4 py-2.5 min-h-[44px] rounded-xl bg-[#0A1124] border border-outline-variant/25 text-brand-white font-body-md text-base sm:text-body-md focus:outline-none focus:border-[#19D392]"
                  >
                    <option value="">Seleccionar club favorito (opcional)</option>
                    {STITCH_REFERENCE_STANDINGS.map((club) => (
                      <option key={club.team_id} value={club.team_id}>
                        {club.team_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <button
                    type="submit"
                    disabled={savingProfile || uploadingAvatar}
                    className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-[#19D392] hover:bg-[#19D392]/90 text-[#0A1124] font-label-md text-label-md font-bold shadow-[0_0_20px_rgba(25,211,146,0.3)] transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      save
                    </span>
                    <span>
                      {savingProfile ? "Guardando..." : "Guardar Cambios"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-surface-container hover:bg-error/20 text-on-surface-variant hover:text-error font-label-md text-label-md transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      logout
                    </span>
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PitchlineShell>
  );
}
