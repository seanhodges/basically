// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { buildPaperTape, ge635BuildTargets } from './targets';
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram } from './tokenizer';
import { ge635Samples } from './samples';

/** The exported tape read back as the text a host would see. */
function readTape(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** The bytes the one target produces, through the {@link fileTarget} wrapper. */
async function exportTape(source: string): Promise<{
  fileName: string;
  text: string;
}> {
  const [file] = await ge635BuildTargets[0]!.build(source, {
    programName: 'Maze',
  });
  return {
    fileName: file!.fileName,
    text: new TextDecoder().decode(await file!.blob.arrayBuffer()),
  };
}

describe('ge635 build targets', () => {
  it('offers the paper tape and nothing else', () => {
    // The machine had no cassette, no disc and no serial port, so a second
    // target would be an invented format rather than a transfer route.
    expect(ge635BuildTargets.map((t) => t.id)).toEqual(['ge635-paper-tape']);
    expect(ge635BuildTargets[0]!.fileExtension).toBe('txt');
    expect(ge635BuildTargets[0]!.supportsBlocks).toBeUndefined();
  });

  it('ends every line with the CR LF a Teletype needs', () => {
    const tape = readTape(buildPaperTape('10 PRINT "HI"\n20 END\n'));
    expect(tape).toBe('10 PRINT "HI"\r\n20 END\r\n');
  });

  it('punches the canonical record, not the editor line', () => {
    // Outer spacing is the typist's, not the tape's: the tokenizer writes the
    // line number, one space and the trimmed body, and blank lines punch
    // nothing at all.
    const tape = readTape(buildPaperTape('  10   PRINT  "HI"   \n\n20 END'));
    expect(tape).toBe('10 PRINT  "HI"\r\n20 END\r\n');
  });

  it('round-trips back through detokenize', () => {
    for (const sample of ge635Samples) {
      const tape = readTape(buildPaperTape(sample.text));
      const reread = tape.replace(/\r\n/g, '\n').replace(/\n$/, '');
      // The tape is what the machine's own reader would give back, so decoding
      // its image has to return the same text.
      expect(reread, sample.name).toBe(
        detokenizeProgram(tokenizeProgram(sample.text).image),
      );
      // And that text re-punches to the same tape, which is what makes the
      // file openable through the plain-text path.
      expect([...tokenizeProgram(reread).image], sample.name).toEqual([
        ...tokenizeProgram(sample.text).image,
      ]);
    }
  });

  it('resolves an escape to the byte the punch wrote', () => {
    // Where the GE-235 has to spell `{0o32}` out - a six-bit BCD code no text
    // file could show - this machine's codes are ASCII, so the bell is byte 7
    // on the tape. Reading it back turns it into its escape again.
    const source = '10 PRINT "{0x07}"\n20 END\n';
    const tape = buildPaperTape(source);
    expect([...tape]).toContain(7);
    expect(readTape(tape)).not.toContain('{0x07}');
    expect(detokenizeProgram(tape)).toBe('10 PRINT "{0x07}"\n20 END');
  });

  it('writes the power operator as the character the machine had', () => {
    // Code 94, which the ASR-33 prints as an up arrow and a later ASCII reads
    // as `^`. The tape carries the code; the editor reads the arrow back.
    const tape = buildPaperTape('10 PRINT 2↑8\n20 END\n');
    expect([...tape]).toContain(94);
    expect(detokenizeProgram(tape)).toBe('10 PRINT 2↑8\n20 END');
  });

  it('refuses a program the machine could not read back', () => {
    expect(() => buildPaperTape('')).toThrow(/empty/);
    expect(() => buildPaperTape('\n\n')).toThrow(/empty/);
    // A character with no ASCII code is fatal; a missing END is only lint, so
    // a program the compiler would complain about still punches a full tape.
    expect(() => buildPaperTape('10 PRINT "£"\n20 END\n')).toThrow(/error/);
    expect(readTape(buildPaperTape('10 PRINT 1\n'))).toBe('10 PRINT 1\r\n');
  });

  it('names the file after the document', async () => {
    const { fileName, text } = await exportTape('10 END\n');
    expect(fileName).toBe('maze.txt');
    expect(text).toBe('10 END\r\n');
  });
});
