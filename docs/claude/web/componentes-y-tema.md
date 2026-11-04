# Componentes y tema (shadcn/ui) — web

> **Aplica a:** `src/index.css`, `src/components/` (incluido `src/components/ui/`), `apps/web/components.json`, colores, claro / oscuro, confirmaciones, toasts, estados de carga y error. **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`.

## shadcn/ui

- Inicializado con el **tema por defecto** (`components.json`: estilo `radix-nova`, base `neutral`, fuente Geist). Agregar componentes: `bunx --bun shadcn@latest add <componente>` desde `apps/web`.
- Los generados viven en `src/components/ui/` y **no se editan a mano salvo para ajustar estilo**. Excepción: `sonner.tsx` usa `theme="system"` en vez de `next-themes` (no hay toggle de tema).
- `cn` (paquete `cn`, reemplazo de `clsx` + `tailwind-merge`) para combinar clases.
- El `tsconfig.json` de la web (el que solo tiene `references`) repite el alias `@/*`: sin eso, el CLI de shadcn escribe en una carpeta `@/` literal.
- La regla de lint `react-refresh/only-export-components` está apagada solo para `src/components/ui/**` (generados).

## Tema: el diseño vive en `src/index.css`

- **Colores, radios y tipografía = variables del tema**: `:root` para claro y `@media (prefers-color-scheme: dark)` para oscuro. Cambiar el diseño = cambiar esas variables.
- **Nunca colores fijos** en las pantallas (`bg-neutral-900`, `text-white`…): usar los del tema — `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-input`, `bg-primary text-primary-foreground`, `text-destructive`. Excepción: los colores de los avatares de grupo.
- **Claro y oscuro siguen al sistema**: la variante `dark:` es `@media (prefers-color-scheme: dark)` (no `.dark`). `color-scheme` también, para que selects y fechas nativos sigan el tema.
- `index.html` no fija colores; `theme-color` (barra del navegador) tiene uno por esquema.

## Componentes base (`src/components/`)

| Para | Usar | Nunca |
|------|------|-------|
| Cargando | Skeletons con la forma de la pantalla (`skeletons.tsx`, sobre `Skeleton`) | Un spinner suelto |
| Error de una query | `<ErrorState message onRetry={() => query.refetch()} />` (mensaje de la API + **Reintentar**) | Un error técnico crudo |
| Confirmar algo destructivo | `useConfirm()` (`src/lib/use-confirm.ts` + `<ConfirmProvider>` en `main.tsx`): `if (await confirm({ title, description, confirmLabel, destructive }))` | `confirm()` del navegador |
| Avisar éxito o error de una acción | `toast()` / `toast.error()` de `sonner` (`<Toaster>` en `main.tsx`) | `alert()` |
| Campo numérico | `<NumberInput>` (ver `plata-y-fechas.md`) | `<input>` + `parseFloat` |
| Moneda y tipo de cambio | `<ExchangeRateFields>` + `useExchangeRate` | Repetir la lógica en cada form |

Falta (en `V1.md` → "Por hacer"): pasar inputs, selects y botones de las pantallas a `Input`, `Select`, `Button` de shadcn, y un botón con estado de carga, texto de monto y selector de participantes reutilizables.
