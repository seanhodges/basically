// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  Speaker,
  SPEAKER_SAMPLE_RATE,
  SPEAKER_SAMPLES_PER_FRAME,
} from './speaker';
import { CYCLES_PER_FRAME } from './clock';
import { splitRomImage } from '../romImage';
import { tokenizeProgram } from '../tokenizer';
import { Pmd85Machine } from './pmd85Machine';

/** Half a 4kHz period at 2.048MHz - the phase offset the gate test needs. */
const PC1_HALF_PERIOD_CYCLES = 256;

/**
 * The fundamental of a square wave, from the spacing of its rising zero
 * crossings. Measured between the first and last crossing rather than across
 * the whole buffer, because a window that starts and ends mid-cycle otherwise
 * reads a whole crossing low.
 */
function frequencyOf(samples: Float32Array): number {
  const at: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1]! <= 0 && samples[i]! > 0) at.push(i);
  }
  if (at.length < 2) return 0;
  const span = at[at.length - 1]! - at[0]!;
  return ((at.length - 1) * SPEAKER_SAMPLE_RATE) / span;
}

/** Render `frames` whole frames with port C held at `portC` throughout. */
function hold(portC: number, frames = 4): Float32Array {
  const speaker = new Speaker();
  speaker.write(0, portC);
  const chunks: Float32Array[] = [];
  for (let f = 1; f <= frames; f++) {
    chunks.push(speaker.render(f * CYCLES_PER_FRAME));
  }
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

describe('pmd85 speaker', () => {
  it('gates the two raster tones from PC0 and PC1', () => {
    // The frequencies are hardware, not software: holding the bit connects an
    // oscillator that was already running. Both are exact divisions of the
    // 16kHz line rate, so the only slack either needs is the sample grid the
    // crossings land on.
    expect(frequencyOf(hold(0x01))).toBeCloseTo(1000, -1);
    expect(frequencyOf(hold(0x02))).toBeCloseTo(4000, -2);
  });

  it('sounds neither tone on its own when both gates are open', () => {
    // The three drive lines OR together, so 1kHz + 4kHz is the union of two
    // square waves rather than a chord: the 4kHz edges that fall inside the
    // 1kHz high half are swallowed, leaving fewer crossings than 4kHz alone.
    const both = frequencyOf(hold(0x03));
    expect(both).toBeGreaterThan(1000);
    expect(both).toBeLessThan(4000);
  });

  it('silences the gated tones while PC2 is held high', () => {
    // Documented as "acoustic signalling off": a constant PC2 pins the cone,
    // and the tone gates stop mattering. The DC blocker takes the held level
    // to zero, which is what a cone held to one end actually sounds like.
    const held = hold(0x07);
    const tail = held.subarray(SPEAKER_SAMPLES_PER_FRAME);
    for (const s of tail) expect(Math.abs(s)).toBeLessThan(0.01);
  });

  it('lets software toggle PC2 to any pitch it likes', () => {
    // 200 flips per frame is 100 full cycles at 50Hz - a 5kHz square from a
    // machine whose hardware only offers 1kHz and 4kHz.
    const speaker = new Speaker();
    const flips = 200;
    for (let i = 0; i < flips; i++) {
      speaker.write((i * CYCLES_PER_FRAME) / flips, i % 2 ? 0x00 : 0x04);
    }
    expect(frequencyOf(speaker.render(CYCLES_PER_FRAME))).toBeCloseTo(5000, -2);
  });

  it('emits exactly one frame of samples per frame of machine time', () => {
    const speaker = new Speaker();
    speaker.write(0, 0x02);
    for (let f = 1; f <= 10; f++) {
      expect(speaker.render(f * CYCLES_PER_FRAME)).toHaveLength(
        SPEAKER_SAMPLES_PER_FRAME,
      );
    }
  });

  it('carries the fractional sample a short slice leaves over', () => {
    // A debugger step ends wherever the BASIC line did, so slices do not divide
    // evenly into samples. Ten tenth-frames must still come to one frame.
    const speaker = new Speaker();
    speaker.write(0, 0x02);
    let total = 0;
    for (let i = 1; i <= 10; i++) {
      total += speaker.render((i * CYCLES_PER_FRAME) / 10).length;
    }
    expect(total).toBe(SPEAKER_SAMPLES_PER_FRAME);
  });

  it('costs nothing while the machine is silent', () => {
    const speaker = new Speaker();
    for (let f = 1; f <= 4; f++) {
      expect(speaker.render(f * CYCLES_PER_FRAME)).toHaveLength(0);
    }
  });

  it('drops the backlog rather than voicing fast-forwarded time', () => {
    // `loadProgram` boots the machine in one go, which is seconds of machine
    // time in one slice. Voicing it would fire the whole boot at the speaker on
    // the first frame the host drains.
    const speaker = new Speaker();
    speaker.write(0, 0x02);
    expect(speaker.render(60 * CYCLES_PER_FRAME)).toHaveLength(0);
    // …and the next real frame picks up from there, still sounding.
    expect(frequencyOf(speaker.render(61 * CYCLES_PER_FRAME))).toBeCloseTo(
      4000,
      -2,
    );
  });

  it('keeps the oscillator phase free-running across a gate', () => {
    // Gating the tone on connects an oscillator, it does not start one. Two
    // machines that gate PC1 half a 4kHz period apart must therefore sound in
    // phase with each other once both are open - where a gate that reset the
    // counter would put them in antiphase for the rest of the run.
    const a = new Speaker();
    a.write(0, 0x02);
    const b = new Speaker();
    b.write(PC1_HALF_PERIOD_CYCLES, 0x02);
    const sa = a.render(CYCLES_PER_FRAME).subarray(20);
    const sb = b.render(CYCLES_PER_FRAME).subarray(20);
    expect(sa.length).toBeGreaterThan(800);
    for (let i = 0; i < sa.length; i++) {
      expect(Math.sign(sa[i]!)).toBe(Math.sign(sb[i]!));
    }
  });
});

describe('pmd85 BEEP', () => {
  const rom = new Uint8Array(
    readFileSync(join(__dirname, '../../../../public/roms/pmd85.rom')),
  );

  it('sounds the 4kHz gate for the length of the Monitor’s sound table', () => {
    // The interpreter plays the Monitor's table at 0x80F4 - `02 10 FF`, so PC1
    // for sixteen ticks. This is the whole of the machine's BASIC sound: BEEP
    // takes no arguments because there is no pitch to give it.
    const pmd = new Pmd85Machine(splitRomImage(rom));
    const { program, errors } = tokenizeProgram('10 BEEP\n20 END\n');
    expect(errors).toEqual([]);
    pmd.loadProgram(program);

    const chunks: Float32Array[] = [];
    for (let f = 0; f < 300 && pmd.isProgramRunning(); f++) {
      pmd.runFrame();
      chunks.push(pmd.readAudio());
    }
    const audio = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of chunks) {
      audio.set(c, at);
      at += c.length;
    }

    expect(audio.length).toBeGreaterThan(SPEAKER_SAMPLES_PER_FRAME);

    // From the first sounding sample to the last. The window also spans the
    // gap to the beep BASIC-G sounds as it starts up, which costs a crossing or
    // two but cannot move the pitch off the gate the interpreter opened.
    const first = audio.findIndex((s) => Math.abs(s) > 0.2);
    let last = audio.length - 1;
    while (last > first && Math.abs(audio[last]!) <= 0.2) last--;
    expect(first).toBeGreaterThanOrEqual(0);
    expect(last - first).toBeGreaterThan(SPEAKER_SAMPLE_RATE / 10);
    expect(frequencyOf(audio.subarray(first, last + 1))).toBeCloseTo(4000, -2);
  });
});
