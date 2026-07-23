import { describe, expect, it } from 'vitest';
import { cpc464BuildTargets } from './targets';
import { parseBasFile } from './basfile';
import { parseCdt } from './cdt';
import { tokenizeProgram } from './tokenizer';

const SRC = '10 MODE 1\n20 PRINT "HELLO"\n30 GOTO 20\n';
const program = tokenizeProgram(SRC).bytes;

const target = (id: string) => {
  const t = cpc464BuildTargets.find((b) => b.id === id);
  if (!t) throw new Error(`no target ${id}`);
  return t;
};

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

describe('cpc464 build targets', () => {
  it('exports the expected set of targets', () => {
    expect(cpc464BuildTargets.map((t) => t.fileExtension)).toEqual([
      'bas',
      'cdt',
      'wav',
    ]);
    // No memory-block support yet (the block editor lands in a later stage).
    expect(cpc464BuildTargets.some((t) => t.supportsBlocks)).toBe(false);
  });

  it('builds an AMSDOS .bas that round-trips', async () => {
    const [file] = await target('cpc464-bas').build(SRC, {
      programName: 'hello',
    });
    expect(file!.fileName).toBe('hello.bas');
    const parsed = parseBasFile(await bytesOf(file!.blob));
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
  });

  it('builds a .cdt tape that round-trips', async () => {
    const [file] = await target('cpc464-cdt').build(SRC, {
      programName: 'hello',
    });
    expect(file!.fileName).toBe('hello.cdt');
    const parsed = parseCdt(await bytesOf(file!.blob));
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
  });

  it('builds a cassette .wav (RIFF/WAVE)', async () => {
    const [file] = await target('cpc464-wav').build(SRC, {
      programName: 'hello',
    });
    expect(file!.fileName).toBe('hello.wav');
    const wav = await bytesOf(file!.blob);
    expect(new TextDecoder('latin1').decode(wav.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder('latin1').decode(wav.subarray(8, 12))).toBe('WAVE');
  });

  it('refuses to build a program with errors', () => {
    expect(() =>
      target('cpc464-bas').build('PRINT "NO LINE NUMBER"\n', {
        programName: 'bad',
      }),
    ).toThrow(/error/i);
  });
});
