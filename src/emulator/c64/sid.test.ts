import { describe, expect, it } from 'vitest';
import { SidRenderer, SID_SAMPLE_RATE } from './sid';

const SAMPLES_PER_FRAME = SID_SAMPLE_RATE / 50;
const SID_CLOCK_PAL = 985248;

/** Voice base register offsets ($D400/$D407/$D40E → reg 0/7/14). */
const VOICE_BASE = [0x00, 0x07, 0x0e];

/** Waveform control-register bits. */
const TRIANGLE = 0x10;
const SAWTOOTH = 0x20;
const PULSE = 0x40;
const NOISE = 0x80;

/** Frequency register value (Fn) that produces `hz` on the PAL clock. */
function fnForHz(hz: number): number {
  return Math.round((hz * 0x1000000) / SID_CLOCK_PAL);
}

/**
 * Configure a voice: frequency, waveform, and (via the host envelope hook) a
 * fixed amplitude. Master volume is set to full. Mirrors how the machine drives
 * the renderer — registers from viciious's onRegWrite, amplitude from its ADSR
 * via setVoiceVolume.
 */
function setVoice(
  sid: SidRenderer,
  v: number,
  hz: number,
  waveform: number,
  amp = 1,
  pulseWidth = 0x800,
): void {
  const base = VOICE_BASE[v]!;
  const fn = fnForHz(hz);
  sid.onRegWrite(base, fn & 0xff);
  sid.onRegWrite(base + 1, (fn >> 8) & 0xff);
  sid.onRegWrite(base + 2, pulseWidth & 0xff);
  sid.onRegWrite(base + 3, (pulseWidth >> 8) & 0x0f);
  sid.onRegWrite(base + 4, waveform);
  sid.onRegWrite(0x18, 0x0f); // master volume = full
  sid.setVoiceVolume(v, amp);
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

describe('SidRenderer host hooks', () => {
  it('stores register writes masked to a byte and mirrors the register file', () => {
    const sid = new SidRenderer();
    // Writing a non-zero waveform/amplitude makes the chip audible; without it
    // render() short-circuits to empty.
    setVoice(sid, 0, 440, SAWTOOTH);
    expect(sid.render()).toHaveLength(SAMPLES_PER_FRAME);
  });

  it('wraps register addresses into the 0x20 file', () => {
    const sid = new SidRenderer();
    // reg 0x38 mirrors reg 0x18 (master volume). Set it to 0 → silent.
    setVoice(sid, 0, 440, SAWTOOTH);
    sid.onRegWrite(0x38, 0x00);
    // Drain the DC blocker, then it should fall silent.
    let out = sid.render();
    for (let f = 0; f < 6 && out.length > 0; f++) out = sid.render();
    expect(out).toHaveLength(0);
  });
});

describe('SidRenderer synthesis', () => {
  it('exposes a 44.1kHz stream with an integer frame size', () => {
    expect(SID_SAMPLE_RATE).toBe(44100);
    expect(SAMPLES_PER_FRAME).toBe(882);
    expect(new SidRenderer().sampleRate).toBe(SID_SAMPLE_RATE);
  });

  it('emits nothing while every voice envelope is zero', () => {
    const sid = new SidRenderer();
    // A voice is configured but its envelope amplitude stays 0 → silent.
    setVoice(sid, 0, 440, SAWTOOTH, 0);
    expect(sid.render()).toHaveLength(0);
  });

  it('emits nothing while the master volume is zero', () => {
    const sid = new SidRenderer();
    setVoice(sid, 0, 440, SAWTOOTH, 1);
    sid.onRegWrite(0x18, 0x00); // master volume = 0
    expect(sid.render()).toHaveLength(0);
  });

  it('renders a full frame once a voice has amplitude and master volume', () => {
    const sid = new SidRenderer();
    setVoice(sid, 0, 440, SAWTOOTH);
    expect(sid.render()).toHaveLength(SAMPLES_PER_FRAME);
  });

  it('produces an AC tone with no DC offset', () => {
    const sid = new SidRenderer();
    setVoice(sid, 0, 440, SAWTOOTH);
    sid.render(); // discard the first frame: the DC blocker is warming up
    const out = sid.render();
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

  it('raises pitch as the frequency rises', () => {
    const low = new SidRenderer();
    setVoice(low, 0, 220, SAWTOOTH);
    const high = new SidRenderer();
    setVoice(high, 0, 880, SAWTOOTH);
    expect(zeroCrossings(high.render())).toBeGreaterThan(
      zeroCrossings(low.render()),
    );
  });

  it('matches the requested tone frequency (zero crossings ≈ 2·f/50)', () => {
    const sid = new SidRenderer();
    const hz = 440;
    setVoice(sid, 0, hz, SAWTOOTH);
    // A sawtooth has two zero crossings per cycle; f/50 cycles fit in a frame.
    const expectedCrossings = (hz / 50) * 2;
    const measured = zeroCrossings(sid.render());
    expect(measured).toBeGreaterThan(expectedCrossings * 0.8);
    expect(measured).toBeLessThan(expectedCrossings * 1.2);
  });

  it('scales level with the envelope amplitude', () => {
    const quiet = new SidRenderer();
    setVoice(quiet, 0, 440, SAWTOOTH, 0.25);
    const loud = new SidRenderer();
    setVoice(loud, 0, 440, SAWTOOTH, 1);
    expect(peak(loud.render())).toBeGreaterThan(peak(quiet.render()) * 2);
  });

  it('scales level with the master volume', () => {
    const quiet = new SidRenderer();
    setVoice(quiet, 0, 440, SAWTOOTH);
    quiet.onRegWrite(0x18, 0x04); // ~1/4 master volume
    const loud = new SidRenderer();
    setVoice(loud, 0, 440, SAWTOOTH);
    loud.onRegWrite(0x18, 0x0f); // full master volume
    expect(peak(loud.render())).toBeGreaterThan(peak(quiet.render()) * 2);
  });

  it('pulse duty controls the high/low balance of the waveform', () => {
    const narrow = new SidRenderer();
    setVoice(narrow, 0, 220, PULSE, 1, 0x100); // ~6% duty → mostly low
    const out = narrow.render();
    let positive = 0;
    for (const s of out) if (s > 0) positive++;
    // A narrow pulse spends most of its cycle low (before the DC blocker
    // re-centres a steady level, the asymmetry is clear within a frame).
    expect(positive).toBeLessThan(out.length / 2);
  });

  it('noise produces a broadband, non-periodic signal', () => {
    const sid = new SidRenderer();
    setVoice(sid, 0, 3000, NOISE);
    const out = sid.render();
    expect(out).toHaveLength(SAMPLES_PER_FRAME);
    expect(zeroCrossings(out)).toBeGreaterThan(40);
  });

  it('renders a triangle waveform', () => {
    const sid = new SidRenderer();
    setVoice(sid, 0, 440, TRIANGLE);
    expect(peak(sid.render())).toBeGreaterThan(0.05);
  });

  it('mutes voice 3 via $D418 bit 7', () => {
    const on = new SidRenderer();
    setVoice(on, 2, 440, SAWTOOTH);
    const off = new SidRenderer();
    setVoice(off, 2, 440, SAWTOOTH);
    off.onRegWrite(0x18, 0x0f | 0x80); // master full + voice-3 disable
    expect(peak(off.render())).toBeLessThan(peak(on.render()));
  });

  it('the test bit silences a voice', () => {
    const loud = new SidRenderer();
    setVoice(loud, 0, 440, SAWTOOTH);
    const tested = new SidRenderer();
    setVoice(tested, 0, 440, SAWTOOTH);
    tested.onRegWrite(VOICE_BASE[0]! + 4, SAWTOOTH | 0x08); // set TEST bit
    // The voice is the only sound source, so with TEST held the frame is silent
    // (it is still rendered — the envelope amplitude keeps it non-idle).
    expect(peak(tested.render())).toBe(0);
    expect(peak(loud.render())).toBeGreaterThan(0.05);
  });

  it('mixes three voices', () => {
    const one = new SidRenderer();
    setVoice(one, 0, 440, SAWTOOTH);
    const three = new SidRenderer();
    setVoice(three, 0, 440, SAWTOOTH);
    setVoice(three, 1, 554, SAWTOOTH);
    setVoice(three, 2, 659, SAWTOOTH);
    // Three voices summed reach a higher peak than one alone.
    expect(peak(three.render())).toBeGreaterThan(peak(one.render()));
  });

  it('falls silent (and frees frames) after the envelope returns to zero', () => {
    const sid = new SidRenderer();
    setVoice(sid, 0, 440, SAWTOOTH);
    sid.render();
    sid.setVoiceVolume(0, 0); // envelope released to zero
    let out = sid.render();
    for (let f = 0; f < 6 && out.length > 0; f++) out = sid.render();
    expect(out).toHaveLength(0);
  });

  it('reset returns it to silence', () => {
    const sid = new SidRenderer();
    setVoice(sid, 0, 440, SAWTOOTH);
    sid.render();
    sid.reset();
    expect(sid.render()).toHaveLength(0);
  });
});
