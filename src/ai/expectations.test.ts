import { describe, expect, it } from 'vitest';
import {
  applyJudgement,
  isVisual,
  mergeScreenViews,
  noScreenViews,
  parseScreenViews,
  leaveUnjudged,
  parseExpectations,
  parseJudgement,
  visualDescriptions,
  type ExpectationResult,
  type Judgement,
} from './expectations';

/**
 * What the assistant states about its own program. The vocabulary itself and
 * how it is judged are the schedule's (`../app/driveScript`), tested there;
 * what is tested here is what only the assistant has - the block it writes
 * them in, the one form only it can settle, and the verdict it gives on that.
 */

/** The block's lines, unjudged, as a check would hand them over. */
function stated(block: string): ExpectationResult[] {
  return parseExpectations(block).map((action) => ({
    action,
    outcome: 'unevaluated',
    detail: 'not judged yet',
  }));
}

describe('the block the assistant writes', () => {
  it('reads the vocabulary every caller writes an expectation in', () => {
    expect(
      parseExpectations(
        'WAIT END\nEXPECT "GAME OVER"\nEXPECT VAR TOTAL = 42',
      ).map((a) => a.kind),
    ).toEqual(['waitEnd', 'expect', 'expect']);
  });

  it('still reads what was written before the vocabularies became one', () => {
    // A saved conversation is a record: restoring one must never report the
    // expectations in it as malformed for having been written earlier.
    const restored = parseExpectations(
      'VAR TOTAL = 42\nSCREEN CONTAINS "GAME OVER"\nSCREEN SHOWS a circle',
    );
    expect(restored.map((a) => a.kind)).toEqual(['expect', 'expect', 'expect']);
    expect(restored.some((a) => a.kind === 'malformed')).toBe(false);
  });

  it('keeps a malformed line rather than dropping it', () => {
    // Silently discarding a line reads as one that passed; the assistant can
    // rewrite one it is shown.
    const parsed = parseExpectations(
      'EXPECT VAR A = 1\nthe program should work\nEXPECT VAR B = 2',
    );
    expect(parsed.map((e) => e.kind)).toEqual([
      'expect',
      'malformed',
      'expect',
    ]);
  });

  it('returns nothing for an empty block', () => {
    expect(parseExpectations('')).toEqual([]);
    expect(parseExpectations('   \n  \n')).toEqual([]);
  });
});

describe('the form only the assistant can settle', () => {
  it('is the one an expectation about how the screen looks makes', () => {
    const [shows] = stated('EXPECT SHOWS a circle in the middle');
    expect(isVisual(shows!)).toBe(true);
    expect(visualDescriptions([shows!])).toEqual(['a circle in the middle']);
  });

  it('is not what an expectation about text makes', () => {
    expect(stated('EXPECT "SHOWS"').every((s) => !isVisual(s))).toBe(true);
    expect(visualDescriptions(stated('WAIT END\nEXPECT "HI"'))).toEqual([]);
  });
});

describe('applyJudgement', () => {
  const visuals = (...descriptions: string[]) =>
    stated(descriptions.map((d) => `EXPECT SHOWS ${d}`).join('\n'));

  it('settles each visual expectation with the verdict in its position', () => {
    const results = applyJudgement(visuals('a circle', 'a paddle'), [
      { held: true, detail: 'a circle' },
      { held: false, detail: 'there is no paddle' },
    ]);
    expect(results[0]).toMatchObject({ outcome: 'done', detail: 'a circle' });
    expect(results[1]).toMatchObject({
      outcome: 'failed',
      detail: 'there is no paddle',
    });
  });

  it('leaves an unjudged expectation unchecked rather than passed', () => {
    const results = applyJudgement(visuals('a circle', 'a paddle'), [
      { held: true, detail: 'a circle' },
    ]);
    expect(results[1]).toMatchObject({
      outcome: 'unevaluated',
      detail: 'it was not judged',
    });
  });

  it('leaves the machine-checked expectations exactly as they were', () => {
    const mixed: ExpectationResult[] = [
      {
        action: parseExpectations('EXPECT VAR T = 42')[0]!,
        outcome: 'done',
        detail: 'T holds 42',
      },
      ...visuals('a circle'),
    ];
    const results = applyJudgement(mixed, [{ held: false, detail: 'an egg' }]);
    expect(results[0]).toMatchObject({ outcome: 'done', detail: 'T holds 42' });
    expect(results[1]).toMatchObject({ outcome: 'failed' });
  });

  it('leaveUnjudged says why, and touches nothing else', () => {
    const mixed: ExpectationResult[] = [
      {
        action: parseExpectations('EXPECT VAR T = 42')[0]!,
        outcome: 'failed',
        detail: 'T holds 1, not 42',
      },
      ...visuals('a circle'),
    ];
    const results = leaveUnjudged(mixed, 'the screen cannot be shown');
    expect(results[0]).toMatchObject({ outcome: 'failed' });
    expect(results[1]).toMatchObject({
      outcome: 'unevaluated',
      detail: 'the screen cannot be shown',
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

describe('parseScreenViews', () => {
  it('reads a request to be shown the screen', () => {
    expect(parseScreenViews('SCREEN IMAGE')).toEqual({
      image: true,
      text: false,
      drive: false,
      unknown: [],
    });
  });

  it('reads a request to be shown the screen as text', () => {
    expect(parseScreenViews('SCREEN TEXT')).toEqual({
      image: false,
      text: true,
      drive: false,
      unknown: [],
    });
  });

  it('reads a request for both, which are different questions', () => {
    expect(parseScreenViews('SCREEN IMAGE\nSCREEN TEXT')).toEqual({
      image: true,
      text: true,
      drive: false,
      unknown: [],
    });
  });

  it('forgives the punctuation and casing a model adds', () => {
    expect(parseScreenViews('screen image.')).toEqual({
      image: true,
      text: false,
      drive: false,
      unknown: [],
    });
    expect(parseScreenViews('screen text;')).toEqual({
      image: false,
      text: true,
      drive: false,
      unknown: [],
    });
  });

  it('keeps a view it cannot produce, rather than dropping it', () => {
    expect(parseScreenViews('SCREEN IMAGE\nSCREEN AUDIO')).toEqual({
      image: true,
      text: false,
      drive: false,
      unknown: ['SCREEN AUDIO'],
    });
  });

  it('asks for nothing when the block is empty', () => {
    expect(parseScreenViews('\n  \n')).toEqual({
      image: false,
      text: false,
      drive: false,
      unknown: [],
    });
  });

  it('merges the blocks of one reply into a single request', () => {
    expect(
      mergeScreenViews([
        parseScreenViews('SCREEN IMAGE'),
        parseScreenViews('SCREEN SMELL'),
      ]),
    ).toEqual({
      image: true,
      text: false,
      drive: false,
      unknown: ['SCREEN SMELL'],
    });
  });

  it('merges a text ask named in one block and a picture in another', () => {
    expect(
      mergeScreenViews([
        parseScreenViews('SCREEN TEXT'),
        parseScreenViews('SCREEN IMAGE'),
      ]),
    ).toEqual({ image: true, text: true, drive: false, unknown: [] });
  });

  it('merges nothing into nothing asked for', () => {
    expect(mergeScreenViews([])).toEqual(noScreenViews());
  });
});
