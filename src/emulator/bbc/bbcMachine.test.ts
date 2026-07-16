import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { BbcMachine, configureNodeRomPath } from './bbcMachine';
import { tokenizeProgram } from '../../dialects/bbcmicro/tokenizer';
import type { MachineFileEntry, MachineFileStore } from '../../dialects/types';
import { WRITE_BIT } from '../memoryActivityBuffer';

// Point jsbeeb's ROM loader at the real ROMs shipped in its npm package.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

/** Mode-7 screen RAM (0x7C00–0x7FFF) as a string of printable characters. */
function screenText(machine: BbcMachine): string {
  let text = '';
  for (let addr = 0x7c00; addr < 0x8000; addr++) {
    const b = machine.processor.readmem(addr);
    text += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ' ';
  }
  return text;
}

/** Run frames (yielding to the microtask queue) until the predicate holds. */
async function runUntil(
  machine: BbcMachine,
  predicate: () => boolean,
  maxFrames = 500,
): Promise<boolean> {
  for (let i = 0; i < maxFrames; i++) {
    machine.runFrame();
    if (predicate()) return true;
    // Let async work (ROM loads, the tokenizer pipeline) make progress.
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return predicate();
}

describe('BbcMachine (jsbeeb adapter)', () => {
  it('boots the OS to the BASIC banner in mode 7', async () => {
    const machine = new BbcMachine();
    await machine.whenReady();
    const booted = await runUntil(machine, () => {
      const text = screenText(machine);
      return text.includes('BBC Computer 32K') && text.includes('BASIC');
    });
    expect(booted).toBe(true);
    machine.dispose();
  }, 30000);

  it('loads and runs a BASIC program', async () => {
    const machine = new BbcMachine();
    const { bytes } = tokenizeProgram('10 PRINT "HELLO BEEB"\n20 END\n');
    machine.loadProgram(bytes);
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('HELLO BEEB'),
    );
    expect(ran).toBe(true);
    machine.dispose();
  }, 60000);

  it('reports plausible actual RAM figures while a program runs', async () => {
    const machine = new BbcMachine();
    expect(machine.readMemoryStats()).toBeNull(); // not initialised yet
    const { bytes } = tokenizeProgram(
      '10 DIM A(500)\n20 PRINT "HELLO BEEB"\n30 END\n',
    );
    machine.loadProgram(bytes);
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('HELLO BEEB'),
    );
    expect(ran).toBe(true);
    const stats = machine.readMemoryStats();
    expect(stats).not.toBeNull();
    // 500 five-byte reals ≈ 2.5K of variables beyond the program text.
    expect(stats!.used).toBeGreaterThan(2500);
    expect(stats!.free).toBeGreaterThan(0);
    // PAGE (&0E00) to HIMEM (&7C00 in mode 7) on a Model B.
    expect(stats!.used + stats!.free).toBeLessThanOrEqual(0x7c00 - 0x0e00);
    machine.dispose();
  }, 60000);

  it('records live memory activity only while enabled', async () => {
    const machine = new BbcMachine();
    // Off by default: nothing to drain even after running.
    machine.loadProgram(tokenizeProgram('10 A=1\n20 GOTO 10\n').bytes);
    await runUntil(machine, () => machine.currentLine() !== null);
    expect(machine.drainMemoryActivity()).toBeNull();

    machine.setMemoryActivityRecording(true);
    for (let i = 0; i < 3; i++) machine.runFrame();
    const hits = machine.drainMemoryActivity();
    expect(hits).not.toBeNull();
    expect(hits!.length).toBe(0x10000);
    // The BASIC ROM (sideways bank at 0x8000-0xBFFF) is executed constantly, so
    // some address there must have been read while the program looped.
    let romTouched = false;
    for (let a = 0x8000; a < 0xc000; a++) if (hits![a]) romTouched = true;
    expect(romTouched).toBe(true);
    // The zero-page interpreter pointer is written as BASIC runs.
    let zpWritten = false;
    for (let a = 0; a < 0x100; a++)
      if ((hits![a]! & WRITE_BIT) !== 0) zpWritten = true;
    expect(zpWritten).toBe(true);

    // Disabling stops recording and drops accumulated hits.
    machine.setMemoryActivityRecording(false);
    machine.runFrame();
    expect(machine.drainMemoryActivity()).toBeNull();
    machine.dispose();
  }, 60000);

  it('takes more frames to finish the same program at a slower speed', async () => {
    // A busy loop long enough that its completion spans many frames, so the
    // run (not just boot) is what setSpeed throttles.
    const src = '10 FOR I=1 TO 5000\n20 NEXT I\n30 PRINT "DONE"\n40 END\n';
    async function framesToDone(speed: number): Promise<number> {
      const machine = new BbcMachine();
      const { bytes } = tokenizeProgram(src);
      machine.loadProgram(bytes);
      machine.setSpeed(speed);
      for (let i = 1; i <= 3000; i++) {
        machine.runFrame();
        if (screenText(machine).includes('DONE')) {
          machine.dispose();
          return i;
        }
        if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      throw new Error('never displayed DONE');
    }
    const atFullSpeed = await framesToDone(1);
    const atHalfSpeed = await framesToDone(0.5);
    expect(atHalfSpeed).toBeGreaterThan(atFullSpeed);
  }, 60000);

  it('feeds virtual-keyboard tokens into the key matrix', async () => {
    const machine = new BbcMachine();
    await machine.whenReady();
    await runUntil(machine, () =>
      screenText(machine).includes('BBC Computer 32K'),
    );
    machine.setKey('KeyA', true);
    for (let i = 0; i < 10; i++) machine.runFrame();
    machine.setKey('KeyA', false);
    for (let i = 0; i < 10; i++) machine.runFrame();
    // The prompt line now shows the typed character.
    expect(screenText(machine)).toContain('>A');
    machine.dispose();
  }, 30000);

  it('synthesizes audio for a SOUND command', async () => {
    const machine = new BbcMachine();
    // The audio seam is detected per-machine via these two members.
    expect(typeof machine.readAudio).toBe('function');
    expect(machine.audioSampleRate).toBeGreaterThan(0);

    const { bytes } = tokenizeProgram('10 SOUND 1,-15,100,200\n20 GOTO 20\n');
    machine.loadProgram(bytes);

    // Drain readAudio() each frame, tracking the loudest sample seen. A clean
    // boot leaves the buffer silent; the SOUND tone pushes it well off zero.
    let peak = 0;
    const sounded = await runUntil(
      machine,
      () => {
        const samples = machine.readAudio!();
        for (let i = 0; i < samples.length; i++) {
          const v = Math.abs(samples[i]!);
          if (v > peak) peak = v;
        }
        return peak > 0.001;
      },
      400,
    );
    expect(sounded).toBe(true);
    expect(peak).toBeGreaterThan(0.001);
    machine.dispose();
  }, 60000);

  it('reads BASIC variables from a running program', async () => {
    const machine = new BbcMachine();
    const src =
      '10 A=5.5\n20 B%=42\n30 C$="HI"\n40 DIM D(3)\n50 D(1)=7\n55 DIM E(2,4)\n60 END\n';
    const { bytes } = tokenizeProgram(src);
    machine.loadProgram(bytes);
    // Key off the resident integer (high-confidence format) to know the
    // program has run, then snapshot everything.
    const ready = await runUntil(machine, () =>
      machine.readVariables().some((v) => v.name === 'B%' && v.value === '42'),
    );
    expect(ready).toBe(true);
    const vars = machine.readVariables();
    expect(vars).toContainEqual(
      expect.objectContaining({ name: 'A', kind: 'number', value: '5.5' }),
    );
    expect(vars).toContainEqual(
      expect.objectContaining({ name: 'B%', kind: 'number', value: '42' }),
    );
    expect(vars).toContainEqual(
      expect.objectContaining({ name: 'C$', kind: 'string', value: '"HI"' }),
    );
    expect(vars).toContainEqual(
      expect.objectContaining({
        name: 'D(',
        kind: 'number-array',
        value: '[3] = 0, 7, 0, 0',
      }),
    );
    expect(vars).toContainEqual(
      expect.objectContaining({ name: 'E(', kind: 'number-array' }),
    );
    machine.dispose();
  }, 60000);

  it('detects a runtime error after running a buggy program', async () => {
    const machine = new BbcMachine();
    // Referencing an undefined variable raises a BASIC error via BRK.
    const { bytes } = tokenizeProgram('10 PRINT zzq\n');
    machine.loadProgram(bytes);
    const faulted = await runUntil(machine, () => {
      const r = machine.readReport();
      return r !== null && r.isError;
    });
    expect(faulted).toBe(true);
    const report = machine.readReport()!;
    expect(report.isError).toBe(true);
    expect(report.message.length).toBeGreaterThan(0);
    machine.dispose();
  }, 60000);

  it('reports no error after a clean program', async () => {
    const machine = new BbcMachine();
    const { bytes } = tokenizeProgram('10 PRINT "HELLO BEEB"\n20 END\n');
    machine.loadProgram(bytes);
    await runUntil(machine, () => screenText(machine).includes('HELLO BEEB'));
    for (let i = 0; i < 20; i++) machine.runFrame();
    expect(machine.readReport()).toBeNull();
    machine.dispose();
  }, 60000);

  it('reports 896×600 as its visible display size', () => {
    const machine = new BbcMachine();
    expect(machine.displayWidth).toBe(896);
    expect(machine.displayHeight).toBe(600);
    machine.dispose();
  });

  describe('analogue joystick', () => {
    const NEUTRAL = {
      up: false,
      down: false,
      left: false,
      right: false,
      fire1: false,
      fire2: false,
    };
    // The ADC source and VIA exist synchronously after construction, so these
    // need no ROM boot or frames.
    const axes = (m: BbcMachine) => {
      const src = (m as unknown as { joystickSource: { x: number; y: number } })
        .joystickSource;
      return { x: src.x, y: src.y };
    };
    const buttons = (m: BbcMachine) =>
      (
        m.processor.sysvia as unknown as {
          getJoysticks(): { button1: boolean; button2: boolean };
        }
      ).getJoysticks();

    it('maps the D-pad to BBC ADC extremes (left/up = 0xffff)', () => {
      const m = new BbcMachine();
      expect(axes(m)).toEqual({ x: 0x8000, y: 0x8000 }); // idle = centred
      m.setJoystick(1, { ...NEUTRAL, left: true, up: true });
      expect(axes(m)).toEqual({ x: 0xffff, y: 0xffff });
      m.setJoystick(1, { ...NEUTRAL, right: true, down: true });
      expect(axes(m)).toEqual({ x: 0x0000, y: 0x0000 });
      m.setJoystick(1, NEUTRAL);
      expect(axes(m)).toEqual({ x: 0x8000, y: 0x8000 });
      m.dispose();
    });

    it('routes the two fire buttons to the system VIA (active-low PB4/PB5)', () => {
      const m = new BbcMachine();
      expect(buttons(m)).toMatchObject({ button1: false, button2: false });
      m.setJoystick(1, { ...NEUTRAL, fire1: true, fire2: true });
      expect(buttons(m)).toMatchObject({ button1: true, button2: true });
      m.setJoystick(1, NEUTRAL);
      expect(buttons(m)).toMatchObject({ button1: false, button2: false });
      m.dispose();
    });
  });

  describe('step-through debugging', () => {
    // A tight loop whose executing line cycles 20 → 30 → 20, so a breakpoint on
    // 20 trips almost as soon as the program is running.
    const LOOP_SRC = '10 FOR I=1 TO 1000\n20 A=I\n30 NEXT I\n';

    async function loadLoop(): Promise<BbcMachine> {
      const machine = new BbcMachine();
      const { bytes } = tokenizeProgram(LOOP_SRC);
      machine.loadProgram(bytes);
      // Run until execution is inside the loop (a real program line shows up).
      await runUntil(machine, () => {
        const line = machine.currentLine();
        return line === 10 || line === 20 || line === 30;
      });
      return machine;
    }

    /** Drive debugStep slices until one pauses, or give up. */
    function runToPause(
      machine: BbcMachine,
      mode: 'run' | 'step',
      breakpoints: Set<number>,
      fromLine: number | null,
    ) {
      for (let i = 0; i < 5000; i++) {
        const res = machine.debugStep({ breakpoints, mode, fromLine });
        if (res.paused) return res;
      }
      throw new Error('debugStep never paused');
    }

    it('reports a current line inside the running program', async () => {
      const machine = await loadLoop();
      const line = machine.currentLine();
      expect(line === 10 || line === 20 || line === 30).toBe(true);
      machine.dispose();
    }, 60000);

    it('pauses at a breakpointed line, then steps to the next', async () => {
      const machine = await loadLoop();
      const hit = runToPause(machine, 'run', new Set([20]), null);
      expect(hit).toEqual({ paused: true, line: 20 });
      const stepped = runToPause(machine, 'step', new Set(), 20);
      expect(stepped.paused).toBe(true);
      expect(stepped.line).toBe(30);
      machine.dispose();
    }, 60000);
  });

  describe('VFS-backed data file I/O', () => {
    function fakeStore() {
      const files = new Map<string, { data: Uint8Array; kind?: string }>();
      const store: MachineFileStore = {
        save: (name, data, meta) =>
          void files.set(name, { data: data.slice(), kind: meta?.kind }),
        load: (name) => files.get(name)?.data.slice() ?? null,
        list: (): MachineFileEntry[] =>
          [...files.entries()].map(([name, f]) => ({
            name,
            size: f.data.length,
            updatedAt: 1,
            kind: f.kind,
          })),
        delete: (name) => files.delete(name),
      };
      return { store, files };
    }

    it('round-trips OPENOUT/BPUT#/CLOSE# then OPENIN/BGET#/EOF#/CLOSE# through the VFS', async () => {
      const s = fakeStore();
      const machine = new BbcMachine('B', { files: s.store });
      const src = [
        '10 X%=OPENOUT("DATA")',
        '20 BPUT#X%,65',
        '30 BPUT#X%,66',
        '40 CLOSE#X%',
        '50 Y%=OPENIN("DATA")',
        '60 A%=BGET#Y%',
        '70 B%=BGET#Y%',
        '80 IF EOF#Y% THEN PRINT "EOF OK"',
        '90 CLOSE#Y%',
        '100 PRINT "DONE"',
      ].join('\n');
      const { bytes } = tokenizeProgram(src);
      machine.loadProgram(bytes);
      const ran = await runUntil(machine, () =>
        screenText(machine).includes('DONE'),
      );
      expect(ran).toBe(true);
      expect(screenText(machine)).toContain('EOF OK');
      expect(machine.readReport()).toBeNull();
      expect([...(s.files.get('DATA')?.data ?? [])]).toEqual([65, 66]);
      expect(s.files.get('DATA')!.kind).toBe('data');
      machine.dispose();
    }, 60000);

    it('reads back PTR#/EXT# through OSARGS, and OPENUP preserves existing content', async () => {
      const s = fakeStore();
      const machine = new BbcMachine('B', { files: s.store });
      const src = [
        '10 X%=OPENOUT("DATA")',
        '20 BPUT#X%,65',
        '30 BPUT#X%,66',
        '40 P%=PTR#X%',
        '50 E%=EXT#X%',
        '60 CLOSE#X%',
        '70 Y%=OPENUP("DATA")',
        '80 Z%=BGET#Y%',
        '90 PTR#Y%=EXT#Y%',
        '100 BPUT#Y%,67',
        '110 CLOSE#Y%',
        '120 PRINT P%,E%,Z%',
        '130 PRINT "DONE2"',
      ].join('\n');
      const { bytes } = tokenizeProgram(src);
      machine.loadProgram(bytes);
      const ran = await runUntil(machine, () =>
        screenText(machine).includes('DONE2'),
      );
      expect(ran).toBe(true);
      expect(machine.readReport()).toBeNull();
      // PTR# and EXT# both read back as 2 after two BPUT#s; OPENUP starts
      // PTR# at 0 (real DFS random-access semantics — not "append"), so the
      // first BGET# reads back the first byte written earlier (65).
      expect(screenText(machine)).toMatch(/2\s+2\s+65\s+DONE2/);
      // Seeking PTR# to EXT# before BPUT# is how a program appends after
      // OPENUP, so the third byte lands after the original two.
      expect([...(s.files.get('DATA')?.data ?? [])]).toEqual([65, 66, 67]);
      machine.dispose();
    }, 60000);

    it('round-trips PRINT#/INPUT# strings through OPENOUT then OPENUP (regression)', async () => {
      // Reproduces a user-reported bug: OPENUP followed by INPUT# came back
      // empty because the channel's read buffer was never populated for
      // update mode. PRINT#/INPUT# encode strings with the top bit of the
      // final character set (real BBC BASIC's format), which round-trips
      // transparently through BPUT#/BGET# since we never touch the payload.
      const s = fakeStore();
      const machine = new BbcMachine('B', { files: s.store });
      const src = [
        '20 channel=OPENOUT("PLDATA")',
        '30 PRINT#channel,"ALICE"',
        '40 PRINT#channel,STR$(48200)',
        '50 CLOSE#channel',
        '110 channel=OPENUP("PLDATA")',
        '120 INPUT#channel,nm$',
        '130 INPUT#channel,sc$',
        '140 CLOSE#channel',
        '150 sc=VAL(sc$)',
        '230 PRINT "NAME:";nm$',
        '240 PRINT "SCORE:";sc',
        '250 PRINT "DONE4"',
      ].join('\n');
      const { bytes } = tokenizeProgram(src);
      machine.loadProgram(bytes);
      const ran = await runUntil(machine, () =>
        screenText(machine).includes('DONE4'),
      );
      expect(ran).toBe(true);
      expect(machine.readReport()).toBeNull();
      expect(screenText(machine)).toContain('NAME:ALICE');
      expect(screenText(machine)).toContain('SCORE:48200');
      machine.dispose();
    }, 60000);

    it('runs programs with no VFS store exactly as before', async () => {
      const machine = new BbcMachine('B');
      const { bytes } = tokenizeProgram('10 PRINT "HELLO BEEB"\n20 END\n');
      machine.loadProgram(bytes);
      const ran = await runUntil(machine, () =>
        screenText(machine).includes('HELLO BEEB'),
      );
      expect(ran).toBe(true);
      machine.dispose();
    }, 60000);

    it('discards an unflushed write on reset without touching the store', async () => {
      const s = fakeStore();
      const machine = new BbcMachine('B', { files: s.store });
      const { bytes } = tokenizeProgram(
        ['10 X%=OPENOUT("DATA")', '20 BPUT#X%,65', '30 GOTO 30'].join('\n'),
      );
      machine.loadProgram(bytes);
      await runUntil(machine, () => machine.currentLine() === 30);
      machine.reset();
      await new Promise((r) => setTimeout(r, 0));
      expect(s.files.has('DATA')).toBe(false);
      machine.dispose();
    }, 60000);

    it('round-trips a data file on the Master (shares the same trap against MOS 3.20)', async () => {
      const s = fakeStore();
      const machine = new BbcMachine('Master', { files: s.store });
      const src = [
        '10 X%=OPENOUT("DATA")',
        '20 BPUT#X%,65',
        '30 CLOSE#X%',
        '40 Y%=OPENIN("DATA")',
        '50 A%=BGET#Y%',
        '60 IF EOF#Y% THEN PRINT "EOF OK"',
        '70 CLOSE#Y%',
        '80 PRINT "DONE3"',
      ].join('\n');
      const { bytes } = tokenizeProgram(src);
      machine.loadProgram(bytes);
      const ran = await runUntil(machine, () =>
        screenText(machine).includes('DONE3'),
      );
      expect(ran).toBe(true);
      expect(screenText(machine)).toContain('EOF OK');
      expect(machine.readReport()).toBeNull();
      expect([...(s.files.get('DATA')?.data ?? [])]).toEqual([65]);
      machine.dispose();
    }, 60000);
  });
});
