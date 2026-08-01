import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { dialects, getDialect } from '../dialects/registry';
import {
  asmReferenceTopic,
  openingTopicFor,
  referenceTopic,
  referenceTopicFor,
} from './docsTopic';

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

describe('asmReferenceTopic', () => {
  it('builds a per-CPU asm path seeded with the mnemonic', () => {
    expect(asmReferenceTopic('z80', 'LD A,5')).toBe(
      'reference/z80-assembly?q=LD',
    );
    expect(asmReferenceTopic('6502', 'lda')).toBe(
      'reference/6502-assembly?q=lda',
    );
  });

  it('opens the CPU page even with no selection (unlike the BASIC topic)', () => {
    expect(asmReferenceTopic('z80', '')).toBe('reference/z80-assembly');
    expect(asmReferenceTopic('6502', '  ')).toBe('reference/6502-assembly');
  });
});

describe('referenceTopicFor', () => {
  it('routes to the CPU asm page when a block tab is active', () => {
    expect(
      referenceTopicFor({
        dialect: getDialect('zxspectrum'),
        editorSelection: 'PUSH HL',
        activeBlockId: 'listing-0',
      }),
    ).toBe('reference/z80-assembly?q=PUSH');
    expect(
      referenceTopicFor({
        dialect: getDialect('commodore64'),
        editorSelection: 'JSR $FFD2',
        activeBlockId: 'block-1',
      }),
    ).toBe('reference/6502-assembly?q=JSR');
  });

  it('routes to the dialect BASIC page when no block tab is active', () => {
    expect(
      referenceTopicFor({
        dialect: getDialect('commodore64'),
        editorSelection: 'POKE',
        activeBlockId: null,
      }),
    ).toBe('reference/commodore?q=POKE');
  });

  // Guards the CPU -> asm-page mapping the same way the BASIC test above does:
  // every dialect that supports machine-code blocks must resolve to an asm
  // reference page that exists, so the docs button never deep-links to a 404.
  it('maps every block-capable dialect to an existing asm reference page', () => {
    // `referenceTopicFor` returns a `reference/…` topic, so resolve it against
    // the docs root (not docs/reference, which would double the segment).
    const docsDir = fileURLToPath(new URL('../../docs/', import.meta.url));
    const missing = dialects
      .filter((d) => d.memoryBlocks)
      .map((d) => ({
        id: d.id,
        topic: referenceTopicFor({
          dialect: d,
          editorSelection: '',
          activeBlockId: 'x',
        }),
      }))
      .filter(({ topic }) => !existsSync(`${docsDir}${topic}.md`));
    expect(missing).toEqual([]);
  });
});

describe('openingTopicFor', () => {
  const base = {
    dialect: getDialect('commodore64'),
    editorSelection: 'POKE',
    activeBlockId: null,
  };

  it('opens on the comparison offered for the open program when there is one', () => {
    // Wherever the user reaches the documentation from after keeping their
    // program on a new machine, they land on the port that was offered - not on
    // the reference page for a machine they have just left behind.
    expect(
      openingTopicFor({
        ...base,
        docsProgramTopic: 'reference/compare?from=commodore64&to=zx81',
      }),
    ).toBe('reference/compare?from=commodore64&to=zx81');
  });

  it('falls back to the usual contextual reference with no comparison', () => {
    expect(openingTopicFor({ ...base, docsProgramTopic: null })).toBe(
      'reference/commodore?q=POKE',
    );
  });

  it('falls back to null when there is no context either', () => {
    expect(
      openingTopicFor({
        ...base,
        editorSelection: '',
        docsProgramTopic: null,
      }),
    ).toBeNull();
  });

  it('still prefers the comparison over an active block tab', () => {
    expect(
      openingTopicFor({
        ...base,
        editorSelection: 'JSR $FFD2',
        activeBlockId: 'block-1',
        docsProgramTopic: 'reference/compare?from=commodore64&to=zx81',
      }),
    ).toBe('reference/compare?from=commodore64&to=zx81');
  });
});
