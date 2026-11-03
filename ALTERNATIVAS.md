# Alternativas: ¿app nativa, web app o Tricount?

Complementa `CONTRAS.md` (costos y límites). Acá están los caminos posibles y qué cambia en cada uno. Investigado el 3/11/2026.

---

## TL;DR

- **Web app mobile-first (PWA)**: se usa desde el navegador en el celu y en la compu, y en el iPhone se "instala" agregándola a la pantalla de inicio. **Sin cuenta de Apple, sin stores y se puede hostear gratis** (Vercel + Supabase Free). Es la opción que mejor encaja con lo que queremos.
- **No hay que tirar casi nada**: la API (Hono + tRPC + Prisma), las reglas de negocio, los tests de la API, el CI y la base quedan igual. Lo que cambia es `apps/mobile` → una app web, y hoy esa carpeta es casi solo el template de Expo.
- Para ser **mejor que Tricount en Argentina**: dólar blue automático, "mantener en USD", **alias de cada uno cargado en el grupo** (pagar = copiar alias y monto, sin comisiones), filtros con totales, explicación de cada saldo y, más adelante, el agente de IA (~USD 1/mes con un modelo chico).

---

## Las opciones

| | **A. App nativa (Expo)** — lo planeado | **B. Web app con el mismo código Expo** | **C. Web app nueva (React + Vite)** — recomendada | **D. Volver a Tricount** |
|---|---|---|---|---|
| Qué es | App instalada (TestFlight en iPhone, APK en Android) | El mismo proyecto Expo compilado para web (`react-native-web`, ya está en el template) | App web pensada desde cero para el celu y la compu, como el front de dear-cred | — |
| Celular | ✅ Nativa | ⚠️ Web en la pantalla de inicio | ⚠️ Web en la pantalla de inicio | ✅ |
| Compu | ❌ | ⚠️ Funciona, pero los componentes de React Native en web se ven "de celu estirado" | ✅ Pensada para las dos | ✅ Web |
| Costo fijo | ~USD 13/mes (Railway + Apple) | **~USD 0** (ver abajo) | **~USD 0** | USD 0 |
| Cuenta de Apple / stores | Obligatoria en iPhone | No | No | — |
| Updates | EAS Update (OTA) / builds que vencen a los 90 días en TestFlight | Al deployar, todos tienen la última | Al deployar, todos tienen la última | — |
| Reutiliza lo hecho | Todo | Todo | Todo menos `apps/mobile` (hoy casi vacío: template + cliente tRPC + tests) | Nada |
| Volver a nativa después | — | ✅ Mismo código | ❌ Habría que hacer la app nativa aparte | — |
| Tests de UI | Jest + Maestro | Jest + Playwright | **Vitest + Testing Library + Playwright** (lo que se pensó al principio) | — |

### Por qué recomiendo C sobre B
- El objetivo pasó a ser **celu + compu**. React Native en web sirve, pero en pantallas grandes y con teclado/mouse queda por debajo de una web hecha para eso.
- El grupo ya conoce el stack (React + Vite + Tailwind/shadcn de dear-cred) y el ecosistema web es mucho más grande.
- Lo único que se pierde es "volver a nativa sin reescribir". Si algún día se quiere app nativa, la API y las reglas no cambian: solo se hace otro front.
- B tiene sentido solo si estamos bastante seguros de que en el futuro vamos a querer la app nativa en las stores.

---

## Cómo sería la web app (opción C)

- **Front**: React + Vite + TypeScript, mobile-first, Tailwind + shadcn/ui, **PWA** (manifest + íconos para "Agregar a inicio", se abre como app a pantalla completa).
- **Datos**: igual que hoy → tRPC + TanStack Query contra la API, tipos de punta a punta, schemas Zod compartidos (`@kachingga/api/schemas`).
- **Login**: Supabase Auth con email + password desde el front, igual que la decisión actual (sesión y refresh los maneja la librería).
- **Hosting gratis**:
  - **Front en Vercel** (Hobby, gratis).
  - **API en Vercel** como función (Hono se deploya en Vercel sin configuración especial; Hobby incluye 1.000.000 de invocaciones/mes) → **no hace falta Railway**.
  - **Supabase Free** (prod + dev).
  - Ojo: Vercel Hobby es **solo para uso personal, no comercial**. Si algún día la app cobra o es un negocio, hay que pasar a Pro (USD 20/usuario/mes) o volver a Railway.
- **Qué se pierde frente a nativa**:
  - En iPhone la instalación es manual (Safari → Compartir → "Agregar a inicio"), no hay App Store.
  - Notificaciones push en iPhone: funcionan solo si la app está agregada a la pantalla de inicio (iOS 16.4+) y con menos opciones que en Android.
  - Sin haptics ni algunos componentes nativos; nada de eso es central para esta app.
- **Cambios en el repo** (si se elige): reemplazar `apps/mobile` por `apps/web`, adaptar la API para correr en Vercel, cambiar CI (Playwright en vez de Maestro, sin EAS Update ni Expo doctor), y reescribir `apps/mobile/CLAUDE.md` como `apps/web/CLAUDE.md`. Las reglas de negocio, `V1.md` y la API no cambian.

---

## Qué la haría mejor que Tricount (en Argentina)

| Feature | Estado | Costo |
|---------|--------|-------|
| **Dólar blue promedio automático** (editable) al cargar gastos en USD | ✅ API hecha | Gratis (DolarApi) |
| **"Mantener en USD"**: deudas en dólares separadas de las de pesos | ✅ API hecha | — |
| **Alias / CVU de cada uno en el grupo**: en "cómo quedar a mano" se ve "Pagale $7.775 a Tuke — alias `tuke.mp` [Copiar alias] [Copiar monto]". Se transfiere desde Mercado Pago o el banco y se marca "ya pagué" | ❌ A agregar (campo en el participante + UI) | Gratis, sin comisiones |
| **Filtros combinables + totales** ("¿cuánto gasté en noviembre?", "mis gastos", "lo que pagó Román") | ✅ API hecha | — |
| **Explicación de un saldo** ("¿por qué le debo $15.000 a Juan?"): lista de los gastos y pagos entre las dos personas que suman ese número. Sale de los datos con filtros, **sin IA** | ❌ A agregar (un procedure + pantalla) | Gratis |
| **Agente de IA** que responde preguntas en lenguaje natural usando los datos y filtros | V3 | ~USD 1/mes con Claude Haiku 5.5 (estimado: 300 preguntas/mes, ~30k tokens de entrada y ~1,5k de salida por pregunta, a USD 0,10 / 0,50 por millón). Con Sonnet 5.5 serían ~USD 22/mes |
| Celu **y** compu | Con la web app | — |

> La "explicación de un saldo" resuelve sin IA y gratis la mayoría de las preguntas tipo "¿por qué le debo tanto?". El agente queda para preguntas libres ("¿en qué gastamos más en el viaje?").

---

## Costos por opción (sin impuestos)

| Opción | Fijo | Variable |
|--------|------|----------|
| A. Nativa | ~USD 13/mes (Railway USD 5 + Apple USD 99/año) | — |
| B / C. Web app | **USD 0** (Vercel Hobby + Supabase Free) | Agente de IA ~USD 1/mes cuando exista (V3) |
| D. Tricount | USD 0 | — |

> Con cualquier opción hay que bajar la org `kachingga` de Supabase de Pro a Free (hoy cuesta ~USD 35/mes, ver `CONTRAS.md`).

---

## Si se elige la web app: próximos pasos

1. Decidir entre B y C (recomendado: C).
2. Agregar a las reglas de negocio y a la API: **alias/CVU por participante** y **explicación de saldo** (son de la V1, sirven para cualquier front).
3. Reemplazar `apps/mobile` por `apps/web` y adaptar CI, docs y la API para Vercel.
4. Actualizar `LANZAMIENTO.md`: la Fase 1 pasa a ser "deploy en Vercel + que cada uno la agregue a la pantalla de inicio", sin Apple ni Railway.

## Fuentes

- Vercel Hobby: [plan y límites](https://vercel.com/docs/plans/hobby) (gratis, uso personal no comercial)
- Hono en Vercel: [guía](https://hono.dev/docs/getting-started/vercel)
- PWA en iPhone (fuentes no oficiales): [MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) · [MobiLoud](https://www.mobiloud.com/blog/progressive-web-apps-ios) · [webscraft (push en 2026)](https://webscraft.org/blog/pwa-pushspovischennya-na-ios-u-2026-scho-realno-pratsyuye?lang=en)
- Precios de Claude: precios oficiales de la API (Haiku 5.5: USD 0,10 / 0,50 por millón de tokens de entrada / salida; Sonnet 5.5: USD 2 / 10)
- Costos del resto: ver `CONTRAS.md`
