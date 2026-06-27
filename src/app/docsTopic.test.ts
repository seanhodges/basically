import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { dialects, getDialect } from '../dialects/registry';
import { referenceTopic } from './docsTopic';

describe('referenceTopic', () => {
  it('returns null when the selection is empty or whitespace only', () => {
    const zx81 = getDialect('zx81');
    expect(referenceTopic(zx81, '')).toBeNull();
    expect(referenceTopic(zx81, '   \n\t ')).toBeNull();
  });

  it('builds a reference path with the keyword query for a self-named page', () => {
    expect(referenceTopic(getDialect('zx81'), 'PRINT')).toBe(
      'reference/zx81?q=PRINT',
    );
  });

  it('maps dialects that share a reference page to that page', () => {
    expect(referenceTopic(getDialect('zxspectrum128'), 'BEEP')).toBe(
      'reference/zxspectrum?q=BEEP',
    );
    expect(referenceTopic(getDialect('bbcmicro'), 'MODE')).toBe(
      'reference/bbc?q=MODE',
    );
    expect(referenceTopic(getDialect('bbcmaster'), 'MODE')).toBe(
      'reference/bbc?q=MODE',
    );
  });

  it('uses only the first token of a multi-word selection', () => {
    expect(referenceTopic(getDialect('zx81'), '  PRINT AT 0,0  ')).toBe(
      'reference/zx81?q=PRINT',
    );
  });

  it('url-encodes special characters in the keyword', () => {
    expect(referenceTopic(getDialect('zx81'), '<=')).toBe(
      'reference/zx81?q=%3C%3D',
    );
  });

  // Guards the dialect -> reference-page mapping: every registered dialect must
  // resolve (via `docsReference`, else its `id`) to a docs reference page that
  // actually exists, so the docs button never deep-links to a 404. Fails when a
  // new dialect is added without a matching page or `docsReference` override.
  it('maps every registered dialect to an existing reference page', () => {
    const refDir = fileURLToPath(
      new URL('../../docs/reference/', import.meta.url),
    );
    const missing = dialects
      .map((d) => ({ id: d.id, page: d.docsReference ?? d.id }))
      .filter(({ page }) => !existsSync(`${refDir}${page}.md`));
    expect(missing).toEqual([]);
  });
});
