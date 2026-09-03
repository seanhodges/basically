/**
 * Pins the shape of the reference pages, which nothing else reads.
 *
 * The crosscheck suites beside this one pin the reference *data* hard - every
 * keyword row, every escape byte. The pages carrying that data were pinned only
 * by `hardware-memory-map.test.ts` (map embeds land one per machine section) and
 * `docsNavigation.test.ts` (a page is reachable at all), so everything between
 * those two drifted: two rival navigation conventions grew side by side, one
 * hardware page invented its own headings, and four links resolved to the wrong
 * machine's section while the dead-link check passed.
 *
 * That last one is why the anchor battery below exists. A page covering several
 * machines repeats its headings, and VitePress numbers the duplicates
 * `#memory-1`, `#memory-2`. A link written `#memory` is then valid and wrong -
 * it lands on whichever machine comes first, and inserting a machine ahead of it
 * silently renumbers every other link on the page. Explicit `{#...}` anchors are
 * the fix, and asking for them is something a substring can decide.
 *
 * Read as text: these are assertions about a Markdown file's structure, and
 * rendering it would need a VitePress build to say anything a regex cannot.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { machines } from './machines';
import { REFERENCE_PAGE_IDS } from './pages';

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs');
const refRoot = join(docsRoot, 'reference');

const read = (...parts: string[]) =>
  readFileSync(join(refRoot, ...parts), 'utf8');
const machinesOn = (page: string) => machines.filter((m) => m.page === page);

/** Heading text at one level, with any explicit `{#anchor}` stripped. */
function headings(source: string, level: number): string[] {
  const at = new RegExp(`^#{${level}} (.+?)(?:\\s*\\{#[^}]+\\})?\\s*$`);
  return source
    .split('\n')
    .map((l) => at.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => m[1]!.trim());
}

/** The `###` headings under each `##`, in source order. */
function sections(source: string): string[][] {
  const out: string[][] = [];
  for (const line of source.split('\n')) {
    if (/^## [^#]/.test(line)) out.push([]);
    const m = /^### (.+?)(?:\s*\{#[^}]+\})?\s*$/.exec(line);
    if (m && out.length) out[out.length - 1]!.push(m[1]!.trim());
  }
  return out;
}

/** The anchor VitePress gives a heading, and whether the page spelled it out. */
function anchors(source: string): { slugs: string[]; explicit: Set<string> } {
  const slugs: string[] = [];
  const explicit = new Set<string>();
  for (const line of source.split('\n')) {
    const h = /^#{2,6} (.+?)(?:\s*\{#([^}]+)\})?\s*$/.exec(line);
    if (!h) continue;
    if (h[2]) explicit.add(h[2]);
    slugs.push(
      h[2] ??
        h[1]!
          .replace(/[`*_]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
    );
  }
  return { slugs, explicit };
}

const PAGES = REFERENCE_PAGE_IDS.filter((p) => machinesOn(p).length > 0);

describe.each(PAGES)('the %s reference page', (page) => {
  const source = read(`${page}.md`);

  it('opens with a title and the one-sentence formula', () => {
    expect(source.startsWith('---\ntitle: ')).toBe(true);
    const after = source.slice(source.indexOf('\n# ')).split('\n').slice(2);
    const intro = after.find((l) => l.trim() !== '');
    expect(intro).toMatch(/^Every command, function and operator in\b/);
  });

  it('names its sub-pages in one bar, not twice', () => {
    const bar = /^\*\*In this reference:\*\*.*$/m.exec(source);
    expect(
      bar,
      'the bar under the intro is how a reader reaches the sub-pages',
    ).not.toBeNull();
    for (const target of ['hardware', 'escapes', 'formats']) {
      expect(bar![0]).toContain(`(./${page}/${target})`);
    }
    expect(bar![0]).toContain('(./#argument-notation)');
    // The bar replaced a closing cross-link paragraph; two pages kept both.
    const afterTable = source.slice(source.indexOf('<ReferenceTable'));
    expect(afterTable).not.toContain(`](./${page}/hardware)`);
  });

  it('files what the machine will not run under the one heading', () => {
    // Keywords that tokenize and then do nothing are a fact four machines have
    // and the rest do not. It was written three different ways - a section
    // here, a caveat bullet there - so a reader could not tell whether a page
    // without one had nothing to declare. One spelling, or none.
    const invented = headings(source, 2).filter(
      (h) =>
        h !== 'What this machine does not run' &&
        /\b(does not|do not|doesn't|not work|not run|unsupported)\b/i.test(h),
    );
    expect(invented, `${page}.md`).toEqual([]);
  });

  it('leads with Notes and caveats, and ends on the table', () => {
    // A machine may earn a section past the caveats - the Apple I's unnumbered
    // preamble, the Altair's tape-loaded interpreter - but the caveats come
    // first on every page, and the table is the last thing on it.
    expect(headings(source, 2)[0]).toBe('Notes and caveats');
    expect(source.trimEnd().endsWith('/>')).toBe(true);
  });
});

describe.each(PAGES)('the %s hardware page', (page) => {
  const source = read(page, 'hardware.md');

  it('gives every machine on the page a section of its own', () => {
    expect(headings(source, 2)).toHaveLength(machinesOn(page).length);
  });

  it('describes each machine under the same headings in the same order', () => {
    for (const [i, found] of sections(source).entries()) {
      const where = `${page}/hardware.md, machine ${i + 1}`;
      // A machine may add a heading its own hardware needs - Timing, Joystick,
      // Storage - but only between Sound and Memory, so the shared five stay
      // where a reader comparing two machines expects them.
      expect(found.slice(0, 4), where).toEqual([
        'Screen modes',
        'Colour',
        'Graphics',
        'Sound',
      ]);
      expect(found[found.length - 1], where).toBe('Memory');
    }
  });
});

describe.each(PAGES)('the %s file formats page', (page) => {
  const source = read(page, 'formats.md');

  it('closes on the cassette encoding', () => {
    const last = source
      .split('\n')
      .filter((l) => /^#{2,3} /.test(l))
      .pop();
    expect(last?.replace(/\s*\{#[^}]+\}\s*$/, '')).toMatch(
      /^#{2,3} Cassette audio$/,
    );
  });

  it('gives each machine its own cassette section when it splits by machine', () => {
    // Two pages organise by machine rather than by container. There the tape
    // scheme is per machine, and so is its heading.
    const level3 = headings(source, 3);
    if (level3.length === 0) return;
    expect(level3.filter((h) => h === 'Cassette audio')).toHaveLength(
      headings(source, 2).length,
    );
  });
});

describe.each(PAGES)('links on the %s sub-pages', (page) => {
  it.each(['hardware.md', 'formats.md', 'escapes.md'])(
    'resolve as written in %s',
    (file) => {
      const source = read(page, file);
      const { slugs, explicit } = anchors(source);

      const repeated = [
        ...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i)),
      ];
      expect(
        repeated,
        `${page}/${file}: a repeated heading needs an explicit {#anchor}, or VitePress numbers it`,
      ).toEqual([]);

      for (const [, target] of source.matchAll(/\]\(#([^)]+)\)/g)) {
        expect(
          slugs.includes(target!) || explicit.has(target!),
          `${page}/${file}: link to #${target} matches no heading`,
        ).toBe(true);
        expect(
          target,
          `${page}/${file}: #${target} is a VitePress-numbered duplicate; anchor the heading instead`,
        ).not.toMatch(/-\d+$/);
      }
    },
  );
});
