import { describe, expect, it } from 'vitest';
import {
  VicAudioRenderer,
  VIC_AUDIO_SAMPLE_RATE,
  vicVoiceFreqHz,
} from './vicAudio';

const SAMPLES_PER_FRAME = VIC_AUDIO_SAMPLE_RATE / 50;
const VIC_CLOCK_PAL = 1_108_404;

/** A fake VIC register file the renderer reads through (all 16 registers). */
function regFile(values: Partial<Record<number, number>> = {}) {
  const regs = new Uint8Array(16);
  for (const [reg, value] of Object.entries(values)) {
    regs[Number(reg)] = value! & 0xff;
  }
  return {
    regs,
    read: (reg: number) => regs[reg & 0x0f]!,
    set: (reg: number, value: number) => void (regs[reg & 0x0f] = value & 0xff),
  };
}

/** Count sign changes (zero crossings) in a rendered frame. */
function zeroCrossings(out: Float32Array): number {
  let crossings = 0;
  let prev = 0;
  for (const s of out) {
    const sign = s > 0 ? 1 : s < 0 ? -1 : 0;
    if (sign !== 0 && prev !== 0 && sign !== prev) crossings++;
    if (sign !== 0) prev = sign;
  }
  return crossings;
}

/** Peak absolute amplitude of a frame. */
function peak(out: Float32Array): number {
  return out.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
}

describe('vicVoiceFreqHz', () => {
  it('derives f = CLOCK / (divisor * (128 - X)) per voice', () => {
    // X = 0 → the lowest note of each voice; the divisors halve per octave.
    expect(vicVoiceFreqHz(0, 0)).toBeCloseTo(VIC_CLOCK_PAL / (1024 * 128));
    expect(vicVoiceFreqHz(1, 0)).toBeCloseTo(VIC_CLOCK_PAL / (512 * 128));
    expect(vicVoiceFreqHz(2, 0)).toBeCloseTo(VIC_CLOCK_PAL / (256 * 128));
    expect(vicVoiceFreqHz(3, 0)).toBeCloseTo(VIC_CLOCK_PAL / (128 * 128));
    // The alto voice is exactly one octave above the bass for the same X.
    expect(vicVoiceFreqHz(1, 100)).toBeCloseTo(vicVoiceFreqHz(0, 100) * 2);
  });

  it('masks the enable bit off X (POKE 36876,128+X style values)', () => {
    expect(vicVoiceFreqHz(2, 0x80 | 60)).toBeCloseTo(vicVoiceFreqHz(2, 60));
  });
});

describe('VicAudioRenderer', () => {
  it('exposes a 44.1kHz stream with an integer frame size', () => {
    expect(VIC_AUDIO_SAMPLE_RATE).toBe(44100);
    expect(SAMPLES_PER_FRAME).toBe(882);
    expect(new VicAudioRenderer().sampleRate).toBe(VIC_AUDIO_SAMPLE_RATE);
  });

  it('emits nothing while the master volume is zero', () => {
    const file = regFile({ 0x0c: 0x80 | 200 }); // soprano enabled, volume 0
    expect(new VicAudioRenderer().render(file.read)).toHaveLength(0);
  });

  it('emits nothing while no voice is enabled', () => {
    // Full volume, but every voice's bit 7 is clear (X alone does not sound).
    const file = regFile({ 0x0e: 0x0f, 0x0c: 60 });
    expect(new VicAudioRenderer().render(file.read)).toHaveLength(0);
  });

  it('renders a full frame once a voice is enabled at volume', () => {
    const file = regFile({ 0x0e: 0x0f, 0x0c: 0x80 | 200 });
    expect(new VicAudioRenderer().render(file.read)).toHaveLength(
      SAMPLES_PER_FRAME,
    );
  });

  it('produces an AC square tone with no DC offset', () => {
    // X = 120 → ~541Hz, enough cycles per frame for the mean to settle.
    const file = regFile({ 0x0e: 0x0f, 0x0c: 0x80 | 120 });
    const renderer = new VicAudioRenderer();
    renderer.render(file.read); // discard the first frame: DC blocker warm-up
    const out = renderer.render(file.read);
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const s of out) {
      min = Math.min(min, s);
      max = Math.max(max, s);
      sum += s;
    }
    expect(max).toBeGreaterThan(0.05); // swings positive
    expect(min).toBeLessThan(-0.05); // and negative — DC removed
    expect(Math.abs(sum / out.length)).toBeLessThan(0.02); // mean near zero
  });

  it('matches the derived tone frequency (zero crossings ≈ 2·f/50)', () => {
    const x = 200 & 0x7f; // POKE 36876,200 → X = 72
    const file = regFile({ 0x0e: 0x0f, 0x0c: 0x80 | x });
    const hz = vicVoiceFreqHz(2, x);
    // A square wave has two zero crossings per cycle; f/50 cycles per frame.
    const expected = (hz / 50) * 2;
    const measured = zeroCrossings(new VicAudioRenderer().render(file.read));
    expect(measured).toBeGreaterThan(expected * 0.8);
    expect(measured).toBeLessThan(expected * 1.2);
  });

  it('raises pitch as X rises', () => {
    const low = regFile({ 0x0e: 0x0f, 0x0c: 0x80 | 20 });
    const high = regFile({ 0x0e: 0x0f, 0x0c: 0x80 | 120 });
    expect(
      zeroCrossings(new VicAudioRenderer().render(high.read)),
    ).toBeGreaterThan(zeroCrossings(new VicAudioRenderer().render(low.read)));
  });

  it('scales level with the $900E volume nibble', () => {
    const quiet = regFile({ 0x0e: 0x04, 0x0c: 0x80 | 200 });
    const loud = regFile({ 0x0e: 0x0f, 0x0c: 0x80 | 200 });
    expect(peak(new VicAudioRenderer().render(loud.read))).toBeGreaterThan(
      peak(new VicAudioRenderer().render(quiet.read)) * 2,
    );
  });

  it('ignores the aux-colour high nibble of $900E', () => {
    // Volume 0 with a non-zero aux colour must stay silent.
    const file = regFile({ 0x0e: 0xf0, 0x0c: 0x80 | 200 });
    expect(new VicAudioRenderer().render(file.read)).toHaveLength(0);
  });

  it('noise produces a broadband, non-periodic signal', () => {
    // X = 126 → the fastest LFSR clock (~4.3kHz, ~86 new levels per frame).
    const file = regFile({ 0x0e: 0x0f, 0x0d: 0x80 | 126 });
    const renderer = new VicAudioRenderer();
    // Let the LFSR mix past its seed's initial run of ones.
    renderer.render(file.read);
    renderer.render(file.read);
    const out = renderer.render(file.read);
    expect(out).toHaveLength(SAMPLES_PER_FRAME);
    expect(zeroCrossings(out)).toBeGreaterThan(20);
  });

  it('mixes multiple voices', () => {
    const one = regFile({ 0x0e: 0x0f, 0x0c: 0x80 | 200 });
    const three = regFile({
      0x0e: 0x0f,
      0x0a: 0x80 | 200,
      0x0b: 0x80 | 200,
      0x0c: 0x80 | 200,
    });
    expect(peak(new VicAudioRenderer().render(three.read))).toBeGreaterThan(
      peak(new VicAudioRenderer().render(one.read)),
    );
  });

  it('falls silent (and frees frames) after the voice is switched off', () => {
    const file = regFile({ 0x0e: 0x0f, 0x0c: 0x80 | 200 });
    const renderer = new VicAudioRenderer();
    renderer.render(file.read);
    file.set(0x0c, 0); // POKE 36876,0
    let out = renderer.render(file.read);
    for (let f = 0; f < 6 && out.length > 0; f++)
      out = renderer.render(file.read);
    expect(out).toHaveLength(0);
  });

  it('reset returns it to silence immediately', () => {
    const file = regFile({ 0x0e: 0x0f, 0x0c: 0x80 | 200 });
    const renderer = new VicAudioRenderer();
    renderer.render(file.read);
    renderer.reset();
    file.set(0x0e, 0);
    file.set(0x0c, 0);
    expect(renderer.render(file.read)).toHaveLength(0);
  });
});
