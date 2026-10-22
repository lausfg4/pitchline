# AGENTS.md — Guía Maestra de Arquitectura, Seguridad y Diseño (UI Stitch) para Antigravity CLI (`agy`)
**Nombre Oficial de la Aplicación:** `Pitchline` (`pitchline`)

Este archivo define el contexto permanente, la identidad visual de **Pitchline**, las reglas de negocio, la arquitectura de seguridad (Row Level Security al 100%) y el flujo de conversión de diseño desde **Google Stitch** para la aplicación de la **UEFA Champions League**.

---

## 1. Identidad de Marca (`Pitchline`) y Stack Tecnológico
- **Nombre de la App y Repositorio:** **Pitchline** (`pitchline`).
- **Concepto Visual del Logo:** Círculo central y línea de medio campo minimalista (mitad izquierda en blanco `#FFFFFF`, mitad derecha y punto central en verde menta eléctrico `#19D392`, sobre fondo azul medianoche `#0A1124`).
- **Paleta Oficial de Colores (Tokens para Tailwind CSS y Google Stitch):**
  - `brand-navy` (Fondo principal oscuro / Icono): `#0A1124`
  - `brand-mint` (Acento principal / En Vivo / CTA): `#19D392`
  - `brand-ice` (Superficie clara / Tarjetas secundarias): `#EEF2F8`
  - `brand-white` (Texto sobre fondo oscuro / Superficie limpia): `#FFFFFF`
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS + Lucide Icons (instalable como PWA en móvil y escritorio).
- **Backend, Base de Datos, Auth, Storage y Tiempo Real:** Supabase (`PostgreSQL` + `Supabase Auth` + `Supabase Storage` + `Supabase Realtime` + `pgvector`).
- **Fuentes de Datos Oficiales (Solo desde Backend / Cron Jobs):**
  - `Football-Data.org API` (`/v4/competitions/CL/standings` y `/matches`).
  - `API-Football` (`/fixtures?live=all&league=2` para marcador e incidencias en vivo, `/injuries?league=2` para lesionados y bajas).
  - RSS Oficial de UEFA + `NewsAPI.org` para noticias filtradas exclusivamente de Champions League.
- **Motor IA del Chatbot:** Google Gemini API (`gemini-2.5-flash`) con RAG conectado a las tablas `matches`, `match_events`, `player_injuries` y `news_articles`.

---

## 2. Estructura de las 5 Pestañas y Autenticación

1. **Pestaña 1 — Clasificación y Eliminatorias (`/clasificacion`):**
   - Sub-pestaña **Fase de Liga (36 equipos):** Tabla con PJ, V, E, D, GF, GC, DG, Puntos y Racha. Zonas visuales: puestos 1–8 (Octavos directo en verde `#19D392`), 9–24 (Playoffs), 25–36 (Eliminados).
   - Sub-pestañas **Eliminatorias (Octavos, Cuartos, Semifinales, Final):** Componente `<KnockoutBracket mode="live" />` sincronizado con la base de datos.
2. **Pestaña 2 — Partidos por Día, Marcador en Tiempo Real y Pronósticos (`/partidos`):**
   - **Detector de Semana Vacía:** Si no hay partidos programados en la semana actual (lunes a domingo), mostrar tarjeta: *"No hay partidos para esta semana — Próxima jornada: [Fecha]"*.
   - **Tarjetas de Partido con 3 Estados:**
     - `SCHEDULED` (Previa): Hora local y **Pronóstico Algorítmico** (% Victoria Local, % Empate, % Visitante) basado en Rendimiento Reciente (30%), Estadísticas/xG (30%), Jerarquía UEFA (25%) y H2H/Localía (15%).
     - `IN_PLAY` / `HT` (En Tiempo Real): Suscripción vía WebSockets a **Supabase Realtime** (`matches` y `match_events`) con indicador pulsante en verde `#19D392` para actualizar goles, minuto exacto (`34'`, `45+2'`), goleadores, tarjetas y estadísticas en vivo sin recargar la página.
     - `FINISHED`: Marcador definitivo, resumen de eventos y verificación del pronóstico.
3. **Pestaña 3 — Simulador "Arma tu Champions" (`/simulador`):**
   - Reutiliza `<KnockoutBracket mode="simulator" />` permitiendo al usuario elegir ganadores desde Octavos hasta el Campeón y guardar su predicción en la tabla `user_brackets`.
4. **Pestaña 4 — Noticias Exclusivas (`/noticias`):**
   - Feed de artículos verificados exclusivamente sobre los partidos y actualidad de la UEFA Champions League.
5. **Pestaña 5 — Chatbot IA Deportivo (`/chatbot`):**
   - Asistente conversacional de **Pitchline** que responde qué ocurrió en los partidos (en vivo o terminados) y cuánto tiempo estimado estará fuera un jugador lesionado consultando `player_injuries` y `match_events`.
6. **Autenticación y Perfil (`/login`, `/perfil`):**
   - Inicio de sesión 100% gratuito con **Google OAuth 2.0** y **Correo/Contraseña** mediante Supabase Auth (sin Apple Sign-In para evitar el costo de $99 USD/año).
   - Selección de avatar predefinido o subida de foto comprimida (`WebP 256x256 px`) al bucket `avatars` de Supabase Storage.

---

## 3. Reglas Estrictas de Seguridad (Obligatorias en Todo Código Generado)

1. **Prohibido exponer claves privadas en el cliente:**
   - En componentes de cliente (`"use client"`), usar exclusivamente `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - `SUPABASE_SERVICE_ROLE_KEY`, `API_FOOTBALL_KEY`, `FOOTBALL_DATA_KEY` y `GEMINI_API_KEY` **jamás** deben llevar el prefijo `NEXT_PUBLIC_` y solo pueden leerse en Route Handlers de servidor (`app/api/.../route.ts`) o Server Actions.
2. **Respeto absoluto a Row Level Security (RLS):**
   - Las tablas oficiales (`standings`, `matches`, `match_events`, `predictions`, `news_articles`, `player_injuries`) son de **solo lectura (`SELECT`)** para cualquier cliente web/móvil. Solo el worker del backend (autenticado con `SUPABASE_SERVICE_ROLE_KEY` y protegido por cabecera `CRON_SECRET`) puede hacer `INSERT` o `UPDATE`.
   - En `profiles`, `user_brackets` y `chat_messages`, toda operación desde cliente usa la sesión activa de Supabase Auth (`supabase.auth.getUser()`), donde PostgreSQL valida `auth.uid() = user_id`.
3. **Validación de Subida de Avatares:**
   - Antes de subir una imagen al bucket `avatars`, validar en cliente y servidor que sea imagen (`image/webp`, `image/png`, `image/jpeg`), redimensionarla a máximo `256x256 px` (< 2 MB) y guardarla bajo la ruta `${user.id}/avatar.webp` para cumplir con la política RLS de carpetas de Supabase Storage.

---

## 4. Cómo Integrar los Diseños de Google Stitch (`design_reference/`)

Todos los diseños visuales generados con **Google Stitch** y el logo oficial (`Logo Pitchline@1x.png`) se almacenan en `/design_reference/` y `/public/`:
- Capturas de referencia visual: `design_reference/*.png`
- Código base exportado de Stitch (HTML + Tailwind CSS): `design_reference/*.html`

### Instrucciones para el Agente (`agy`) al Construir Componentes desde Stitch:
1. Cuando el usuario referencie un archivo de `/design_reference/` (por ejemplo `@design_reference/tab2_partidos.png` y `@design_reference/tab2_partidos.html`), **respeta fielmente la paleta de colores de Pitchline (`#0A1124` y `#19D392`), tipografía, espaciados y estructura de tarjetas** del diseño de Stitch.
2. Convierte el HTML estático de Stitch en componentes modulares de React/Next.js con TypeScript, reemplazando los textos fijos (hardcoded) por los datos dinámicos tipados provenientes de Supabase (`matches`, `standings`, `predictions`, etc.).
3. Mantén diseño *responsive* (móvil primero con barra de navegación inferior de 5 pestañas y vista adaptada en escritorio).