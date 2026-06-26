/**
 * Host-side Web Audio plumbing for run-time emulator sound, built once and
 * shared by every sound-capable machine behind the {@link
 * ../dialects/types.MachineEmulator} audio seam (`audioSampleRate` / `readAudio`).
 *
 * The graph is `AudioWorkletNode (ring-buffer-processor) → GainNode →
 * destination`. The worklet owns buffering + resampling + underrun silence (see
 * {@link ./ringBufferProcessor}); this class owns the context lifecycle, volume
 * and mute. The context is created lazily inside the Run gesture (autoplay
 * policy needs a user gesture), mirroring the proven pattern in
 * {@link ../keyboard/VirtualKeyboard} (lazy `new AudioContext()` + `resume()`).
 */

// Resolve the worklet module URL at module load so Vite emits the processor as
// a hashed `.js` asset (matching the SW `**/*.js` precache glob for offline use).
const WORKLET_URL = new URL('./ringBufferProcessor.js', import.meta.url);

const PROCESSOR_NAME = 'ring-buffer-processor';

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export interface EmulatorAudioOptions {
  /** Initial linear volume, 0..1. */
  volume?: number;
  /** Start muted (gain forced to 0 regardless of volume). */
  muted?: boolean;
}

export class EmulatorAudio {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private gain: GainNode | null = null;
  private ready: Promise<void> | null = null;
  private volume: number;
  private muted: boolean;
  private disposed = false;

  constructor(opts: EmulatorAudioOptions = {}) {
    this.volume = clampVolume(opts.volume ?? 0.7);
    this.muted = opts.muted ?? false;
  }

  /**
   * Lazily build the audio graph and resume the context. Must be called from a
   * user gesture (the Run click) the first time so autoplay policy unlocks it.
   * Safe to call repeatedly — later calls just ensure the context is running.
   */
  async resume(): Promise<void> {
    if (this.disposed) return;
    if (!this.ready) this.ready = this.init();
    try {
      await this.ready;
    } catch {
      // A failed init (no Web Audio / worklet load error) leaves audio off; the
      // emulator still runs. Don't surface — sound is best-effort.
      return;
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // ignore — resume can reject if the gesture was lost
      }
    }
  }

  private async init(): Promise<void> {
    const Ctor =
      typeof AudioContext !== 'undefined'
        ? AudioContext
        : (
            globalThis as unknown as {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio is not available');
    const ctx = new Ctor();
    await ctx.audioWorklet.addModule(WORKLET_URL);
    if (this.disposed) {
      void ctx.close();
      return;
    }
    const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    const gain = ctx.createGain();
    gain.gain.value = this.muted ? 0 : this.volume;
    node.connect(gain).connect(ctx.destination);
    this.ctx = ctx;
    this.node = node;
    this.gain = gain;
  }

  /**
   * Hand a batch of native-rate mono samples to the worklet. The buffer is
   * transferred (zero-copy), so the caller must pass a fresh array it no longer
   * uses — {@link ../dialects/types.MachineEmulator.readAudio} returns exactly
   * that. A no-op until the graph is built or when given an empty batch.
   */
  push(samples: Float32Array, srcRate: number): void {
    if (!this.node || samples.length === 0) return;
    this.node.port.postMessage({ type: 'samples', samples, srcRate }, [
      samples.buffer,
    ]);
  }

  setVolume(v: number): void {
    this.volume = clampVolume(v);
    if (this.gain && !this.muted) this.gain.gain.value = this.volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.gain) this.gain.gain.value = muted ? 0 : this.volume;
  }

  /** Tear the graph down and close the context (Stop / unmount / dialect swap). */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.node?.port.postMessage({ type: 'reset' });
    } catch {
      // port may already be gone
    }
    this.node?.disconnect();
    this.gain?.disconnect();
    void this.ctx?.close();
    this.node = null;
    this.gain = null;
    this.ctx = null;
  }
}
