import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CpcMachine } from './cpcMachine';
import { tokenizeProgram } from '../../dialects/cpc464/tokenizer';

/**
 * Runtime-introspection acceptance tests against the genuine 464
 * firmware: the sysvar addresses in src/dialects/cpc464/sysvars.ts were pinned
 * against this ROM, so these confirm the variable walk, the ERR/ERL report and
 * the memory-stats read hold up end to end. Skips until the ROM is present
 * (see cpcBoot.test.ts / public/roms/ATTRIBUTION.md).
 */
const ROM_PATH = join(__dirname, '../../../public/roms/cpc/cpc464.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);
const suite = hasRom ? describe : describe.skip;

function runProgram(src: string): CpcMachine {
  const m = new CpcMachine({ rom });
  const { bytes, errors } = tokenizeProgram(src, 'basic10');
  expect(errors).toHaveLength(0);
  m.loadProgram(bytes);
  // Let the injected program RUN to completion (assign variables / error out).
  for (let i = 0; i < 90; i++) m.runFrame();
  return m;
}

suite('CpcMachine runtime introspection', () => {
  it('reads back live BASIC variables of each type', () => {
    const m = runProgram(
      [
        '10 A=3.5',
        '20 B%=5',
        '30 C$="HI"',
        '40 DIM Q(2)',
        '50 Q(1)=9',
        '60 END',
      ].join('\n'),
    );
    const vars = m.readVariables();
    const byName = (n: string) => vars.find((v) => v.name === n);

    expect(byName('A')).toMatchObject({ kind: 'number', value: '3.5' });
    expect(byName('B%')).toMatchObject({ kind: 'number', value: '5' });
    expect(byName('C$')).toMatchObject({ kind: 'string', value: '"HI"' });

    const q = byName('Q()');
    expect(q?.kind).toBe('number-array');
    expect(q?.value).toBe('[3] = 0, 9, 0');
    m.dispose();
  });

  it('handles negative integers and larger arrays', () => {
    const m = runProgram(['10 N%=-7', '20 END'].join('\n'));
    expect(m.readVariables().find((v) => v.name === 'N%')?.value).toBe('-7');
    m.dispose();
  });

  it('reports a clean run as not-an-error with plausible memory stats', () => {
    const m = runProgram('10 A=1\n20 END');
    const report = m.readReport();
    expect(report?.isError).toBe(false);

    const stats = m.readMemoryStats();
    expect(stats).not.toBeNull();
    expect(stats!.used).toBeGreaterThan(0);
    // A clean 464 boot leaves well over 40K free for BASIC.
    expect(stats!.free).toBeGreaterThan(40000);
    m.dispose();
  });

  it('reports a trapped runtime error with its code and line', () => {
    const m = runProgram('10 GOTO 9000'); // Line does not exist (code 8)
    const report = m.readReport();
    expect(report?.isError).toBe(true);
    expect(report?.code).toBe('8');
    expect(report?.message).toBe('Line does not exist');
    expect(report?.line).toBe(10);
    m.dispose();
  });

  it('reports the erroring line for an error deeper in the program', () => {
    const m = runProgram('10 REM\n30 REM\n55 A=SQR(-1)'); // Improper argument
    const report = m.readReport();
    expect(report?.isError).toBe(true);
    expect(report?.code).toBe('5');
    expect(report?.line).toBe(55);
    m.dispose();
  });
  describe('run state', () => {
    /**
     * Sample isProgramRunning() once per frame. loadProgram boots, injects and
     * submits RUN synchronously, so the hand-over is already complete when the
     * first sample is taken.
     */
    function trace(src: string, frames = 200): (boolean | null)[] {
      const m = new CpcMachine({ rom });
      const { bytes, errors } = tokenizeProgram(src, 'basic10');
      expect(errors).toHaveLength(0);
      m.loadProgram(bytes);
      const seen: (boolean | null)[] = [];
      for (let i = 0; i < frames; i++) {
        m.runFrame();
        seen.push(m.isProgramRunning());
      }
      m.dispose();
      return seen;
    }

    it('reports a looping program as running', () => {
      const seen = trace('10 GOTO 10\n');
      expect(seen.at(-1)).toBe(true);
      // The hand-over is synchronous, so it is running from the first frame.
      expect(seen).not.toContain(false);
    });

    it('reports a finished program as not running', () => {
      expect(trace('10 PRINT "HI"\n20 END\n').at(-1)).toBe(false);
    });

    it('reports a program stopped by an error as not running', () => {
      const m = new CpcMachine({ rom });
      const { bytes } = tokenizeProgram('10 GOTO 9000\n', 'basic10');
      m.loadProgram(bytes);
      for (let i = 0; i < 90; i++) m.runFrame();
      expect(m.readReport()?.isError).toBe(true);
      expect(m.isProgramRunning()).toBe(false);
      m.dispose();
    });
  });
});
