import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * No accessibility problems axe can detect on the current screen (WCAG 2.1 A and AA: contrast,
 * names of buttons and fields, roles…). It doesn't replace trying it with the keyboard and a
 * screen reader (docs/claude/web/ui-ux.md → "Visual y accesibilidad").
 */
export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target).join(', ')})`),
  ).toEqual([]);
}
