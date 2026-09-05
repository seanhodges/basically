import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { samcoupeBuildTargets, buildTapeImage } from './targets';
import {
  parseSamFile,
  samBlockScan,
  DATA_BLOCK,
  HEADER_BLOCK,
} from './samfile';
import { tokenizeProgram } from './tokenizer';
import { SamMachine } from './emulator/samMachine';

const ROM = new Uint8Array(
  readFileSync(
    path.resolve(__dirname, '../../../public/roms/samcoupe/samcoupe.rom'),
  ),
);

/** Frames the loaded program is given to print its line and stop. */
const RUN_FRAMES = 40;

const SRC = '10 MODE 4\n20 PRINT "HELLO"\n30 GO TO 20\n';
const program = tokenizeProgram(SRC).bytes;

const target = (id: string) => {
  const t = samcoupeBuildTargets.find((b) => b.id === id);
  if (!t) throw new Error(`no target ${id}`);
  return t;
};

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

describe('samcoupe build targets', () => {
  it('exports the expected set of targets', () => {
    expect(samcoupeBuildTargets.map((t) => t.fileExtension)).toEqual([
      'tap',
      'wav',
    ]);
    // A SAM CODE file's address only means anything beside the paging it was
    // saved under, so no target carries the document's memory blocks.
    expect(samcoupeBuildTargets.some((t) => t.supportsBlocks)).toBe(false);
  });

  it('builds a .tap tape of a header block and a data block', async () => {
    const [file] = await target('tap-file').build(SRC, {
      programName: 'hello',
    });
    expect(file!.fileName).toBe('hello.tap');
    const image = await bytesOf(file!.blob);
    expect(samBlockScan(image).map((b) => b.type)).toEqual([
      HEADER_BLOCK,
      DATA_BLOCK,
    ]);
    expect(Array.from(parseSamFile(image).program)).toEqual(
      Array.from(program),
    );
  });

  it('exports load-only, so real hardware waits for RUN', () => {
    // Header byte 37 is 0xFF for "no auto-run"; the emulator types RUN itself.
    const [header] = samBlockScan(buildTapeImage(SRC, 'hello'));
    expect(header!.payload[37]).toBe(0xff);
  });

  it('builds a cassette .wav (RIFF/WAVE)', async () => {
    const [file] = await target('wav').build(SRC, { programName: 'hello' });
    expect(file!.fileName).toBe('hello.wav');
    const wav = await bytesOf(file!.blob);
    expect(new TextDecoder('latin1').decode(wav.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder('latin1').decode(wav.subarray(8, 12))).toBe('WAVE');
  });

  it('exports a tape the machine loads and runs', () => {
    // The exported container going back through the ROM's own loader, which is
    // the only proof that what the .TAP button writes is a file a SAM reads:
    // the header's three length fields are boundaries the loader rebuilds
    // memory to, so a tape that parses here can still leave a machine unable
    // to run what it just loaded.
    const machine = new SamMachine({ rom: ROM });
    machine.loadProgram(buildTapeImage('10 PRINT "FROM TAPE"', 'hello'));
    for (let i = 0; i < RUN_FRAMES; i++) machine.runFrame();
    const lines = (machine.readScreenText()?.lines ?? [])
      .map((l) => l.trimEnd())
      .filter((l) => l !== '');
    expect(lines).toEqual(['FROM TAPE', '0 OK, 10:1']);
    machine.dispose();
  });

  it('refuses to build a program with errors', () => {
    expect(() =>
      target('tap-file').build('PRINT "NO LINE NUMBER"\n', {
        programName: 'bad',
      }),
    ).toThrow(/error/i);
  });
});
