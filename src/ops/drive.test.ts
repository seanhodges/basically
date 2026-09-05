import { describe, expect, it } from 'vitest';
import { stepLines } from '../app/driveScript';
import { describeScreen, driveOp, lookOp, screenshotOp } from './drive';
import { pureContext, stubSession } from './testSupport';

describe('driving through the operation', () => {
  it('runs the script over the session and reports the screen it left', () => {
    const session = stubSession();
    const outcome = driveOp.run(
      { script: 'WAIT FOR "GO"; PRESS A' },
      pureContext({ session }),
    );
    expect(outcome).toMatchObject({ ok: true, sentInput: true });
    expect(stepLines(outcome.steps)).toEqual(['"GO" appeared', 'pressed A']);
    expect(session.pressed).toEqual(['A']);
    expect(driveOp.failed!(outcome)).toBe(false);
    expect(driveOp.describe(outcome)).toContain('pressed A');
    expect(driveOp.describe(outcome)).toContain('READY');
  });

  it('reports driving that failed as the driving failing', () => {
    const session = stubSession({
      pressKeys: () => ({
        ok: false,
        frames: 0,
        detail: 'this machine has no key called "F13"',
      }),
    });
    const outcome = driveOp.run(
      { script: 'PRESS F13' },
      pureContext({ session }),
    );
    expect(outcome.ok).toBe(false);
    expect(driveOp.failed!(outcome)).toBe(true);
    expect(driveOp.describe(outcome)).toContain('no key called');
  });

  it('describes every action a schedule accepts, and how they are separated', () => {
    const text = driveOp.description!;
    for (const word of ['PRESS', 'JOY', 'WAIT <n>', 'WAIT FOR', 'WAIT END']) {
      expect(text).toContain(word);
    }
    expect(text).toContain('";"');
  });
});

describe('looking', () => {
  it('reads the screen without touching anything', () => {
    const session = stubSession();
    const outcome = lookOp.run({}, pureContext({ session }));
    expect(lookOp.describe(outcome)).toContain('READY');
    expect(session.pressed).toEqual([]);
  });

  it('says when the screen cannot be read', () => {
    expect(describeScreen(null)).toContain('cannot be read');
  });
});

describe('a picture of the screen', () => {
  it('is what the session captured', () => {
    const picture = { width: 4, height: 2, png: 'AAAA' };
    const session = stubSession({ capture: () => picture });
    expect(screenshotOp.run({}, pureContext({ session }))).toEqual({ picture });
    expect(screenshotOp.describe({ picture })).toContain('4x2');
    expect(screenshotOp.describe({ picture: null })).toContain('No picture');
  });
});
