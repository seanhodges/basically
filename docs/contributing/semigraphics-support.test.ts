import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Pin the generated region of the semigraphics support page to the dialects it
 * is derived from, the same way escape-crosscheck.test.ts pins the escape
 * tables: add a graphics character, or make one typeable, and this fails until
 * the page is regenerated.
 *
 * This test may import and run src/ freely - vitest runs it in node, and the
 * VitePress bundle never includes *.test.ts, so the published page stays free
 * of dialect code.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const docPath = resolve(here, 'semigraphics-support.md');

const BEGIN = '<!-- semigraphics:begin -->';
const END = '<!-- semigraphics:end -->';

function generatedRegion(markdown: string): string {
  const start = markdown.indexOf(BEGIN);
  const stop = markdown.indexOf(END);
  expect(start, 'begin marker').toBeGreaterThanOrEqual(0);
  expect(stop, 'end marker').toBeGreaterThan(start);
  return markdown.slice(start, stop + END.length);
}

describe('semigraphics support page', () => {
  it('matches what the dialects say', () => {
    const committed = readFileSync(docPath, 'utf8');
    // Regenerating rewrites the file in place, so capture the committed region
    // first and restore nothing - the generator is deterministic, so a matching
    // run leaves the file byte-identical anyway.
    const before = generatedRegion(committed);
    execFileSync('npx', ['vite-node', 'scripts/gen-semigraphics-audit.mts'], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
    const after = generatedRegion(readFileSync(docPath, 'utf8'));
    expect(
      after,
      'semigraphics matrix is stale; run `npm run gen:semigraphics`',
    ).toBe(before);
  }, 60_000);

  it('keeps the hand-written sections outside the markers', () => {
    const markdown = readFileSync(docPath, 'utf8');
    const outside =
      markdown.slice(0, markdown.indexOf(BEGIN)) +
      markdown.slice(markdown.indexOf(END) + END.length);
    // These are the sections the generator must never clobber; losing them
    // would silently strip the context that makes the matrix readable.
    // ("Machines this page does not yet cover" was retired with the Atom, the
    // last machine in it - every registered dialect is now in scope.)
    for (const heading of ['## How to read it', '## Known wrinkles']) {
      expect(outside, heading).toContain(heading);
    }
  });
});
