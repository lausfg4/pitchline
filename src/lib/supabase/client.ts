import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para componentes de Cliente ("use client") y suscripciones WebSockets (Supabase Realtime).
 * Cumple estrictamente la Regla 3.1 de AGENTS.md: usa exclusivamente variables públicas NEXT_PUBLIC_*.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan las variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
