// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { buildPaperTape, ge235BuildTargets } from './targets';
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram } from './tokenizer';
import { ge235Samples } from './samples';

/** The exported tape read back as the text a host would see. */
function readTape(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** The bytes the one target produces, through the {@link fileTarget} wrapper. */
async function exportTape(source: string): Promise<{
  fileName: string;
  text: string;
}> {
  const [file] = await ge235BuildTargets[0]!.build(source, {
    programName: 'Maze',
  });
  return {
    fileName: file!.fileName,
    text: new TextDecoder().decode(await file!.blob.arrayBuffer()),
  };
}

describe('ge235 build targets', () => {
  it('offers the paper tape and nothing else', () => {
    // The machine had no cassette, no disc and no serial port, so a second
    // target would be an invented format rather than a transfer route.
    expect(ge235BuildTargets.map((t) => t.id)).toEqual(['ge235-paper-tape']);
    expect(ge235BuildTargets[0]!.fileExtension).toBe('txt');
    expect(ge235BuildTargets[0]!.supportsBlocks).toBeUndefined();
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
    for (const sample of ge235Samples) {
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

  it('keeps an unprintable code as its escape, so nothing is lost', () => {
    // 0o32 is the bell; there is no ASCII byte to resolve it to on a machine
    // whose codes are 6-bit BCD, so the tape carries the spelling the editor
    // reads back.
    const source = '10 PRINT "{0o32}"\n20 END\n';
    const tape = readTape(buildPaperTape(source));
    expect(tape).toContain('{0o32}');
    expect([...tokenizeProgram(tape.replace(/\r\n/g, '\n')).image]).toEqual([
      ...tokenizeProgram(source).image,
    ]);
  });

  it('writes the power operator as the character the machine had', () => {
    expect(readTape(buildPaperTape('10 PRINT 2↑8\n20 END\n'))).toBe(
      '10 PRINT 2↑8\r\n20 END\r\n',
    );
  });

  it('refuses a program the machine could not read back', () => {
    expect(() => buildPaperTape('')).toThrow(/empty/);
    expect(() => buildPaperTape('\n\n')).toThrow(/empty/);
    // A character with no BCD code is fatal; a missing END is only lint, so a
    // program the compiler would complain about still punches a full tape.
    expect(() => buildPaperTape('10 PRINT "£"\n20 END\n')).toThrow(/error/);
    expect(readTape(buildPaperTape('10 PRINT 1\n'))).toBe('10 PRINT 1\r\n');
  });

  it('names the file after the document', async () => {
    const { fileName, text } = await exportTape('10 END\n');
    expect(fileName).toBe('maze.txt');
    expect(text).toBe('10 END\r\n');
  });
});
