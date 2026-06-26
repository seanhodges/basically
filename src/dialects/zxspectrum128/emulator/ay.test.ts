import { describe, expect, it } from 'vitest';
import { Ay38912, AY_SAMPLE_RATE } from './ay';

const SAMPLES_PER_FRAME = AY_SAMPLE_RATE / 50;

/** Drive the AY as the machine would: latch a register, then write it. */
function poke(ay: Ay38912, reg: number, value: number): void {
  ay.selectRegister(reg);
  ay.writeData(value);
}

/** Set channel A (regs 0/1) to a 12-bit tone period and unmute it at `vol`. */
function toneA(ay: Ay38912, period: number, vol = 15): void {
  poke(ay, 0, period & 0xff);
  poke(ay, 1, (period >> 8) & 0x0f);
  poke(ay, 7, 0x3e); // mixer: tone A on (bit0=0), everything else off
  poke(ay, 8, vol);
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

describe('Ay38912 register file', () => {
  it('latches a register on 0xFFFD then writes/reads it on 0xBFFD/0xFFFD', () => {
    const ay = new Ay38912();
    ay.selectRegister(7); // mixer (8-bit)
    ay.writeData(0x3c);
    expect(ay.readData()).toBe(0x3c);
    expect(ay.readRegister(7)).toBe(0x3c);
  });

  it('masks narrow registers to their real width', () => {
    const ay = new Ay38912();
    ay.writeRegister(1, 0xff); // tone-coarse: 4 bits
    expect(ay.readRegister(1)).toBe(0x0f);
    ay.writeRegister(8, 0xff); // channel A volume: 5 bits
    expect(ay.readRegister(8)).toBe(0x1f);
    ay.writeRegister(13, 0xff); // envelope shape: 4 bits
    expect(ay.readRegister(13)).toBe(0x0f);
    ay.writeRegister(0, 0xff); // tone-fine: full 8 bits
    expect(ay.readRegister(0)).toBe(0xff);
  });

  it('wraps the register selector to 0-15', () => {
    const ay = new Ay38912();
    ay.selectRegister(0x17); // 0x17 & 0x0F = 7
    ay.writeData(0x42);
    expect(ay.readRegister(7)).toBe(0x42);
  });

  it('clears every register and the selector on reset', () => {
    const ay = new Ay38912();
    ay.selectRegister(5);
    ay.writeData(0x0a);
    ay.reset();
    for (let r = 0; r < 16; r++) expect(ay.readRegister(r)).toBe(0);
    expect(ay.readData()).toBe(0); // selector back to 0
  });
});

describe('Ay38912 synthesis', () => {
  it('exposes a 44.1kHz stream with an integer frame size', () => {
    expect(AY_SAMPLE_RATE).toBe(44100);
    expect(SAMPLES_PER_FRAME).toBe(882);
    expect(new Ay38912().sampleRate).toBe(AY_SAMPLE_RATE);
  });

  it('emits nothing while every channel volume is zero', () => {
    const ay = new Ay38912();
    // A tone is configured but its volume stays 0, so the chip is silent.
    poke(ay, 0, 0x40);
    poke(ay, 7, 0x3e);
    expect(ay.render()).toHaveLength(0);
  });

  it('renders a full frame once a channel is given volume', () => {
    const ay = new Ay38912();
    toneA(ay, 0x040);
    expect(ay.render()).toHaveLength(SAMPLES_PER_FRAME);
  });

  it('produces an AC tone with no DC offset', () => {
    const ay = new Ay38912();
    toneA(ay, 0x040);
    ay.render(); // discard the first frame: the DC blocker is still warming up
    const out = ay.render();
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const s of out) {
      min = Math.min(min, s);
      max = Math.max(max, s);
      sum += s;
    }
    expect(max).toBeGreaterThan(0.05); // swings positive
    expect(min).toBeLessThan(-0.05); // and negative — DC has been removed
    expect(Math.abs(sum / out.length)).toBeLessThan(0.02); // mean near zero
  });

  it('raises pitch as the tone period shrinks', () => {
    const low = new Ay38912();
    toneA(low, 0x200); // long period → low pitch
    const high = new Ay38912();
    toneA(high, 0x040); // short period → high pitch
    expect(zeroCrossings(high.render())).toBeGreaterThan(
      zeroCrossings(low.render()),
    );
  });

  it('matches the datasheet tone frequency clock/(16*period)', () => {
    const ay = new Ay38912();
    const period = 0x080;
    toneA(ay, period);
    // f = 1773400 / (16 * 128) ≈ 866Hz → ~17.3 full cycles per 20ms frame,
    // i.e. ~34.6 zero crossings. Allow slack for the fractional accumulator.
    const expectedHz = 1773400 / (16 * period);
    const expectedCrossings = (expectedHz / 50) * 2;
    const measured = zeroCrossings(ay.render());
    expect(measured).toBeGreaterThan(expectedCrossings * 0.8);
    expect(measured).toBeLessThan(expectedCrossings * 1.2);
  });

  it('louder volume yields a larger swing (log volume table)', () => {
    const quiet = new Ay38912();
    toneA(quiet, 0x080, 4);
    const loud = new Ay38912();
    toneA(loud, 0x080, 15);
    const peak = (out: Float32Array) =>
      out.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
    expect(peak(loud.render())).toBeGreaterThan(peak(quiet.render()) * 2);
  });

  it('an envelope-driven channel rises from silence (attack shape)', () => {
    const ay = new Ay38912();
    poke(ay, 7, 0x3e); // tone A only
    poke(ay, 8, 0x10); // channel A uses the envelope (bit 4)
    poke(ay, 11, 0x10); // envelope period: small → fast ramp
    poke(ay, 12, 0x00);
    poke(ay, 13, 0x0c); // shape 1100: rising saw
    const first = ay.render();
    const peakOf = (out: Float32Array) =>
      out.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
    // It starts at zero amplitude and grows as the envelope attacks.
    let peak = peakOf(first);
    for (let f = 0; f < 4; f++) peak = Math.max(peak, peakOf(ay.render()));
    expect(peak).toBeGreaterThan(0.05);
  });

  it('noise alone produces a broadband, non-periodic signal', () => {
    const ay = new Ay38912();
    poke(ay, 6, 0x10); // noise period
    poke(ay, 7, 0x37); // mixer: noise A on (bit3=0), tone A off
    poke(ay, 8, 0x0f); // channel A volume
    const out = ay.render();
    expect(out).toHaveLength(SAMPLES_PER_FRAME);
    // Far more transitions than any single tone period would give.
    expect(zeroCrossings(out)).toBeGreaterThan(40);
  });

  it('falls silent (and frees frames) after volumes return to zero', () => {
    const ay = new Ay38912();
    toneA(ay, 0x080);
    ay.render();
    poke(ay, 8, 0); // mute channel A
    // The DC blocker drains over a few frames, then idle frames allocate nothing.
    let out = ay.render();
    for (let f = 0; f < 6 && out.length > 0; f++) out = ay.render();
    expect(out).toHaveLength(0);
  });

  it('reset returns it to silence', () => {
    const ay = new Ay38912();
    toneA(ay, 0x080);
    ay.render();
    ay.reset();
    expect(ay.render()).toHaveLength(0);
  });
});
