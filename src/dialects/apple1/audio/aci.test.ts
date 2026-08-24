// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  ACI_HEADER_PHASES,
  ACI_HEADER_PHASE_US,
  ACI_ONE_PHASE_US,
  ACI_START_PHASE_US,
  ACI_ZERO_PHASE_US,
  CASSETTE_SAMPLE_RATE,
  buildCassetteImage,
  buildCassetteSamples,
  encodeAciTape,
} from './aciEncoder';
import { decodeAciTape, decodeCassette } from './aciDecoder';
import { ZP_BLOCK_BYTES } from '../addresses';
import { parseBasicImage } from '../basicImage';
import { detokenizeProgram } from '../detokenizer';
import { tokenizeProgram } from '../tokenizer';

const SOURCE = '10 A=1\n20 PRINT A\n30 GOTO 10';

/** A leader long enough to be found, without ten seconds of it per range. */
const SHORT_HEADER = { headerPhases: 64 };

describe('apple1 ACI timings', () => {
  it('are the durations the PROM’s delay loops produce', () => {
    // (Y + carry ? 47 : 0) x 5us per phase: WRITEBIT's Y = 44 either way, the
    // header loop's Y = 66, and the Y = 30 it leaves behind for the start bit.
    expect(ACI_ZERO_PHASE_US).toBe(44 * 5);
    expect(ACI_ONE_PHASE_US).toBe((44 + 47) * 5);
    expect(ACI_HEADER_PHASE_US).toBe((66 + 47) * 5);
    expect(ACI_START_PHASE_US).toBe((30 + 47) * 5);
    // A zero is a ~2kHz cycle and a one a ~1kHz one, which is how the manual
    // describes the encoding.
    expect(Math.round(1e6 / (2 * ACI_ZERO_PHASE_US) / 100) * 100).toBe(2300);
    expect(Math.round(1e6 / (2 * ACI_ONE_PHASE_US) / 100) * 100).toBe(1100);
  });

  it('writes the ten-second leader the read routine waits out', () => {
    // The reader spends its first ~3.2s letting the tape settle, so the leader
    // has to outlast that by some margin.
    const seconds = (ACI_HEADER_PHASES * ACI_HEADER_PHASE_US) / 1e6;
    expect(seconds).toBeGreaterThan(9);
    expect(seconds).toBeLessThan(10);
  });
});

describe('apple1 ACI modulation', () => {
  it('round-trips arbitrary bytes through the modulation', () => {
    const bytes = Uint8Array.from([0x00, 0xff, 0x80, 0x01, 0x4a, 0xa5]);
    const blocks = decodeAciTape(
      encodeAciTape([bytes], SHORT_HEADER),
      CASSETTE_SAMPLE_RATE,
    );
    expect(blocks).toHaveLength(1);
    expect([...blocks[0]!]).toEqual([...bytes]);
  });

  it('keeps two ranges apart, because each is written behind its own leader', () => {
    const first = Uint8Array.from([1, 2, 3]);
    const second = Uint8Array.from([4, 5, 6, 7]);
    const blocks = decodeAciTape(
      encodeAciTape([first, second], SHORT_HEADER),
      CASSETTE_SAMPLE_RATE,
    );
    expect(blocks.map((b) => [...b])).toEqual([[...first], [...second]]);
  });

  it('follows a recorder running fast or slow, having no absolute timings', () => {
    const bytes = Uint8Array.from([0x0f, 0xf0, 0x55]);
    const samples = encodeAciTape([bytes], SHORT_HEADER);
    // Same waveform, told it was sampled 8% faster / slower: every threshold
    // scales off the leader that was just measured, so both still decode.
    for (const rate of [
      CASSETTE_SAMPLE_RATE * 0.92,
      CASSETTE_SAMPLE_RATE * 1.08,
    ]) {
      const blocks = decodeAciTape(samples, rate);
      expect(blocks.map((b) => [...b])).toEqual([[...bytes]]);
    }
  });

  it('reads a tape written to the round figures rather than the PROM’s', () => {
    // What another ACI implementation - or the Apple II's own cassette code,
    // which is this scheme tidied up - puts on tape: a 2kHz cycle for a zero, a
    // 1kHz one for a one, and a 770Hz leader. No fixture of a real recording
    // ships (there is none in the project's licence-clean sources), so the
    // foreign case is pinned by building one from the published figures.
    //
    // The phases below are laid out most significant bit first, so this is also
    // what pins the bit order: the round trip above would pass either way.
    const bytes = Uint8Array.from([0x4a, 0x00, 0xff, 0x2d]);
    const phases: number[] = [];
    for (let i = 0; i < 64; i++) phases.push(650);
    phases.push(200, 250);
    for (const byte of bytes) {
      for (let bit = 7; bit >= 0; bit--) {
        const phase = (byte >> bit) & 1 ? 500 : 250;
        phases.push(phase, phase);
      }
    }
    phases.push(5000);

    let elapsed = 0;
    const rate = CASSETTE_SAMPLE_RATE;
    const total = phases.reduce((a, b) => a + b, 0);
    const wave = new Float32Array(Math.round((total / 1e6) * rate));
    let at = 0;
    phases.forEach((us, i) => {
      elapsed += us;
      const end = Math.min(wave.length, Math.round((elapsed / 1e6) * rate));
      wave.fill(i % 2 === 0 ? 0.7 : -0.7, at, end);
      at = end;
    });

    expect([...decodeAciTape(wave, rate)[0]!]).toEqual([...bytes]);
  });

  it('finds the data after silence and noise in front of the leader', () => {
    const bytes = Uint8Array.from([0x12, 0x34]);
    const tape = encodeAciTape([bytes], SHORT_HEADER);
    const lead = new Float32Array(4410);
    for (let i = 0; i < lead.length; i++) {
      // A few cycles of hum, well below the signal, then quiet.
      lead[i] = i < 2205 ? 0.02 * Math.sin((i / 40) * Math.PI) : 0;
    }
    const noisy = new Float32Array(lead.length + tape.length);
    noisy.set(lead, 0);
    noisy.set(tape, lead.length);
    expect([...decodeAciTape(noisy, CASSETTE_SAMPLE_RATE)[0]!]).toEqual([
      ...bytes,
    ]);
  });

  it('reports silence rather than an empty program', () => {
    expect(() =>
      decodeCassette(new Float32Array(44_100), CASSETTE_SAMPLE_RATE),
    ).toThrow(/No cassette signal/);
  });

  it('refuses a tape with no housekeeping block to find the program with', () => {
    const { program } = tokenizeProgram(SOURCE);
    const workspace = buildCassetteImage(SOURCE).subarray(ZP_BLOCK_BYTES);
    expect(program.length).toBeGreaterThan(0);
    expect(() =>
      decodeCassette(
        encodeAciTape([workspace], SHORT_HEADER),
        CASSETTE_SAMPLE_RATE,
      ),
    ).toThrow(/4A\.FF W/);
  });
});

describe('apple1 cassette', () => {
  it('is the two ranges the monitor would have written', () => {
    const image = buildCassetteImage(SOURCE);
    const { program } = tokenizeProgram(SOURCE);
    expect(image).toHaveLength(ZP_BLOCK_BYTES + 2048);
    expect([...parseBasicImage(image).program]).toEqual([...program]);
  });

  it('refuses a program the machine could not load back', () => {
    expect(() => buildCassetteImage('')).toThrow(/empty/i);
    expect(() => buildCassetteImage('10 PRINT "')).toThrow(/error/i);
  });

  it('round-trips a program through the FSK encoding', () => {
    const samples = buildCassetteSamples(SOURCE);
    const { programName, data } = decodeCassette(samples, CASSETTE_SAMPLE_RATE);

    // An ACI tape carries a memory range, not a named file.
    expect(programName).toBe('');
    expect([...data]).toEqual([...buildCassetteImage(SOURCE)]);
    expect(detokenizeProgram(parseBasicImage(data).program)).toBe(SOURCE);
  });

  it('round-trips in robust mode, which only lengthens the leader', () => {
    const plain = buildCassetteSamples(SOURCE, false);
    const robust = buildCassetteSamples(SOURCE, true);
    expect(robust.length).toBeGreaterThan(plain.length);
    const { data } = decodeCassette(robust, CASSETTE_SAMPLE_RATE);
    expect(detokenizeProgram(parseBasicImage(data).program)).toBe(SOURCE);
  });
});
