# Git, Pull Requests y conflictos

> **Aplica a:** branches, PRs, rebases, merges y conflictos de git. **Si cambia el flujo, actualizá este archivo en el mismo PR.** Reglas cortas: `CLAUDE.md` raíz → "Commits" y "Branches y Pull Requests".

## Branches y Pull Requests

**`main` está protegido en GitHub: no se puede pushear directo (ni los admins).** Todo cambio entra por PR.

```bash
git switch main && git pull --rebase origin main
git switch -c feat/<descripcion-corta>        # o fix/…, chore/…, docs/…
# … commits con formato Conventional Commits …
git push -u origin HEAD
gh pr create --fill                            # título = Conventional Commit (ej. "feat(web): pantalla de grupos")
```

- Para mergear, el CI (`.github/workflows/ci.yml`) tiene que pasar entero:
  - **"Typecheck, tests y lint"** — `bun run check` (formato + typecheck + tests + lint).
  - **"Migraciones al día con el schema"** — aplica todas las migraciones en un Postgres vacío y falla si el schema de Prisma tiene cambios sin migración.
  - **"Formato de commits y título del PR"** — Conventional Commits.
- **E2E** (`.github/workflows/e2e.yml`, no obligatorio): Playwright en la web (celular y compu). Corre a mano o en PRs con la label `e2e` — ponérsela a los PRs que cambian recorridos críticos (ver "Testing" en `apps/web/CLAUDE.md`).
- Dependabot abre PRs mensuales solo para las GitHub Actions (las dependencias de las apps se actualizan a mano).
- Se mergea solo con **squash**: el título del PR queda como el commit en `main`, por eso tiene que respetar el formato. La branch se borra sola al mergear.
- **El PR tiene que estar al día con `main`** para poder mergearse (GitHub lo marca como *BEHIND* si entró otro PR antes). Se actualiza **siempre con rebase, nunca con merge** (el historial de `main` es lineal):
  ```bash
  gh pr update-branch <número> --rebase          # desde GitHub, sin tocar tu copia local
  # o en local:
  git fetch origin && git rebase origin/main     # resolver conflictos según "Trabajo en paralelo y conflictos"
  git push --force-with-lease                    # solo sobre TU branch, nunca sobre main
  ```
  Después del rebase el CI corre de nuevo y hay que esperar a que pase.
- Resultado: **un PR = un commit en `main`**, con el título del PR como mensaje.
- No hace falta aprobación de otro para mergear (somos pocos), pero conviene avisar al grupo en PRs grandes.
- Mantener los PRs chicos y de un tema (una pantalla, un procedure, un fix).
- Claude: crear la branch y el PR; **mergear solo si el usuario lo pide** (`gh pr merge --squash` cuando el CI esté en verde).

## Trabajo en paralelo y conflictos

Somos varios trabajando a la vez.

### Antes de empezar y antes de pushear
```bash
git pull --rebase origin main
bun install          # por si cambiaron dependencias o hooks (el cliente de Prisma lo regeneran los hooks de git)
bun run check
```

> **Cliente de Prisma al cambiar de branch:** el cliente generado no está en git, así que al cambiar de branch puede quedar con el schema de la otra (síntoma: fallan todos los tests de integración juntos, o el typecheck dice que no existe un modelo/campo). Los hooks de husky `post-checkout`, `post-merge` y `post-rewrite` lo regeneran solos. Si igual pasa: `bun run --cwd apps/api db:generate`. **`bun install` no alcanza**: si no hay dependencias nuevas, no vuelve a correr el `postinstall`.

### Si tenés trabajo local viejo
1. Commitealo en una branch (`git switch -c feat/<lo-que-sea>`). Si el hook rechaza el mensaje, usá `type(scope): ...`.
2. `git rebase origin/main` (o `merge`) y resolvé los conflictos como abajo.
3. `bun install && bun run check` antes de pushear.

### Cómo resolver conflictos por archivo
- **`bun.lock`:** nunca a mano. Quedarse con la de `main` (`git checkout --theirs bun.lock` en un merge, `--ours` en un rebase), `bun install` para regenerarlo y `git add bun.lock`.
- **`package.json` (cualquiera):** combinar las dos listas de dependencias y scripts. En mobile, si quedan versiones raras, `bunx expo install --fix`. Después `bun install`.
- **`CLAUDE.md`, `V1.md` y docs:** combinar ambos textos respetando la regla de "dónde va cada cosa".
- **Archivos de cada app:** ver "Conflictos" en `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md` y `apps/mobile/CLAUDE.md` (migraciones, `app.json`, `_layout.tsx`, `router.ts`…).

Después de cualquier conflicto: `bun install && bun run check`. Si falla, se arregla antes de commitear — **nunca** `--no-verify`.

- **No apilar PRs** (uno encima de otro): con merges squash, el de arriba queda con commits que ya entraron y hay que rebasearlo con `git rebase --onto origin/main <último commit del de abajo>`. Mejor PRs independientes, o esperar a que entre el anterior.
- **Si el CI queda colgado** (un job "in progress" o "queued" mucho tiempo): mirar githubstatus.com; si GitHub Actions tiene un incidente, esperar. Cuando se recupere, relanzar el run (`gh run rerun <id>`). No es el código.
