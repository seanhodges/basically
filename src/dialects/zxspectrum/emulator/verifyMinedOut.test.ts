import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SpectrumMachine } from './spectrumMachine';
import { tokenizeProgram } from '../tokenizer';
import { detokenizeProgram } from '../detokenizer';
import { buildTap } from '../tapfile';
import { encodeSpectrumNumber } from '../numbers';
import { hasFatalErrors } from '../../types';

const rom = new Uint8Array(
  readFileSync(
    join(__dirname, '../../../../public/roms/zxspectrum/zxspectrum.rom'),
  ),
);

const LET = 0xf1;
const PRINT = 0xf5;
const NUMBER_MARKER = 0x0e;
const ENTER = 0x0d;

/** Assemble a tokenized program area from per-line body bytes. */
function programArea(lines: Array<{ no: number; body: number[] }>): Uint8Array {
  const out: number[] = [];
  for (const { no, body } of lines) {
    out.push((no >> 8) & 0xff, no & 0xff);
    const len = body.length + 1;
    out.push(len & 0xff, (len >> 8) & 0xff);
    out.push(...body, ENTER);
  }
  return Uint8Array.from(out);
}

describe('Mined-Out split-constant round-trip runs on the ROM', () => {
  it('a colour-split constant re-tokenizes to a program the ROM accepts', () => {
    // Quicksilva's "Mined Out" pokes colour-control bytes between a constant's
    // printed digits and its 0x0E marker, e.g. `LET HSC=250` stored as digits
    // "250", then {PAPER 7}{INK 7}, then the marker + value - the exact shape
    // of its failing statement 2:5. A naive detokenize let the bare "250" grow
    // its own marker, so the re-tokenized line read `250 <value> {colour}
    // <value>` and the Spectrum reported "C nonsense in BASIC" on the stray
    // colour code after a complete number. Import the poked layout, round-trip
    // it, and run it on the real ROM to prove the C report no longer fires.
    const original = programArea([
      {
        no: 10,
        body: [
          LET,
          0x61,
          0x3d, // LET a=
          0x32,
          0x35,
          0x30, // printed digits "250"
          0x11,
          0x07,
          0x10,
          0x07, // {PAPER 7}{INK 7} filler
          NUMBER_MARKER,
          ...encodeSpectrumNumber(250),
        ],
      },
      { no: 20, body: [PRINT, 0x61] }, // 20 PRINT a - execution got past 10
    ]);

    const { bytes, errors } = tokenizeProgram(detokenizeProgram(original));
    expect(hasFatalErrors(errors)).toBe(false);

    const machine = new SpectrumMachine({ rom });
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 120; i++) machine.runFrame();

    // Report 'C' is "nonsense in BASIC"; the program should end cleanly (0/OK).
    const report = machine.readReport();
    expect(report.code).not.toBe('C');
    expect(report.isError).toBe(false);

    // And the constant kept its value through the split marker.
    const a = machine.readVariables().find((v) => v.name === 'A');
    expect(a).toMatchObject({ kind: 'number', value: '250' });
  });
});
