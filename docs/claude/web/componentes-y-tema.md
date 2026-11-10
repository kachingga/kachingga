# Componentes y tema (shadcn/ui) — web

> **Aplica a:** `src/index.css`, `src/components/` (incluido `src/components/ui/`), `apps/web/components.json`, colores, claro / oscuro, confirmaciones, toasts, estados de carga y error, el marco de las pantallas (`AppShell`). **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`.

## Diseño: paleta "yerba y durazno" (nov 2026)

Sale de un diseño hecho en Lovable que eligió Galo (#37), con una **segunda iteración "con más onda"** (#84: el último commit del proyecto de Lovable). En las dos **no se copió el proyecto** (usaba otro router y datos falsos): se llevaron el tema, las tipografías, el layout, los componentes y las animaciones a nuestras pantallas.

- **Colores:** verde profundo de confianza (`primary`) + durazno cálido (`highlight`), fondo crema. Claro en `:root` y oscuro en `.dark`, en `src/index.css`.
- **Tokens propios** además de los de shadcn: `positive` / `positive-soft` (te deben), `negative` / `negative-soft` (debés), `highlight` / `highlight-foreground` (acento durazno: avisos, detalles, el punto de "Kachingga." y la selección de texto), `google` / `google-foreground` / `google-border` (botón de Google), `primary-deep` (el borde de abajo del botón principal), `ledge` (el borde "sticker" de las tarjetas) y el texto de cada estado de "Tu situación": `hero-foreground` / `owe-foreground` / `even-foreground`.
- **Sombras:** `shadow-sticker` (tarjetas: un borde plano abajo, como una calcomanía), `shadow-ledge` / `shadow-ledge-pressed` (botón principal: se hunde al tocarlo), `shadow-lift` (lo que flota: botón "Agregar gasto", menús) y `shadow-soft` (queda para lo que no es tarjeta).
- **"Tu situación" con 3 estados** (`MySituation` en `routes/groups/detail.tsx`): degradé verde `bg-hero` (te deben), durazno `bg-owe` (debés, con "Registrar pago") y lima `bg-even` (al día). Cada uno con su color de texto (arriba).
- **Colores de categorías** (#84): 12 colores vivos y distintos — tomate, mandarina, mango, lima, menta, turquesa, cielo, índigo, uva, frambuesa, rosa y cacao (`tomato` … `cocoa`, `categoryColors` en la API). Cada uno es un par de tokens `--cat-<color>` (el ícono) y `--cat-<color>-soft` (su fondo), definidos en claro y oscuro con contraste AA entre ellos (≥4.8:1 en claro, ≥7.4:1 en oscuro). Las 8 por defecto tienen un color cada una (comida mandarina, súper lima, transporte cielo, alojamiento índigo, salidas frambuesa, compras uva, servicios mango, otros cacao). Para sumar un color: los dos tokens en `:root` y `.dark` + `@theme`, `categoryColors` en la API, `CATEGORY_COLORS` en `src/lib/categories.ts` y su nombre en el editor.
- **Tipografías self-hosted** (`@fontsource-variable/*`, andan offline con la PWA): **Manrope** para el texto (`font-sans`) y **Bricolage Grotesque** para títulos y montos grandes (`font-display`; los `h1`–`h3` ya la usan).
- **Utilidades** (`@utility` en `index.css`): `bg-hero` / `bg-owe` / `bg-even` (los degradés de "Tu situación"; `bg-hero` también en el código de invitación), `coin-pattern` (la moneda partida de nuestro logo repetida de fondo en el login: una máscara que toma el color del texto, con opacidad baja), `tabular` (números de ancho fijo en montos), `press` (se achica al tocar y rebota un poco al soltar), `rise` (entra subiendo), `pop-in` (lo recién agregado cae con un destello verde) y las de zonas seguras del iPhone: `pb-safe`, `pt-safe`, `bottom-safe`.
- **"Reducir movimiento"** del sistema apaga **todas** las animaciones y transiciones (regla global en `index.css`, además de las de pantallas, `rise` y `pop-in`). Una animación nueva no necesita nada más.
- **Radios:** `--radius` 1rem; tarjetas, íconos de categoría y chips de categoría `rounded-lg`, botones y chips de opciones `rounded-full`, campos `rounded-xl`.
- **Personalidad, con tono claro** (lo que eligió Galo en Lovable): saludo "¡Hola, {nombre}!" en Mis grupos (el nombre de la cuenta de Google; con email, "¡Hola!"), "Cuentas claras. Amistades intactas." en el login y la barra lateral, y estados vacíos con ícono. Sin chistes forzados ni emojis en los textos.

## shadcn/ui

- Inicializado con estilo `radix-nova` (`components.json`); el estilo de los componentes se ajustó al diseño (`button`: pastilla, `h-11`, sombra; `input`: `h-11`, `rounded-xl`, `bg-card`, texto de 16 px para que Safari no haga zoom). Agregar componentes: `bunx --bun shadcn@latest add <componente>` desde `apps/web`.
- Los generados viven en `src/components/ui/` y **no se editan a mano salvo para ajustar estilo**. Excepción: `sonner.tsx` toma el tema de `useTheme()` (`src/lib/theme.ts`) en vez de `next-themes`.
- Hoy hay: `button`, `input`, `label`, `skeleton`, `alert-dialog`, `sonner` y uno propio, `native-select`. Los `<select>` y las fechas siguen siendo **nativos** (en el celu abren el selector del sistema, que es lo mejor): `<NativeSelect>` (`src/components/ui/native-select.tsx`) tiene el mismo estilo que `Input`, y las fechas son `<Input type="date">`.
- **Todas las pantallas usan estos componentes**, no `<button>` / `<input>` / `<label>` con clases a mano. Excepciones a propósito: las superficies que se tocan enteras (la tarjeta de un grupo con sus acciones de deslizar, los links de gastos) y los selectores de categoría y de colores de la app (`CategoryPicker`, `CategoryEditor`, el de "Mi cuenta": grupos de opciones con rol de radio).
- `cn` (paquete `cn`, reemplazo de `clsx` + `tailwind-merge`) para combinar clases.
- El `tsconfig.json` de la web (el que solo tiene `references`) repite el alias `@/*`: sin eso, el CLI de shadcn escribe en una carpeta `@/` literal.
- La regla de lint `react-refresh/only-export-components` está apagada solo para `src/components/ui/**` (generados).

## Tema: claro, oscuro, el toggle y las paletas

- **Colores, radios y tipografía = variables del tema** en `src/index.css`. Cambiar el diseño = cambiar esas variables.
- **Nunca colores fijos** en las pantallas (`bg-neutral-900`, `text-white`, `text-green-600`…): usar los del tema (`bg-card`, `text-muted-foreground`, `text-positive`, `bg-negative-soft`…). Única excepción: los colores de marca del logo de Google (`google-sign-in.tsx`, comentado). El captcha (Turnstile) es un iframe de Cloudflare: no toma nuestros colores, solo claro u oscuro según el tema (`useCaptcha`).
- **Oscuro por clase:** la variante `dark:` es `.dark` en `<html>`. Por defecto sigue al sistema; el **toggle** (luna / sol, en la barra lateral, el header del celu y el login) guarda la elección en el dispositivo (`localStorage` `kachingga-theme`, con try/catch). Lógica en `src/lib/theme.ts` (`useTheme`, `setTheme`).
- **Paletas de colores** (como Slack): **Verde** (la de siempre, por defecto), **Azul**, **Violeta**, **Amarillo** y **Blanco y negro**. Se eligen en **Mi cuenta → "Colores de la app"** y se guardan **en el dispositivo**, como el toggle (`localStorage` `kachingga-palette`; `PALETTES`, `usePalette`, `setPalette` en `src/lib/theme.ts`). Las lee el CSS por `data-palette` en `<html>`.
  - **Qué cambia** (bloques "Palettes" de `index.css`, uno claro y uno oscuro por paleta): el tono de superficies y textos (`--hue-surface`, `--hue-text`; `--tint` = cuánto color tienen, 0 en blanco y negro), el color principal (`primary`, `primary-deep`, `ring`, `accent`), el degradé de "te deben" / código de invitación (`bg-hero`) y los colores del **logo** (`--logo-bg`, `--logo-a`, `--logo-b`). Los saldos (verde / terracota), "al día" (lima), "debés" (durazno) y los colores de categorías y personas **no cambian**: significan algo.
  - **Texto en el color principal:** `text-primary-ink`, nunca `text-primary` (en amarillo el principal es un amarillo claro con texto oscuro encima, y como texto no se lee; `--primary-ink` es un ámbar oscuro ahí y el mismo `primary` en las demás).
  - **El logo** de la app es `<LogoMark>` (`app-shell.tsx`): el mismo dibujo que `public/logo.svg` pero en SVG con los colores de la paleta. Los íconos de la app (pantalla de inicio, favicon) salen de `public/logo.svg` al buildear y **quedan verdes** en todas las paletas.
  - **Para sumar una:** un bloque claro (`[data-palette='x']`) y uno oscuro (`.dark[data-palette='x'], .dark [data-palette='x']`) como los otros en `index.css`, el id en `PALETTES` (`theme.ts`) y en `public/theme.js`. `src/lib/__tests__/palettes.test.ts` verifica que todas definan los mismos colores.
  - El selector previsualiza cada paleta poniendo `data-palette` en cada opción (los bloques también aplican a cualquier elemento: el logo y el borde de la opción toman sus colores).
- **Sin flash al abrir:** un script mínimo, `public/theme.js` (cargado sin `defer` en el `<head>` de `index.html`; es un archivo y no inline por la CSP, ver `servidor-y-headers.md`), pone `.dark` y `data-palette` antes del primer pintado con la misma lógica y las mismas claves que `theme.ts` (mantenerlos iguales; lo verifica `theme.test.ts`). `color-scheme` va con el tema para que selects y fechas nativos lo sigan; `theme-color` (barra del navegador) tiene uno por esquema.

## Marco de las pantallas

- **`AppShell`** (`src/components/app-shell.tsx`, ruta padre de todo lo logueado en `src/router.tsx`): en compu (`lg`) barra lateral con el logo, la frase, "Mis grupos", "Mi cuenta", "Salir" y el toggle; en el celu un header fijo arriba con el logo, "Mi cuenta" y el toggle. Adentro va la pantalla animada (`AnimatedLayout`). El logo (`Logo` / `Wordmark`) es `public/logo.svg` (el mismo de los íconos de la PWA) + "Kachingga." con el punto durazno.
- **Login, registro y recuperar la contraseña** van sin marco, con `AuthLayout` (`src/components/auth-layout.tsx`): fondo crema con monedas (`coin-pattern`), la marca (el `h1`) y el formulario, uno al lado del otro en compu y uno arriba del otro en el celu. "Continuar con Google" va primero y después "o con tu email".
- **Ancho de cada pantalla:** `<Page>` (`src/components/kit.tsx`): angosta por defecto (formularios, listas: `max-w-2xl`) y `wide` (`max-w-6xl`) para el grupo y filtros, que en compu van en **dos columnas** (saldos o filtros a un costado, gastos al lado).
- **Botón flotante** ("Agregar gasto") solo en el celu, con `bottom-safe`; en compu va en el título de la columna de gastos.

## Componentes base (`src/components/`)

| Para | Usar | Nunca |
|------|------|-------|
| Superficie de contenido | `<Card>` (`kit.tsx`): `rounded-lg`, borde, `shadow-sticker` | Un `div` con estilos repetidos |
| Ícono de una categoría | `<CategoryIcon icon color>` (`kit.tsx`) con el `icon` y `color` que trae la categoría de la API. Los nombres se traducen en `src/lib/categories.ts`: ícono → componente de lucide, color → clases del tema (`CATEGORY_COLORS`, fondo suave + color, siempre variables del tema). Si se suma un ícono o color a la API (`categoryIcons` / `categoryColors`), sumarlo ahí | Emojis, íconos sueltos o colores hex |
| Elegir una categoría (formulario de gasto) | `<CategoryPicker>` (`components/category-picker.tsx`): chips del color de cada categoría con ícono y nombre (la elegida, rellena de su color: `CATEGORY_COLORS_STRONG`), como grupo de opciones (`radio`) | Un `<select>` (no muestra íconos) |
| Crear o editar una categoría | `<CategoryEditor>` (`components/category-editor.tsx`): nombre, ícono y color, todos con nombre accesible | — |
| Inicial de una persona o grupo | `<Avatar id name>` (`kit.tsx`): cada uno con su color, uno de los mismos 12 de las categorías elegido por su `id` (`colorForId` en `src/lib/categories.ts`: misma persona, mismo color en todas las pantallas) | Colores fijos por nombre |
| Quiénes están en un grupo | `<AvatarStack people>` (`kit.tsx`): hasta 5 caritas superpuestas y "+N" (decorativo: al lado va "N participantes") | — |
| Un monto grande (saldo, gasto, transferencia) | `<Money cents currency>` (`kit.tsx`): tipografía de títulos, con los centavos más chicos (`formatCentsParts`) | Partir el texto a mano |
| Nada para mostrar todavía | `<EmptyState icon title description>` (`kit.tsx`), con la acción para empezar como `children` | Un texto suelto o un emoji |
| Mi saldo ("Te deben" / "Debés" / "Estás al día") | `<MyBalance cents currency>` (`kit.tsx`: verde / terracota / gris, en un solo texto) | Armar el texto y el color en cada pantalla |
| Título de pantalla con "volver" y acciones | `<PageHeader>` (`kit.tsx`; también pone el título de la pestaña) | — |
| Cargando | Skeletons con la forma de la pantalla (`skeletons.tsx`, sobre `Skeleton`) | Un spinner suelto |
| Error de una query | `<ErrorState message onRetry={() => query.refetch()} />` (mensaje de la API + **Reintentar**) | Un error técnico crudo |
| Confirmar algo destructivo | `useConfirm()` (`src/lib/use-confirm.ts` + `<ConfirmProvider>` en `main.tsx`): `if (await confirm({ title, description, confirmLabel, destructive }))`. `description` es texto o JSX si necesita más (ej. la lista de saldos de "Borrar mi cuenta") | `confirm()` del navegador |
| Avisar éxito o error de una acción | `toast()` / `toast.error()` de `sonner` (`<Toaster>` en `main.tsx`) | `alert()` |
| Botón | `<Button>` (`src/components/ui/button.tsx`; todos rebotan al tocar con `press`). Variantes: `default` (acción principal, con borde de abajo que se hunde al tocarlo), `outline` (secundaria), `secondary`, `soft` (confirmar algo chico en línea, ej. "OK"), `ghost` (acciones de texto o de solo ícono, ítems de menú), `destructive` (borrar, quitar), `link`, `google` (solo "Continuar con Google"). Tamaños `default` / `sm` / `xs` / `lg` e `icon*` (los de solo ícono **siempre** con `aria-label`). **`loading`**: deshabilita y marca `aria-busy`; el texto lo pone la pantalla ("Guardando…") | `<button>` con clases a mano |
| Campo de texto | `<Input>` (`src/components/ui/input.tsx`); fechas, `<Input type="date">` | `<input>` con clases a mano |
| Elegir de una lista (participante, moneda) | `<NativeSelect>` (`src/components/ui/native-select.tsx`): `<select>` nativo con el estilo de `Input` | Un dropdown propio (en el celu es peor que el del sistema) |
| Etiqueta + campo | `<Field label htmlFor>` (`kit.tsx`, usa `Label`); `small` para formularios densos (filtros) | `<label>` + `<div>` con márgenes a mano |
| Elegir una opción entre pocas (dividir, convertir/mantener, blue/oficial, categorías en filtros) | `<Chip active>` (`kit.tsx`, con `aria-pressed`) dentro de un `role="group"` con etiqueta | Botones con estilos condicionales a mano |
| Campo numérico | `<NumberInput>` (ver `plata-y-fechas.md`): ya es un `Input` por dentro | `<input>` + `parseFloat` |
| Moneda y tipo de cambio | `<ExchangeRateFields>` + `useExchangeRate` | Repetir la lógica en cada form |
| Cerrar sesión (también después de borrar la cuenta) | `useSignOut()` (`src/lib/use-sign-out.ts`: borra la cache offline y la de memoria) | `signOut()` suelto |

Falta: selector de participantes reutilizable (hoy cada pantalla resuelve el suyo).
