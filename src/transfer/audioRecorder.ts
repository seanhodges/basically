/**
 * Capture raw microphone / line-in PCM for cassette-audio import, and decode a
 * recorded .wav file to samples. The companion of {@link playSamples}.
 *
 * We deliberately capture *raw* Float32 PCM (via an AudioWorklet, falling back
 * to a ScriptProcessorNode) rather than using MediaRecorder: its Opus/AAC
 * compression is psychoacoustic and would smear the ~3.3kHz FSK carrier and the
 * sharp pulse edges the decoder relies on. We also disable the browser's own
 * echo-cancellation / noise-suppression / auto-gain, which would distort the
 * tone.
 */

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

export interface CapturedAudio {
  samples: Float32Array;
  sampleRate: number;
}

export interface RecordingSession {
  readonly sampleRate: number;
  /**
   * Resolves with the captured audio when recording stops — manually via
   * {@link stop}, or automatically after a stretch of trailing silence. A
   * cancelled session resolves with an empty buffer.
   */
  done: Promise<CapturedAudio>;
  /** Stop and resolve `done` with what was captured. */
  stop(): void;
  /** Abort: release the microphone and resolve `done` with no samples. */
  cancel(): void;
}

export interface RecordOptions {
  /** A specific input from {@link listAudioInputs}; omit for the default. */
  deviceId?: string;
  /** Called (~20×/s) with the latest input level, 0..1, for a meter. */
  onLevel?: (level: number) => void;
  /** Auto-stop after this much trailing silence once a signal has been heard. */
  autoStopSilenceMs?: number;
}

/** List available audio inputs. Labels are blank until mic permission is granted. */
export async function listAudioInputs(): Promise<AudioInputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || `Audio input ${i + 1}`,
    }));
}

const CAPTURE_WORKLET = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('cassette-capture', CaptureProcessor);
`;

export async function startRecording(
  opts: RecordOptions = {},
): Promise<RecordingSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone capture needs a secure (https) context');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: opts.deviceId ? { exact: opts.deviceId } : undefined,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  const ctx = new AudioContext();
  const sampleRate = ctx.sampleRate;
  const source = ctx.createMediaStreamSource(stream);
  const chunks: Float32Array[] = [];

  // Auto-stop bookkeeping: arm once a clear signal arrives, then count silence.
  const silenceLimit = opts.autoStopSilenceMs ?? 1500;
  let heardSignal = false;
  let silentMs = 0;
  let peakSeen = 0;

  let resolveDone!: (a: CapturedAudio) => void;
  const done = new Promise<CapturedAudio>((r) => (resolveDone = r));
  let finished = false;

  const handleChunk = (data: Float32Array) => {
    chunks.push(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i]!);
      if (a > peak) peak = a;
    }
    peakSeen = Math.max(peakSeen, peak);
    opts.onLevel?.(Math.min(1, peak));

    const chunkMs = (data.length / sampleRate) * 1000;
    const active = peak > Math.max(0.05, peakSeen * 0.15);
    if (active) {
      heardSignal = true;
      silentMs = 0;
    } else if (heardSignal) {
      silentMs += chunkMs;
      if (silentMs >= silenceLimit) finalize(false);
    }
  };

  const finalize = (cancelled: boolean) => {
    if (finished) return;
    finished = true;
    for (const t of stream.getTracks()) t.stop();
    source.disconnect();
    void ctx.close();
    if (cancelled) {
      resolveDone({ samples: new Float32Array(0), sampleRate });
      return;
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const samples = new Float32Array(total);
    let off = 0;
    for (const c of chunks) {
      samples.set(c, off);
      off += c.length;
    }
    resolveDone({ samples, sampleRate });
  };

  // Prefer an AudioWorklet; fall back to the deprecated ScriptProcessorNode.
  let usingWorklet = false;
  if (ctx.audioWorklet) {
    try {
      const url = URL.createObjectURL(
        new Blob([CAPTURE_WORKLET], { type: 'application/javascript' }),
      );
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(ctx, 'cassette-capture');
      node.port.onmessage = (e: MessageEvent<Float32Array>) =>
        handleChunk(e.data);
      source.connect(node);
      node.connect(ctx.destination); // node emits silence; keeps the graph live
      usingWorklet = true;
    } catch {
      usingWorklet = false;
    }
  }
  if (!usingWorklet) {
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = (e) =>
      handleChunk(Float32Array.from(e.inputBuffer.getChannelData(0)));
    source.connect(proc);
    proc.connect(ctx.destination); // required for the callback to fire (outputs silence)
  }

  return {
    sampleRate,
    done,
    stop: () => finalize(false),
    cancel: () => finalize(true),
  };
}

/** Decode a recorded audio file (WAV/etc.) to mono samples via the Web Audio API. */
export async function decodeWavFile(bytes: Uint8Array): Promise<CapturedAudio> {
  const ctx = new AudioContext();
  try {
    const copy = bytes.slice().buffer; // detachable ArrayBuffer for decodeAudioData
    const audio = await ctx.decodeAudioData(copy);
    return {
      samples: Float32Array.from(audio.getChannelData(0)),
      sampleRate: audio.sampleRate,
    };
  } finally {
    void ctx.close();
  }
}
