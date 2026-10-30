import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextParam = requestUrl.searchParams.get("next");
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // En Vercel y entornos de producción, requestUrl.origin puede apuntar a localhost o un contenedor interno.
  // x-forwarded-host y x-forwarded-proto contienen el dominio público real.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const isLocalEnv = process.env.NODE_ENV === "development";

  const publicOrigin =
    isLocalEnv || !forwardedHost
      ? requestUrl.origin
      : `${forwardedProto}://${forwardedHost}`;

  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/partidos";

  // Si Supabase o el proveedor OAuth devolvieron un error directamente
  if (errorParam) {
    const errorMsg = errorDescription || errorParam;
    return NextResponse.redirect(
      `${publicOrigin}/login?error=${encodeURIComponent(errorMsg)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      const user = data.user;
      const metaFullName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null;
      const metaAvatar =
        (user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        null;
      const defaultUsername =
        user.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) ??
        `analista_${user.id.slice(0, 6)}`;

      try {
        // Verificar si ya existe perfil en public.profiles para no sobreescribir datos manuales
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (!existingProfile) {
          await supabase.from("profiles").upsert(
            {
              id: user.id,
              full_name: metaFullName,
              username: defaultUsername,
              avatar_url: metaAvatar,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );
        }
      } catch (profileErr) {
        console.warn("Aviso al sincronizar perfil en OAuth callback:", profileErr);
      }

      return NextResponse.redirect(`${publicOrigin}${safeNext}`);
    }

    if (error) {
      return NextResponse.redirect(
        `${publicOrigin}/login?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  return NextResponse.redirect(
    `${publicOrigin}/login?error=${encodeURIComponent(
      "No se recibió un código de autenticación válido de Google."
    )}`
  );
}
