import { describe, expect, it } from 'vitest';
import type { MachineScreenText, MachineVariable } from '../dialects/types';
import {
  evaluateExpectations,
  parseExpectations,
  type Expectation,
} from './expectations';

/** A screen of fixed-width rows, padded the way a real reader pads them. */
function screen(lines: string[], cols = 32): MachineScreenText {
  return {
    lines: lines.map((l) => l.padEnd(cols, ' ').slice(0, cols)),
    cols,
    rows: lines.length,
  };
}

function num(name: string, value: string): MachineVariable {
  return { name, kind: 'number', value };
}

function str(name: string, value: string): MachineVariable {
  return { name, kind: 'string', value };
}

describe('parseExpectations', () => {
  it('reads the VAR form', () => {
    expect(parseExpectations('VAR TOTAL = 42')).toEqual<Expectation[]>([
      { kind: 'var', name: 'TOTAL', expected: '42', source: 'VAR TOTAL = 42' },
    ]);
  });

  it('reads the SCREEN CONTAINS form, dropping the quotes', () => {
    const [e] = parseExpectations('SCREEN CONTAINS "GAME OVER"');
    expect(e).toEqual({
      kind: 'screen',
      needle: 'GAME OVER',
      source: 'SCREEN CONTAINS "GAME OVER"',
    });
  });

  it('accepts an unquoted screen needle', () => {
    const [e] = parseExpectations('SCREEN CONTAINS READY');
    expect(e).toMatchObject({ kind: 'screen', needle: 'READY' });
  });

  it('is case-insensitive about the keywords but not the values', () => {
    const [e] = parseExpectations('var Name$ = "Bob"');
    expect(e).toMatchObject({ kind: 'var', name: 'Name$', expected: '"Bob"' });
  });

  it('keeps string and typed variable names as written', () => {
    const parsed = parseExpectations('VAR N$ = "HI"\nVAR T% = 7');
    expect(parsed.map((e) => (e.kind === 'var' ? e.name : ''))).toEqual([
      'N$',
      'T%',
    ]);
  });

  it('keeps a malformed line rather than dropping it', () => {
    const parsed = parseExpectations(
      'VAR A = 1\nthe program should work\nVAR B = 2',
    );
    expect(parsed.map((e) => e.kind)).toEqual(['var', 'malformed', 'var']);
    expect(parsed[1]).toEqual({
      kind: 'malformed',
      source: 'the program should work',
    });
  });

  it('treats a VAR with no value as malformed', () => {
    expect(parseExpectations('VAR A =')[0]!.kind).toBe('malformed');
  });

  it('treats an empty screen needle as malformed - it asserts nothing', () => {
    expect(parseExpectations('SCREEN CONTAINS ""')[0]!.kind).toBe('malformed');
  });

  it('ignores blank lines and surrounding whitespace', () => {
    const parsed = parseExpectations('\n\n   VAR A = 1   \n\n  \n');
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ kind: 'var', name: 'A', expected: '1' });
  });

  it('returns nothing for an empty block', () => {
    expect(parseExpectations('')).toEqual([]);
    expect(parseExpectations('   \n  \n')).toEqual([]);
  });
});

describe('evaluateExpectations - variables', () => {
  const readings = (variables: MachineVariable[] | null) => ({
    variables,
    screen: screen(['READY.']),
  });

  it('passes an exact match', () => {
    const results = evaluateExpectations(
      parseExpectations('VAR A = 42'),
      readings([num('A', '42')]),
    );
    expect(results[0]).toMatchObject({ status: 'passed', actual: '42' });
  });

  it('fails a different value, reporting what the machine said', () => {
    const results = evaluateExpectations(
      parseExpectations('VAR A = 42'),
      readings([num('A', '41')]),
    );
    expect(results[0]).toMatchObject({ status: 'failed', actual: '41' });
  });

  it('compares numbers numerically, not as text', () => {
    for (const [expected, actual] of [
      ['42', '42.0'],
      ['42', ' 42'],
      ['42.0', '42'],
      ['0.5', '.5'],
      ['1e2', '100'],
      ['-3', '-3.00'],
    ]) {
      const results = evaluateExpectations(
        parseExpectations(`VAR A = ${expected}`),
        readings([num('A', actual!)]),
      );
      expect(results[0]!.status, `${expected} vs ${actual}`).toBe('passed');
    }
  });

  it('does not let numeric leniency forgive a different number', () => {
    const results = evaluateExpectations(
      parseExpectations('VAR A = 42'),
      readings([num('A', '42.5')]),
    );
    expect(results[0]!.status).toBe('failed');
  });

  it('makes quotes optional on both sides', () => {
    // The machine reports a string already quoted; the assistant may write it
    // either way and mean the same thing.
    for (const written of ['"HELLO"', 'HELLO']) {
      const results = evaluateExpectations(
        parseExpectations(`VAR N$ = ${written}`),
        readings([str('N$', '"HELLO"')]),
      );
      expect(results[0]!.status, written).toBe('passed');
    }
  });

  it('compares string values exactly once the quotes are off', () => {
    const results = evaluateExpectations(
      parseExpectations('VAR N$ = "hello"'),
      readings([str('N$', '"HELLO"')]),
    );
    expect(results[0]!.status).toBe('failed');
  });

  it('matches the variable name case-insensitively', () => {
    const results = evaluateExpectations(
      parseExpectations('VAR total = 7'),
      readings([num('TOTAL', '7')]),
    );
    expect(results[0]!.status).toBe('passed');
  });

  it('fails when no variable of that name exists', () => {
    const results = evaluateExpectations(
      parseExpectations('VAR A = 1'),
      readings([num('B', '1')]),
    );
    expect(results[0]).toMatchObject({
      status: 'failed',
      reason: 'no variable of that name',
    });
  });

  it('is unchecked on a machine that cannot report variables', () => {
    const results = evaluateExpectations(
      parseExpectations('VAR A = 1'),
      readings(null),
    );
    expect(results[0]).toMatchObject({
      status: 'unchecked',
      reason: 'this machine cannot report its variables',
    });
  });

  it('never matches an element against an array-shaped value', () => {
    // Arrays report a shape plus a truncated preview, so there is no element to
    // compare with - the expectation fails rather than accidentally matching.
    const arr: MachineVariable = {
      name: 'B()',
      kind: 'number-array',
      value: '(10) = 1, 2, 3, …',
    };
    expect(
      evaluateExpectations(
        parseExpectations('VAR B(0) = 1'),
        readings([arr]),
      )[0],
    ).toMatchObject({ status: 'failed' });
    expect(
      evaluateExpectations(
        parseExpectations('VAR B() = 1'),
        readings([arr]),
      )[0],
    ).toMatchObject({ status: 'failed' });
  });
});

describe('evaluateExpectations - screen', () => {
  const readings = (lines: string[] | null) => ({
    variables: [],
    screen: lines === null ? null : screen(lines),
  });

  it('passes text present on a row', () => {
    const results = evaluateExpectations(
      parseExpectations('SCREEN CONTAINS "GAME OVER"'),
      readings(['', 'GAME OVER', 'READY.']),
    );
    expect(results[0]!.status).toBe('passed');
  });

  it('fails text that is nowhere on the screen', () => {
    const results = evaluateExpectations(
      parseExpectations('SCREEN CONTAINS "GAME OVER"'),
      readings(['READY.']),
    );
    expect(results[0]!.status).toBe('failed');
  });

  it('collapses runs of spaces on both sides', () => {
    const results = evaluateExpectations(
      parseExpectations('SCREEN CONTAINS "TOTAL 42"'),
      readings(['TOTAL     42']),
    );
    expect(results[0]!.status).toBe('passed');
  });

  it('never matches across a row boundary', () => {
    // "GAME" ends one row and "OVER" starts the next: on a fixed-width machine
    // that is a wrap, and asserting across it would assert about the width.
    const results = evaluateExpectations(
      parseExpectations('SCREEN CONTAINS "GAME OVER"'),
      readings(['GAME', 'OVER']),
    );
    expect(results[0]!.status).toBe('failed');
  });

  it('treats case as significant', () => {
    const results = evaluateExpectations(
      parseExpectations('SCREEN CONTAINS "Game Over"'),
      readings(['GAME OVER']),
    );
    expect(results[0]!.status).toBe('failed');
  });

  it('is unchecked when the screen could not be read', () => {
    const results = evaluateExpectations(
      parseExpectations('SCREEN CONTAINS "HI"'),
      readings(null),
    );
    expect(results[0]).toMatchObject({
      status: 'unchecked',
      reason: 'the screen could not be read',
    });
  });

  it('matches a row of astral block graphics by code point', () => {
    const results = evaluateExpectations(
      parseExpectations('SCREEN CONTAINS "\u{1FB00}\u{1FB01}"'),
      readings(['\u{1FB00}\u{1FB01}']),
    );
    expect(results[0]!.status).toBe('passed');
  });
});

describe('evaluateExpectations - malformed', () => {
  it('reports a malformed line as unchecked, never as passed', () => {
    const results = evaluateExpectations(
      parseExpectations('do the right thing'),
      {
        variables: [],
        screen: screen(['READY.']),
      },
    );
    expect(results[0]).toMatchObject({
      status: 'unchecked',
      reason: 'not a recognised expectation',
    });
  });
});
