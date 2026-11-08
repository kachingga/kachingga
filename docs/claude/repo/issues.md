# Issues, labels y milestones — dónde va cada cosa

> **Aplica a:** anotar algo pendiente, proponer una mejora, dejar una decisión para otro, crear o cerrar issues, labels o milestones. **Si cambia cómo los usamos, actualizá este archivo en el mismo PR.** Reglas cortas (incluida la de no crearlos sin el ok del humano): `CLAUDE.md` raíz → "Issues".

**Todo lo pendiente vive en GitHub Issues** (no hay un archivo de pendientes). Para ver qué falta: `gh issue list` (filtrar con `--milestone "Fase 1 — Privada"`, `--label question`, `--label blocked`…).

| Qué es | Dónde va |
|--------|----------|
| **Tarea decidida** (feature, infra, deploy, bug) | Issue con label de tipo: `enhancement`, `infra` o `bug`. Con qué falta, pasos o dónde están, y **"Listo cuando:"** |
| **Propuesta o mejora todavía no decidida** (ej. Claude ve algo que se podría hacer mejor en lo que está haciendo otro del grupo) | Issue con label **`question`**: el problema, 2–3 opciones con sus tradeoffs y una recomendación. Sin milestone hasta decidir |
| **Decisión pendiente** que bloquea algo (ej. "¿registro abierto o a mano?") | Issue `question`, en el milestone de la fase que bloquea |
| Algo que **depende de otro issue o de algo externo** (presupuesto, una cuenta) | Label **`blocked`** + "**Bloqueado por:** #N" (o el motivo) en el cuerpo |
| Algo que hace falta para **lanzar** | Milestone **"Fase 1 — Privada"** (que el grupo la use) o **"Fase 2 — Pública (futuro)"**. Contexto de las fases: `docs/decisiones/lanzamiento.md` |
| **Ítem chico de UI de la V1** (un detalle de una pantalla) | Checklist de `V1.md` → "Trabajo de la UI (web)" → "Por hacer". Si es grande o independiente: issue propio, linkeado desde ahí (ej. #18) |
| Alcance de una versión (qué entra) | `V1.md` / `V2.md`, no un issue |
| Conocimiento investigado (costos, requisitos, alternativas) | `docs/decisiones/`, no un issue |

**Reglas:**
- **Claude no crea, edita ni cierra issues, labels o milestones por su cuenta**: el repo es público y lo ve todo el grupo. Propone en el chat qué crearía y dónde (título, label, milestone), y lo crea cuando el humano dice que sí. Lo mismo para proponerle algo a otro: issue `question`, nunca un cambio sin hablarlo.
- **Al decidir un `question`**: se cierra con la decisión escrita en un comentario. Si genera trabajo, se crea el issue de la tarea (o el ítem en `V1.md`). Si cambia una regla o una convención, se actualiza el doc que corresponde (`CLAUDE.md`, el de la app, `docs/decisiones/`).
- **Un PR que resuelve un issue** lo dice en la descripción (`Closes #N`), para que se cierre solo al mergear.
- **No duplicar:** antes de crear un issue, buscar si ya existe (`gh issue list --search "…"`). El contenido de un issue no se copia en los docs: se linkea.
