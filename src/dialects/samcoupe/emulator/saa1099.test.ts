import { describe, it, expect } from 'vitest';
import { SAA_SAMPLES_PER_FRAME, Saa1099 } from './saa1099';

/** Register addresses used here, by the datasheet's own numbering. */
const AMPLITUDE = 0x00;
const FREQUENCY = 0x08;
const OCTAVE = 0x10;
const TONE_ENABLE = 0x14;
const NOISE_ENABLE = 0x15;
const NOISE_CLOCK = 0x16;
const ENVELOPE0 = 0x18;
const ENABLE = 0x1c;

/** Zero crossings in a frame, which is the frequency the chip is sounding at. */
function crossings(samples: Float32Array): number {
  let count = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1]! <= 0 !== samples[i]! <= 0) count++;
  }
  return count;
}

/** A chip sounding one tone channel at full volume. */
function withTone(channel: number, freq: number, octave: number): Saa1099 {
  const saa = new Saa1099();
  saa.write(AMPLITUDE + channel, 0xff);
  saa.write(FREQUENCY + channel, freq);
  const shift = channel & 1 ? 4 : 0;
  saa.write(OCTAVE + (channel >> 1), octave << shift);
  saa.write(TONE_ENABLE, 1 << channel);
  saa.write(ENABLE, 0x01);
  return saa;
}

describe('samcoupe saa1099', () => {
  it('emits nothing while the chip is disabled', () => {
    const saa = new Saa1099();
    // Bit 0 of 0x1C gates every channel, so a chip with tones set up but sound
    // off allocates nothing at all.
    saa.write(AMPLITUDE, 0xff);
    saa.write(TONE_ENABLE, 0x01);
    expect(saa.drain()).toHaveLength(0);
    saa.write(ENABLE, 0x01);
    expect(saa.drain()).toHaveLength(SAA_SAMPLES_PER_FRAME);
  });

  it('sounds the datasheet frequency for a tone', () => {
    // 15625 * 2^octave / (511 - freq): octave 4 and freq 255 is 15625*16/256,
    // which is 976.6Hz - a little under an octave above concert A.
    const saa = withTone(0, 255, 4);
    const frame = saa.drain();
    // Two crossings a cycle, in a fiftieth of a second.
    const hz = (crossings(frame) / 2) * 50;
    expect(hz).toBeGreaterThan(900);
    expect(hz).toBeLessThan(1050);

    // An octave down halves it, which is what the octave register is for.
    const lower = withTone(0, 255, 3).drain();
    expect(crossings(lower)).toBeLessThan(crossings(frame) * 0.6);
  });

  it('mixes all six channels down to one stream', () => {
    // The amplitude register is a stereo pair - left in the low nibble, right
    // in the high - and both sides reach the mono stream, so a voice panned
    // hard to one side is quieter but still audible.
    const centred = withTone(0, 255, 4);
    const panned = withTone(0, 255, 4);
    panned.write(AMPLITUDE, 0x0f); // left only
    const peak = (s: Float32Array) => Math.max(...Array.from(s, Math.abs));
    expect(peak(panned.drain())).toBeGreaterThan(0);
    expect(peak(panned.drain())).toBeLessThan(peak(centred.drain()));

    // Six voices at once stay inside the mix rather than clipping.
    const all = new Saa1099();
    for (let c = 0; c < 6; c++) {
      all.write(AMPLITUDE + c, 0xff);
      all.write(FREQUENCY + c, 200 + c);
      all.write(OCTAVE + (c >> 1), 0x44);
    }
    all.write(TONE_ENABLE, 0x3f);
    all.write(ENABLE, 0x01);
    expect(peak(all.drain())).toBeLessThanOrEqual(1);
  });

  it('runs the noise generators off their own clock', () => {
    const saa = new Saa1099();
    saa.write(AMPLITUDE, 0xff);
    saa.write(NOISE_ENABLE, 0x01);
    saa.write(NOISE_CLOCK, 0x00); // the fastest of the three fixed clocks
    saa.write(ENABLE, 0x01);
    const fast = crossings(saa.drain());
    const slow = new Saa1099();
    slow.write(AMPLITUDE, 0xff);
    slow.write(NOISE_ENABLE, 0x01);
    slow.write(NOISE_CLOCK, 0x02); // the slowest, two octaves down
    slow.write(ENABLE, 0x01);
    expect(crossings(slow.drain())).toBeLessThan(fast);
  });

  it('scales a channel by its envelope generator', () => {
    // Envelope 0 shapes channel 2. Control bit 7 enables it; the shape here is
    // a single decay, so the channel starts loud and fades.
    const saa = withTone(2, 255, 4);
    saa.write(ENVELOPE0, 0x80 | (0b010 << 1));
    const first = saa.drain();
    const later = saa.drain();
    const peak = (s: Float32Array) => Math.max(...Array.from(s, Math.abs));
    expect(peak(later)).toBeLessThan(peak(first));
  });

  it('holds every generator in reset while the reset bit is set', () => {
    const saa = withTone(0, 255, 4);
    expect(crossings(saa.drain())).toBeGreaterThan(0);
    saa.write(ENABLE, 0x03); // sound on, generators held
    // Nothing advances, so the level cannot change - which is what lets a
    // program line several channels up before letting them all run.
    expect(crossings(saa.drain())).toBe(0);
  });
});
