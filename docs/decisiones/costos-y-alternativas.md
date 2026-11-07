# Costos y alternativas: ¿app nativa, web app o Tricount?

Decisión: con qué front seguir y cuánto cuesta cada camino, frente a volver a **Tricount**. Investigado el 3/11/2026; los precios cambian, así que antes de pagar algo conviene confirmarlo en la página oficial (links al final).

**Estado: decidido → opción C**, web app nueva con React + Vite (`apps/web`). **Web y API en Railway** (el front iba a ir a Vercel; se cambió el 7/11/2026, ver "Hosting de la web: Railway en vez de Vercel"). `apps/mobile` (Expo) queda como alternativa nativa por si algún día se hace.

---

## TL;DR

- **Web app mobile-first (PWA):** se usa desde el navegador en el celu y en la compu; en el iPhone se "instala" agregándola a la pantalla de inicio. **Sin cuenta de Apple ni stores.** ~**USD 5/mes** (web y API en Railway + Supabase Free).
- **App nativa:** ~**USD 13/mes** (Railway + cuenta de Apple), más mantenimiento (builds de TestFlight que vencen, SDKs de Expo).
- **Tricount:** gratis, sin publicidad y sin límites, y ya funciona. Lo que no tiene es lo nuestro: dólar blue automático, deudas en USD, alias para cobrar, filtros con totales.
- **Hoy Supabase está en Pro (~USD 35/mes):** con cualquier opción hay que bajarlo a Free.
- **Pagar desde la app sin comisiones no es posible:** ver `mercado-pago.md`.

---

## Las opciones

| | **A. App nativa (Expo)** | **B. Web app con el mismo código Expo** | **C. Web app nueva (React + Vite)** — recomendada | **D. Volver a Tricount** |
|---|---|---|---|---|
| Qué es | App instalada (TestFlight en iPhone, APK en Android) | El mismo proyecto Expo compilado para web (`react-native-web`, ya está en el template) | App web pensada desde cero para el celu y la compu, con el stack que el grupo ya conoce (React + Vite + Tailwind/shadcn) | — |
| Celular | ✅ Nativa | ⚠️ Web en la pantalla de inicio | ⚠️ Web en la pantalla de inicio | ✅ |
| Compu | ❌ | ⚠️ Funciona, pero se ve "de celu estirado" | ✅ Pensada para las dos | ✅ Web |
| Costo fijo (sin impuestos) | ~USD 13/mes | ~USD 5/mes | ~USD 5/mes | USD 0 |
| Cuenta de Apple / stores | Obligatoria en iPhone | No | No | — |
| Updates | EAS Update (OTA); builds de TestFlight que vencen a los 90 días | Al deployar, todos tienen la última | Al deployar, todos tienen la última | — |
| Reutiliza lo hecho | Todo | Todo | Todo menos `apps/mobile` (hoy casi vacío: template + cliente tRPC + tests) | Nada |
| Volver a nativa después | — | ✅ Mismo código | ❌ Habría que hacer la app nativa aparte | — |
| Tests de UI | Jest + Maestro | Jest + Playwright | Vitest + Testing Library + Playwright | — |

### Por qué recomiendo C sobre B
- El objetivo es **celu + compu**. React Native en web sirve, pero en pantallas grandes y con teclado/mouse queda por debajo de una web hecha para eso.
- El grupo ya conoce el stack y el ecosistema web es mucho más grande.
- Lo único que se pierde es "volver a nativa sin reescribir". Si algún día se quiere app nativa, la API y las reglas no cambian: solo se hace otro front.
- B tiene sentido solo si estamos bastante seguros de que vamos a querer la app nativa en las stores.

---

## Cómo sería la web app (opción C)

- **Front:** React + Vite + TypeScript, mobile-first, Tailwind + shadcn/ui, **PWA** (manifest + íconos para "Agregar a inicio", se abre como app a pantalla completa).
- **Datos:** igual que hoy → tRPC + TanStack Query contra la API, tipos de punta a punta, schemas Zod compartidos (`@kachingga/api/schemas`).
- **Login:** Supabase Auth con email + password desde el front, igual que la decisión actual.
- **Hosting — elegido por el grupo:**
  - **Web y API en Railway**, cada una como un servicio: la API es un proceso Bun siempre prendido y la web un server estático chico de Bun (USD 5/mes del plan Hobby, que incluye USD 5 de uso).
  - Dos entornos, staging y prod, con dominio propio (`kachingga.com`).
  - **Supabase Free** (prod + dev).
- **Alternativa gratis (si algún día hace falta): web y API en Vercel**, la API como *funciones*. Total USD 0, pero se pierde:
  - **Arranque en frío:** la API no está siempre prendida; el primer pedido después de un rato tarda más.
  - **Límite de tiempo por pedido** (hasta 5 minutos en Hobby): puede molestar con el agente de IA (V2).
  - **Conexiones a la base más delicadas:** cada función abre las suyas; hay que usar siempre el pooler de Supabase.
  - **Nada en segundo plano:** sin tareas programadas ni cachés en memoria (ej. la del dólar blue).
  - **Logs cortos** (1 hora en Hobby) y menos control del entorno.
  - Hay que adaptar la API (hoy está pensada como servidor Bun).
  - Además, Vercel Hobby es **solo para uso personal, no comercial**.
- **Qué se pierde frente a nativa:** en iPhone la instalación es manual (Safari → Compartir → "Agregar a inicio"); las notificaciones push en iPhone funcionan solo si está agregada a la pantalla de inicio (iOS 16.4+) y con menos opciones; sin haptics ni algunos componentes nativos.
- **Cambios en el repo si se elige:** reemplazar `apps/mobile` por `apps/web`, cambiar el CI (Playwright en vez de Maestro, sin EAS Update ni Expo doctor) y reescribir `apps/mobile/CLAUDE.md` como `apps/web/CLAUDE.md`. Las reglas de negocio, `V1.md` y la API no cambian.

### Hosting de la web: Railway en vez de Vercel (decidido el 7/11/2026)
- **Por qué:** menos servicios (un solo proyecto, dashboard y factura), **la web y la API se deployan juntas** y esperando el CI (Vercel no espera al CI: la web podía salir aunque fallara y quedar desfasada de la API), y es el mismo setup que Galo ya maneja en otro proyecto. Con dominio propio queda `kachingga.com` / `api.kachingga.com`.
- **Qué se pierde:** los *previews* por PR de Vercel (en Railway habría que armar entornos por PR, que cuestan uso; se prueba en local con `bun run dev:celu` y en staging) y su CDN (Railway sirve desde una región: solo pesa en la primera carga, porque después la PWA guarda la app en el celu).
- **Costo:** el servicio `web` es un contenedor más que suma un poco de uso al plan Hobby (estimado: centavos a ~USD 1/mes; medirlo después del primer mes).

---

## Costos

Precios en USD; a todo lo que se paga con tarjeta argentina en dólares se le suman impuestos (abajo).

| Servicio | Para qué | Plan | Costo | ¿Hace falta? |
|----------|----------|------|-------|--------------|
| **Railway** | Web + API (staging y prod) | Hobby | **USD 5/mes** (incluye USD 5 de uso) — estimado por Galo: **~ARS 10.000/mes** con impuestos | ✅ En todas las opciones (el plan Free da USD 1/mes de uso: no alcanza para tenerla prendida todo el mes) |
| **Supabase** | Base de datos + login | Free (hasta 2 proyectos: prod + dev) | **USD 0** — pero **se pausa tras 1 semana sin uso** (la app deja de andar hasta reactivarlo) | ✅ Free alcanza |
| **Supabase hoy** | — | **Pro** (org `kachingga`) | **USD 25/mes + USD 10/mes** por el segundo proyecto = **USD 35/mes** | ❌ Pasarla a Free |
| **Apple Developer** | App nativa en iPhone (TestFlight) | Individual | **USD 99/año** (~USD 8,25/mes) | Solo app nativa (Expo Go sirve solo para desarrollar) |
| **Google Play** | Publicar en Android | — | **USD 25** (una vez) | Solo para publicar (entre nosotros alcanza el APK) |
| **Expo / EAS** | Builds y updates OTA | Free | **USD 0**: 15 builds Android + 15 iOS, 1.000 usuarios/mes de updates | Solo app nativa |
| **Dominio** `kachingga.com` | URL fija de la web (la PWA instalada queda atada al dominio) | Cloudflare Registrar | **~USD 10–11/año** (precio de costo) | ✅ Antes de invitar al grupo |
| **GitHub** | Repo y CI | Free | **USD 0** (repo público: Actions sin costo) | ✅ |
| **Agente de IA (V2)** | Preguntas en lenguaje natural | API de Claude | **~USD 1/mes** con Haiku 5.5 (~300 preguntas/mes); ~USD 22/mes con Sonnet 5.5 | Cuando exista la V2 |

### Totales (sin impuestos)

| Escenario | USD/mes | Por persona (5) |
|-----------|---------|-----------------|
| **Web app** (Railway + Supabase Free + dominio ~USD 1/mes) | **~6** | ~1,20 |
| Web app con todo en Vercel | 0 | 0 |
| App nativa entre nosotros (Railway + Apple + Supabase Free) | ~13,25 | ~2,65 |
| **Como está hoy** (Supabase Pro + lo anterior) | +35 | — |
| App publicada en las stores (estimado: Supabase Pro para que no se pause, Google Play, mail, dominio) | ~40+ | — |

### Impuestos al pagar con tarjeta en dólares (Argentina, 2026)
- **IVA 21%** sobre servicios digitales del exterior (RG 4240): se paga igual con pesos o con dólares propios.
- **Ingresos Brutos** provincial: ~2% en CABA y Buenos Aires (varía por provincia).
- **Percepción 30%** a cuenta de Ganancias / Bienes Personales: **recuperable** si no pagás esos impuestos; no aplica si pagás el resumen con dólares propios.
- El Impuesto PAIS ya no rige (venció en diciembre de 2024).

---

## Otros contras (no son plata)

- **Tiempo:** falta toda la UI (pantallas, login) y la hace una persona (Juan). Tricount ya está terminado.
- **Mantenimiento:** actualizar dependencias y, si es nativa, SDKs de Expo y requisitos de Apple/Google.
- **TestFlight vence (solo nativa):** cada build dura **90 días**; hay que subir uno nuevo al menos cada 3 meses.
- **Pausas del plan gratis de Supabase:** si nadie la usa una semana, la app deja de andar hasta reactivarla desde el dashboard.
- **Responsabilidad:** los datos del grupo dependen de nuestro código, backups y seguridad.
- **Un solo pagador:** las cuentas (Railway, Apple) quedan a nombre de una persona.
- **Publicarla** suma requisitos legales y de las stores (`lanzamiento.md` → "Fase 2").

---

## Qué la haría mejor que Tricount (en Argentina)

| Feature | Estado | Costo |
|---------|--------|-------|
| **Dólar blue promedio automático** (editable) al cargar gastos en USD | ✅ API hecha | Gratis (DolarApi) |
| **"Mantener en USD"**: deudas en dólares separadas de las de pesos | ✅ API hecha | — |
| **Alias / CVU para cobrar** (de la cuenta y por grupo): "Pagale $7.775 a Tuke — alias `tuke.mp` [Copiar alias] [Copiar monto]" | ✅ API hecha | Gratis, sin comisiones |
| **Filtros combinables + totales** ("¿cuánto gasté en noviembre?", "mis gastos", "lo que pagó Román") | ✅ API hecha | — |
| **Explicación de un saldo** ("¿por qué le debo $15.000 a Juan?"), sin IA | V2 (adelantable a V1) | Gratis |
| **Agente de IA** que responde preguntas libres usando los datos y filtros | V2 | ~USD 1/mes con Haiku |
| Celu **y** compu | Con la web app | — |

### Otras apps
| App | Costo | Notas |
|-----|-------|-------|
| **Tricount** | Gratis, sin publicidad ni límites (según varias fuentes; hoy es de bunq) | Lo que ya usamos |
| **Splitwise** | Gratis con publicidad y **3–4 gastos por día**; Pro ~USD 40–50/año | El límite diario lo hace incómodo en un viaje |

---

## Fuentes

- Railway: [planes](https://docs.railway.com/reference/pricing/plans)
- Vercel Hobby: [plan y límites](https://vercel.com/docs/plans/hobby) · Hono en Vercel: [guía](https://hono.dev/docs/getting-started/vercel)
- Supabase: [precios](https://supabase.com/pricing) · [facturación y proyectos gratis](https://supabase.com/docs/guides/platform/billing-on-supabase)
- Expo / EAS: [precios](https://expo.dev/pricing)
- Claude: precios oficiales de la API (Haiku 5.5: USD 0,10 / 0,50 por millón de tokens de entrada / salida; Sonnet 5.5: USD 2 / 10)
- PWA en iPhone (no oficiales): [MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) · [MobiLoud](https://www.mobiloud.com/blog/progressive-web-apps-ios) · [webscraft](https://webscraft.org/blog/pwa-pushspovischennya-na-ios-u-2026-scho-realno-pratsyuye?lang=en)
- Impuestos: [nacho.com.ar (RG 4240)](https://nacho.com.ar/iva-netflix-cobraran-el-impuesto-a-los-usuarios-de-servicios-digitales/) · [global66](https://www.global66.com/blog/como-afectan-los-impuestos-a-tus-gastos-digitales/) · [economis.com.ar](https://economis.com.ar/desde-2026-pagar-con-tarjeta-en-dolares-cuesta-menos-tras-el-fin-del-impuesto-pais/)
- Tricount / Splitwise (blogs comparativos): [app-partly](https://app-partly.web.app/en/blog/splitwise-vs-tricount-vs-partly-2026/) · [endlesstravelplans](https://www.endlesstravelplans.com/guides/family-dynamics/family-trip-cost-splitting-2026)
- Mercado Pago: ver `mercado-pago.md`
