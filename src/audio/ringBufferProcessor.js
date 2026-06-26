/**
 * AudioWorklet processor: a ring buffer fed from the main thread that linearly
 * resamples a machine's native sample rate to the AudioContext rate, emitting
 * silence on underrun (no clicks). It runs in the audio rendering thread, so it
 * never blocks the main thread — important because rAF (and thus sample
 * production) pauses when the tab is hidden, starving this buffer; silence is
 * the correct, click-free response to that.
 *
 * Authored as plain JS (not TS): it's loaded via
 * `new URL('./ringBufferProcessor.js', import.meta.url)` and emitted verbatim as
 * a hashed `.js` asset, so it (a) needs no transpile step the asset pipeline
 * doesn't run and (b) matches the service-worker glob that precaches every JS
 * file, making it available offline. Runs in the AudioWorklet global scope,
 * which the app's tsconfig DOM lib doesn't cover — hence JS plus the scoped
 * ESLint globals block.
 *
 * @typedef {{ type: 'samples', samples: Float32Array, srcRate: number }} SamplesMessage
 * @typedef {{ type: 'reset' }} ResetMessage
 */

/**
 * Ring capacity in samples. Sized to hold ~0.5s at the BBC's 500 kHz native
 * rate (the highest producer in the app), a 2^n for cheap masking. Comfortably
 * absorbs the per-frame (~20ms) push cadence and rAF jitter.
 */
const CAPACITY = 1 << 18; // 262144
const MASK = CAPACITY - 1;
/**
 * Samples that must be buffered before playback (re)starts, smoothing the gap
 * between the gesture-time start and the first frame's push. ~8ms at 500 kHz.
 */
const PRIME_SAMPLES = 4096;

class RingBufferProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(CAPACITY);
    this.writeIndex = 0;
    this.readIndex = 0;
    /** Unread samples currently held in the ring. */
    this.available = 0;
    /** Output samples consumed per output sample = srcRate / ctxRate. */
    this.ratio = 1;
    /** Fractional read phase between s0 and s1, in [0, 1). */
    this.phase = 0;
    this.s0 = 0;
    this.s1 = 0;
    /** False until enough samples are buffered to begin (and after underrun). */
    this.primed = false;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'samples') {
        if (msg.srcRate > 0) this.ratio = msg.srcRate / sampleRate;
        this.write(msg.samples);
      } else {
        this.reset();
      }
    };
  }

  reset() {
    this.writeIndex = 0;
    this.readIndex = 0;
    this.available = 0;
    this.phase = 0;
    this.s0 = 0;
    this.s1 = 0;
    this.primed = false;
  }

  /** @param {Float32Array} samples */
  write(samples) {
    for (let i = 0; i < samples.length; i++) {
      if (this.available >= CAPACITY) {
        // Overflow (producer outran consumer): drop the oldest sample.
        this.readIndex = (this.readIndex + 1) & MASK;
        this.available--;
      }
      this.buffer[this.writeIndex] = samples[i];
      this.writeIndex = (this.writeIndex + 1) & MASK;
      this.available++;
    }
  }

  /** Pop one sample, or null when the ring is empty. */
  pull() {
    if (this.available <= 0) return null;
    const v = this.buffer[this.readIndex];
    this.readIndex = (this.readIndex + 1) & MASK;
    this.available--;
    return v;
  }

  process(_inputs, outputs) {
    const channel = outputs[0] && outputs[0][0];
    if (!channel) return true;

    if (!this.primed) {
      if (this.available < PRIME_SAMPLES) {
        channel.fill(0);
        return true;
      }
      this.primed = true;
      const a = this.pull();
      this.s0 = a === null ? 0 : a;
      const b = this.pull();
      this.s1 = b === null ? this.s0 : b;
    }

    for (let i = 0; i < channel.length; i++) {
      if (!this.primed) {
        channel[i] = 0;
        continue;
      }
      channel[i] = this.s0 + (this.s1 - this.s0) * this.phase;
      this.phase += this.ratio;
      while (this.phase >= 1) {
        this.phase -= 1;
        const next = this.pull();
        if (next === null) {
          // Underrun: emit silence for the rest of this block and re-prime once
          // the buffer refills, rather than glitching on stale samples.
          this.primed = false;
          this.phase = 0;
          this.s0 = 0;
          this.s1 = 0;
          break;
        }
        this.s0 = this.s1;
        this.s1 = next;
      }
    }
    return true;
  }
}

registerProcessor('ring-buffer-processor', RingBufferProcessor);
