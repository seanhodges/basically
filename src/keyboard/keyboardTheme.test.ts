import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dialects } from '../dialects/registry';

/**
 * Every keyboard theme a layout names is a theme the stylesheet has rules for.
 *
 * `VirtualKeyboard.tsx` puts `layout.theme` straight on the container's class
 * list, so a name with no rules behind it is not an error - the keyboard simply
 * renders in the default colours and looks like a machine whose keys were plain
 * grey. That is a real choice for some machines, so the exemptions below say
 * which; everything else owes the stylesheet a block.
 *
 * Read as text rather than imported: a stylesheet is not a module vitest can
 * ask questions of, and the token pinned (`.vk-theme-<id>`) is stable under any
 * reformatting - the same trade `fontCoverage.test.ts` makes against the
 * VitePress CSS.
 */

const CSS = join(__dirname, 'VirtualKeyboard.css');

/**
 * Themes that deliberately style nothing, and why. Named rather than inferred
 * from the stylesheet's silence, which is what "unstyled on purpose" and
 * "forgotten" look like from the outside.
 */
const UNSTYLED_THEMES: Record<string, string> = {
  // The Sinclair rubber keyboard is the default keycap treatment this
  // stylesheet already draws, so the ZX81 and ZX80 name a theme to keep the
  // class hook and add no rules under it. `src/components/machineArt.tsx`
  // records the same fact from the other side.
  'vk-theme-zx81': 'the default keycap treatment already is this machine’s',
};

describe('per-machine keyboard themes', () => {
  const css = readFileSync(CSS, 'utf8');

  it.each(dialects.map((d) => [d.id, d.keyboardLayout.theme] as const))(
    '%s has rules for the theme it names',
    (id, theme) => {
      expect(theme, `${id} names no keyboard theme`).toBeTruthy();
      if (UNSTYLED_THEMES[theme]) {
        expect(
          css.includes(`.${theme} `) || css.includes(`.${theme}:`),
          `${theme} has rules after all - take it out of UNSTYLED_THEMES`,
        ).toBe(false);
        return;
      }
      expect(
        css.includes(`.${theme} `) || css.includes(`.${theme}:`),
        `${id} names ${theme} but VirtualKeyboard.css has no rules for it - ` +
          'add a block, or list the theme in UNSTYLED_THEMES with a reason',
      ).toBe(true);
    },
  );

  it('excuses only themes a registered layout names', () => {
    const named = new Set(dialects.map((d) => d.keyboardLayout.theme));
    for (const theme of Object.keys(UNSTYLED_THEMES)) {
      expect(named.has(theme), `${theme} is named by no layout`).toBe(true);
    }
  });

  // A block for a theme nobody names is dead weight that reads as coverage.
  it('styles no theme no layout names', () => {
    const named = new Set(dialects.map((d) => d.keyboardLayout.theme));
    const styled = new Set(
      [...css.matchAll(/\.(vk-theme-[a-z0-9]+)/g)].map((m) => m[1]!),
    );
    expect([...styled].filter((theme) => !named.has(theme))).toEqual([]);
  });
});
