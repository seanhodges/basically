import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Zx81Machine } from '../dialects/zx81/emulator/zx81Machine';
import { zx81KeyboardLayout } from '../dialects/zx81/keyboardLayout';
import { tokenizeProgram } from '../dialects/zx81/tokenizer';
import { buildPFile } from '../dialects/zx81/pfile';
import {
  createMachineControl,
  forgetMachineControl,
  freezeMachine,
  hasMachineControl,
  machineControl,
  machineFrozen,
  ownsMachine,
  registerMachineControl,
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
  readFileSync(join(__dirname, '../../public/roms/zx81.rom')),
);

function boot(source: string): {
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

describe('the registry', () => {
  it('hands out the driver the pane registered, and takes it back', () => {
    forgetMachineControl();
    expect(hasMachineControl()).toBe(false);

    const { control } = boot('10 GOTO 10');
    const unregister = registerMachineControl(control);
    expect(machineControl()).toBe(control);

    unregister();
    // A machine that is gone must not be drivable, or an answer about this
    // program could be checked against the last one.
    expect(machineControl()).toBeNull();
    expect(hasMachineControl()).toBe(false);
  });

  it('thaws the machine when the driver goes away', () => {
    forgetMachineControl();
    const { control } = boot('10 GOTO 10');
    const unregister = registerMachineControl(control);

    freezeMachine(true);
    expect(machineFrozen()).toBe(true);
    unregister();

    // Otherwise a frozen machine outlives the turn that froze it and the
    // user's own run never advances again.
    expect(machineFrozen()).toBe(false);
  });

  it('thaws the machine when the driver is forgotten outright', () => {
    forgetMachineControl();
    const { control } = boot('10 GOTO 10');
    registerMachineControl(control);
    freezeMachine(true);

    forgetMachineControl();

    // This is the path a run the user started takes: the pane drops the driver
    // rather than unregistering a particular one, and a drop that left the
    // machine frozen would strand the very run that asked for it.
    expect(machineFrozen()).toBe(false);
  });

  it('says which driver owns the machine', () => {
    forgetMachineControl();
    const first = boot('10 GOTO 10').control;
    const second = boot('10 GOTO 10').control;

    registerMachineControl(first);
    expect(ownsMachine(first)).toBe(true);

    // A new run registers over the old driver, and the turn still holding the
    // old one has to be able to find that out: its own reference goes on
    // working, so nothing else would tell it the machine had moved on.
    registerMachineControl(second);
    expect(ownsMachine(first)).toBe(false);
    expect(ownsMachine(second)).toBe(true);

    forgetMachineControl();
    expect(ownsMachine(second)).toBe(false);
  });

  it('cannot be thawed by the unregister of a driver already replaced', () => {
    forgetMachineControl();
    const first = boot('10 GOTO 10').control;
    const second = boot('10 GOTO 10').control;
    const unregisterFirst = registerMachineControl(first);
    registerMachineControl(second);

    freezeMachine(true);
    unregisterFirst();

    // The pane drops and re-registers a driver on every run, so a stale
    // unregister firing late must not reach past its own driver and thaw - or
    // drop - the machine that replaced it.
    expect(machineFrozen()).toBe(true);
    expect(machineControl()).toBe(second);
  });
});
