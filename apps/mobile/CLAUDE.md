# CLAUDE.md — apps/mobile

> **Reglas de negocio → `CLAUDE.md` raíz** (grupos, participantes, gastos, multimoneda, saldos, pagos, filtros). Leelas antes de construir una pantalla: la UI tiene que reflejar esas reglas (ej. el tipo de cambio precargado con el blue y editable). Este archivo es solo lo **técnico** de la app. El contrato de la API (procedures y modelo) está en `apps/api/CLAUDE.md`.

App mobile con Expo / React Native. Priorizar patrones mobile-first, performance y compatibilidad entre plataformas.

## Expo cambió — no confiar en lo que sabés de memoria

Expo mete breaking changes en cada SDK. Las APIs que recordás probablemente se renombraron, se movieron o se eliminaron. Antes de escribir código que toque una API de Expo, EAS o React Native:

1. Leer la versión major del paquete `expo` en `package.json`.
2. Consultar la documentación de esa versión: `https://docs.expo.dev/versions/v<major>.0.0/`
3. Para todo lo demás, leer https://docs.expo.dev/llms.txt — un índice de toda la documentación de Expo con correcciones a errores comunes de los LLMs. Seguir sus links a la página específica; nunca responder de memoria.

## Comandos

Usamos Bun, así que siempre `bunx` en lugar de `npx`.

```bash
bunx expo install <paquete>  # usar SIEMPRE en lugar de bun add — resuelve versiones compatibles con el SDK
bunx expo start              # levantar el dev server (o `bun run dev` / `bun run mobile` desde la raíz)
bunx expo lint               # lint
bun run typecheck            # typecheck (genera expo-env.d.ts si falta y corre tsc)
bunx expo-doctor             # diagnosticar problemas de dependencias y config
bunx expo install --fix      # arreglar versiones incompatibles
```

Correr `bun run check` desde la raíz antes de dar una tarea por terminada (es lo que corre el pre-commit).

## Env

Copiar `.env.sample` a `.env`. Todo lo `EXPO_PUBLIC_*` queda **embebido en la app y es público**: nunca secretos.

- `EXPO_PUBLIC_API_URL` — opcional en desarrollo (ver abajo); en builds, la URL de Railway.
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — solo para login y sesión.

## API (tRPC)

- Toda la data viene de la API por tRPC. Cliente en `src/lib/trpc.ts`, provider en `src/components/api-provider.tsx` (ya montado en `src/app/_layout.tsx`).
- En componentes: `const trpc = useTRPC()` + `useQuery(trpc.<router>.<procedure>.queryOptions(input))` / `useMutation(trpc.<router>.<procedure>.mutationOptions())` de `@tanstack/react-query`.
- Solo `import type` desde `@kachingga/api`. Los schemas Zod para formularios se importan de `@kachingga/api/schemas`. Nunca importar otro código de runtime de la API.
- Tipos de respuesta: `inferRouterOutputs<AppRouter>`. No redefinirlos a mano.
- Montos: la API usa **centavos enteros** (`amountCents`). Convertir a/desde pesos solo para mostrar y para leer inputs.
- Los errores de la API vienen con mensaje en español listo para mostrar.
- URL de la API: `EXPO_PUBLIC_API_URL` si está definida; si no, en desarrollo usa `Constants.expoConfig.hostUri` (la IP de la máquina que sirve el bundle) en el puerto 3000 — funciona desde el teléfono en la misma red.
- **Auth (pendiente):** la app usará `@supabase/supabase-js` solo para login/sesión y mandará el `access_token` en el header `Authorization: Bearer` del `httpBatchLink`.

## Navegación y rutas

- Usar **Expo Router** para toda la navegación. Las rutas viven en `src/app/` — cada archivo ahí es una pantalla, y los `_layout.tsx` definen los navegadores. Lo que no es ruta (componentes, hooks, utils) va fuera de `src/app/`.
- Importar `Link`, `router` y `useLocalSearchParams` desde `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Builds con EAS

Usamos EAS para compilar, firmar y publicar la app en la nube (`eas build`, `eas submit`) y para mandar updates over-the-air (`eas update`) — no hace falta Xcode ni Android Studio local. Correr el CLI como `bunx eas-cli <comando>` en lugar de `eas` a secas. Ver `DEPLOY.md` en la raíz. **Los builds solo se lanzan cuando alguien lo pide explícitamente.**
Docs: https://docs.expo.dev/eas/index.md

## Reglas

- Si no existen `ios/` y `android/`, se generan solos (Continuous Native Generation). Nunca crearlos ni editarlos a mano — el comportamiento nativo se configura en `app.json` y con config plugins.
- Expo Go solo incluye sus módulos nativos propios. Después de agregar una librería con código nativo, hace falta un development build (`bunx eas-cli build --profile development`) y un nuevo build `preview` para todos — un `eas update` no alcanza.
- Preferir los módulos recomendados de Expo antes que librerías de terceros, y revisar las skills disponibles antes de sumar dependencias. Docs: https://docs.expo.dev/versions/latest/index.md
- Textos de la UI en español; código en inglés.

## Notas técnicas — no romper

- El script `typecheck` crea `expo-env.d.ts` si no existe (lo genera `expo start` y está gitignoreado). Sin ese archivo, `tsc` falla con los imports de CSS.
- `src/components/app-tabs.web.tsx` tiene un cast `props as PressableProps` y `src/hooks/use-color-scheme.web.ts` un `eslint-disable` puntual: son workarounds de tipos/lint del template de Expo. No sacarlos sin correr `bun run check`.
- `src/app/_layout.tsx` envuelve todo en `<ApiProvider>` (tRPC + TanStack Query). Cualquier layout nuevo tiene que quedar **adentro** de ese provider.
- `@kachingga/api` es devDependency (`workspace:*`). La app typechequea archivos de la API: si la API importa algo que acá no resuelve, se rompe el typecheck de mobile.
- `app.json`: `owner: "kachingga"`, `extra.eas.projectId`, `updates.url` y `runtimeVersion: { policy: "fingerprint" }` vinculan la app al proyecto de EAS. **No borrarlos ni cambiarlos** — si se pierden, los teléfonos dejan de recibir updates.
- Nombres fijos: `slug`/`scheme` `kachingga`, bundle id iOS y package Android `com.kachingga.app`. Cambiarlos después del primer build obliga a reinstalar en todos los teléfonos.
- `eas.json`: perfil `preview` → canal `main` (el que tienen instalado todos). No cambiar canales sin avisar.

## Conflictos (mobile)

- **`app.json`:** combinar a mano conservando siempre `owner`, `extra.eas.projectId`, `updates.url`, `runtimeVersion`, `slug`, `scheme`, `ios.bundleIdentifier` y `android.package` tal como están en `main`.
- **`src/app/_layout.tsx`:** conservar el `<ApiProvider>` envolviendo todo y sumar los cambios del otro lado adentro.
- **`eas.json`:** conservar los perfiles y canales de `main`.
- **`package.json`:** combinar dependencias; si quedan versiones incompatibles, `bunx expo install --fix`. Después `bun install && bun run check` desde la raíz.
