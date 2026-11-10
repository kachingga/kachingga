# Componentes y tema (shadcn/ui) — web

> **Aplica a:** `src/index.css`, `src/components/` (incluido `src/components/ui/`), `apps/web/components.json`, colores, claro / oscuro, confirmaciones, toasts, estados de carga y error, el marco de las pantallas (`AppShell`). **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`.

## Diseño: paleta "yerba y durazno" (nov 2026)

Sale de un diseño hecho en Lovable que eligió Galo (#37): **no se copió el proyecto** (usaba otro router y datos falsos), se llevaron el tema, las tipografías, el layout y el estilo de los componentes a nuestras pantallas.

- **Colores:** verde profundo de confianza (`primary`) + durazno cálido (`highlight`), fondo crema. Claro en `:root` y oscuro en `.dark`, en `src/index.css`.
- **Tokens propios** además de los de shadcn: `positive` / `positive-soft` (te deben), `negative` / `negative-soft` (debés), `highlight` / `highlight-foreground` (acento durazno: avisos, detalles), `google` / `google-foreground` / `google-border` (botón de Google), sombras `shadow-soft` (tarjetas) y `shadow-lift` (lo que flota o se destaca).
- **Colores de categorías** (#84): 12 colores vivos y distintos — tomate, mandarina, mango, lima, menta, turquesa, cielo, índigo, uva, frambuesa, rosa y cacao (`tomato` … `cocoa`, `categoryColors` en la API). Cada uno es un par de tokens `--cat-<color>` (el ícono) y `--cat-<color>-soft` (su fondo), definidos en claro y oscuro con contraste AA entre ellos (≥4.8:1 en claro, ≥7.4:1 en oscuro). Las 8 por defecto tienen un color cada una (comida mandarina, súper lima, transporte cielo, alojamiento índigo, salidas frambuesa, compras uva, servicios mango, otros cacao). Para sumar un color: los dos tokens en `:root` y `.dark` + `@theme`, `categoryColors` en la API, `CATEGORY_COLORS` en `src/lib/categories.ts` y su nombre en el editor.
- **Tipografías self-hosted** (`@fontsource-variable/*`, andan offline con la PWA): **Manrope** para el texto (`font-sans`) y **Bricolage Grotesque** para títulos y montos grandes (`font-display`; los `h1`–`h3` ya la usan).
- **Utilidades** (`@utility` en `index.css`): `bg-hero` (degradé verde de "Tu situación" y del login), `tabular` (números de ancho fijo en montos), `press` (se achica apenas al tocar), `rise` (entra subiendo; apagada con "reducir movimiento"), y las de zonas seguras del iPhone: `pb-safe`, `pt-safe`, `bottom-safe`.
- **Radios:** `--radius` 1rem; tarjetas `rounded-2xl`, botones y chips `rounded-full`, campos `rounded-xl`.

## shadcn/ui

- Inicializado con estilo `radix-nova` (`components.json`); el estilo de los componentes se ajustó al diseño (`button`: pastilla, `h-11`, sombra; `input`: `h-11`, `rounded-xl`, `bg-card`, texto de 16 px para que Safari no haga zoom). Agregar componentes: `bunx --bun shadcn@latest add <componente>` desde `apps/web`.
- Los generados viven en `src/components/ui/` y **no se editan a mano salvo para ajustar estilo**. Excepción: `sonner.tsx` toma el tema de `useTheme()` (`src/lib/theme.ts`) en vez de `next-themes`.
- Hoy hay: `button`, `input`, `label`, `skeleton`, `alert-dialog`, `sonner` y uno propio, `native-select`. Los `<select>` y las fechas siguen siendo **nativos** (en el celu abren el selector del sistema, que es lo mejor): `<NativeSelect>` (`src/components/ui/native-select.tsx`) tiene el mismo estilo que `Input`, y las fechas son `<Input type="date">`.
- **Todas las pantallas usan estos componentes**, no `<button>` / `<input>` / `<label>` con clases a mano. Excepciones a propósito: las superficies que se tocan enteras (la tarjeta de un grupo con sus acciones de deslizar, los links de gastos) y los selectores de categoría (`CategoryPicker`, `CategoryEditor`: grupos de opciones con rol de radio).
- `cn` (paquete `cn`, reemplazo de `clsx` + `tailwind-merge`) para combinar clases.
- El `tsconfig.json` de la web (el que solo tiene `references`) repite el alias `@/*`: sin eso, el CLI de shadcn escribe en una carpeta `@/` literal.
- La regla de lint `react-refresh/only-export-components` está apagada solo para `src/components/ui/**` (generados).

## Tema: claro, oscuro y el toggle

- **Colores, radios y tipografía = variables del tema** en `src/index.css`. Cambiar el diseño = cambiar esas variables.
- **Nunca colores fijos** en las pantallas (`bg-neutral-900`, `text-white`, `text-green-600`…): usar los del tema (`bg-card`, `text-muted-foreground`, `text-positive`, `bg-negative-soft`…). Única excepción: los colores de marca del logo de Google (`google-sign-in.tsx`, comentado).
- **Oscuro por clase:** la variante `dark:` es `.dark` en `<html>`. Por defecto sigue al sistema; el **toggle** (luna / sol, en la barra lateral, el header del celu y el login) guarda la elección en el dispositivo (`localStorage` `kachingga-theme`, con try/catch). Lógica en `src/lib/theme.ts` (`useTheme`, `setTheme`).
- **Sin flash al abrir:** un script mínimo en `index.html` pone `.dark` antes del primer pintado con la misma lógica y la misma clave que `theme.ts` (mantenerlos iguales). `color-scheme` va con el tema para que selects y fechas nativos lo sigan; `theme-color` (barra del navegador) tiene uno por esquema.

## Marco de las pantallas

- **`AppShell`** (`src/components/app-shell.tsx`, ruta padre de todo lo logueado en `src/router.tsx`): en compu (`lg`) barra lateral con el logo, "Mis grupos", "Mi cuenta", "Salir" y el toggle; en el celu un header fijo arriba con el logo, "Mi cuenta" y el toggle. Adentro va la pantalla animada (`AnimatedLayout`). El logo es `public/logo.svg` (el mismo de los íconos de la PWA).
- **Login y registro** van sin marco, con `AuthLayout` (`src/components/auth-layout.tsx`): en compu, panel verde (`bg-hero`) a la izquierda y el formulario a la derecha.
- **Ancho de cada pantalla:** `<Page>` (`src/components/kit.tsx`): angosta por defecto (formularios, listas: `max-w-2xl`) y `wide` (`max-w-6xl`) para el grupo y filtros, que en compu van en **dos columnas** (saldos o filtros a un costado, gastos al lado).
- **Botón flotante** ("Agregar gasto") solo en el celu, con `bottom-safe`; en compu va en el título de la columna de gastos.

## Componentes base (`src/components/`)

| Para | Usar | Nunca |
|------|------|-------|
| Superficie de contenido | `<Card>` (`kit.tsx`): `rounded-2xl`, borde, `shadow-soft` | Un `div` con estilos repetidos |
| Ícono de una categoría | `<CategoryIcon icon color>` (`kit.tsx`) con el `icon` y `color` que trae la categoría de la API. Los nombres se traducen en `src/lib/categories.ts`: ícono → componente de lucide, color → clases del tema (`CATEGORY_COLORS`, fondo suave + color, siempre variables del tema). Si se suma un ícono o color a la API (`categoryIcons` / `categoryColors`), sumarlo ahí | Emojis, íconos sueltos o colores hex |
| Elegir una categoría (formulario de gasto) | `<CategoryPicker>` (`components/category-picker.tsx`): grupo de opciones con ícono, color y nombre | Un `<select>` (no muestra íconos) |
| Crear o editar una categoría | `<CategoryEditor>` (`components/category-editor.tsx`): nombre, ícono y color, todos con nombre accesible | — |
| Inicial de una persona o grupo | `<Avatar name>` (`kit.tsx`, colores del tema) | Colores fijos por nombre |
| Mi saldo ("Te deben" / "Debés" / "Estás al día") | `<MyBalance cents currency>` (`kit.tsx`: verde / terracota / gris, en un solo texto) | Armar el texto y el color en cada pantalla |
| Título de pantalla con "volver" y acciones | `<PageHeader>` (`kit.tsx`) | — |
| Cargando | Skeletons con la forma de la pantalla (`skeletons.tsx`, sobre `Skeleton`) | Un spinner suelto |
| Error de una query | `<ErrorState message onRetry={() => query.refetch()} />` (mensaje de la API + **Reintentar**) | Un error técnico crudo |
| Confirmar algo destructivo | `useConfirm()` (`src/lib/use-confirm.ts` + `<ConfirmProvider>` en `main.tsx`): `if (await confirm({ title, description, confirmLabel, destructive }))` | `confirm()` del navegador |
| Avisar éxito o error de una acción | `toast()` / `toast.error()` de `sonner` (`<Toaster>` en `main.tsx`) | `alert()` |
| Botón | `<Button>` (`src/components/ui/button.tsx`). Variantes: `default` (acción principal), `outline` (secundaria), `secondary`, `soft` (confirmar algo chico en línea, ej. "OK"), `ghost` (acciones de texto o de solo ícono, ítems de menú), `destructive` (borrar, quitar), `link`, `google` (solo "Continuar con Google"). Tamaños `default` / `sm` / `xs` / `lg` e `icon*` (los de solo ícono **siempre** con `aria-label`). **`loading`**: deshabilita y marca `aria-busy`; el texto lo pone la pantalla ("Guardando…") | `<button>` con clases a mano |
| Campo de texto | `<Input>` (`src/components/ui/input.tsx`); fechas, `<Input type="date">` | `<input>` con clases a mano |
| Elegir de una lista (participante, moneda) | `<NativeSelect>` (`src/components/ui/native-select.tsx`): `<select>` nativo con el estilo de `Input` | Un dropdown propio (en el celu es peor que el del sistema) |
| Etiqueta + campo | `<Field label htmlFor>` (`kit.tsx`, usa `Label`); `small` para formularios densos (filtros) | `<label>` + `<div>` con márgenes a mano |
| Elegir una opción entre pocas (dividir, convertir/mantener, blue/oficial, categorías en filtros) | `<Chip active>` (`kit.tsx`, con `aria-pressed`) dentro de un `role="group"` con etiqueta | Botones con estilos condicionales a mano |
| Campo numérico | `<NumberInput>` (ver `plata-y-fechas.md`): ya es un `Input` por dentro | `<input>` + `parseFloat` |
| Moneda y tipo de cambio | `<ExchangeRateFields>` + `useExchangeRate` | Repetir la lógica en cada form |
| Cerrar sesión | `useSignOut()` (`src/lib/use-sign-out.ts`: borra la cache offline y la de memoria) | `signOut()` suelto |

Falta: texto de monto y selector de participantes reutilizables (hoy cada pantalla resuelve el suyo).
