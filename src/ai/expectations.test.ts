import { describe, expect, it } from 'vitest';
import type { MachineScreenText, MachineVariable } from '../dialects/types';
import {
  applyJudgement,
  evaluateExpectations,
  mergeScreenViews,
  noScreenViews,
  parseScreenViews,
  leaveUnjudged,
  parseExpectations,
  parseJudgement,
  type Expectation,
  type Judgement,
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

describe('the visual form', () => {
  it('reads SCREEN SHOWS as an expectation only a look can settle', () => {
    expect(
      parseExpectations('SCREEN SHOWS a circle in the middle of the screen'),
    ).toEqual<Expectation[]>([
      {
        kind: 'visual',
        description: 'a circle in the middle of the screen',
        source: 'SCREEN SHOWS a circle in the middle of the screen',
      },
    ]);
  });

  it('drops surrounding quotes, as the text form does', () => {
    const [e] = parseExpectations('SCREEN SHOWS "a maze with no gaps"');
    expect(e).toMatchObject({
      kind: 'visual',
      description: 'a maze with no gaps',
    });
  });

  it('treats a SCREEN SHOWS with nothing described as malformed', () => {
    expect(parseExpectations('SCREEN SHOWS   ')[0]!.kind).toBe('malformed');
  });

  it('does not swallow the SCREEN CONTAINS form', () => {
    expect(parseExpectations('SCREEN CONTAINS "SHOWS"')[0]!.kind).toBe(
      'screen',
    );
  });

  it('is unchecked from the machine, never passed and never failed', () => {
    const results = evaluateExpectations(
      parseExpectations('SCREEN SHOWS a ball bouncing off the paddle'),
      { variables: [], screen: screen(['READY.']) },
    );
    expect(results[0]).toMatchObject({
      status: 'unchecked',
      reason: 'the screen has not been looked at',
    });
  });
});

describe('parseJudgement', () => {
  it('reads a verdict per line, in order', () => {
    expect(
      parseJudgement('PASS the maze fills the screen\nFAIL nothing is drawn'),
    ).toEqual<Judgement[]>([
      { held: true, detail: 'the maze fills the screen' },
      { held: false, detail: 'nothing is drawn' },
    ]);
  });

  it('accepts the punctuation a model tends to add', () => {
    expect(parseJudgement('PASS: a circle\nfail - it is an egg')).toEqual<
      Judgement[]
    >([
      { held: true, detail: 'a circle' },
      { held: false, detail: 'it is an egg' },
    ]);
  });

  it('skips anything that is not a verdict', () => {
    expect(parseJudgement('Looking at the screen:\n\nPASS a circle')).toEqual([
      { held: true, detail: 'a circle' },
    ]);
  });
});

describe('applyJudgement', () => {
  const visuals = (...descriptions: string[]) =>
    evaluateExpectations(
      parseExpectations(
        descriptions.map((d) => `SCREEN SHOWS ${d}`).join('\n'),
      ),
      { variables: [], screen: null },
    );

  it('settles each visual expectation with the verdict in its position', () => {
    const results = applyJudgement(visuals('a circle', 'a paddle'), [
      { held: true, detail: 'a circle' },
      { held: false, detail: 'there is no paddle' },
    ]);
    expect(results[0]).toMatchObject({ status: 'passed' });
    expect(results[1]).toMatchObject({
      status: 'failed',
      actual: 'there is no paddle',
    });
  });

  it('leaves an unjudged expectation unchecked rather than passed', () => {
    const results = applyJudgement(visuals('a circle', 'a paddle'), [
      { held: true, detail: 'a circle' },
    ]);
    expect(results[1]).toMatchObject({
      status: 'unchecked',
      reason: 'it was not judged',
    });
  });

  it('leaves the machine-checked expectations exactly as they were', () => {
    const mixed = evaluateExpectations(
      parseExpectations('VAR T = 42\nSCREEN SHOWS a circle'),
      { variables: [num('T', '42')], screen: null },
    );
    const results = applyJudgement(mixed, [{ held: false, detail: 'an egg' }]);
    expect(results[0]).toMatchObject({ status: 'passed' });
    expect(results[1]).toMatchObject({ status: 'failed' });
  });

  it('leaveUnjudged says why, and touches nothing else', () => {
    const mixed = evaluateExpectations(
      parseExpectations('VAR T = 42\nSCREEN SHOWS a circle'),
      { variables: [num('T', '1')], screen: null },
    );
    const results = leaveUnjudged(mixed, 'the screen cannot be shown');
    expect(results[0]).toMatchObject({ status: 'failed' });
    expect(results[1]).toMatchObject({
      status: 'unchecked',
      reason: 'the screen cannot be shown',
    });
  });
});

describe('parseScreenViews', () => {
  it('reads a request to be shown the screen', () => {
    expect(parseScreenViews('SCREEN IMAGE')).toEqual({
      image: true,
      text: false,
      unknown: [],
    });
  });

  it('reads a request to be shown the screen as text', () => {
    expect(parseScreenViews('SCREEN TEXT')).toEqual({
      image: false,
      text: true,
      unknown: [],
    });
  });

  it('reads a request for both, which are different questions', () => {
    expect(parseScreenViews('SCREEN IMAGE\nSCREEN TEXT')).toEqual({
      image: true,
      text: true,
      unknown: [],
    });
  });

  it('forgives the punctuation and casing a model adds', () => {
    expect(parseScreenViews('screen image.')).toEqual({
      image: true,
      text: false,
      unknown: [],
    });
    expect(parseScreenViews('screen text;')).toEqual({
      image: false,
      text: true,
      unknown: [],
    });
  });

  it('keeps a view it cannot produce, rather than dropping it', () => {
    expect(parseScreenViews('SCREEN IMAGE\nSCREEN AUDIO')).toEqual({
      image: true,
      text: false,
      unknown: ['SCREEN AUDIO'],
    });
  });

  it('asks for nothing when the block is empty', () => {
    expect(parseScreenViews('\n  \n')).toEqual({
      image: false,
      text: false,
      unknown: [],
    });
  });

  it('merges the blocks of one reply into a single request', () => {
    expect(
      mergeScreenViews([
        parseScreenViews('SCREEN IMAGE'),
        parseScreenViews('SCREEN SMELL'),
      ]),
    ).toEqual({ image: true, text: false, unknown: ['SCREEN SMELL'] });
  });

  it('merges a text ask named in one block and a picture in another', () => {
    expect(
      mergeScreenViews([
        parseScreenViews('SCREEN TEXT'),
        parseScreenViews('SCREEN IMAGE'),
      ]),
    ).toEqual({ image: true, text: true, unknown: [] });
  });

  it('merges nothing into nothing asked for', () => {
    expect(mergeScreenViews([])).toEqual(noScreenViews());
  });
});
