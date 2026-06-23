import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import {
  buildConstructSnippet,
  constructsByDialect,
  type ConstructTemplate,
} from './constructs';
import { buildCompletionSource } from './completions';
import type { KeywordInfo } from '../dialects/types';

describe('buildConstructSnippet', () => {
  const forNext = ['FOR ${1:I}=${2:1} TO ${3:10}', '${0}', 'NEXT ${1:I}'];

  it('prefixes continuation lines with their planned numbers', () => {
    expect(buildConstructSnippet(forNext, [20, 30])).toBe(
      'FOR ${1:I}=${2:1} TO ${3:10}\n20 ${0}\n30 NEXT ${1:I}',
    );
  });

  it('joins with bare newlines when numbering is off (null)', () => {
    expect(buildConstructSnippet(forNext, null)).toBe(forNext.join('\n'));
  });
});

describe('constructsByDialect', () => {
  it('covers every dialect with block templates', () => {
    for (const id of [
      'zx81',
      'zx80',
      'zxspectrum',
      'zxspectrum128',
      'bbcmicro',
      'bbcmaster',
      'commodore64',
      'atom',
      'trs80',
    ]) {
      const list = constructsByDialect[id];
      expect(list, id).toBeDefined();
      // Every dialect offers at least IF, a loop and a subroutine/procedure.
      expect(list!.some((c) => c.label === 'IF')).toBe(true);
      expect(list!.some((c) => c.label === 'FOR')).toBe(true);
    }
  });

  it('uses the Spectrum two-word GO SUB spelling', () => {
    const labels = constructsByDialect.zxspectrum!.map((c) => c.label);
    expect(labels).toContain('GO SUB');
    expect(labels).not.toContain('GOSUB');
  });

  it('gives the BBC procedure and function block templates', () => {
    const labels = constructsByDialect.bbcmicro!.map((c) => c.label);
    expect(labels).toEqual(
      expect.arrayContaining(['REPEAT', 'DEFPROC', 'PROC', 'DEFFN']),
    );
  });
});

describe('buildCompletionSource with constructs', () => {
  const keywords: KeywordInfo[] = [
    { word: 'IF', token: 1, kind: 'command' },
    { word: 'FOR', token: 2, kind: 'command' },
    { word: 'PRINT', token: 3, kind: 'command' },
  ];
  const constructs: ConstructTemplate[] = [
    { label: 'IF', lines: ['IF ${1:c} THEN ${0}'] },
    {
      label: 'FOR',
      lines: ['FOR ${1:I}=${2:1} TO ${3:10}', '${0}', 'NEXT ${1:I}'],
    },
  ];

  function optionsFor(doc: string, pos: number) {
    const source = buildCompletionSource(keywords, constructs);
    const state = EditorState.create({ doc });
    const result = source(new CompletionContext(state, pos, true));
    return result?.options ?? [];
  }

  it('offers the construct (with an apply) instead of the plain keyword', () => {
    const opts = optionsFor('10 F', 4);
    const forOpts = opts.filter((o) => o.label === 'FOR');
    expect(forOpts).toHaveLength(1);
    expect(typeof forOpts[0]!.apply).toBe('function');
    // The un-constructed PRINT keyword is still a plain (apply-less) option.
    const printOpt = opts.find((o) => o.label === 'PRINT');
    expect(printOpt!.apply).toBeUndefined();
  });

  it('ranks constructs above plain command keywords', () => {
    const opts = optionsFor('10 ', 3);
    const forOpt = opts.find((o) => o.label === 'FOR');
    const printOpt = opts.find((o) => o.label === 'PRINT');
    expect((forOpt!.boost ?? 0) > (printOpt!.boost ?? 0)).toBe(true);
  });
});
