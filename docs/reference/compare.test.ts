import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dialects } from '../../src/dialects/registry';
import { machines } from '../../src/reference/machines';

/**
 * Pin the porting guide's three lookup tables to the registry.
 *
 * `compare.md` is a VitePress page, so nothing type-checks its maps against the
 * machines it offers: a machine missing from one of them simply renders the
 * guide with that panel blank, on every pair it appears in, silently. That is
 * how the Apple I and the PMD 85 came to be registered, offered in the picker
 * and shown with no reference rows, no control codes and no memory map at all.
 *
 * The maps are read as text rather than imported, because the page is Markdown
 * with a `<script setup>` block and there is nothing to import. Keys only: what
 * they resolve to is the concern of the crosschecks beside each table.
 */

const here = dirname(fileURLToPath(import.meta.url));
const markdown = readFileSync(resolve(here, 'compare.md'), 'utf8');

/**
 * The keys of one `const <name> = { … };` object literal in the page. A slug
 * that is not a bare identifier is quoted there (`'integer-basic'`), so both
 * spellings count.
 */
function keysOf(name: string): string[] {
  const start = markdown.indexOf(`const ${name} = {`);
  expect(start, `${name} is not declared in compare.md`).toBeGreaterThanOrEqual(
    0,
  );
  const stop = markdown.indexOf('\n};', start);
  expect(stop, `${name} is not closed`).toBeGreaterThan(start);
  return [...markdown.slice(start, stop).matchAll(/^\s{2}'?([\w-]+)'?:/gm)].map(
    (m) => m[1]!,
  );
}

/**
 * Machines whose panel is deliberately absent, and why. Named rather than
 * derived, so a machine cannot join them by being forgotten.
 */
const NO_MEMORY_MAP: Record<string, string> = {
  trs80: 'its layout is not described, so no pair involving it reports one',
};

describe('the porting guide’s lookup tables', () => {
  it('has a reference table for every page the picker offers', () => {
    const pages = [...new Set(machines.map((m) => m.page))].sort();
    expect(keysOf('referenceByPage').sort()).toEqual(pages);
  });

  it('has an escape table for every page the picker offers', () => {
    const pages = [...new Set(machines.map((m) => m.page))].sort();
    expect(keysOf('escapesByPage').sort()).toEqual(pages);
  });

  it('has a memory map for every registered machine that describes one', () => {
    const expected = dialects
      .map((d) => d.id)
      .filter((id) => !NO_MEMORY_MAP[id])
      .sort();
    expect(keysOf('memoryMapById').sort()).toEqual(expected);
  });

  it('excuses only registered machines from the memory map', () => {
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of Object.keys(NO_MEMORY_MAP)) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
  });
});
