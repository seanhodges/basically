import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Zx81Machine } from '../dialects/zx81/emulator/zx81Machine';
import { zx81KeyboardLayout } from '../dialects/zx81/keyboardLayout';
import { tokenizeProgram } from '../dialects/zx81/tokenizer';
import { buildPFile } from '../dialects/zx81/pfile';
import {
  createMachineControl,
  MAX_DRIVE_FRAMES,
  type MachineControl,
} from './machineControl';

/**
 * Driven against a real ZX81 with its real ROM, not a stub.
 *
 * The whole question these answer is whether a press is held long enough for a
 * ROM's own keyboard scan to notice it, and whether waiting for text sees what
 * the machine actually put on screen. A fake machine would answer neither.
 */
const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../public/roms/zx81/zx81.rom')),
);

function boot(
  source: string,
  /** Hand over the machine's stopping path, as a holder that can step does. */
  stepping = false,
): {
  machine: Zx81Machine;
  control: MachineControl;
} {
  const machine = new Zx81Machine({ rom, ramKb: 16 });
  const { bytes } = tokenizeProgram(source);
  machine.loadProgram(buildPFile(bytes));
  const control = createMachineControl({
    machine,
    layout: zx81KeyboardLayout,
    gamepadMode: 'keymapped',
    fireButtons: 1,
    step: () => machine.runFrame(),
    ...(stepping ? { debugSlice: (opts) => machine.debugStep(opts) } : {}),
  });
  return { machine, control };
}

/** The whole screen as one string, for asking "is this anywhere on it". */
function screen(machine: Zx81Machine): string {
  return (machine.readScreenText()?.lines ?? []).join('\n');
}

describe('waiting for what the program put on screen', () => {
  it('returns as soon as the text is there, without burning the budget', () => {
    const { machine, control } = boot('10 PRINT "READY NOW"\n20 GOTO 20');

    const step = control.waitForText('READY NOW', 400);

    expect(step.ok).toBe(true);
    // The point of waiting on the screen rather than on a frame count: it stops
    // when the program got there, not when a guess ran out.
    expect(step.frames).toBeLessThan(400);
    expect(screen(machine)).toContain('READY NOW');
  });

  it('gives up and says so when the text never appears', () => {
    const { control } = boot('10 PRINT "HELLO"\n20 GOTO 20');

    const step = control.waitForText('NEVER PRINTED', 120);

    // Not an error: the program simply did not get where it was expected to,
    // which is a thing the assistant needs told rather than thrown at it.
    expect(step.ok).toBe(false);
    expect(step.detail).toContain('did not appear');
    expect(step.frames).toBe(120);
  });

  it('matches the way a reader sees a row, not the way the grid stores it', () => {
    const { control } = boot('10 PRINT "A   B"\n20 GOTO 20');

    // The machine pads its rows out with spaces; a match must not depend on
    // how many fell between the words.
    expect(control.waitForText('A B', 400).ok).toBe(true);
  });

  it('refuses to wait for nothing', () => {
    const { control } = boot('10 GOTO 10');
    expect(control.waitForText('   ', 100)).toMatchObject({ ok: false });
  });
});

describe('pressing this machine’s keys', () => {
  it('gets a program past a keypress it was waiting on', () => {
    // INKEY$ loops until something is held - the exact shape that makes an
    // undriven check useless, because the program never reaches its result.
    const { machine, control } = boot(
      '10 PRINT "PRESS"\n20 IF INKEY$="" THEN GOTO 20\n30 PRINT "WENT ON"\n40 GOTO 40',
    );
    control.waitForText('PRESS', 400);

    const step = control.pressKeys(['KeyA']);
    control.advance(60);

    expect(step.ok).toBe(true);
    expect(screen(machine)).toContain('WENT ON');
  });

  it('says which key it does not have, rather than pressing nothing', () => {
    const { control } = boot('10 GOTO 10');

    const step = control.pressKeys(['F13']);

    expect(step.ok).toBe(false);
    expect(step.detail).toContain('no key called "F13"');
    // Nothing was spent finding that out.
    expect(step.frames).toBe(0);
  });

  it('holds for at least as long as this machine’s layout asks', () => {
    const { control } = boot('10 GOTO 10');
    const hold = zx81KeyboardLayout.options?.minHoldFrames ?? 3;

    const step = control.pressKeys(['KeyA']);

    expect(step.frames).toBeGreaterThanOrEqual(hold);
  });

  it('lets go of everything it was holding', () => {
    const { machine, control } = boot('10 GOTO 10');
    const released: string[] = [];
    const realSetKey = machine.setKey.bind(machine);
    machine.setKey = (token: string, down: boolean) => {
      if (!down) released.push(token);
      realSetKey(token, down);
    };

    control.pressKeys(['KeyA']);
    control.releaseAll();

    // A key left down outlives the step that pressed it and corrupts every
    // later one, so this is the invariant that matters most.
    expect(released).toContain('KeyA');
  });
});

describe('waiting for the program to stop', () => {
  it('sees a program that prints and stops, well inside the cap', () => {
    const { machine, control } = boot('10 PRINT "DONE"');

    const step = control.waitForEnd(600);

    expect(step.ok).toBe(true);
    expect(step.frames).toBeLessThan(600);
    expect(control.programState()).toBe(false);
    // The program really did run to its end before the wait came back, rather
    // than the wait answering about a machine that had not started yet.
    expect(screen(machine)).toContain('DONE');
  });

  it('says a program that never stops is still running when the cap runs out', () => {
    const { control } = boot('10 GOTO 10');

    const step = control.waitForEnd(120);

    // An ordinary outcome, like a wait for text that never appears: the
    // program did not get where the schedule expected it to.
    expect(step.ok).toBe(false);
    expect(step.detail).toContain('still running after 120 frames');
    expect(step.frames).toBe(120);
    expect(control.programState()).toBe(true);
  });
});

describe('pressing by the shared vocabulary rather than by this machine’s ids', () => {
  it('drives a program with the names any machine answers to', () => {
    // The same three names a schedule written for another machine would use;
    // the ZX81's own cells behind them are Digit-and-Key ids nobody wrote here.
    const { machine, control } = boot(
      '10 PRINT "PRESS"\n20 IF INKEY$="" THEN GOTO 20\n30 PRINT "WENT ON"\n40 GOTO 40',
    );
    control.waitForText('PRESS', 400);

    expect(control.pressKeys(['A']).ok).toBe(true);
    control.advance(60);
    expect(screen(machine)).toContain('WENT ON');

    expect(control.pressKeys(['SPACE']).ok).toBe(true);
    expect(control.pressKeys(['ENTER']).ok).toBe(true);
  });

  it('presses one cell once for a chord that names it twice', () => {
    // PRESS SHIFT+LEFT resolves to the shift cell and then to shift-plus-a-
    // digit; pressing and releasing one cell twice in a step is bookkeeping
    // nobody needs.
    const { machine, control } = boot('10 GOTO 10');
    const pressed: string[] = [];
    const realSetKey = machine.setKey.bind(machine);
    machine.setKey = (token: string, down: boolean) => {
      if (down) pressed.push(token);
      realSetKey(token, down);
    };

    expect(control.pressKeys(['SHIFT', 'LEFT']).ok).toBe(true);

    expect(pressed).toEqual([...new Set(pressed)]);
    expect(pressed).toContain('Shift');
  });
});

describe('the bound on a step', () => {
  it('caps how much machine time one step may spend', () => {
    const { control } = boot('10 GOTO 10');

    const step = control.advance(MAX_DRIVE_FRAMES * 5);

    expect(step.frames).toBe(MAX_DRIVE_FRAMES);
  });

  it('caps a wait the same way', () => {
    const { control } = boot('10 GOTO 10');

    const step = control.waitForText('NOWHERE', MAX_DRIVE_FRAMES * 5);

    expect(step.frames).toBe(MAX_DRIVE_FRAMES);
  });
});

/**
 * Stopping a program on a line, stepping it and continuing it, against the real
 * ROM.
 *
 * A stub machine would answer every one of these by construction: the questions
 * are whether the ROM's own line cell says what the stepper reads at the moment
 * it pauses, and whether a line the program dwells on is one step rather than
 * one per frame. Only a real machine answers those.
 */
describe('stopping a program on a line', () => {
  it('stops before the line it was told to stop on, and nowhere else', () => {
    const { control } = boot('10 LET A=1\n20 LET A=2\n30 PRINT A\n', true);

    control.setBreakpoints([20]);
    const stop = control.continueRun(400);

    expect(stop.ending).toBe('stopped');
    expect(stop.line).toBe(20);
    // Stopped before the line, not after it: the assignment on 20 has not run.
    expect(control.variables()).toContainEqual(
      expect.objectContaining({ name: 'A', value: '1' }),
    );
    expect(control.position()).toMatchObject({
      canStep: true,
      line: 20,
      running: true,
      breakpoints: [20],
    });
  });

  it('reports the lines in force as it was given them, sorted and deduplicated', () => {
    const { control } = boot('10 PRINT 1\n', true);

    control.setBreakpoints([30, 10, 30]);
    expect(control.breakpoints()).toEqual([10, 30]);
    // A second naming replaces the first rather than adding to it.
    control.setBreakpoints([20]);
    expect(control.breakpoints()).toEqual([20]);
    control.setBreakpoints([]);
    expect(control.breakpoints()).toEqual([]);
  });

  it('steps to the next line, and a line the program dwells on is one step', () => {
    // PAUSE 100 is two seconds of the machine's own time on one line, so a
    // stepper that stopped when its frame budget ran out rather than when the
    // line changed would land on line 20 still.
    const { machine, control } = boot(
      '10 LET A=1\n20 PAUSE 100\n30 PRINT A\n',
      true,
    );

    control.setBreakpoints([20]);
    expect(control.continueRun(400).line).toBe(20);

    const step = control.stepLine(400);

    expect(step.ending).toBe('stopped');
    expect(step.line).toBe(30);
    // Many frames, one step - and the cost is reported in the machine's own
    // time rather than the host's.
    expect(step.frames).toBeGreaterThan(1);
    expect(step.seconds).toBeCloseTo(step.frames / machine.frameHz, 5);
  });

  it('continues off a line that is itself a stop rather than stopping again at once', () => {
    const { control } = boot(
      '10 LET A=0\n20 LET A=A+1\n30 IF A<3 THEN GOTO 20\n40 PRINT A\n',
      true,
    );

    control.setBreakpoints([20]);
    expect(control.continueRun(400).line).toBe(20);
    const again = control.continueRun(400);

    // Round the loop once and back to 20, rather than re-triggering on the line
    // execution resumed from.
    expect(again.ending).toBe('stopped');
    expect(again.line).toBe(20);
    expect(control.variables()).toContainEqual(
      expect.objectContaining({ name: 'A', value: '1' }),
    );
  });

  it('says the program ended rather than naming a line it never reached', () => {
    const { control } = boot('10 LET A=1\n20 PRINT A\n', true);

    control.setBreakpoints([20]);
    expect(control.continueRun(400).line).toBe(20);
    const off = control.stepLine(400);

    expect(off.ending).toBe('ended');
    expect(off.line).toBeNull();
    // And where the program is, afterwards, is nowhere rather than the last
    // line the machine's own cell still holds.
    expect(control.position()).toMatchObject({ line: null, running: false });
  });

  it('exhausts its bound on a program that will not finish, and says so', () => {
    const { control } = boot('10 GOTO 10\n', true);

    const ran = control.continueRun(30);

    // An ordinary outcome: 10 GOTO 10 is an ordinary BASIC program.
    expect(ran.ending).toBe('exhausted');
    expect(ran.frames).toBe(30);
    expect(control.programState()).toBe(true);
  });

  it('never spends more frames than the waits beside it may', () => {
    const { control } = boot('10 GOTO 10\n', true);

    expect(control.continueRun(MAX_DRIVE_FRAMES * 10).frames).toBe(
      MAX_DRIVE_FRAMES,
    );
  });

  it('says a machine with no stopping path cannot be stepped', () => {
    // The holder handed none, which is what a machine with no `debugStep` does.
    const { control } = boot('10 PRINT 1\n');

    expect(control.canStep()).toBe(false);
    expect(control.position().canStep).toBe(false);
    for (const ran of [control.stepLine(100), control.continueRun(100)]) {
      expect(ran.ending).toBe('cannot-step');
      expect(ran.frames).toBe(0);
      expect(ran.line).toBeNull();
    }
  });
});
