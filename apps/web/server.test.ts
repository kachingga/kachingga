import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { contentSecurityPolicy, handle, resolveFile, securityHeaders } from './server.ts';

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'kachingga-web-'));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'index.html'), '<!doctype html>');
  await writeFile(join(root, 'assets', 'app-abc.js'), 'console.log(1)');
  await writeFile(join(root, 'favicon.svg'), '<svg/>');
  await mkdir(join(root, '.well-known'));
  await writeFile(join(root, '.well-known', 'security.txt'), 'Contact: mailto:hola@kachingga.com');
});

describe('resolveFile', () => {
  it('serves files that exist in the build', async () => {
    expect(await resolveFile('/assets/app-abc.js', root)).toBe(join(root, 'assets', 'app-abc.js'));
    expect(await resolveFile('/favicon.svg?v=2', root)).toBe(join(root, 'favicon.svg'));
  });

  it('serves security.txt from .well-known (where vulnerability reporters look)', async () => {
    expect(await resolveFile('/.well-known/security.txt', root)).toBe(
      join(root, '.well-known', 'security.txt'),
    );
  });

  it('serves index.html for app routes', async () => {
    expect(await resolveFile('/', root)).toBe(join(root, 'index.html'));
    expect(await resolveFile('/groups/abc/expenses', root)).toBe(join(root, 'index.html'));
  });

  it('returns 404 for missing files with an extension', async () => {
    expect(await resolveFile('/assets/old-123.js', root)).toBeNull();
  });

  it('never serves files outside the build', async () => {
    expect(await resolveFile('/../../etc/passwd', root)).toBeNull();
    expect(await resolveFile('/%2e%2e/%2e%2e/etc/passwd', root)).toBeNull();
    expect(await resolveFile('/%E0%A4%A', root)).toBeNull();
  });
});

// The variables of the `web` service in Railway (staging).
const env = {
  VITE_API_URL: 'https://api-staging.kachingga.com',
  VITE_SUPABASE_URL: 'https://abcdefgh.supabase.co',
  VITE_SENTRY_DSN: 'https://publickey@o123.ingest.us.sentry.io/456',
};

describe('security headers', () => {
  it('the CSP only lets the app load its own files and connect to its API, Supabase and Sentry', () => {
    expect(contentSecurityPolicy(env).split('; ')).toEqual([
      "default-src 'self'",
      "script-src 'self' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self' https://api-staging.kachingga.com https://abcdefgh.supabase.co https://o123.ingest.us.sentry.io",
      'frame-src https://challenges.cloudflare.com',
      "worker-src 'self'",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "object-src 'none'",
    ]);
  });

  it('without those variables (local, or Sentry off) it only connects to its own origin', () => {
    expect(contentSecurityPolicy({ VITE_API_URL: '' })).toContain("connect-src 'self';");
    expect(contentSecurityPolicy({ ...env, VITE_SENTRY_DSN: '' })).not.toContain('sentry.io');
  });

  it('the CSP only warns (Report-Only) until CSP_ENFORCE=true', () => {
    const reportOnly = securityHeaders(env);
    expect(reportOnly['Content-Security-Policy-Report-Only']).toBe(contentSecurityPolicy(env));
    expect(reportOnly).not.toHaveProperty('Content-Security-Policy');

    const enforced = securityHeaders({ ...env, CSP_ENFORCE: 'true' });
    expect(enforced['Content-Security-Policy']).toBe(contentSecurityPolicy(env));
    expect(enforced).not.toHaveProperty('Content-Security-Policy-Report-Only');
  });

  it('go with every response, without blocking the clipboard or sharing', async () => {
    const cases = [
      ['GET', '/', 200],
      ['GET', '/assets/app-abc.js', 200],
      ['HEAD', '/grupos', 200],
      ['GET', '/assets/old-123.js', 404],
      ['POST', '/', 405],
    ] as const;
    for (const [method, url, status] of cases) {
      const res = fakeResponse();
      const req = { method, url, headers: {} } as IncomingMessage;
      await handle(req, res as unknown as ServerResponse, root, securityHeaders(env));
      expect(res.status, `${method} ${url}`).toBe(status);
      expect(res.headers, `${method} ${url}`).toMatchObject({
        'Content-Security-Policy-Report-Only': contentSecurityPolicy(env),
        'Strict-Transport-Security': 'max-age=86400',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
      });
      const permissions = String(res.headers['Permissions-Policy']);
      expect(permissions).toContain('camera=()');
      expect(permissions).not.toMatch(/clipboard|web-share/);
    }
  });
});

function fakeResponse() {
  const res = {
    status: 0,
    headers: {} as Record<string, unknown>,
    writeHead(status: number, headers: Record<string, unknown>) {
      res.status = status;
      res.headers = headers;
      return res;
    },
    end: () => res,
  };
  return res;
}
