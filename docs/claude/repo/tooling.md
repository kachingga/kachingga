# Tooling del monorepo

> **Aplica a:** `.husky/`, `bunfig.toml`, `package.json` (raíz y de cada app), Prettier, versiones de TypeScript y React, `scripts/check-docs.ts`. **Si cambiás algo de esto, actualizá este archivo en el mismo PR.** Reglas cortas: `CLAUDE.md` raíz → "Comandos".

- **Husky** se activa con `prepare` en `bun install`. `pre-commit` corre `bun run check`; `commit-msg` valida Conventional Commits y deja pasar `Merge`, `Revert`, `fixup!`, `squash!` y `amend!`; `post-checkout`, `post-merge` y `post-rewrite` regeneran el cliente de Prisma (sin frenar nunca a git).
- `bunfig.toml` usa `linker = "hoisted"` (todo en el `node_modules` raíz). Viene así desde el setup de Expo; no cambiarlo sin probar que Metro siga resolviendo.
- `bun --filter '*' <script>` corre solo en los workspaces que tienen ese script.
- **Prettier** (versión fija en la raíz) con config por app que respeta su estilo: API sin `;` y líneas de hasta 140 (`apps/api/.prettierrc`), web y mobile con `;` y 100 (`apps/mobile/.prettierrc`). `.prettierignore` excluye generados, migraciones y markdown. Si `check` falla por formato: `bun run format`. No discutir estilo: lo decide Prettier.
- **TypeScript `~6.0.3` y React `19.3.0` en todos los workspaces** (los del SDK 58 de Expo): web y mobile typechequean archivos de la API y comparten `node_modules`, así que tienen que ir juntos.
- **Chequeo de docs** (`bun run docs:check`, primer paso de `bun run check`): `scripts/check-docs.ts` falla si un `CLAUDE.md` o un doc de `docs/claude/` menciona un archivo del repo que no existe, o si un doc de `docs/claude/` no está linkeado desde ningún `CLAUDE.md`. Ver `docs/claude/README.md`.
