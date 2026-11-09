// Promotes to production: moves the `production` branch to `origin/main` (fast-forward only).
// Railway deploys prod from that branch. It runs from a member's machine on purpose: a push made
// by a bot (GitHub Actions) leaves the prod deploys waiting for approval in Railway.
// Usage: `bun run promote` (add `--migrated` once new migrations were applied to prod).
import { $ } from "bun";

const MIGRATIONS = "apps/api/prisma/migrations";

await $`git fetch --quiet origin main production`;
const main = (await $`git rev-parse origin/main`.text()).trim();
const production = (await $`git rev-parse origin/production`.text()).trim();

if (main === production) {
  console.log("production ya está en main: no hay nada para promover.");
  process.exit(0);
}

const isFastForward =
  (await $`git merge-base --is-ancestor ${production} ${main}`.nothrow())
    .exitCode === 0;
if (!isFastForward) {
  console.error(
    "production tiene commits que no están en main: no es un fast-forward. Revisarlo a mano.",
  );
  process.exit(1);
}

const newMigrations = (
  await $`git diff --name-only ${production} ${main} -- ${MIGRATIONS}`.text()
).trim();
if (newMigrations && !process.argv.includes("--migrated")) {
  console.error(`Hay migraciones nuevas:\n${newMigrations}\n`);
  console.error(
    "Aplicalas en prod (bun run --cwd apps/api db:migrate:prod) y volvé a correr: bun run promote --migrated",
  );
  process.exit(1);
}

console.log(
  `Va a prod:\n${await $`git log --oneline ${production}..${main}`.text()}`,
);
await $`git push origin ${main}:refs/heads/production`;
console.log(
  "Listo: Railway deploya prod. Comprobar https://api.kachingga.com/health y https://kachingga.com.",
);
