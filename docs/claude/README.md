# docs/claude — cómo funciona cada cosa por dentro

Los `CLAUDE.md` (raíz, `.claude/` y de cada app) se cargan **en cada sesión de Claude**: tienen solo lo que hace falta en cualquier tarea (reglas, lo que nunca se hace, comandos) y un índice **"Antes de tocar… → leé…"**. Las explicaciones largas, los ejemplos de código y el porqué de cada decisión viven acá, y se leen **solo cuando la tarea toca ese tema**. Sirven igual para una persona.

## Reglas

- **Cada doc arranca con a qué aplica** (archivos, APIs, tareas) y está linkeado desde el índice del `CLAUDE.md` que corresponde, con un disparador concreto ("antes de tocar X"), no un "más info en…".
- **Lo que no se puede romper queda también como una línea en el `CLAUDE.md`** (ej. "fechas: siempre los helpers de `format.ts`"). Acá va el cómo y el porqué.
- **Si cambiás cómo funciona algo que describe un doc, actualizalo en el mismo PR.** Si un doc dice algo que el código no hace, se corrige uno de los dos y se avisa.
- **Un dato vive en un solo lugar:** reglas de negocio en el `CLAUDE.md` raíz, alcance en `V1.md`, pendientes en issues, investigaciones en `docs/decisiones/`. Acá solo lo técnico de cómo está hecho.
- **Chequeo automático** (`bun run docs:check`, parte de `bun run check`): falla si un doc menciona un archivo del repo que no existe (se movió o se renombró) o si un doc de esta carpeta no está linkeado desde ningún `CLAUDE.md`. Implementación: `scripts/check-docs.ts`.

## Qué hay

| Carpeta | De qué |
|---------|--------|
| `repo/` | Lo de todo el repo: git, PRs y conflictos; issues, labels y milestones; tooling del monorepo; incidentes de seguridad |
| `web/` | Cómo está hecha la web (`apps/web`) |
| `api/` | Cómo está hecha la API (`apps/api`) |

El índice de cada uno está en su `CLAUDE.md`.
