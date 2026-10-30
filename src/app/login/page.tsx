"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PitchlineLogo } from "@/components/layout/PitchlineShell";

type AuthTab = "LOGIN" | "REGISTER";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AuthTab>("LOGIN");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (err) {
        if (err === "oauth_callback_error") {
          return "No se pudo completar la autenticación con Google. Por favor, inténtalo de nuevo.";
        }
        return decodeURIComponent(err);
      }
    }
    return null;
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace("/perfil");
      }
    });
  }, [router]);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setErrorMessage(error.message);
        setGoogleLoading(false);
      }
    } catch {
      setErrorMessage("Error al conectar con Google OAuth.");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();

    if (!trimmedEmail || !password) {
      setErrorMessage("Por favor ingresa tu correo electrónico y contraseña.");
      return;
    }

    if (activeTab === "REGISTER" && !trimmedName) {
      setErrorMessage("Por favor ingresa tu nombre completo para crear tu cuenta.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      if (activeTab === "LOGIN") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (error) {
          setErrorMessage(
            error.message === "Invalid login credentials"
              ? "Correo o contraseña incorrectos. Verifica tus datos o crea una cuenta."
              : error.message
          );
          setLoading(false);
          return;
        }

        window.dispatchEvent(new CustomEvent("pitchline:profile-updated"));
        router.push("/partidos");
        router.refresh();
      } else {
        const defaultUsername =
          trimmedEmail
            .split("@")[0]
            ?.replace(/[^a-zA-Z0-9_]/g, "")
            .slice(0, 24) || "analista_ucl";

        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: trimmedName,
              username: defaultUsername,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }

        if (data.user && data.session) {
          await supabase.from("profiles").upsert(
            {
              id: data.user.id,
              full_name: trimmedName,
              username: defaultUsername,
            },
            { onConflict: "id" }
          );
          window.dispatchEvent(new CustomEvent("pitchline:profile-updated"));
          router.push("/perfil");
          router.refresh();
          return;
        }

        setSuccessMessage(
          "Cuenta creada exitosamente. Revisa tu bandeja de correo para confirmar tu cuenta o inicia sesión directamente."
        );
        setActiveTab("LOGIN");
      }
    } catch {
      setErrorMessage("Ocurrió un problema inesperado. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-dvh bg-[#0A1124] text-on-surface flex flex-col justify-between relative overflow-hidden">
      {/* Luces ambientales con paleta oficial de Pitchline (#0A1124 y #19D392) */}
      <div className="absolute -top-40 -left-32 w-96 h-96 bg-[#19D392]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-32 w-96 h-96 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

      {/* Barra superior de retorno */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-3 sm:px-8 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-6 flex items-center justify-between gap-3">
        <Link
          href="/partidos"
          className="inline-flex items-center gap-2.5 group min-w-0"
        >
          <div className="w-10 h-10 shrink-0 rounded-xl bg-surface-container-high flex items-center justify-center p-1.5 shadow-md border border-outline-variant/30">
            <PitchlineLogo />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-headline-md text-headline-md tracking-tight text-brand-white lowercase font-bold leading-none">
                pitchline
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#19D392]"></span>
            </div>
            <span className="font-label-sm text-[10px] uppercase text-[#19D392] tracking-wider font-semibold truncate">
              UEFA Champions League
            </span>
          </div>
        </Link>

        <Link
          href="/partidos"
          aria-label="Volver a Marcadores"
          className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-3 sm:px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-brand-white font-label-md text-label-md transition-colors border border-outline-variant/20"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          <span className="hidden min-[400px]:inline">Volver a Marcadores</span>
        </Link>
      </header>

      {/* Contenedor central de Autenticación */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-3 sm:px-4 py-6 sm:py-10">
        <div className="w-full max-w-md rounded-2xl bg-surface-container-low/95 backdrop-blur-xl p-5 sm:p-8 shadow-2xl border border-outline-variant/20 space-y-5 sm:space-y-6">
          {/* Identidad de Marca Pitchline */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0A1124] flex items-center justify-center p-2.5 shadow-lg border border-[#19D392]/35">
              <PitchlineLogo />
            </div>
            <h1 className="font-headline-lg text-[24px] leading-8 sm:text-headline-lg text-brand-white font-bold tracking-tight text-balance">
              {activeTab === "LOGIN"
                ? "Bienvenido a Pitchline"
                : "Crea tu Cuenta de Analista"}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {activeTab === "LOGIN"
                ? "Inicia sesión para guardar tu llave de Champions, pronósticos y personalizar tu perfil."
                : "Regístrate gratis para competir en el simulador de llaves y guardar tus predicciones."}
            </p>
          </div>

          {/* Selector de Pestaña: Iniciar Sesión vs Crear Cuenta */}
          <div
            role="tablist"
            aria-label="Modo de autenticación"
            className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0A1124] border border-outline-variant/20"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "LOGIN"}
              onClick={() => {
                setActiveTab("LOGIN");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2.5 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                activeTab === "LOGIN"
                  ? "bg-[#19D392] text-[#0A1124] font-bold shadow-[0_0_16px_rgba(25,211,146,0.3)]"
                  : "text-on-surface-variant hover:text-brand-white"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "REGISTER"}
              onClick={() => {
                setActiveTab("REGISTER");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2.5 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                activeTab === "REGISTER"
                  ? "bg-[#19D392] text-[#0A1124] font-bold shadow-[0_0_16px_rgba(25,211,146,0.3)]"
                  : "text-on-surface-variant hover:text-brand-white"
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          {/* Botón Destacado: Continuar con Google OAuth 2.0 */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full py-3 px-4 rounded-xl bg-brand-white hover:bg-brand-ice text-[#0A1124] font-label-md text-label-md font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.9C3.5 21.4 7.4 24 12 24z"
              />
            </svg>
            <span>
              {googleLoading
                ? "Conectando con Google..."
                : "Continuar con Google"}
            </span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-outline-variant/20 w-full"></div>
            <span className="bg-surface-container-low px-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
              o con tu correo
            </span>
            <div className="border-t border-outline-variant/20 w-full"></div>
          </div>

          {/* Mensajes de Error o Éxito */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-error/15 border border-error/40 text-error font-body-md text-body-md flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                error
              </span>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-[#19D392]/15 border border-[#19D392]/40 text-[#19D392] font-body-md text-body-md flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                check_circle
              </span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Formulario de Correo / Contraseña */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === "REGISTER" && (
              <div className="space-y-1.5">
                <label
                  htmlFor="full-name"
                  className="block font-label-md text-label-md text-on-surface"
                >
                  Nombre Completo
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px] absolute left-3.5">
                    badge
                  </span>
                  <input
                    id="full-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej. Carlos Martínez"
                    className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl bg-[#0A1124] border border-outline-variant/25 text-brand-white placeholder:text-on-surface-variant/60 font-body-md text-base sm:text-body-md focus:outline-none focus:border-[#19D392]"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block font-label-md text-label-md text-on-surface"
              >
                Correo Electrónico
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-on-surface-variant text-[18px] absolute left-3.5">
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl bg-[#0A1124] border border-outline-variant/25 text-brand-white placeholder:text-on-surface-variant/60 font-body-md text-base sm:text-body-md focus:outline-none focus:border-[#19D392]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block font-label-md text-label-md text-on-surface"
              >
                Contraseña
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-on-surface-variant text-[18px] absolute left-3.5">
                  lock
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl bg-[#0A1124] border border-outline-variant/25 text-brand-white placeholder:text-on-surface-variant/60 font-body-md text-base sm:text-body-md focus:outline-none focus:border-[#19D392]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 px-4 min-h-[46px] rounded-xl bg-[#19D392] hover:bg-[#19D392]/90 text-[#0A1124] font-label-md text-label-md font-bold shadow-[0_0_20px_rgba(25,211,146,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">
                {activeTab === "LOGIN" ? "login" : "person_add"}
              </span>
              <span>
                {loading
                  ? "Procesando..."
                  : activeTab === "LOGIN"
                    ? "Iniciar Sesión"
                    : "Crear Cuenta"}
              </span>
            </button>
          </form>
        </div>
      </main>

      <footer className="relative z-10 py-4 text-center font-label-sm text-label-sm text-on-surface-variant">
        Pitchline • UEFA Champions League Hub
      </footer>
    </div>
  );
}
