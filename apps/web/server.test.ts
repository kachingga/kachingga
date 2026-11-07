import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveFile } from './server.ts';

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'kachingga-web-'));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'index.html'), '<!doctype html>');
  await writeFile(join(root, 'assets', 'app-abc.js'), 'console.log(1)');
  await writeFile(join(root, 'favicon.svg'), '<svg/>');
});

describe('resolveFile', () => {
  it('serves files that exist in the build', async () => {
    expect(await resolveFile('/assets/app-abc.js', root)).toBe(join(root, 'assets', 'app-abc.js'));
    expect(await resolveFile('/favicon.svg?v=2', root)).toBe(join(root, 'favicon.svg'));
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
