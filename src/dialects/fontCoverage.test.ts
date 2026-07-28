import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { requiredCodepoints } from './semigraphicsAudit';
import coverage from '../assets/fonts/coverage.json';

/**
 * The bundled character-graphics faces have to cover every non-ASCII character
 * a dialect can render, or that character shows as a missing-glyph box (which
 * is the whole reason they are bundled). Two things can break that: a dialect
 * starting to emit a character the subsets do not carry, and the `unicode-range`
 * in the stylesheet not admitting one the subsets do carry. Both are pinned
 * here, against the same derived list the subsets were built from.
 */

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Every `unicode-range` in a stylesheet that belongs to a bundled face. */
function declaredRanges(css: string, family: string): Array<[number, number]> {
  const face = css
    .split('@font-face')
    .find((block) => block.includes(`font-family: '${family}';`));
  if (!face) throw new Error(`no @font-face for "${family}"`);
  const declaration = /unicode-range:([^;]+);/.exec(face);
  if (!declaration) throw new Error(`no unicode-range for "${family}"`);
  return declaration[1]!.split(',').map((entry) => {
    const match = /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(entry.trim());
    if (!match) throw new Error(`unparsable unicode-range entry "${entry}"`);
    const from = parseInt(match[1]!, 16);
    return [from, match[2] ? parseInt(match[2], 16) : from];
  });
}

const covers = (ranges: Array<[number, number]>, cp: number): boolean =>
  ranges.some(([from, to]) => cp >= from && cp <= to);

const hex = (cp: number): string => `U+${cp.toString(16).toUpperCase()}`;

describe('bundled font coverage', () => {
  const required = requiredCodepoints();
  const manifest = coverage.faces.map((face) => ({
    ...face,
    points: face.codepoints.map((c) => parseInt(c, 16)),
  }));

  it('carries every non-ASCII codepoint the dialects render', () => {
    const bundled = new Set(manifest.flatMap((face) => face.points));
    const missing = required.filter((cp) => !bundled.has(cp));
    expect(
      missing.map(hex),
      'add these to a subset (see src/assets/fonts/ATTRIBUTION.md)',
    ).toEqual([]);
  });

  it('carries nothing the dialects do not render', () => {
    // The subsets are generated from the audit; anything extra means the two
    // have drifted apart and the font is carrying dead weight.
    const wanted = new Set(required);
    for (const face of manifest) {
      expect(
        face.points.filter((cp) => !wanted.has(cp)).map(hex),
        face.file,
      ).toEqual([]);
    }
  });

  it('splits the codepoints between the faces without overlap', () => {
    const seen = new Set<number>();
    for (const face of manifest) {
      for (const cp of face.points) {
        expect(seen.has(cp), `${hex(cp)} is in more than one face`).toBe(false);
        seen.add(cp);
      }
    }
  });

  it('never claims an ASCII codepoint', () => {
    // The faces sit first in the mono stack; admitting ASCII would mean they
    // drew ordinary program text too.
    for (const face of manifest) {
      for (const cp of face.points) expect(cp, face.file).toBeGreaterThan(0x7f);
    }
  });

  it.each([
    ['the app', '../styles.css'],
    ['the docs', '../../docs/.vitepress/theme/custom.css'],
  ])('declares each face over its whole subset in %s', (_where, path) => {
    const css = read(path);
    for (const face of manifest) {
      const ranges = declaredRanges(css, face.family);
      const outside = face.points.filter((cp) => !covers(ranges, cp));
      expect(outside.map(hex), `${face.family} in ${path}`).toEqual([]);
    }
  });

  it.each([
    ['the app', '../styles.css'],
    ['the docs', '../../docs/.vitepress/theme/custom.css'],
  ])('declares no range in %s the subsets cannot serve', (_where, path) => {
    const css = read(path);
    for (const face of manifest) {
      const carried = new Set(face.points);
      const claimed: number[] = [];
      for (const [from, to] of declaredRanges(css, face.family))
        for (let cp = from; cp <= to; cp++)
          if (!carried.has(cp)) claimed.push(cp);
      expect(claimed.map(hex), `${face.family} in ${path}`).toEqual([]);
    }
  });

  it('references each face file from the app stylesheet', () => {
    const css = read('../styles.css');
    for (const face of manifest) expect(css).toContain(face.file);
  });
});
