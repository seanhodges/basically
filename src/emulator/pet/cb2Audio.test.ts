import { describe, expect, it } from 'vitest';
import { Via6522 } from '../commodore/via6522';
import { Cb2Audio, CB2_SAMPLE_RATE } from './cb2Audio';

// VIA register offsets exercised here.
const T2CL = 0x8;
const SR = 0xa;
const ACR = 0xb;

/** Drive the classic PET sound POKE sequence into a VIA (59467/59466/59464). */
function soundOn(via: Via6522, n: number, pattern = 0x0f): void {
  via.write(ACR, 0x10); // POKE 59467,16 — shift out free-running at T2 rate
  via.write(SR, pattern); // POKE 59466,15 — the cycling bit pattern
  via.write(T2CL, n); // POKE 59464,N — bit period = 2*(N+2) cycles
}

/** Count sign flips — twice the number of tone cycles in the frame. */
function zeroCrossings(samples: Float32Array): number {
  let n = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i]! >= 0 !== samples[i - 1]! >= 0) n++;
  }
  return n;
}

describe('Cb2Audio', () => {
  it('is silent (and allocation-free) while the shift register is idle', () => {
    const via = new Via6522();
    const audio = new Cb2Audio(via);
    const a = audio.render();
    expect(a.length).toBe(0);
    expect(audio.render()).toBe(a); // shared empty array, no per-frame alloc
  });

  it('produces a tone at f = 1MHz / (16 * (N+2)) for the $0F pattern', () => {
    const via = new Via6522();
    const audio = new Cb2Audio(via);
    soundOn(via, 100);
    const frame = audio.render();
    expect(frame.length).toBe(CB2_SAMPLE_RATE / 50);
    // Expected tone: 1e6 / (16 * 102) ≈ 612.7 Hz → ~12.25 cycles in the 20ms
    // frame → ~24.5 zero crossings. Allow slack for phase/DC-blocker edges.
    const crossings = zeroCrossings(frame);
    expect(crossings).toBeGreaterThanOrEqual(20);
    expect(crossings).toBeLessThanOrEqual(30);
  });

  it('raises the pitch when the T2 latch shrinks', () => {
    const via = new Via6522();
    const low = new Cb2Audio(via);
    soundOn(via, 200);
    const lowCrossings = zeroCrossings(low.render());
    soundOn(via, 50);
    const high = new Cb2Audio(via);
    expect(zeroCrossings(high.render())).toBeGreaterThan(lowCrossings * 2);
  });

  it('treats a constant $00 or $FF pattern as silence', () => {
    const via = new Via6522();
    const audio = new Cb2Audio(via);
    soundOn(via, 100, 0x00);
    expect(audio.render().length).toBe(0);
    soundOn(via, 100, 0xff);
    expect(audio.render().length).toBe(0);
  });

  it('requires the free-run-out shift mode, then settles back to empty', () => {
    const via = new Via6522();
    const audio = new Cb2Audio(via);
    soundOn(via, 100);
    expect(audio.render().length).toBeGreaterThan(0);
    // POKE 59467,0 — any other shift mode stops the sound; the DC blocker
    // drains over a frame or two, after which frames are empty again.
    via.write(ACR, 0x00);
    for (let i = 0; i < 10 && audio.render().length > 0; i++) {
      // keep rendering until the blocker settles
    }
    expect(audio.render().length).toBe(0);
  });
});
