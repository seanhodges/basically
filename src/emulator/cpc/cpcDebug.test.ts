import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CpcMachine } from './cpcMachine';
import { tokenizeProgram } from '../../dialects/cpc464/tokenizer';
import type { DebugStepOptions } from '../../dialects/types';

/**
 * Stage 6 debugger + joystick acceptance tests against the genuine 464 firmware.
 * The current-line sysvar (src/dialects/cpc464/sysvars.ts `curLinePtr`) was
 * pinned against this ROM, so these confirm currentLine/debugStep track live
 * execution and that `native` joystick input reaches JOY(0). Skips until the ROM
 * is present (see cpcBoot.test.ts / public/roms/ATTRIBUTION.md).
 */
const ROM_PATH = join(__dirname, '../../../public/roms/cpc/cpc464.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);
const suite = hasRom ? describe : describe.skip;

function load(src: string): CpcMachine {
  const m = new CpcMachine({ rom });
  const { bytes, errors } = tokenizeProgram(src, 'basic10');
  expect(errors).toHaveLength(0);
  m.loadProgram(bytes);
  return m;
}

const step = (over: Partial<DebugStepOptions>): DebugStepOptions => ({
  breakpoints: new Set(),
  mode: 'run',
  fromLine: null,
  ...over,
});

suite('CpcMachine step debugger', () => {
  it('reports the live BASIC line while a loop runs and null once ended', () => {
    // A tight loop keeps execution alive over lines 20/30.
    const m = load(['10 A=1', '20 A=A+1', '30 GOTO 20'].join('\n'));
    for (let i = 0; i < 10; i++) m.runFrame();
    expect([20, 30]).toContain(m.currentLine());

    const ended = load(['10 A=1', '20 END'].join('\n'));
    for (let i = 0; i < 90; i++) ended.runFrame();
    expect(ended.currentLine()).toBeNull();
    m.dispose();
    ended.dispose();
  });

  it('step mode pauses as soon as the executing line changes', () => {
    const m = load(['10 A=1', '20 A=A+1', '30 GOTO 20'].join('\n'));
    for (let i = 0; i < 10; i++) m.runFrame();
    const from = m.currentLine()!;
    const r = m.debugStep(step({ mode: 'step', fromLine: from }));
    expect(r.paused).toBe(true);
    expect(r.line).not.toBe(from);
    expect([20, 30]).toContain(r.line);
    m.dispose();
  });

  it('run mode pauses at a breakpoint line', () => {
    const m = load(['10 A=1', '20 A=A+1', '30 GOTO 20'].join('\n'));
    for (let i = 0; i < 10; i++) m.runFrame();
    const r = m.debugStep(step({ breakpoints: new Set([30]), mode: 'run' }));
    expect(r.paused).toBe(true);
    expect(r.line).toBe(30);
    m.dispose();
  });

  it('run mode does not immediately re-trigger on the resumed-from line', () => {
    // Resuming from a breakpointed line must first leave it (run 20) before the
    // breakpoint at 30 re-arms and fires - so A is incremented in between.
    const m = load(['10 A=1', '20 A=A+1', '30 GOTO 20'].join('\n'));
    for (let i = 0; i < 10; i++) m.runFrame();
    const before = Number(m.readVariables().find((v) => v.name === 'A')?.value);
    const r = m.debugStep(
      step({ breakpoints: new Set([30]), mode: 'run', fromLine: 30 }),
    );
    expect(r.paused).toBe(true);
    expect(r.line).toBe(30);
    const after = Number(m.readVariables().find((v) => v.name === 'A')?.value);
    expect(after).toBeGreaterThan(before);
    m.dispose();
  });
});

suite('CpcMachine native joystick', () => {
  it('drives JOY(0) through matrix line 9', () => {
    // Spin reading JOY(0) until a direction is seen, then end.
    const m = load(['10 J=JOY(0)', '20 IF J=0 THEN 10', '30 END'].join('\n'));
    for (let i = 0; i < 20; i++) m.runFrame(); // no input yet: still looping
    expect(m.currentLine()).not.toBeNull();

    m.setJoystick('native', {
      up: true,
      down: false,
      left: false,
      right: false,
      fire1: false,
      fire2: false,
    });
    for (let i = 0; i < 40; i++) m.runFrame();

    // JOY(0) bit 0 is up, so the program read J = 1 and fell through to END.
    const j = m.readVariables().find((v) => v.name === 'J');
    expect(j?.value).toBe('1');
    m.dispose();
  });

  it('exposes the two fire buttons on distinct JOY(0) bits', () => {
    const m = load(['10 J=JOY(0)', '20 IF J=0 THEN 10', '30 END'].join('\n'));
    for (let i = 0; i < 20; i++) m.runFrame();
    m.setJoystick('native', {
      up: false,
      down: false,
      left: false,
      right: false,
      fire1: false,
      fire2: true,
    });
    for (let i = 0; i < 40; i++) m.runFrame();
    // fire2 is JOY(0) bit 4 (value 16); fire1 would be bit 5 (value 32).
    const j = m.readVariables().find((v) => v.name === 'J');
    expect(j?.value).toBe('16');
    m.dispose();
  });
});
