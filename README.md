# Kachingga

App (web, mobile-first) para dividir gastos en grupo: viajes, departamentos compartidos, salidas con amigos. Cargás quién pagó qué, la app calcula cuánto debe cada uno y te dice cómo quedar a mano con la menor cantidad de transferencias.

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

### Agente de gastos (v2)
Un asistente con IA integrado en cada grupo que responde preguntas sobre los gastos en lenguaje natural:
- "¿Por qué le debo $15.000 a Juan?"
- "¿En qué gastamos más en el viaje?"
- "¿Cuánto puse yo en comida esta semana?"

El agente explica cómo se llegó a cada saldo, desglosando los gastos que lo componen.

## Stack

> Stack inicial, puede cambiar a medida que avance el proyecto.

| Capa | Tecnología |
|------|------------|
| Web (front principal) | React + Vite + Tailwind, mobile-first, en Vercel |
| Mobile (alternativa nativa) | React Native (Expo) |
| Backend | TypeScript con Hono y Bun, hosteado en Railway |
| API | tRPC (tipado de punta a punta entre app y backend) |
| Base de datos | PostgreSQL en Supabase con Prisma |
| Auth | Supabase Auth (email + password) |
| Agente | API de LLM con tool calling sobre los datos del grupo |

## Onboarding (para cada miembro)

### 1. Accesos

Pedir invitación a:
- Org de GitHub `kachingga`
- Org de Supabase `kachingga` (proyectos `kachingga-dev` para desarrollo y `kachingga` para producción)
- Proyecto de Railway
- Org de Expo `kachingga` (solo si se trabaja en la app nativa)
- Proyecto de Vercel (cuando se deploye la web)

### 2. Herramientas

- [Bun](https://bun.sh)
- Git con SSH configurado para GitHub
- [Claude Code](https://claude.com/claude-code)

### 3. Instalación

El repo es un monorepo: la API está en `apps/api`, el front web (el principal) en `apps/web` y la app nativa (alternativa) en `apps/mobile`.

```bash
git clone git@github.com:kachingga/kachingga.git
cd kachingga
bun install                              # instala dependencias y activa los hooks (husky)
bun run api                              # API en :3000 (en otra terminal:)
bun run web                              # web en http://localhost:5173
bun run dev:celu                         # API + web, con la web visible desde el celu (misma Wi-Fi)
```

Solo si vas a tocar la app nativa: `cd apps/mobile && bunx eas-cli login` (una vez) y `bun run mobile`.

### 4. Armar los `.env` (dev)

Para desarrollar solo hacen falta los de **dev** (proyecto `kachingga-dev`). El `.env.prod` lo necesita únicamente quien vaya a migrar producción.

```bash
cp apps/api/.env.sample apps/api/.env
cp apps/web/.env.sample apps/web/.env
cp apps/mobile/.env.sample apps/mobile/.env   # solo si vas a tocar la app nativa
```

Los samples ya traen el ref, el host y las URLs de dev. Solo hay que completar:

| Variable | Archivo | De dónde sale |
|----------|---------|---------------|
| `<DB_PASSWORD>` (en `DATABASE_URL` y `DIRECT_URL`) | `apps/api/.env` | **Pedírsela a Galo** (por privado o gestor de contraseñas). Supabase **no la muestra** en el dashboard |
| `SUPABASE_SECRET_KEY` | `apps/api/.env` | Supabase → `kachingga-dev` → Project Settings → API Keys → Secret key (o `supabase projects api-keys --project-ref nraoqdaplvvsakvtlcam --reveal`) |
| `SEED_USER_PASSWORD` | `apps/api/.env` | **Pedírsela a Galo**. Es la contraseña de los usuarios de prueba (`juan.demo@example.com`, etc.) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en mobile) | `apps/web/.env` (y `apps/mobile/.env`) | Supabase → `kachingga-dev` → Project Settings → API Keys → Publishable key |

> ⚠️ **Nunca resetear la contraseña de la base** desde el dashboard: deja sin conexión a todos los demás (y, en prod, a Railway). Si se perdió, avisar al grupo antes.

Después: `bun run api` + `bun run web` (o `bun run dev`, que levanta las dos). Para entrar con datos ya cargados: **`juan.demo@example.com`** con la contraseña de `SEED_USER_PASSWORD`. Si los datos de prueba se rompieron, `bun run --cwd apps/api db:seed` los vuelve a crear (ver `apps/api/CLAUDE.md` → "Datos de prueba"). También te podés registrar con tu mail (cada base tiene sus propios usuarios).

Cada commit corre automáticamente typecheck, tests y lint (`bun run check`) y valida el formato del mensaje.

**`main` está protegido:** se trabaja en una branch y se entra por Pull Request, que se mergea con squash cuando el CI pasa. Detalle en [`CLAUDE.md`](CLAUDE.md) → "Flujo de trabajo".

> **¿Tenías cambios locales de antes de este setup?** Commitealos en una branch y seguí "Trabajo en paralelo y conflictos" en [`CLAUDE.md`](CLAUDE.md) para traer `main` sin romper nada (o pedile a Claude que lo haga: ya conoce esas reglas).

### 5. Claude Code

Abrir `claude` desde la **raíz del repo**. Todo el contexto se carga solo y es igual para todos (qué hay en cada archivo: ver "Documentación" más abajo):

- `CLAUDE.md` — **reglas de negocio** (cómo funcionan grupos, gastos, monedas, saldos) y reglas del repo (commits, conflictos)
- `.claude/CLAUDE.md` — guías de comportamiento
- `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md` y `apps/mobile/CLAUDE.md` — **lo técnico** de cada proyecto (modelo de datos, procedures, front, decisiones de implementación)
- `.claude/settings.json` — config compartida (plugin de Expo). Aceptar cuando Claude pregunte si confiar en la carpeta / instalar el plugin

Lo personal **no se commitea**: configuración propia en `.claude/settings.local.json` y notas propias en `CLAUDE.local.md` (ambos gitignoreados). Si algo debería aplicar a todos, va en `CLAUDE.md` o `.claude/settings.json` vía PR.

## Roadmap

- **v1** — grupos, gastos, saldos, filtros, multimoneda y alias para cobrar. Ver [`V1.md`](V1.md).
- **v2** — explicación de saldos y agente de gastos con IA. Ver [`V2.md`](V2.md).
- Lo que falta (lanzamiento, infraestructura, propuestas): [issues de GitHub](https://github.com/kachingga/kachingga/issues), por milestone ([Fase 1 — Privada](https://github.com/kachingga/kachingga/milestone/1)). Contexto de las fases: [`docs/decisiones/lanzamiento.md`](docs/decisiones/lanzamiento.md).

## Documentación

El repo está documentado para que **cualquier persona y el Claude de cada uno trabajen igual sin preguntar**: las reglas, decisiones y pendientes están escritos, y cada cosa vive en **un solo lugar**.

### Qué hay en cada archivo (y qué tiene que haber)

| Archivo | Qué tiene que haber | Qué **no** va ahí |
|---------|---------------------|-------------------|
| [`README.md`](README.md) | Qué es la app, onboarding (accesos, setup, `.env`) y esta guía de documentación | Reglas de negocio o detalles técnicos |
| [`CLAUDE.md`](CLAUDE.md) | **Reglas de negocio y decisiones de producto** (grupos, gastos, monedas, saldos, pagos, alias, filtros) y reglas de todo el repo: stack, arquitectura, comandos, commits, PRs, conflictos, cuándo una tarea está terminada | Detalles de una app (van en su `CLAUDE.md`), pendientes, investigaciones |
| [`.claude/CLAUDE.md`](.claude/CLAUDE.md) | Cómo se comporta Claude: pensar antes de codear, simplicidad, cambios quirúrgicos, cuestionar y dar opciones | Nada del proyecto |
| [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) | Todo lo técnico de la API: modelo de datos, **tabla de procedures**, dónde vive cada regla en el código, migraciones, notas técnicas, tests | Reglas de negocio (se referencian, no se copian) |
| [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) | Todo lo técnico del front web (el principal): cómo usar la API, login, estándar de UI/UX, React, testing, deploy | Ídem |
| [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) | Todo lo técnico de la app nativa (alternativa): cómo usar la API, estándar de UI/UX, React, testing, EAS, notas técnicas | Ídem |
| [`V1.md`](V1.md) / [`V2.md`](V2.md) | Alcance de cada versión: qué entra, qué no, **pantallas** y roadmap con checkboxes | Cómo se implementa |
| [`INFRA.md`](INFRA.md) | Qué servicios existen (Supabase, Railway, Expo, GitHub…), entornos dev/prod, **todas las variables de entorno y secretos** (nombres, nunca valores) | Pasos de deploy |
| [`DEPLOY.md`](DEPLOY.md) | **Cómo** se hace cada cosa: deploy de la API, migraciones en prod, builds, updates | Inventario de servicios |
| [Issues de GitHub](https://github.com/kachingga/kachingga/issues) (no es un archivo) | **Todo lo pendiente**: tareas, bugs, propuestas y decisiones a tomar, con labels y milestones ("Fase 1 — Privada", "Fase 2 — Pública"). Cómo usarlos: `CLAUDE.md` → "Issues, labels y milestones" | Alcance de una versión (va en `V1.md`), conocimiento investigado (va en `docs/decisiones/`) |
| [`docs/decisiones/`](docs/decisiones/) | Decisiones investigadas, con fuentes y fecha: [`costos-y-alternativas.md`](docs/decisiones/costos-y-alternativas.md) (costos, web app vs. nativa vs. Tricount), [`mercado-pago.md`](docs/decisiones/mercado-pago.md) (qué se puede y qué no), [`lanzamiento.md`](docs/decisiones/lanzamiento.md) (fases y requisitos para lanzar) | Tareas pendientes (van en issues) |
| `.env.sample` de cada app | Qué variables hacen falta y de dónde sale cada valor | Valores reales |
| `.github/pull_request_template.md` | El checklist de cada PR | — |

### Cómo leerlos

- **Al empezar en el repo:** este README (onboarding) → `CLAUDE.md` → el `CLAUDE.md` de la app en la que vas a trabajar.
- **Antes de cualquier feature:** "Reglas de negocio" de `CLAUDE.md` y el alcance en `V1.md`.
- **Para una tarea puntual:** la tabla "Dónde buscar según la tarea" de `CLAUDE.md` dice qué leer.
- **Claude** carga `CLAUDE.md`, `.claude/CLAUDE.md` y el `CLAUDE.md` de la app automáticamente; el resto lo lee cuando la tarea lo pide.

### Cómo actualizarlos (personas y Claude)

**Cada PR deja la documentación al día con lo que cambia.** Está en la "Definition of Done" de `CLAUDE.md` y en el checklist de la plantilla de PR.

| Si cambia… | Se actualiza… |
|------------|---------------|
| Una regla de negocio (cómo funciona algo para el usuario) | `CLAUDE.md` → "Reglas de negocio" |
| Un procedure, el modelo de datos o algo técnico de la API | `apps/api/CLAUDE.md` (tabla de procedures, modelo, notas) |
| Algo técnico del front | `apps/web/CLAUDE.md` (o `apps/mobile/CLAUDE.md` si es la app nativa) |
| El alcance o una pantalla | `V1.md` / `V2.md` (y se tilda el roadmap al terminar) |
| Un servicio, una variable de entorno o un secreto | `INFRA.md` + el `.env.sample` que corresponda |
| Cómo se deploya o se migra | `DEPLOY.md` |
| Algo pendiente (tarea, bug, infra, lanzamiento) o una propuesta / decisión a tomar | Un issue de GitHub, con su label y milestone según `CLAUDE.md` → "Issues, labels y milestones". Al terminarlo: `Closes #N` en el PR |
| Una decisión que requirió investigar (costos, alternativas, proveedores) | Un archivo en `docs/decisiones/` con fecha y fuentes |
| Una convención del repo (commits, PRs, tooling) | `CLAUDE.md` |

Reglas:
- **Un dato vive en un solo lugar.** Si algo ya está escrito en otro archivo, se linkea en vez de copiarlo.
- **Lo que se termina cierra su issue**; lo que se decide queda escrito con el porqué (en el issue y, si cambia una regla o convención, en el doc que corresponde), para no volver a discutirlo.
- **Si el código contradice la documentación**, se avisa y se corrige uno de los dos en el mismo PR.
- No crear archivos de documentación nuevos en la raíz sin necesidad: primero ver si entra en alguno de los de arriba.

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/) (`feat(api): ...`, `chore: ...`). `bun install` activa los hooks de husky: uno rechaza mensajes que no cumplen el formato y otro corre typecheck, tests y lint antes de cada commit. Detalle en [`CLAUDE.md`](CLAUDE.md).

## Autores

- [Kachingga](https://github.com/kachingga)
