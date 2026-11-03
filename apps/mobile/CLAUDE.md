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

## Cómo usar la API desde la app

La API ya implementa **toda la lógica de la v1** (permisos, divisiones, redondeo, monedas, saldos, transferencias). **La app no recalcula nada de eso**: pide los datos ya resueltos y los muestra.

### Dónde buscar
| Necesito… | Dónde |
|-----------|-------|
| Entender qué tiene que hacer una pantalla | "Reglas de negocio" en el `CLAUDE.md` raíz |
| Qué procedure llamar y qué devuelve | Tabla **"Procedures tRPC"** en `apps/api/CLAUDE.md` |
| El input exacto (campos, validaciones) | `apps/api/src/schemas.ts` (importable como `@kachingga/api/schemas`) |
| El output exacto | El router en `apps/api/src/trpc/routers/<dominio>.ts`, o `inferRouterOutputs<AppRouter>` |
| Cómo se guardan los datos (monedas, centavos, borrados) | "Modelo de datos" en `apps/api/CLAUDE.md` |

### Patrones (verificados con estas versiones)
```tsx
import type { AppRouter } from '@kachingga/api';
import { expenseInput, type ExpenseInput } from '@kachingga/api/schemas';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useTRPC } from '@/lib/trpc';

type Balances = inferRouterOutputs<AppRouter>['balances']['get'];

const trpc = useTRPC();
const queryClient = useQueryClient();

// Query
const group = useQuery(trpc.groups.get.queryOptions({ groupId }));

// Lista paginada (expenses.list devuelve { items, nextCursor }; el cursor lo maneja tRPC)
const expenses = useInfiniteQuery(
  trpc.expenses.list.infiniteQueryOptions({ groupId, filters }, { getNextPageParam: (last) => last.nextCursor }),
);

// Mutation + invalidar lo que cambia
const createExpense = useMutation(
  trpc.expenses.create.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.expenses.pathFilter());
      queryClient.invalidateQueries(trpc.balances.get.queryFilter({ groupId }));
    },
  }),
);
```

### Reglas
- Toda la data viene de la API por tRPC. Cliente en `src/lib/trpc.ts`, provider en `src/components/api-provider.tsx` (ya montado en `src/app/_layout.tsx`).
- Solo `import type` desde `@kachingga/api`. Los schemas Zod para formularios se importan de `@kachingga/api/schemas` (verificado que Metro los empaqueta). Nunca importar otro código de runtime de la API. Si usás `zod` directo en la app, agregalo con `bunx expo install zod`.
- No redefinir a mano tipos de inputs/outputs: `ExpenseInput` etc. desde `schemas`, outputs con `inferRouterOutputs<AppRouter>`.
- **Después de una mutation, invalidar** lo que afecta: gastos y pagos cambian `balances.get`; participantes cambian `groups.get`; etc.
- **Montos en centavos enteros** (`amountCents`). Convertir a/desde unidades solo para mostrar y al leer inputs (`Math.round(valor * 100)`). Mostrar con la moneda que viene en cada dato.
- **Tipo de cambio:** al cargar un gasto en otra moneda, precargar `rates.blue` (`mid`) para ARS ↔ USD y dejarlo editable; ofrecer "mantener moneda" (`keepCurrency: true`). Si se manda sin `exchangeRate`, la API usa el blue automático.
- **Errores:** los `TRPCClientError` traen `message` en español listo para mostrar. `NOT_FOUND` en un grupo = no sos miembro.
- Fechas viajan como `Date` (superjson): no convertir a string.
- **Si a la app le falta algo de la API** (un campo, un procedure, un filtro), no hacer workarounds en la app: se agrega en `apps/api` siguiendo `apps/api/CLAUDE.md` (mismo repo, mismo commit o uno `feat(api)` aparte) y se actualiza la tabla de procedures.
- URL de la API: `EXPO_PUBLIC_API_URL` si está definida; si no, en desarrollo usa `Constants.expoConfig.hostUri` (la IP de la máquina que sirve el bundle) en el puerto 3000 — funciona desde el teléfono en la misma red. Para desarrollar la app hay que tener la API corriendo (`bun run dev` desde la raíz levanta las dos).

### Auth (pendiente de implementar en la app)
- Login/signup/logout con `@supabase/supabase-js` (email + password) usando `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Supabase **solo** para auth, nunca para leer datos.
- Mandar el `access_token` de la sesión en `headers` del `httpBatchLink` de `src/lib/trpc.ts` (`Authorization: Bearer <token>`). Sin token, todo menos `health.ping` responde `UNAUTHORIZED`.
- Después del login: `groups.list`. Para unirse a un grupo: `groups.preview` con el código → elegir participante sin cuenta o nombre nuevo → `groups.join`.

## UI / UX — estándar de calidad

Qué pantallas hay y qué hace cada una: **`V1.md` → "Pantallas"**. Esta sección es **cómo** tienen que sentirse. La app la usamos nosotros todos los días: tiene que ser rápida, clara y linda. Ante la duda, priorizar que **cargar un gasto sea lo más rápido posible**.

### Skills del plugin de Expo (usarlas antes de inventar)
El plugin de Expo está activado en `.claude/settings.json`. Para UI, cargar la skill que corresponda antes de escribir código:
- `expo-native-ui` — estilo de pantallas nativas, colores, controles, íconos.
- `expo-design-system` — tokens de tema y componentes reutilizables (partir de `src/constants/theme.ts`).
- `expo-router` — stacks, tabs, headers, modales.
- `expo-animation` — animaciones y gestos (Reanimated + Gesture Handler, ya instalados).
- `expo-ui` — componentes de `@expo/ui` (ya instalado).
- `expo-data-fetching` **no** reemplaza nuestro patrón: la data va **siempre** por tRPC + TanStack Query como se describe arriba.

### Los 4 estados de toda pantalla con datos
Ninguna pantalla puede quedar en blanco ni "colgada". Siempre contemplar:
1. **Cargando:** skeletons con la forma del contenido (no un spinner suelto en el medio). En recargas, mantener los datos viejos visibles (TanStack Query lo hace solo) y mostrar un indicador sutil.
2. **Vacío:** mensaje que explique qué va ahí + la acción para empezar ("Todavía no hay gastos" + "Agregar gasto").
3. **Error:** el `message` de la API en español + botón **Reintentar**. Nunca un error técnico crudo.
4. **Con datos:** el contenido. Listas con **pull-to-refresh** y scroll infinito donde haya paginación.

### Acciones y feedback
- **Botones de envío:** deshabilitados + indicador mientras la mutation está en curso (`isPending`); nunca permitir doble envío.
- **Optimistic updates** en lo frecuente (agregar/borrar gasto, marcar pago) para que se sienta instantáneo; si falla, revertir y avisar. Después siempre invalidar las queries afectadas (ver arriba).
- **Confirmación** antes de lo destructivo (borrar gasto/pago, quitar participante, archivar), explicando la consecuencia.
- Confirmar éxitos de forma breve y no bloqueante (toast/feedback visual), y **haptics** suaves en acciones clave (`expo-haptics`, se instala con `bunx expo install expo-haptics`).
- Transiciones y animaciones cortas y nativas (Reanimated). Nada que haga esperar.

### Formularios
- Validar con los schemas de `@kachingga/api/schemas` y mostrar el error **al lado del campo**, en español.
- Teclado correcto por campo (`decimal-pad` para montos), el formulario no queda tapado por el teclado, "siguiente" pasa al próximo campo.
- Defaults inteligentes (fecha = hoy, pagó = yo, moneda = la base, división = todos en partes iguales) para cargar un gasto en segundos.
- En divisiones por monto/porcentaje, mostrar en vivo cuánto falta para el total/100% y no dejar enviar hasta que cierre.

### Plata, fechas y textos
- Formatear montos en **un solo helper** (ej. `src/lib/format.ts`) con `Intl.NumberFormat('es-AR', { style: 'currency', currency })`: `$ 15.550,00`, `US$ 20,00`. Siempre mostrar la moneda de cada dato.
- Saldos con color y texto, no solo color: "Debés $X" / "Te deben $X" / "Estás al día".
- Fechas relativas cuando ayuda ("hoy", "ayer") y si no `dd/mm`; formato argentino.
- Copy en español argentino, corto y claro ("Agregá un gasto", "¿Quién pagó?").

### Visual y accesibilidad
- **Modo claro y oscuro**: usar siempre los colores de `theme.ts` vía `useTheme` / `ThemedText` / `ThemedView`; nunca colores hardcodeados. Si hace falta un color nuevo, se agrega al tema (light y dark).
- Espaciados de `Spacing`; tipografías de `ThemedText`. Consistencia antes que creatividad por pantalla.
- Safe areas respetadas; áreas táctiles de al menos 44×44; contraste suficiente; `accessibilityLabel` en botones con solo ícono.
- Íconos con `expo-symbols` (ya instalado), consistentes en toda la app.
- Probar cada pantalla en un teléfono real (no solo simulador) y en los dos modos de color.

### Antes de dar una pantalla por terminada
- [ ] Cumple las reglas de negocio de la raíz y lo descripto en `V1.md` → "Pantallas".
- [ ] Tiene los 4 estados (cargando, vacío, error, datos).
- [ ] Mutations con `isPending`, invalidación y (si aplica) optimistic update.
- [ ] Funciona en modo claro y oscuro, con teclado abierto y en pantallas chicas.
- [ ] `bun run check` pasa.

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
