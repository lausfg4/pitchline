// Central scheduler. Never put CRON_SECRET in a browser or NEXT_PUBLIC variable.
const origin = process.env.PITCHLINE_ORIGIN ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) throw new Error("Configura CRON_SECRET en .env.local");
let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });
let nextNews = 0;
while (running) {
  const started = Date.now();
  for (const route of ["champions", ...(started >= nextNews ? ["news"] : [])]) {
    try {
      const response = await fetch(new URL(`/api/sync/${route}`, origin), {
        method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(55_000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) console.error(`${route}: sincronización fallida (${response.status}); revisa la migración y los registros del servidor.`);
      else if (result.warnings?.length) console.warn(`${route}: proveedor no disponible; se conserva la última lectura. Revisa la cuota o cobertura en tu cuenta.`);
      else console.log(`${route}: ${result.skipped ? "sin cambios" : "procesado"}`);
    } catch { console.error(`${route}: no se pudo conectar con el servidor.`); }
    if (route === "news") nextNews = Date.now() + 3_600_000;
  }
  // Small sleeps allow graceful shutdown; requests never overlap in this worker.
  while (running && Date.now() - started < 60_000) await new Promise(resolve => setTimeout(resolve, 1000));
}
