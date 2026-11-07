# Marcadores con planes gratuitos

## Activación

1. Ejecuta `supabase/migrations/202611070001_sync_control.sql` en el editor SQL de tu proyecto Supabase. Es necesario para la cuota compartida, la procedencia de eventos y las políticas de solo lectura. No elimina los partidos existentes. Revisa y ejecuta este SQL una sola vez (se puede repetir).
2. Configura en `.env.local` las variables de servidor `CRON_SECRET` (secreto aleatorio largo), `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_KEY` y `API_FOOTBALL_KEY`, además de `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Ninguna clave privada debe tener prefijo `NEXT_PUBLIC_`.
3. Inicia la aplicación con `npm run dev` y, en otra terminal, `npm run sync:worker`. Mantén ambos procesos activos. Si la aplicación ya estaba abierta cuando cambiaste las variables, reiníciala.

El worker usa `http://localhost:3000` por defecto. Para otra dirección define `PITCHLINE_ORIGIN` en el entorno del worker. No lo apuntes a un dominio que no controles: envía la cabecera de autenticación a esa dirección. No compartas `.env.local`.

En producción ejecuta el worker en un proceso persistente, o programa una llamada por minuto a `/api/sync/champions` y una por hora a `/api/sync/news`, con `Authorization: Bearer CRON_SECRET`. Una pestaña abierta ya no sincroniza proveedores. La frecuencia del programador y su disponibilidad dependen de tu hosting; este repositorio no registra un cron remoto automáticamente.

## Qué esperar

- Football-Data: calendario/marcadores cada minuto durante la ventana de partidos (desde 15 minutos antes hasta 4 horas después del inicio); fuera de ella, una vez por hora. Clasificación: una vez por hora. Su plan gratuito tiene marcadores retrasados, aunque se consulte con frecuencia.
- API-Football: consulta de los partidos de Champions del día cada 5 minutos durante esa ventana, hasta 85 solicitudes diarias. No se consume cuota cuando no hay partidos cercanos.
- Incidencias: hasta 10 consultas diarias adicionales, cuando cambia un marcador o estado, con un máximo de dos por ciclo. El total de solicitudes configurado es 95/día, dejando margen respecto a las 100 del plan gratuito. Otras aplicaciones que compartan la misma API key también consumen cuota y no están controladas por este contador.
- Las reservas se guardan en PostgreSQL, con incremento atómico y reinicio diario UTC. Se cuentan también los intentos fallidos; reiniciar el servidor no reinicia el presupuesto. Los límites no garantizan cobertura de la temporada en tu cuenta gratuita.
- API-Football es la referencia del marcador cuando devuelve el partido. Football-Data no sobrescribe ese marcador con su lectura retrasada. Si API-Football queda atrasado más de 15 minutos, un resultado final de Football-Data puede completar el partido. No se deduce el final por la hora.
- No se consulta ESPN ni se escribe contenido de demostración como respaldo. La ausencia de incidencias, posesión o xG se muestra como dato no disponible. No se inventan lesiones ni plazos de recuperación.
- El reloj muestra el minuto recibido. No aumenta por su cuenta. «Consultado hace X min» indica la recepción de datos, no la latencia respecto al estadio.
- Realtime distribuye las escrituras; el cliente reconcilia con lecturas cada minuto, al reconectar y al volver a la pestaña. Si Realtime falla, esas lecturas permiten recuperar el estado.

Con estas cuotas no se puede garantizar un gol al instante. Puede haber cinco minutos de espera más el retraso del proveedor. Se prioriza que lo mostrado sea coherente y verificable.

## Datos anteriores

Los eventos anteriores sin `source = 'api-football'` quedan fuera de las lecturas verificadas. No se borran automáticamente por su identificador ni se les atribuye una fuente que no conocemos. Los goles de un snapshot que no coincide con el marcador se ocultan hasta recibir incidencias consistentes (por ejemplo tras VAR). La función de reconciliación reemplaza las incidencias de un partido dentro de una transacción, incluyendo snapshots vacíos.

Los antiguos marcadores y estadísticas sintéticas pueden seguir almacenados. Una sincronización correcta reemplaza marcadores recibidos y la interfaz excluye estadísticas sin procedencia. No se ha realizado una limpieza remota de datos históricos ni se han verificado los RLS de perfiles, avatares y brackets con una sesión real.

## Comprobación

Ejecuta `npm run test:sync` y `npx tsc --noEmit`. Las pruebas simulan proveedores y cubren autorización, agotamiento de cuota, fallos de red, VAR, eventos estables y datos ausentes. La migración SQL y la entrega real por Realtime deben verificarse en tu proyecto Supabase.

Si el worker informa un error, comprueba primero que aplicaste la migración y configuraste las claves. La respuesta del endpoint incluye `warnings`, `sources` y `upserted`; no imprime credenciales. Si falla un proveedor, se conserva la última lectura y su fecha, sin fabricar una actualización.
