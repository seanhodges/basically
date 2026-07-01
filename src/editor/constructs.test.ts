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

  it('offers a PRINT string construct for every dialect', () => {
    for (const id of Object.keys(constructsByDialect)) {
      const print = constructsByDialect[id]!.find((c) => c.label === 'PRINT');
      expect(print, id).toBeDefined();
      expect(print!.lines, id).toEqual(['PRINT "${0}"']);
    }
  });

  it('adds PLAY only to the 128K Spectrum, not the 48K', () => {
    expect(
      constructsByDialect.zxspectrum128!.some((c) => c.label === 'PLAY'),
    ).toBe(true);
    expect(
      constructsByDialect.zxspectrum!.some((c) => c.label === 'PLAY'),
    ).toBe(false);
  });

  it('adds LPRINT to the ZX81 but not the ZX80 (no printer)', () => {
    expect(constructsByDialect.zx81!.some((c) => c.label === 'LPRINT')).toBe(
      true,
    );
    expect(constructsByDialect.zx80!.some((c) => c.label === 'LPRINT')).toBe(
      false,
    );
  });

  it('gives the per-dialect file-string commands', () => {
    const bbc = constructsByDialect.bbcmicro!.map((c) => c.label);
    expect(bbc).toEqual(
      expect.arrayContaining(['CHAIN', 'OSCLI', 'LOAD', 'SAVE']),
    );
    const c64 = constructsByDialect.commodore64!.map((c) => c.label);
    expect(c64).toContain('VERIFY');
  });
});

describe('bracketed function constructs', () => {
  const lineOf = (id: string, label: string) =>
    constructsByDialect[id]!.find((c) => c.label === label)?.lines[0];

  it('puts one numbered placeholder in brackets per required arg', () => {
    // One required arg (INKEY), two required args (INSTR); optional 3rd omitted.
    expect(lineOf('bbcmicro', 'INKEY')).toBe('INKEY(${1})');
    expect(lineOf('bbcmicro', 'INSTR')).toBe('INSTR(${1}, ${2})');
    expect(lineOf('commodore64', 'MID$')).toBe('MID$(${1}, ${2})');
    expect(lineOf('bbcmicro', 'STRING$')).toBe('STRING$(${1}, ${2})');
  });

  it('marks function constructs with the function icon type', () => {
    const instr = constructsByDialect.bbcmicro!.find(
      (c) => c.label === 'INSTR',
    );
    expect(instr!.type).toBe('function');
  });

  it('writes the Spectrum POINT/SCREEN$/ATTR with a space before "("', () => {
    expect(lineOf('zxspectrum', 'POINT')).toBe('POINT (${1}, ${2})');
    expect(lineOf('zxspectrum', 'SCREEN$')).toBe('SCREEN$ (${1}, ${2})');
    expect(lineOf('zxspectrum128', 'ATTR')).toBe('ATTR (${1}, ${2})');
  });

  it('gives the ZX80 bracketed functions but the ZX81 none', () => {
    expect(lineOf('zx80', 'CODE')).toBe('CODE(${1})');
    expect(lineOf('zx80', 'PEEK')).toBe('PEEK(${1})');
    // The ZX81 writes functions with space syntax, so it gets no function
    // constructs at all.
    const zx81Fns = constructsByDialect.zx81!.filter(
      (c) => c.type === 'function',
    );
    expect(zx81Fns).toHaveLength(0);
  });

  it('omits pure-math (trig/log) functions, FN and TAB/SPC', () => {
    for (const id of Object.keys(constructsByDialect)) {
      const labels = constructsByDialect[id]!.map((c) => c.label);
      for (const skipped of [
        'SIN',
        'COS',
        'TAN',
        'ATN',
        'LOG',
        'SQR',
        'FN',
        'TAB',
        'SPC',
      ]) {
        expect(labels, `${id} should not offer ${skipped}`).not.toContain(
          skipped,
        );
      }
    }
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
