import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SpectrumMachine } from './spectrumMachine';
import { tokenizeProgram } from '../tokenizer';
import { buildTap } from '../tapfile';
import { hasFatalErrors } from '../../types';

const rom = new Uint8Array(
  readFileSync(
    join(__dirname, '../../../../public/roms/zxspectrum/zxspectrum.rom'),
  ),
);

describe('DEF FN parameters run on the real ROM', () => {
  it('a defined function is callable without a "Q Parameter error"', () => {
    // The exact program from the bug report. Without the hidden 0x0E + five
    // zero-byte slot the ROM reserves after the parameter `i`, calling FN a(42)
    // reports 'Q' (Parameter error). The tokenizer now inserts that slot, so
    // the call resolves and the program ends cleanly.
    const { bytes, errors } = tokenizeProgram(
      '1 DEF FN a(i)=i\n2 PRINT FN a(42)\n',
    );
    expect(hasFatalErrors(errors)).toBe(false);

    const machine = new SpectrumMachine({ rom });
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 120; i++) machine.runFrame();

    const report = machine.readReport();
    expect(report.code).not.toBe('Q');
    expect(report.isError).toBe(false);
  });
});
