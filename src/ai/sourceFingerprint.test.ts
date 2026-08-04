import { describe, expect, it } from 'vitest';
import { hasMovedOn, sourceFingerprint } from './sourceFingerprint';

describe('sourceFingerprint', () => {
  it('is stable for the same program', () => {
    expect(sourceFingerprint('10 PRINT "HI"\n')).toBe(
      sourceFingerprint('10 PRINT "HI"\n'),
    );
  });

  it('differs for an edited program', () => {
    expect(sourceFingerprint('10 PRINT "HI"\n')).not.toBe(
      sourceFingerprint('10 PRINT "HO"\n'),
    );
  });

  it('is a fixed-width hex string, so storage cost does not grow', () => {
    // The reason it is a hash at all: an already program-heavy conversation
    // would otherwise double what it puts in localStorage.
    expect(sourceFingerprint('')).toMatch(/^[0-9a-f]{8}$/);
    expect(sourceFingerprint('10 REM '.repeat(500))).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('hasMovedOn', () => {
  const ANSWERED_ABOUT = '10 CLS\n20 GOTO 10\n';

  it('says no while the editor still holds the program answered about', () => {
    expect(hasMovedOn(ANSWERED_ABOUT, ANSWERED_ABOUT)).toBe(false);
  });

  it('says yes once the user has edited it', () => {
    expect(hasMovedOn(ANSWERED_ABOUT, '10 CLS\n20 PRINT\n30 GOTO 10\n')).toBe(
      true,
    );
  });

  it('says yes when the user applies an answer into the editor', () => {
    // The case this exists for: applying and running is what the user does
    // while reading a reply, and it is what makes an unrequested correction -
    // or a check that would seize the machine they just started - work on a
    // question they have already moved past.
    expect(hasMovedOn(ANSWERED_ABOUT, '10 PLOT 1,1\n')).toBe(true);
  });

  it('asks about the program answered about, not the one that ran', () => {
    // A checked answer is by definition not what the editor holds. Comparing
    // the program that ran would report "moved on" every single time, and every
    // unrequested correction would be silently disabled.
    const ranCandidate = '10 PRINT "THE ANSWER BEING CHECKED"\n';
    expect(hasMovedOn(ANSWERED_ABOUT, ANSWERED_ABOUT)).toBe(false);
    expect(hasMovedOn(ranCandidate, ANSWERED_ABOUT)).toBe(true);
  });
});
