// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { sorcerer } from './index';
import { sorcererSamples } from './samples';
import { PROGRAM_BASE } from './addresses';
import { detokenizeTape } from './tapeImport';
import { buildTapeFile } from './tapeFile';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import { importProgram } from '../../app/importProgram';
import { buildTapeImage } from './audio/cassetteEncoder';

const HELLO = sorcererSamples.find((s) => s.name === 'hello.bas')!;

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

describe('sorcerer tape import', () => {
  it('declares the tape as the format the Import dialog offers', () => {
    expect(sorcerer.binaryImports).toEqual([
      { extension: '.tape', label: 'Import .tape cassette…' },
    ]);
  });

  it('opens an exported tape back into the same program', () => {
    const { source, warnings, blocks } = detokenizeTape(
      buildTapeImage(HELLO.text, 'HELLO'),
    );
    expect(source.trimEnd()).toBe(HELLO.text.trimEnd());
    // The single byte CSAVE writes past the end-of-program link is expected,
    // so it is not reported as stray machine code.
    expect(warnings).toEqual([]);
    expect(blocks).toBeUndefined();
  });

  it('recovers the memory blocks that travelled beside the program', () => {
    const sample = sorcererSamples.find((s) => s.name === 'breakout.bas')!;
    const original = materializeSampleBlocks(sorcerer, sample);
    expect(original.length).toBeGreaterThan(0);

    const { source, blocks } = detokenizeTape(
      buildTapeImage(sample.text, 'BREAK', original),
    );
    expect(source.trimEnd()).toBe(sample.text.trimEnd());
    expect(blocks).toHaveLength(original.length);
    blocks!.forEach((block, i) => {
      expect(block.address).toBe(original[i]!.address);
      expect([...block.bytes]).toEqual([...original[i]!.bytes]);
      // The header keeps five characters, so the name is the machine's, not
      // the document's - but it is still a name a block may carry.
      expect(block.name).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
    });
  });

  it('still reads a bare program image, and keeps what follows it', () => {
    const { image } = sorcerer.tokenize(HELLO.text);
    const code = Uint8Array.of(0x21, 0x00, 0x70, 0xc9);
    const { source, warnings, blocks } = detokenizeTape(concat([image, code]));

    expect(source.trimEnd()).toBe(HELLO.text.trimEnd());
    expect(warnings[0]).toMatch(/preserved as a memory block/);
    expect(blocks).toHaveLength(1);
    expect(blocks![0]!.address).toBe(PROGRAM_BASE + image.length);
    expect([...blocks![0]!.bytes]).toEqual([...code]);
  });

  it('reports a corrupt tape rather than half-decoding it', () => {
    const tape = buildTapeImage(HELLO.text, 'HELLO');
    tape[tape.length - 1] ^= 0xff;
    const { source, warnings } = detokenizeTape(tape);
    expect(source).toBe('');
    expect(warnings).toEqual([
      expect.stringMatching(/data block checksum/) as unknown as string,
    ]);
  });

  it('opens a tape of memory-range files with an empty editor', () => {
    // A tape written entirely by the Monitor's SA: no CSAVE mark anywhere and
    // nothing loading at the program base, so there is no program to edit.
    const tape = buildTapeFile(Uint8Array.of(1, 2, 3), {
      programName: 'CODE',
      loadAddress: 0x7000,
      execAddress: 0x7005,
    });
    const { source, warnings, blocks } = detokenizeTape(tape);
    expect(source).toBe('');
    expect(warnings[0]).toMatch(/no BASIC program/);
    expect(blocks).toHaveLength(1);
    expect(blocks![0]!.address).toBe(0x7000);
    expect(blocks![0]!.entry).toBe(0x7005);
  });

  it('reaches the app’s import path through the dialect seam', () => {
    // `importProgram` is what the Import dialog and a dropped file both call,
    // and it only sees `detokenizeWithReport` - so this is the check that the
    // tape reader is actually wired to the seam rather than merely exported.
    const imported = importProgram(
      sorcerer,
      buildTapeImage(HELLO.text, 'HELLO'),
    );
    expect(imported.source.trimEnd()).toBe(HELLO.text.trimEnd());
  });
});
