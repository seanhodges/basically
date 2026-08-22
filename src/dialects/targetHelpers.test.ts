import { describe, expect, it } from 'vitest';
import {
  assertNoFatalErrors,
  buildImageOrThrow,
  cassetteWavTarget,
  fileTarget,
} from './targetHelpers';
import type { TokenizeError } from './types';

const fatal: TokenizeError = { line: 1, message: 'bad' };
const lint: TokenizeError = { line: 1, message: 'shape', fatal: false };

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe('assertNoFatalErrors', () => {
  it('counts only the fatal errors in its message', () => {
    expect(() => assertNoFatalErrors([fatal, lint, fatal])).toThrow(
      'Program has 2 error(s) - fix them before building',
    );
  });

  it('lets heuristic lint through', () => {
    expect(() => assertNoFatalErrors([lint])).not.toThrow();
  });
});

describe('buildImageOrThrow', () => {
  it('returns the tokenized bytes when the program is buildable', () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    expect(buildImageOrThrow({ bytes, errors: [lint] })).toBe(bytes);
  });

  it('rejects a program with fatal errors before looking at its bytes', () => {
    expect(() =>
      buildImageOrThrow({ bytes: new Uint8Array(0), errors: [fatal] }),
    ).toThrow('Program has 1 error(s) - fix them before building');
  });

  it('rejects an empty program', () => {
    expect(() =>
      buildImageOrThrow({ bytes: new Uint8Array(0), errors: [] }),
    ).toThrow('Program is empty');
  });

  it('treats a bare end marker as empty when emptyAt says so', () => {
    const marker = Uint8Array.from([0, 0]);
    expect(() => buildImageOrThrow({ bytes: marker, errors: [] }, 2)).toThrow(
      'Program is empty',
    );
    expect(buildImageOrThrow({ bytes: marker, errors: [] })).toBe(marker);
  });
});

describe('fileTarget', () => {
  it('names the file from the lower-cased program name plus the extension', async () => {
    const target = fileTarget('p-file', 'Export .P file', 'p', () =>
      Uint8Array.from([0xff]),
    );
    const [file] = await target.build('10 PRINT', { programName: 'MyGame' });
    expect(target).toMatchObject({
      id: 'p-file',
      label: 'Export .P file',
      fileExtension: 'p',
    });
    expect(target.supportsBlocks).toBeUndefined();
    expect(file!.fileName).toBe('mygame.p');
    expect(await bytesOf(file!.blob)).toEqual(Uint8Array.from([0xff]));
    expect(file!.blob.type).toBe('application/octet-stream');
  });

  it('passes the build options through and keeps a ready-made blob as it is', async () => {
    const target = fileTarget(
      'dsk',
      'Export .dsk disk',
      'dsk',
      (source, opts) =>
        new Blob([`${source}:${opts.loader}:${opts.blocks?.length}`], {
          type: 'text/plain',
        }),
      { supportsBlocks: true },
    );
    const [file] = await target.build('S', {
      programName: 'P',
      blocks: [],
      loader: true,
    });
    expect(target.supportsBlocks).toBe(true);
    expect(file!.blob.type).toBe('text/plain');
    expect(await file!.blob.text()).toBe('S:true:0');
  });
});

describe('cassetteWavTarget', () => {
  it('frames the dialect’s samples as a RIFF WAVE at its own rate', async () => {
    const target = cassetteWavTarget({
      sampleRate: 44100,
      buildSamples: () => Float32Array.from([0, 1, -1, 0]),
    });
    const [file] = await target.build('10 PRINT', { programName: 'Tape' });
    expect(target).toMatchObject({
      id: 'wav',
      label: 'Export cassette .wav',
      fileExtension: 'wav',
    });
    expect(file!.fileName).toBe('tape.wav');
    const wav = await bytesOf(file!.blob);
    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe('WAVE');
    // Sample rate is the little-endian word at offset 24 of the fmt chunk.
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(44100);
  });

  it('takes a namespaced id and the block-carrying flag', () => {
    const target = cassetteWavTarget({
      id: 'c64-wav',
      sampleRate: 44100,
      buildSamples: () => new Float32Array(0),
      supportsBlocks: true,
    });
    expect(target.id).toBe('c64-wav');
    expect(target.supportsBlocks).toBe(true);
  });
});
