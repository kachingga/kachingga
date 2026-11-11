# Kachingga

App (web, mobile-first) para dividir gastos en grupo: viajes, departamentos compartidos, salidas con amigos. Cargás quién pagó qué, la app calcula cuánto debe cada uno y te dice cómo quedar a mano con la menor cantidad de transferencias.

Proyecto de [Kachingga](https://github.com/kachingga), una organización de amigos. Nació para usarla entre nosotros y hoy cualquiera puede crear su cuenta en [app.kachingga.com](https://app.kachingga.com).

**[kachingga.com](https://kachingga.com)** · [Entrar a la app](https://app.kachingga.com) · [Privacidad](https://kachingga.com/privacidad) · [Términos](https://kachingga.com/terminos) · [hola@kachingga.com](mailto:hola@kachingga.com) · [Licencia](LICENSE) · [Seguridad](https://kachingga.com/seguridad)

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
| Web | React + Vite + Tailwind, mobile-first, en Railway |
| Backend | TypeScript con Hono y Bun, hosteado en Railway |
| API | tRPC (tipado de punta a punta entre app y backend) |
| Base de datos | PostgreSQL en Supabase con Prisma |
| Auth | Supabase Auth (email + password y Google) |
| Agente | API de LLM con tool calling sobre los datos del grupo |

## Onboarding (para cada miembro)

### 1. Accesos

Pedir invitación a:
- Org de GitHub `kachingga`
- Org de Supabase `kachingga` (proyectos `stg` para desarrollo y `prod` para producción)
- Proyecto de Railway `kachingga` (opcional: hoy lo maneja Galo)
- Org de Sentry `kachingga` (opcional: para ver los errores de la web y la API)

### 2. Herramientas

- [Bun](https://bun.sh)
- Git con SSH configurado para GitHub
- [Claude Code](https://claude.com/claude-code)

### 3. Instalación

El repo es un monorepo: la API está en `apps/api` y el front web en `apps/web`.

```bash
git clone git@github.com:kachingga/kachingga.git
cd kachingga
bun install                              # instala dependencias y activa los hooks (husky)
bun run api                              # API en :3000 (en otra terminal:)
bun run web                              # web en http://localhost:5173
bun run dev:celu                         # API + web, con la web visible desde el celu (misma Wi-Fi)
```

### 4. Armar los `.env` (dev)

Para desarrollar solo hacen falta los de **dev** (proyecto `stg`). El `.env.prod` lo necesita únicamente quien vaya a migrar producción.

```bash
cp apps/api/.env.sample apps/api/.env
cp apps/web/.env.sample apps/web/.env
```

Los samples ya traen el ref, el host y las URLs de dev. Solo hay que completar:

| Variable | Archivo | De dónde sale |
|----------|---------|---------------|
| `<DB_PASSWORD>` (en `DATABASE_URL` y `DIRECT_URL`) | `apps/api/.env` | **Pedírsela a Galo** (por privado o gestor de contraseñas). Supabase **no la muestra** en el dashboard |
| `SUPABASE_SECRET_KEY` | `apps/api/.env` | Supabase → `stg` → Project Settings → API Keys → Secret key (o `supabase projects api-keys --project-ref nraoqdaplvvsakvtlcam --reveal`) |
| `SEED_USER_PASSWORD` | `apps/api/.env` | **Pedírsela a Galo**. Es la contraseña de los usuarios de prueba (`juan.demo@example.com`, etc.) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `apps/web/.env` | Supabase → `stg` → Project Settings → API Keys → Publishable key |

> ⚠️ **Nunca resetear la contraseña de la base** desde el dashboard: deja sin conexión a todos los demás (y, en prod, a Railway). Si se perdió, avisar al grupo antes.

Después: `bun run api` + `bun run web` (o `bun run dev`, que levanta las dos). Para entrar con datos ya cargados: **`juan.demo@example.com`** con la contraseña de `SEED_USER_PASSWORD`. Si los datos de prueba se rompieron, `bun run --cwd apps/api db:seed` los vuelve a crear (ver `docs/claude/api/datos-de-prueba.md`). También te podés registrar con tu mail (cada base tiene sus propios usuarios).

Cada commit corre automáticamente typecheck, tests y lint (`bun run check`) y valida el formato del mensaje.

**`main` está protegido:** se trabaja en una branch y se entra por Pull Request, que se mergea con squash cuando el CI pasa. Detalle en [`CLAUDE.md`](CLAUDE.md) → "Branches y Pull Requests".

> **¿Tenías cambios locales de antes de este setup?** Commitealos en una branch y seguí "Trabajo en paralelo y conflictos" en [`CLAUDE.md`](CLAUDE.md) para traer `main` sin romper nada (o pedile a Claude que lo haga: ya conoce esas reglas).

### 5. Claude Code

Abrir `claude` desde la **raíz del repo**. Todo el contexto se carga solo y es igual para todos (qué hay en cada archivo: ver "Documentación" más abajo):

- `CLAUDE.md` — **reglas de negocio** (cómo funcionan grupos, gastos, monedas, saldos) y reglas del repo (commits, conflictos)
- `.claude/CLAUDE.md` — guías de comportamiento
- `apps/api/CLAUDE.md` y `apps/web/CLAUDE.md` — **lo técnico** de cada proyecto (modelo de datos, procedures, front, decisiones de implementación)
- `.claude/settings.json` — config compartida (formatea con Prettier al editar). Aceptar cuando Claude pregunte si confiar en la carpeta

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
| [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) | Lo técnico de la API que vale **siempre**: reglas cortas, checklist de seguridad por procedure, migraciones, notas de "no romper", y el índice **"Antes de tocar… → leé…"** | Reglas de negocio (se referencian, no se copian); explicaciones largas (van en `docs/claude/api/`) |
| [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) | Lo técnico del front web que vale **siempre**: reglas cortas, lo que nunca se hace, comandos, env, y el índice **"Antes de tocar… → leé…"** | Ídem (explicaciones en `docs/claude/web/`) |
| [`V1.md`](V1.md) / [`V2.md`](V2.md) | Alcance de cada versión: qué entra, qué no, **pantallas** y roadmap con checkboxes | Cómo se implementa |
| [`INFRA.md`](INFRA.md) | Qué servicios existen (Supabase, Railway, Cloudflare, GitHub…), entornos dev/prod, **todas las variables de entorno y secretos** (nombres, nunca valores) | Pasos de deploy |
| [`DEPLOY.md`](DEPLOY.md) | **Cómo** se hace cada cosa: deploy de la web y la API, promover a prod, migraciones en prod | Inventario de servicios |
| [Issues de GitHub](https://github.com/kachingga/kachingga/issues) (no es un archivo) | **Todo lo pendiente**: tareas, bugs, propuestas y decisiones a tomar, con labels y milestones ("Fase 1 — Privada", "Fase 2 — Pública"). Cómo usarlos: [`docs/claude/repo/issues.md`](docs/claude/repo/issues.md) | Alcance de una versión (va en `V1.md`), conocimiento investigado (va en `docs/decisiones/`) |
| [`docs/claude/`](docs/claude/README.md) | **Cómo está hecha cada cosa por dentro**: explicaciones, ejemplos y el porqué (`repo/`: git, PRs, issues, tooling; `web/`: datos y cache, plata y fechas, componentes, transiciones, UI/UX, tests; `api/`: contrato, seguridad, tests, seed). Cada doc dice a qué aplica y se lee antes de tocar ese tema | Reglas que valen siempre (van en los `CLAUDE.md`), reglas de negocio, pendientes |
| [`docs/decisiones/`](docs/decisiones/) | Decisiones investigadas, con fuentes y fecha: [`costos-y-alternativas.md`](docs/decisiones/costos-y-alternativas.md) (costos, web app vs. nativa vs. Tricount), [`mercado-pago.md`](docs/decisiones/mercado-pago.md) (qué se puede y qué no), [`lanzamiento.md`](docs/decisiones/lanzamiento.md) (fases y requisitos para lanzar) | Tareas pendientes (van en issues) |
| `.env.sample` de cada app | Qué variables hacen falta y de dónde sale cada valor | Valores reales |
| `.github/pull_request_template.md` | El checklist de cada PR | — |

### Cómo leerlos

- **Al empezar en el repo:** este README (onboarding) → `CLAUDE.md` → el `CLAUDE.md` de la app en la que vas a trabajar.
- **Antes de cualquier feature:** "Reglas de negocio" de `CLAUDE.md` y el alcance en `V1.md`.
- **Para una tarea puntual:** la tabla "Dónde buscar según la tarea" de `CLAUDE.md` dice qué leer.
- **Antes de tocar un tema técnico:** el índice "Antes de tocar… → leé…" del `CLAUDE.md` de la app (o "Dónde buscar según la tarea" del raíz) dice qué doc de `docs/claude/` leer.
- **Claude** carga `CLAUDE.md`, `.claude/CLAUDE.md` y el `CLAUDE.md` de la app automáticamente (por eso son cortos); los docs de `docs/claude/` los lee cuando la tarea toca su tema.

### Cómo actualizarlos (personas y Claude)

**Cada PR deja la documentación al día con lo que cambia.** Está en la "Definition of Done" de `CLAUDE.md` y en el checklist de la plantilla de PR.

| Si cambia… | Se actualiza… |
|------------|---------------|
| Una regla de negocio (cómo funciona algo para el usuario) | `CLAUDE.md` → "Reglas de negocio" |
| Un procedure o el modelo de datos | `docs/claude/api/contrato.md` |
| Cómo funciona algo técnico (web o API) | Su doc en `docs/claude/` (el índice "Antes de tocar…" del `CLAUDE.md` de la app dice cuál). Si es una regla que no se puede romper, además una línea en ese `CLAUDE.md`. Doc nuevo → linkearlo desde el índice (si no, `bun run check` falla). |
| El alcance o una pantalla | `V1.md` / `V2.md` (y se tilda el roadmap al terminar) |
| Un servicio, una variable de entorno o un secreto | `INFRA.md` + el `.env.sample` que corresponda |
| Cómo se deploya o se migra | `DEPLOY.md` |
| Algo pendiente (tarea, bug, infra, lanzamiento) o una propuesta / decisión a tomar | Un issue de GitHub, con su label y milestone según [`docs/claude/repo/issues.md`](docs/claude/repo/issues.md). Al terminarlo: `Closes #N` en el PR |
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
