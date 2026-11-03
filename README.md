# Kachingga

App mobile para dividir gastos en grupo: viajes, departamentos compartidos, salidas con amigos. Cargás quién pagó qué, la app calcula cuánto debe cada uno y te dice cómo quedar a mano con la menor cantidad de transferencias.

Proyecto de [Kachingga](https://github.com/kachingga), una organización de amigos, para uso propio del grupo.

## Features

### Grupos y gastos
- Crear grupos y sumar participantes (sin necesidad de que todos tengan cuenta).
- Cargar gastos indicando quién pagó y entre quiénes se divide.
- División en partes iguales, por monto o por porcentaje.
- Saldos por persona y sugerencia de transferencias mínimas para saldar deudas.
- Soporte multimoneda.

### Filtros
- Por participante (quién pagó / a quién le corresponde).
- Por categoría (comida, transporte, alojamiento, etc.).
- Por rango de fechas.
- Por rango de montos.
- Búsqueda por texto en la descripción.
- Filtros combinables y guardables.

### Integración con Mercado Pago (v2)
- Saldar deudas desde la app con Mercado Pago.
- Generar un link de pago o un QR por el monto exacto que se debe.
- Marcar la deuda como saldada automáticamente cuando se confirma el pago.
- Opción de saldar manualmente si el pago se hizo por fuera.

### Agente de gastos (v3)
Un asistente con IA integrado en cada grupo que responde preguntas sobre los gastos en lenguaje natural:
- "¿Por qué le debo $15.000 a Juan?"
- "¿En qué gastamos más en el viaje?"
- "¿Cuánto puse yo en comida esta semana?"

El agente explica cómo se llegó a cada saldo, desglosando los gastos que lo componen.

## Stack

> Stack inicial, puede cambiar a medida que avance el proyecto.

| Capa | Tecnología |
|------|------------|
| Mobile | React Native (Expo), distribuida con EAS Build + EAS Update |
| Backend | TypeScript con Hono y Bun, hosteado en Railway |
| API | tRPC (tipado de punta a punta entre app y backend) |
| Base de datos | PostgreSQL en Supabase con Prisma |
| Auth | Supabase Auth (email + password) |
| Agente | API de LLM con tool calling sobre los datos del grupo |
| Pagos | SDK / API de Mercado Pago |

## Onboarding (para cada miembro)

### 1. Accesos

Pedir invitación a:
- Org de GitHub `kachingga`
- Org de Supabase `kachingga` (proyectos `kachingga-dev` para desarrollo y `kachingga` para producción)
- Proyecto de Railway
- Org de Expo `kachingga`

### 2. Herramientas

- [Bun](https://bun.sh)
- Git con SSH configurado para GitHub
- [Claude Code](https://claude.com/claude-code)

### 3. Instalación

El repo es un monorepo: la app mobile está en `apps/mobile`.

```bash
git clone git@github.com:kachingga/kachingga.git
cd kachingga
bun install                              # instala dependencias y activa los hooks (husky)
cd apps/mobile && bunx eas-cli login     # login en Expo (una vez)
cd ../.. && bun run mobile               # levanta la app
```

### 4. Armar los `.env` (dev)

Para desarrollar solo hacen falta los de **dev** (proyecto `kachingga-dev`). El `.env.prod` lo necesita únicamente quien vaya a migrar producción.

```bash
cp apps/api/.env.sample apps/api/.env
cp apps/mobile/.env.sample apps/mobile/.env
```

Los samples ya traen el ref, el host y las URLs de dev. Solo hay que completar:

| Variable | Archivo | De dónde sale |
|----------|---------|---------------|
| `<DB_PASSWORD>` (en `DATABASE_URL` y `DIRECT_URL`) | `apps/api/.env` | **Pedírsela a Galo** (por privado o gestor de contraseñas). Supabase **no la muestra** en el dashboard |
| `SUPABASE_SECRET_KEY` | `apps/api/.env` | Supabase → `kachingga-dev` → Project Settings → API Keys → Secret key (o `supabase projects api-keys --project-ref nraoqdaplvvsakvtlcam --reveal`) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `apps/mobile/.env` | Supabase → `kachingga-dev` → Project Settings → API Keys → Publishable key |

> ⚠️ **Nunca resetear la contraseña de la base** desde el dashboard: deja sin conexión a todos los demás (y, en prod, a Railway). Si se perdió, avisar al grupo antes.

Después: `bun run dev` levanta la API y la app juntas, y te registrás en la app (cada base tiene sus propios usuarios).

Cada commit corre automáticamente typecheck, tests y lint (`bun run check`) y valida el formato del mensaje.

**`main` está protegido:** se trabaja en una branch y se entra por Pull Request, que se mergea con squash cuando el CI pasa. Detalle en [`CLAUDE.md`](CLAUDE.md) → "Flujo de trabajo".

> **¿Tenías cambios locales de antes de este setup?** Commitealos en una branch y seguí "Trabajo en paralelo y conflictos" en [`CLAUDE.md`](CLAUDE.md) para traer `main` sin romper nada (o pedile a Claude que lo haga: ya conoce esas reglas).

### 5. Claude Code

Abrir `claude` desde la **raíz del repo**. Todo el contexto se carga solo y es igual para todos:

- `CLAUDE.md` — **reglas de negocio** (cómo funcionan grupos, gastos, monedas, saldos) y reglas del repo (commits, conflictos)
- `.claude/CLAUDE.md` — guías de comportamiento
- `apps/api/CLAUDE.md` y `apps/mobile/CLAUDE.md` — **lo técnico** de cada proyecto (modelo de datos, procedures, Expo, decisiones de implementación)
- `.claude/settings.json` — config compartida (plugin de Expo). Aceptar cuando Claude pregunte si confiar en la carpeta / instalar el plugin

Lo personal **no se commitea**: configuración propia en `.claude/settings.local.json` y notas propias en `CLAUDE.local.md` (ambos gitignoreados). Si algo debería aplicar a todos, va en `CLAUDE.md` o `.claude/settings.json` vía PR.

## Roadmap

- **v1** — grupos, gastos, saldos, filtros y multimoneda. Ver [`V1.md`](V1.md).
- **v2** — integración con Mercado Pago. Ver [`V2.md`](V2.md).
- **v3** — agente de gastos con IA. Ver [`V3.md`](V3.md).

Infra y deploy: [`INFRA.md`](INFRA.md), [`DEPLOY.md`](DEPLOY.md), [`IMPROVEMENTS.md`](IMPROVEMENTS.md).

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/) (`feat(api): ...`, `chore: ...`). `bun install` activa los hooks de husky: uno rechaza mensajes que no cumplen el formato y otro corre typecheck, tests y lint antes de cada commit. Detalle en [`CLAUDE.md`](CLAUDE.md).

## Autores

- [Kachingga](https://github.com/kachingga)
