import { describe, it, expect } from 'vitest';
import { Beeper, BEEPER_SAMPLE_RATE, BEEPER_AMPLITUDE } from './beeper';

const FRAME_CYCLES = 69888; // 48K T-states per frame
const SAMPLES_PER_FRAME = BEEPER_SAMPLE_RATE / 50;

describe('Beeper', () => {
  it('exposes a 44.1kHz stream with an integer frame size', () => {
    expect(BEEPER_SAMPLE_RATE).toBe(44100);
    expect(SAMPLES_PER_FRAME).toBe(882);
    expect(new Beeper().sampleRate).toBe(BEEPER_SAMPLE_RATE);
  });

  it('emits nothing while the speaker is idle', () => {
    const beeper = new Beeper();
    expect(beeper.render(FRAME_CYCLES)).toHaveLength(0);
    // Border-only writes (bit 4 clear) must not break the silence.
    beeper.write(100, 0x07);
    beeper.write(20000, 0x02);
    expect(beeper.render(FRAME_CYCLES)).toHaveLength(0);
  });

  it('renders a full frame the moment the speaker is driven high', () => {
    const beeper = new Beeper();
    beeper.write(0, 0x10); // bit 4 set at the very start of the frame
    const out = beeper.render(FRAME_CYCLES);
    expect(out).toHaveLength(SAMPLES_PER_FRAME);
    // First sample is the unfiltered step; the DC blocker has no history yet.
    expect(out[0]).toBeCloseTo(BEEPER_AMPLITUDE, 5);
  });

  it('decays a held level toward zero (DC blocker), not a constant offset', () => {
    const beeper = new Beeper();
    beeper.write(0, 0x10);
    const first = beeper.render(FRAME_CYCLES);
    // Within the frame the held-high output already droops.
    expect(first[SAMPLES_PER_FRAME - 1]!).toBeLessThan(first[0]!);
    // A few more steady-high frames and the output has essentially settled.
    let last = beeper.render(FRAME_CYCLES);
    last = beeper.render(FRAME_CYCLES);
    expect(Math.abs(last[SAMPLES_PER_FRAME - 1]!)).toBeLessThan(0.05);
  });

  it('produces an AC square wave with no DC offset when toggling', () => {
    const beeper = new Beeper();
    // Toggle the speaker eight times across the frame: a ~200Hz square wave.
    for (let k = 0; k < 8; k++) {
      beeper.write((k * FRAME_CYCLES) / 8, k % 2 === 0 ? 0x10 : 0x00);
    }
    const out = beeper.render(FRAME_CYCLES);
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const s of out) {
      min = Math.min(min, s);
      max = Math.max(max, s);
      sum += s;
    }
    expect(max).toBeGreaterThan(0.1); // swings positive
    expect(min).toBeLessThan(-0.1); // and negative — DC has been removed
    expect(Math.abs(sum / out.length)).toBeLessThan(0.05); // mean near zero
  });

  it('places the transition at the right point in the frame', () => {
    const beeper = new Beeper();
    // Speaker goes high exactly halfway through the frame.
    beeper.write(FRAME_CYCLES / 2, 0x10);
    const out = beeper.render(FRAME_CYCLES);
    // First half is silent (input 0 → DC-blocked output 0); second half steps up.
    expect(out[0]).toBe(0);
    expect(out[SAMPLES_PER_FRAME / 2 - 1]).toBe(0);
    expect(out[SAMPLES_PER_FRAME / 2]!).toBeCloseTo(BEEPER_AMPLITUDE, 5);
  });

  it('reset returns it to silence', () => {
    const beeper = new Beeper();
    beeper.write(0, 0x10);
    beeper.render(FRAME_CYCLES);
    beeper.reset();
    expect(beeper.render(FRAME_CYCLES)).toHaveLength(0);
  });
});
