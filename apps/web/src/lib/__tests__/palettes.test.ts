import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PALETTES } from '@/lib/theme';

// The palettes live in index.css (one light and one dark block each) and their ids in theme.ts
// and public/theme.js: check they all say the same and every palette sets the same colors.
// Tests run from apps/web.
const css = readFileSync(resolve('src/index.css'), 'utf8');
const bootScript = readFileSync(resolve('public/theme.js'), 'utf8');

/** The custom properties set by the block whose selector contains `selector`. */
function tokens(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start, `no block for ${selector}`).toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf('\n}', start));
  return new Set([...body.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]));
}

describe('palettes', () => {
  const green = {
    light: tokens("[data-palette='green']"),
    dark: tokens(".dark [data-palette='green']"),
  };
  // Optional per palette: `--tint` (mono: grays) and `--primary-ink` (yellow: primary doesn't read as text).
  const optional = new Set(['--tint', '--primary-ink']);
  const required = (set: Set<string>) => [...set].filter((t) => !optional.has(t)).sort();

  it.each(PALETTES.filter((p) => p.id !== 'green'))(
    '$name sets the same colors as green, in light and dark',
    ({ id }) => {
      expect(required(tokens(`[data-palette='${id}']`))).toEqual(required(green.light));
      expect(required(tokens(`.dark [data-palette='${id}']`))).toEqual(required(green.dark));
    },
  );

  it('public/theme.js applies the same palettes before the first paint', () => {
    const [, ids] = bootScript.match(/\^\(([\w|]+)\)\$/) ?? [];
    expect(ids?.split('|')).toEqual(PALETTES.map((p) => p.id));
  });
});
