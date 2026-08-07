/**
 * Pins each machine's memory layout to its hardware reference page.
 *
 * The layout is on those pages so a reader learning what a machine is meets the
 * whole address space where the page discusses memory. What can go wrong is
 * wiring, not prose: a page that imports a map and never renders it, a map
 * rendered under the wrong machine's heading, a dialect added later whose page
 * quietly has no layout at all.
 *
 * Which machines *should* have one is discovered on disk rather than listed
 * here - a dialect with a `memoryMap.ts` needs its layout shown, and one without
 * (the TRS-80) must show none rather than a guessed one. That is the same
 * property `src/dialects/memoryMap.test.ts` and
 * `src/components/machinePickerBoundary.test.ts` are built around, and it is
 * what makes a newly registered dialect fail here until it is wired.
 *
 * The pages are read as text: the assertions are about a Markdown file's
 * structure, and rendering it would need a VitePress build to say anything a
 * substring cannot.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { machines } from './machines';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, '..');
const docsRoot = resolve(here, '../../docs');

/** Where a machine's map lives, and whether it has one at all. */
const mapModule = (id: string) => `dialects/${id}/memoryMap.ts`;
const hasMap = (id: string) => existsSync(join(srcRoot, mapModule(id)));

const hardwarePage = (page: string) =>
  join(docsRoot, 'reference', page, 'hardware.md');

const readPage = (page: string) => readFileSync(hardwarePage(page), 'utf8');

/** Every hardware page, and the machines the machine list puts on it. */
const pages = [...new Set(machines.map((m) => m.page))].sort();
const machinesOn = (page: string) => machines.filter((m) => m.page === page);

/**
 * The `##` section each embed falls in, as the index of its heading.
 *
 * Structural rather than by name: a machine's heading is the machine's *own*
 * name ("Commodore 64", "ZX Spectrum 48K") and the machine list carries the
 * short name the picker shows ("C64", "Spectrum"), so the two cannot be matched
 * by string. What matters is that the layouts land one per machine section,
 * which counting distinct sections says exactly.
 */
function embedSections(source: string): number[] {
  const lines = source.split('\n');
  const sections: number[] = [];
  let section = -1;
  for (const line of lines) {
    if (line.startsWith('## ')) section += 1;
    if (line.includes('<MemoryMapSingle')) sections.push(section);
  }
  return sections;
}

/** The `###` heading each embed sits under, in source order. */
function embedSubheadings(source: string): string[] {
  const lines = source.split('\n');
  const headings: string[] = [];
  let heading = '';
  for (const line of lines) {
    if (line.startsWith('### ')) heading = line;
    if (line.includes('<MemoryMapSingle')) headings.push(heading);
  }
  return headings;
}

describe.each(pages)('%s hardware page', (page) => {
  const source = readPage(page);
  const described = machinesOn(page).filter((m) => hasMap(m.id));
  const undescribed = machinesOn(page).filter((m) => !hasMap(m.id));

  it.each(described)('shows $id its own layout', ({ id }) => {
    expect(source).toContain(`<MemoryMapSingle machine="${id}"`);
    expect(source).toContain(`src/${mapModule(id).replace(/\.ts$/, '')}`);
  });

  it.each(undescribed)('shows $id no layout at all', ({ id }) => {
    expect(source).not.toContain(`machine="${id}"`);
    expect(source).not.toContain(`src/${mapModule(id).replace(/\.ts$/, '')}`);
  });

  it('shows one layout per machine, each in its own section', () => {
    const sections = embedSections(source);
    expect(sections).toHaveLength(described.length);
    expect(new Set(sections).size).toBe(described.length);
  });

  it('puts every layout in the section covering that machine’s memory', () => {
    for (const heading of embedSubheadings(source)) {
      expect(heading).toMatch(/^### Memory\b/);
    }
  });
});

describe('the machine list and the pages agree', () => {
  it('every machine with a map has a hardware page to show it on', () => {
    const missing = machines
      .filter((m) => hasMap(m.id))
      .filter((m) => !existsSync(hardwarePage(m.page)))
      .map((m) => m.id);
    expect(missing).toEqual([]);
  });

  it('no page renders a layout for a machine that is not on it', () => {
    for (const page of pages) {
      const source = readPage(page);
      const embedded = [
        ...source.matchAll(/<MemoryMapSingle machine="([^"]+)"/g),
      ]
        .map((m) => m[1])
        .sort();
      const expected = machinesOn(page)
        .filter((m) => hasMap(m.id))
        .map((m) => m.id)
        .sort();
      expect(embedded, `on ${page}/hardware.md`).toEqual(expected);
    }
  });
});
