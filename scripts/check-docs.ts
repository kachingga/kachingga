// Checks that the docs Claude reads stay in sync with the repo (runs in `bun run check`):
// 1. Every repo path they mention in backticks (`apps/web/src/lib/format.ts`, `src/lib/format.ts`…)
//    exists. A missing one usually means the code moved or was renamed and the doc wasn't updated.
// 2. Every doc in docs/claude/ is linked from some CLAUDE.md (otherwise Claude never opens it).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const root = join(import.meta.dir, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const claudeFiles = [
  "CLAUDE.md",
  ".claude/CLAUDE.md",
  "apps/api/CLAUDE.md",
  "apps/web/CLAUDE.md",
]
  .map((f) => join(root, f))
  .filter(existsSync);
const claudeDocs = existsSync(join(root, "docs/claude"))
  ? walk(join(root, "docs/claude")).filter((f) => f.endsWith(".md"))
  : [];

// The app a doc talks about: paths like `src/lib/format.ts` are relative to it.
function appOf(file: string): string | null {
  const rel = relative(root, file);
  const match =
    rel.match(/^apps\/([^/]+)\//) ?? rel.match(/^docs\/claude\/(web|api)\//);
  return match ? join(root, "apps", match[1]!) : null;
}

// Mentions that look like a path but aren't files of the repo (or aren't committed).
const ignored = [
  /[*<>{}…$]/, // globs and placeholders: `models/*.prisma`, `routers/<dominio>.ts`
  /^(https?:|@|\/)/, // URLs, packages, routes (`/grupos/:id`)
  /\.env/, // gitignored env files
  /CLAUDE\.local\.md|settings\.local\.json/,
  /(^|\/)(generated|dist|node_modules|\.temp|test-results|playwright-report)(\/|$)/,
];

const errors: string[] = [];
const files = [...claudeFiles, ...claudeDocs];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const app = appOf(file);
  for (const [, mention] of text.matchAll(/`([^`\s]+)`/g)) {
    const path = mention!.replace(/[):,.]+$/, "").replace(/:\d+$/, "");
    if (!path.includes("/") || ignored.some((re) => re.test(path))) continue;
    if (!/\.[a-z]+$/i.test(path) && !path.endsWith("/")) continue; // only files and folders
    const candidates = [
      join(root, path),
      join(dirname(file), path),
      ...(app
        ? [join(app, path), join(app, "src", path), join(app, "src/trpc", path)]
        : []),
    ];
    if (!candidates.some(existsSync))
      errors.push(`${relative(root, file)}: no existe \`${path}\``);
  }
}

const allClaudeText = claudeFiles
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
for (const doc of claudeDocs) {
  const rel = relative(root, doc);
  if (rel === "docs/claude/README.md") continue;
  if (!allClaudeText.includes(rel))
    errors.push(
      `${rel}: ningún CLAUDE.md lo linkea (Claude nunca lo va a abrir)`,
    );
}

if (errors.length > 0) {
  console.error(
    `Docs desactualizados (${errors.length}):\n${errors.map((e) => `  - ${e}`).join("\n")}`,
  );
  console.error(
    "\nActualizá el doc (o el path) en el mismo PR. Ver docs/claude/README.md.",
  );
  process.exit(1);
}
console.log(`Docs OK (${files.length} archivos revisados).`);
