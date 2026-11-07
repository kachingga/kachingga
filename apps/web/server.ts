// Production server for the web (Railway): serves the Vite build from dist/.
// Unknown routes without an extension get index.html (React Router resolves them).
import { readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = resolve(import.meta.dirname, 'dist');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt']);

// The build doesn't change while the server runs, so files (and their gzip) are cached in memory.
const cache = new Map<string, { raw: Buffer; gzip?: Buffer }>();

async function load(file: string) {
  let entry = cache.get(file);
  if (!entry) {
    const raw = await readFile(file);
    entry = { raw, gzip: COMPRESSIBLE.has(extname(file)) ? gzipSync(raw) : undefined };
    cache.set(file, entry);
  }
  return entry;
}

async function isFile(path: string) {
  return (await stat(path).catch(() => null))?.isFile() ?? false;
}

/** Which file answers a URL path: the file itself, index.html for app routes, or null (404). */
export async function resolveFile(urlPath: string, root = DIST): Promise<string | null> {
  let pathname: string;
  try {
    pathname = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const file = resolve(join(root, pathname));
  if (file !== root && !file.startsWith(root + sep)) return null;
  if (await isFile(file)) return file;
  // A missing file with an extension (e.g. an old /assets/x.js) is a 404, not the app's HTML.
  return extname(pathname) ? null : join(root, 'index.html');
}

export async function handle(req: IncomingMessage, res: ServerResponse, root = DIST) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const file = await resolveFile(req.url ?? '/', root);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
    return;
  }
  const { raw, gzip } = await load(file);
  const useGzip =
    gzip !== undefined && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
  const body = useGzip ? gzip : raw;
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Content-Length': body.length,
    // Vite fingerprints /assets/*: they never change. Everything else is revalidated so a deploy shows up.
    'Cache-Control': file.startsWith(join(root, 'assets') + sep)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    ...(gzip !== undefined && { Vary: 'Accept-Encoding' }),
    ...(useGzip && { 'Content-Encoding': 'gzip' }),
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 4173);
  createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500).end();
    });
  }).listen(port, () => console.log(`web listening on :${port}`));
}
