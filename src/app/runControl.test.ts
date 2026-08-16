import { describe, it, expect } from 'vitest';
import type { EmulatorStatus } from './store';
import {
  runControlStateOf,
  runControlGlyph,
  runControlLabel,
  canPauseRun,
} from './runControl';

/** Every run state the store can hold, so the mapping is checked exhaustively. */
const ALL_STATUSES: EmulatorStatus[] = ['stopped', 'running', 'paused'];

/** A debuggable machine running the program the user started. */
const RUNNING = { pausable: true, programEnded: false };

describe('runControlStateOf', () => {
  it('offers Play stopped, Pause running, and Continue paused', () => {
    expect(runControlStateOf('stopped', RUNNING)).toBe('play');
    expect(runControlStateOf('running', RUNNING)).toBe('pause');
    expect(runControlStateOf('paused', RUNNING)).toBe('continue');
  });

  it('gives every run state a position', () => {
    for (const status of ALL_STATUSES) {
      for (const pausable of [true, false]) {
        for (const programEnded of [true, false]) {
          expect(runControlStateOf(status, { pausable, programEnded })).toMatch(
            /^(play|pause|continue)$/,
          );
        }
      }
    }
  });

  it('never offers to restart a program that is running or paused', () => {
    // The bug this control replaces: the button was always Play, so a tap
    // mid-run silently restarted the program the user was watching.
    expect(runControlStateOf('running', RUNNING)).not.toBe('play');
    expect(runControlStateOf('paused', RUNNING)).not.toBe('play');
  });

  it('keeps the plain Play on a machine that cannot be paused', () => {
    // Pausing is offered only where continuing is. On a machine with no
    // debugger the control goes on being what it always was.
    expect(runControlStateOf('stopped', { ...RUNNING, pausable: false })).toBe(
      'play',
    );
    expect(runControlStateOf('running', { ...RUNNING, pausable: false })).toBe(
      'play',
    );
  });

  it('still offers Continue to a run that is somehow paused', () => {
    // Unreachable while the machine stays put, but a pause must never be left
    // with no way out - switching machines mid-pause must not strand one.
    expect(runControlStateOf('paused', { ...RUNNING, pausable: false })).toBe(
      'continue',
    );
  });

  it('goes back to Play when the program ends under a running machine', () => {
    // The machine is still on - it sits at its prompt - but the program the
    // Pause was offered against is over, and offering to pause a prompt would
    // hold a machine still for no reason the user asked for.
    expect(
      runControlStateOf('running', { ...RUNNING, programEnded: true }),
    ).toBe('play');
  });

  it('offers no Continue for a program that ended before the pause', () => {
    // A pause taken on the frame a program ended has nothing to carry on; the
    // control offers the run again rather than a Continue that resumes a
    // prompt.
    expect(
      runControlStateOf('paused', { ...RUNNING, programEnded: true }),
    ).toBe('play');
  });

  it('goes on offering Pause where a finish cannot be observed', () => {
    // Machines that cannot say whether a program is still running never report
    // one ending, so `programEnded` stays false and the run is pausable until
    // the user stops it. Nothing here can improve on that - the ROM does not
    // separate the two states.
    expect(runControlStateOf('running', RUNNING)).toBe('pause');
  });
});

describe('runControlGlyph', () => {
  it('shares the play triangle between Play and Continue', () => {
    expect(runControlGlyph('play')).toBe('▶');
    expect(runControlGlyph('continue')).toBe('▶');
  });

  it('shows bars for Pause, in text presentation', () => {
    const glyph = runControlGlyph('pause');
    expect(glyph).toBe('❚❚');
    // U+23F8 renders as a colour emoji in most browsers; U+275A does not.
    expect(glyph).not.toContain('⏸');
  });
});

describe('runControlLabel', () => {
  it('names the run target when there is one', () => {
    expect(runControlLabel('play', 'ZX81')).toBe(
      'Build and run ZX81 in the emulator',
    );
    expect(runControlLabel('play')).toBe('Build and run in the emulator');
    expect(runControlLabel('play', null)).toBe('Build and run in the emulator');
  });

  it('says what pressing the control does in the other two states', () => {
    expect(runControlLabel('pause')).toBe('Pause the running program');
    expect(runControlLabel('continue')).toBe('Continue the paused program');
  });

  it('calls carrying a paused run on "Continue", not "Resume"', () => {
    // One word for one action: the toolbar and the shortcuts already say
    // Continue, whether the pause came from a breakpoint or from the user.
    expect(runControlLabel('continue')).toContain('Continue');
    expect(runControlLabel('continue')).not.toMatch(/resume/i);
  });

  it('gives each state a distinct label', () => {
    const labels = new Set([
      runControlLabel('play'),
      runControlLabel('pause'),
      runControlLabel('continue'),
    ]);
    expect(labels.size).toBe(3);
  });
});

describe('canPauseRun', () => {
  const ok = {
    debuggable: true,
    checking: false,
    driving: false,
    drawn: true,
  };

  it('allows a pause once a frame is on screen', () => {
    expect(canPauseRun(ok)).toBe(true);
  });

  it('refuses on a machine with no line-level debugger', () => {
    // Nothing would release the pause: the toolbar's Continue and the F8
    // shortcut are both offered only on machines that can be stepped.
    expect(canPauseRun({ ...ok, debuggable: false })).toBe(false);
  });

  it('refuses while a run is checking an assistant answer', () => {
    // The verdict is reached from inside the frame loop, so a paused loop
    // would leave the assistant waiting on one that can never arrive.
    expect(canPauseRun({ ...ok, checking: true })).toBe(false);
  });

  it('refuses while the assistant is driving the machine', () => {
    // It advances the machine outside this loop, so a "paused" machine would
    // visibly keep moving.
    expect(canPauseRun({ ...ok, driving: true })).toBe(false);
  });

  it('refuses before the first frame is drawn', () => {
    // The loading overlay is dismissed by the first rendered frame.
    expect(canPauseRun({ ...ok, drawn: false })).toBe(false);
  });
});
