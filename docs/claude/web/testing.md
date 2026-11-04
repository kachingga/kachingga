# Tests — web

> **Aplica a:** `apps/web/src/**/__tests__/`, `src/test/setup.ts`, `src/test/render.tsx`, `apps/web/e2e/`, `apps/web/playwright.config.ts`. **Si cambiás cómo se testea, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`.

| Nivel | Herramienta | Dónde | Corre en |
|-------|-------------|-------|----------|
| Unit (helpers, hooks) | Vitest | `src/**/__tests__/*.test.ts` | `bun run check` / pre-commit / CI |
| **Contenido de pantallas** | Vitest + Testing Library + `renderWithApi` | `src/**/__tests__/*.test.tsx` | `bun run check` / pre-commit / CI |
| E2E (recorridos en el navegador) | Playwright, en celular (WebKit) y compu (Chrome) | `e2e/*.spec.ts` | Local (`bun run e2e`) y en GitHub Actions (a mano o PRs con label `e2e`) |

## Tests de contenido (`renderWithApi`)

`src/test/render.tsx` renderiza una pantalla con los mismos providers que la app (tRPC + TanStack Query + router + `ConfirmProvider` + `Toaster`) contra una **API falsa**: un handler por procedure. Ejemplo completo en `src/test/__tests__/render.test.tsx`.

```tsx
renderWithApi(<GroupScreen />, {
  'groups.get': () => fixtureGroup,
  'balances.get': () => [],
  'expenses.list': () => ({ items: [], nextCursor: null }),
}, '/grupos/g1');
expect(await screen.findByText('Todavía no hay gastos')).toBeInTheDocument();
```

- Un test por estado (cargando con `neverResolves`, vacío, error con `throw apiError(...)`, datos) + las interacciones principales (`@testing-library/user-event`), verificando qué procedure se llamó y con qué input.
- Un procedure sin handler responde `NOT_FOUND` ("Sin handler de test para …").
- El 3er argumento es la URL inicial (sirve para `?from=…` y otros search params). La pantalla se renderiza sin `<Routes>`, así que `useParams` viene vacío.
- Buscar como el usuario: `getByRole`, `getByLabelText`, `getByText`.
- Datos falsos con la forma real (`docs/claude/api/contrato.md` o `inferRouterOutputs<AppRouter>`).
- Optimistic updates: ver `datos-y-cache.md` (qué testear).

## Setup (`src/test/setup.ts`)

- Navegador en **`es-AR`** (`navigator.language`): los montos se ven "1.500,50".
- Stubs de lo que jsdom no tiene y usan los toasts: `matchMedia` y pointer capture (`setPointerCapture`…). Sin el segundo, tocar un botón de un toast tira un error no capturado y Vitest falla.
- `QueryClient` de los tests con `gcTime: Infinity` (si no, quedan timers colgados) y sin reintentos.
- **Los tests no pueden depender de `.env`** (corren en el CI y en el pre-commit de todos): `vite.config.ts` → `test.env` les da valores fijos a las `VITE_*`. Si agregás una variable que se lee al importar un módulo, sumala ahí también.

## E2E (Playwright)

- **Qué lleva E2E:** solo los recorridos críticos (registrarse / login, crear grupo, unirse con código, agregar gasto, ver saldos, registrar pago). El resto va en los tests de contenido.
- Corre contra el **build de producción** (`build` + `preview` en :4173) en celular y compu. Hoy solo existe `e2e/smoke.spec.ts` (la app carga).
- Para flujos con datos: la API corriendo (`bun run api`) y un usuario de prueba en **dev** (los de `bun run db:seed`, ver `docs/claude/api/datos-de-prueba.md`). `preview` también reenvía `/trpc` a la API.
- Ponerle la label `e2e` a los PRs que cambian un recorrido crítico.
- Ojo: Playwright con `locale: 'es-AR'` en Chromium reporta `navigator.language = 'es-419'` (como Chrome real en Argentina).
