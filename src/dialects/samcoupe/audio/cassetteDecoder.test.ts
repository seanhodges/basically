import { describe, expect, it } from 'vitest';
import { encodeSamTape } from './cassetteEncoder';
import { decodeSamCassette } from './cassetteDecoder';
import { tokenizeProgram } from '../tokenizer';
import { detokenizeProgram } from '../detokenizer';
import { parseSamFile, samBlocks, samImageFromBlocks } from '../samfile';
import { encodeSpectrumTape } from '../../zxspectrum/audio/cassetteEncoder';
import { addNoise, scale, resample } from '../../audio/tapeSignal';

const RATE = 44100;

const normalize = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l !== '')
    .join('\n');

function program(src: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(src);
  expect(errors).toEqual([]);
  return bytes;
}

function encode(src: string, name: string, speed?: number): Float32Array {
  return encodeSamTape(samBlocks(program(src), { name }), {
    sampleRate: RATE,
    ...(speed === undefined ? {} : { speed }),
  });
}

/** One-pole low-pass to mimic the HF roll-off of a speaker + air + microphone. */
function lowPass(
  samples: Float32Array,
  sampleRate: number,
  cutoffHz: number,
): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  const out = new Float32Array(samples.length);
  let y = 0;
  for (let i = 0; i < samples.length; i++) {
    y += alpha * (samples[i]! - y);
    out[i] = y;
  }
  return out;
}

/**
 * Add a fast, damped overshoot after every transition - the edge ringing a real
 * speaker/microphone introduces. This is what injects the spurious extra
 * zero-crossings that desync a rigidly-paired decoder.
 */
function ring(
  samples: Float32Array,
  sampleRate: number,
  fRing: number,
  overshoot: number,
  tau: number,
): Float32Array {
  const out = Float32Array.from(samples);
  const span = Math.round(tau * 5 * sampleRate);
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]!;
    const cur = samples[i]!;
    if ((prev <= 0 && cur > 0) || (prev >= 0 && cur < 0)) {
      const dir = Math.sign(cur - prev);
      for (let k = 0; k < span && i + k < out.length; k++) {
        const t = k / sampleRate;
        out[i + k]! +=
          dir *
          overshoot *
          Math.exp(-t / tau) *
          Math.cos(2 * Math.PI * fRing * t);
      }
    }
  }
  return out;
}

/** Add a single delayed echo, as a reflective room would. */
function echo(
  samples: Float32Array,
  sampleRate: number,
  gain: number,
  delayMs: number,
): Float32Array {
  const d = Math.round((delayMs / 1000) * sampleRate);
  const out = Float32Array.from(samples);
  for (let i = d; i < samples.length; i++) out[i]! += gain * samples[i - d]!;
  return out;
}

describe('decodeSamCassette', () => {
  it('round-trips the name and program through encode→decode', () => {
    const src = '10 PRINT "HELLO"\n20 GO TO 10\n';
    const { name, image } = decodeSamCassette(encode(src, 'GREETING'), RATE);
    expect(name).toBe('GREETING');
    expect(normalize(detokenizeProgram(parseSamFile(image).program))).toBe(
      normalize(src),
    );
  });

  const src = '10 LET a=5\n20 PRINT a\n30 GO TO 10\n';
  const expectedProgram = program(src);
  const clean = encode(src, 'TAPE');

  const robustness: [string, () => Float32Array][] = [
    ['additive noise', () => addNoise(clean, 0.12)],
    ['quiet (gain ×0.05)', () => scale(clean, 0.05)],
    ['loud (gain ×20)', () => scale(clean, 20)],
    ['DC offset', () => scale(clean, 1, 0.3)],
    ['noise + DC + low gain', () => addNoise(scale(clean, 0.3, 0.2), 0.04)],
    ['speed drift 0.85×', () => resample(clean, 0.85)],
    ['speed drift 1.15×', () => resample(clean, 1.15)],
    [
      'robust-mode encoding',
      () =>
        encodeSamTape(samBlocks(expectedProgram, { name: 'TAPE' }), {
          sampleRate: RATE,
          pilotScale: 2,
          blockPauseMs: 2000,
        }),
    ],
    // `DEVICE T200` saves slower than the speed the ROM boots with, for a
    // tired deck. Every threshold in the decoder is a fraction of the leader
    // the recording itself carries, so it comes back the same way.
    ['a DEVICE T200 tape', () => encode(src, 'TAPE', 200)],
    // The slower path the ROM's own loader shares with Spectrum tapes: the
    // pulse timings are the Spectrum ROM's, the bytes on them the SAM's.
    [
      'Spectrum pulse timings',
      () =>
        encodeSpectrumTape(
          samBlocks(expectedProgram, { name: 'TAPE' }).map((b) => ({
            flag: b.type,
            bytes: b.bytes,
          })),
          { sampleRate: RATE },
        ),
    ],
  ];

  for (const [label, make] of robustness) {
    it(`decodes despite ${label}`, () => {
      const { name, image } = decodeSamCassette(make(), RATE);
      expect(name).toBe('TAPE');
      expect(Array.from(parseSamFile(image).program)).toEqual(
        Array.from(expectedProgram),
      );
    });
  }

  it('survives a sample-rate mismatch (decode at 48000)', () => {
    const { name, image } = decodeSamCassette(clean, 48000);
    expect(name).toBe('TAPE');
    expect(Array.from(parseSamFile(image).program)).toEqual(
      Array.from(expectedProgram),
    );
  });

  it('decodes a simulated speaker→microphone acoustic channel', () => {
    // Recreate what playing the tape out of a speaker and recording it on
    // another device's mic does to the signal: resample to the mic's native
    // 48kHz, roll off the highs, add edge ringing (the spurious zero-crossings
    // that break a rigidly-paired decoder), a room echo, then mild noise.
    const RECORD_RATE = 48000;
    let s = resample(clean, RECORD_RATE / RATE);
    s = lowPass(s, RECORD_RATE, 6000);
    s = ring(s, RECORD_RATE, 11000, 1.2, 0.00008);
    s = echo(s, RECORD_RATE, 0.35, 4);
    s = addNoise(s, 0.03, 5);

    const { name, image } = decodeSamCassette(s, RECORD_RATE);
    expect(name).toBe('TAPE');
    expect(Array.from(parseSamFile(image).program)).toEqual(
      Array.from(expectedProgram),
    );
  });

  it('rebuilds the container the .TAP export would have written', () => {
    // Byte for byte, framing and parity included - so a block damaged in the
    // air surfaces as a parity warning on import rather than as silently wrong
    // bytes, exactly as it would from a file.
    const { image } = decodeSamCassette(clean, RATE);
    expect(Array.from(image)).toEqual(
      Array.from(
        samImageFromBlocks(samBlocks(expectedProgram, { name: 'TAPE' })),
      ),
    );
  });

  it('rejects pure silence', () => {
    expect(() => decodeSamCassette(new Float32Array(RATE), RATE)).toThrow(
      /no cassette signal/i,
    );
  });

  it('rejects white noise', () => {
    const noise = addNoise(new Float32Array(RATE * 2), 0.5, 7);
    expect(() => decodeSamCassette(noise, RATE)).toThrow(/no cassette signal/i);
  });
});
