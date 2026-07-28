import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Pin the generated region of the glyph-sources page to the declarations it is
 * derived from, exactly as semigraphics-support.test.ts does for the support
 * matrix: change a font base, an index rule or a cell size, and this fails
 * until the page is regenerated.
 *
 * The page is the materialised half of the deal - the declaration in
 * src/dialects/glyphSources.ts is what a human maintains, and this index is
 * what a search for an address actually finds. It is only useful if it cannot
 * go stale.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const docPath = resolve(here, 'glyph-sources.md');

const BEGIN = '<!-- glyphsources:begin -->';
const END = '<!-- glyphsources:end -->';

function generatedRegion(markdown: string): string {
  const start = markdown.indexOf(BEGIN);
  const stop = markdown.indexOf(END);
  expect(start, 'begin marker').toBeGreaterThanOrEqual(0);
  expect(stop, 'end marker').toBeGreaterThan(start);
  return markdown.slice(start, stop + END.length);
}

describe('glyph sources page', () => {
  it('matches what the declarations say', () => {
    const before = generatedRegion(readFileSync(docPath, 'utf8'));
    execFileSync('npx', ['vite-node', 'scripts/gen-glyph-addresses.mts'], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
    const after = generatedRegion(readFileSync(docPath, 'utf8'));
    expect(after, 'address index is stale; run `npm run gen:glyphs`').toBe(
      before,
    );
  }, 60_000);

  it('keeps the hand-written sections outside the markers', () => {
    const markdown = readFileSync(docPath, 'utf8');
    const outside =
      markdown.slice(0, markdown.indexOf(BEGIN)) +
      markdown.slice(markdown.indexOf(END) + END.length);
    // The prose is what stops the index reading as an inventory of addresses
    // that all exist - a third of it is "nothing is stored here".
    for (const heading of [
      '## Three kinds of source, because not every shape is stored',
      '## Why the anchors are shapes and not checksums',
      '## Known wrinkles',
    ]) {
      expect(outside, heading).toContain(heading);
    }
  });
});
