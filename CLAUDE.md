# Kachingga — App para dividir gastos en grupo

Referencia principal del proyecto. Antes de tocar lógica de dominio o agregar una feature, leé este archivo y el documento de la versión correspondiente. Los `CLAUDE.md` de cada workspace cubren solo detalles de implementación.

Proyecto de **Kachingga**, una organización de amigos (repo: `github.com/kachingga/kachingga`). Es para uso propio del grupo: cada uno tiene la app instalada en su teléfono y usa siempre la última versión.

---

## Mapa de documentos

| Archivo | Qué tiene |
|---------|-----------|
| `CLAUDE.md` | Este archivo: overview, stack, estructura, convenciones, reglas de commits |
| `.claude/CLAUDE.md` | Guías de comportamiento para Claude (pensar antes de codear, simplicidad, cambios quirúrgicos) |
| `V1.md` | Alcance de la v1: grupos, gastos, saldos, filtros, multimoneda. **Lo que se construye ahora** |
| `V2.md` | Alcance de la v2: agente de gastos con IA e integración con Mercado Pago. **No implementar hasta cerrar v1** |
| `INFRA.md` | Servicios, dashboards, variables de entorno, secretos |
| `DEPLOY.md` | Cómo deployar la API (Railway) y distribuir la app (EAS Build / EAS Update) |
| `IMPROVEMENTS.md` | Mejoras de infraestructura pendientes (CI, staging, backups) |
| `apps/mobile/CLAUDE.md` | Reglas de Expo / React Native para la app mobile |
| `apps/api/CLAUDE.md` | Reglas de la API Hono (crear junto con `apps/api`) |

> **Alcance:** si una tarea toca algo de `V2.md` (agente o Mercado Pago), frená y preguntá antes de implementarlo. Todo lo demás es v1.

---

## Idioma

- UI en **español**.
- Código (variables, funciones, tipos, comentarios) en **inglés**.
- Documentación del repo y mensajes de commit en español (el `type(scope)` va en inglés, ver abajo).

---

## Stack

| Capa | Tecnología |
|------|------------|
| Runtime / package manager | Bun (monorepo con workspaces) |
| Mobile | React Native con Expo (SDK 58) + Expo Router |
| Distribución mobile | EAS Build (instalación interna) + EAS Update (OTA) |
| Backend | Hono + TypeScript sobre Bun |
| Hosting backend | Railway |
| Base de datos | PostgreSQL en Supabase |
| ORM | Prisma |
| Auth | Supabase Auth — email + password |
| Agente (v2) | API de LLM con tool calling sobre los datos del grupo |
| Pagos (v2) | API de Mercado Pago |

---

## Auth

Login simple con **email + password** usando **Supabase Auth**.

- **App:** usa `@supabase/supabase-js` solo para auth (login, logout, sesión persistida y refresh del token). Con la clave **publishable** de Supabase (es pública, se puede embeber en la app).
- **API:** cada request lleva `Authorization: Bearer <access_token>`. Un middleware de Hono valida el token contra Supabase y deja el usuario en el contexto. Todas las rutas están protegidas salvo las que se marquen explícitamente como públicas.
- **Datos:** la app **nunca** lee ni escribe la base directo — todo pasa por la API. La API es la que decide qué grupos/gastos puede ver cada usuario.
- **Usuarios:** al ser un grupo de amigos, alcanza con signup por email + password (o crear los usuarios desde el dashboard de Supabase). Sin login social ni magic link en v1.
- La clave **secret** de Supabase (`sb_secret_...`) vive solo en Railway.

---

## Estructura del monorepo

```
kachingga/
├── .claude/CLAUDE.md        # guías de comportamiento
├── .githooks/commit-msg     # valida el formato de commits
├── apps/
│   ├── mobile/              # app Expo (ver apps/mobile/CLAUDE.md)
│   │   └── src/app/         # rutas de Expo Router
│   └── api/                 # API Hono — todavía no creada
├── CLAUDE.md
├── V1.md / V2.md
├── INFRA.md / DEPLOY.md / IMPROVEMENTS.md
└── package.json             # workspaces: apps/*
```

> **Dependencias:** nunca agregar paquetes al `package.json` raíz. Siempre `cd` al workspace y desde ahí `bun add` (en mobile: `bunx expo install <paquete>`).

---

## Comandos

```bash
bun install          # instala todo y activa los git hooks (.githooks)
bun run mobile       # levanta Expo (apps/mobile)
```

---

## Commits — formato obligatorio

Todos los commits usan [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope opcional>): <descripción en minúscula, sin punto final>
```

**Types permitidos:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `build`, `ci`, `revert`

**Scopes sugeridos:** `mobile`, `api`, `db`, `infra`, `deps`, `agent` (v2), `mp` (v2)

Ejemplos:
```
feat(api): agregar endpoint para crear grupos
fix(mobile): corregir cálculo de saldos con decimales
chore: actualizar bun.lock
docs: agregar V1.md y V2.md
refactor(api)!: cambiar formato de respuesta de gastos   # ! = breaking change
```

Reglas para Claude:
- **Nunca** crear un commit que no respete este formato. Si el usuario pide un mensaje que no lo cumple, adaptarlo y avisar.
- Un commit = un cambio lógico. No mezclar `feat` con `chore` no relacionado.
- El hook `.githooks/commit-msg` rechaza mensajes inválidos — no usar `--no-verify` para saltearlo.
- Branches: `feat/<descripcion-corta>`, `fix/<descripcion-corta>`, `chore/<...>`. No commitear directo a `main` salvo que el usuario lo pida.

---

## Decisiones (antes de arrancar la v1)

- [x] Base de datos: PostgreSQL en Supabase.
- [x] Auth: Supabase Auth con email + password.
- [x] Nombre: `Kachingga` (slug/scheme `kachingga`, bundle id iOS y package Android `com.kachingga.app`).
- [x] ORM: Prisma.

Cuando se decida algo, actualizar esta sección, la tabla de stack y `INFRA.md`.
