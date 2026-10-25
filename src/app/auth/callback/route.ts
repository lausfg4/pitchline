import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/partidos";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
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

      // Verificar si ya existe perfil en public.profiles para no sobrescribir cambios manuales del usuario
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

      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_callback_error`);
}
