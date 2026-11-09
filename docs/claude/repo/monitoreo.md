# Monitoreo de errores (Sentry)

> **Aplica a:** `apps/api/src/lib/monitoring.ts`, `apps/web/src/lib/monitoring.ts`, `apps/web/src/components/route-error.tsx`, el `onError` de tRPC y `app.onError` en `apps/api/src/index.ts`, los `onError` del `QueryCache` / `MutationCache` en `apps/web/src/components/api-provider.tsx`, y la subida de source maps en `apps/web/vite.config.ts`. **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Servicios y variables: `INFRA.md`; caídas (UptimeRobot): `DEPLOY.md` → "Monitoreo".

## Qué se reporta

- **Solo errores inesperados** (bugs, la base caída), nunca los de negocio, que son parte del uso normal:
  - **API:** el `onError` de tRPC reporta solo `INTERNAL_SERVER_ERROR` (con la causa original y el procedure como tag). `NOT_FOUND`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `TOO_MANY_REQUESTS`… nunca. Lo que escape de Hono fuera de tRPC lo agarra `app.onError` (responde 500 sin detalles).
  - **Web:** solo los bugs del front: una pantalla que explota al renderizar (`RouteError`, el `errorElement` de la ruta raíz: reporta y muestra "Algo salió mal" con **Reintentar**) y excepciones en queries / mutations que **no** sean errores de la API (`TRPCClientError`: esos los reporta la API si son inesperados) ni "Necesitás conexión para guardar" (modo offline).
- Sin tracing ni Session Replay: solo errores.

## Privacidad (no mandar datos del grupo)

- `dataCollection` apagado para IP, cookies, headers (el token), query strings (los GET de tRPC llevan el input, con montos) y bodies (montos, alias).
- `beforeSend` (`scrubEvent`) lo vuelve a limpiar por las dudas: saca headers, cookies, body y query del request, y del usuario deja **solo el id**.
- Web: `setMonitoringUser` identifica al usuario **solo por su id de Supabase** (nunca el email). `beforeBreadcrumb` (`scrubBreadcrumb`) descarta los breadcrumbs de `console` y saca la query de las URLs de fetch y navegación.
- Los mensajes de error del código no llevan datos de usuarios (regla de la API: mensajes en español, sin datos internos).

## Cuándo está prendido

- **Sin DSN no hace nada:** `SENTRY_DSN` (API) / `VITE_SENTRY_DSN` (web) vacíos en local, tests y CI. Se cargan solo en Railway (`INFRA.md`).
- `environment` = `SENTRY_ENVIRONMENT` / `VITE_SENTRY_ENVIRONMENT` (`staging` o `production`). `release` = el commit (`RAILWAY_GIT_COMMIT_SHA`, que Railway expone; en la web se inyecta al buildear como `__APP_RELEASE__`).
- **El DSN de la web es público por diseño** (va en el JS, como todo `VITE_*`): solo permite mandar eventos, no leerlos.

## Stack traces legibles (source maps de la web)

- Si el build tiene `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` y `SENTRY_PROJECT` (variables del servicio `web` en Railway), `@sentry/vite-plugin` genera los source maps, los sube a Sentry con el mismo `release` y **los borra de `dist/`**: nunca se sirven. Sin token, el build no genera source maps.
- El token es un **Organization Token** de la org `kachingga` de Sentry (solo puede subir source maps y releases), **no** el token personal de `sentry-cli`: ese tiene permisos de admin sobre todas las orgs de quien lo creó y no va en ningún servicio.
- **Verificado (nov 2026):** en staging el log del build dice "Successfully uploaded source maps to Sentry", el release del commit aparece en Sentry y `/assets/*.js.map` da 404. Railway sí expone `RAILWAY_GIT_COMMIT_SHA` al buildear.
- La API corre el TypeScript directo con Bun: sus stack traces ya apuntan a los archivos fuente.

## Tests

`apps/api/src/__tests__/monitoring.test.ts` y `apps/web/src/lib/__tests__/monitoring.test.ts` (sin DSN no se inicializa; los errores de negocio no se reportan y los internos sí; limpieza de datos), y `apps/web/src/components/__tests__/route-error.test.tsx`.
