import { describe, it, expect } from 'vitest';
import {
  binaryImportPickerOptions,
  programNameFromFileName,
  toProjectFileName,
} from './files';

describe('binaryImportPickerOptions', () => {
  it('filters the picker to the requested extension', () => {
    const options = binaryImportPickerOptions('.prg');
    expect(options.types[0].accept['*/*']).toEqual(['.prg']);
    expect(options.types[0].description).toContain('PRG');
  });

  it('gives each extension its own picker id so Chromium does not reuse the last-used filter', () => {
    // A shared, generic picker made a .prg import inherit whichever format
    // (e.g. a Spectrum .tap) was picked before; distinct ids keep them apart.
    expect(binaryImportPickerOptions('.prg').id).toBe('importprg');
    expect(binaryImportPickerOptions('.tap').id).toBe('importtap');
    expect(binaryImportPickerOptions('.prg').id).not.toBe(
      binaryImportPickerOptions('.tap').id,
    );
  });
});

describe('programNameFromFileName', () => {
  it('strips the extension and uppercases', () => {
    expect(programNameFromFileName('game.txt')).toBe('GAME');
    // Legacy .bas files still load, so their names resolve the same way.
    expect(programNameFromFileName('game.bas')).toBe('GAME');
  });

  it('truncates to 10 characters', () => {
    expect(programNameFromFileName('superlongname.txt')).toBe('SUPERLONGN');
  });

  it('handles names without an extension', () => {
    expect(programNameFromFileName('readme')).toBe('README');
  });

  it('falls back to PROGRAM for an empty stem', () => {
    expect(programNameFromFileName('.txt')).toBe('PROGRAM');
    expect(programNameFromFileName('')).toBe('PROGRAM');
  });

  it('derives from the untitled default', () => {
    expect(programNameFromFileName('untitled.txt')).toBe('UNTITLED');
  });
});

describe('toProjectFileName', () => {
  it('swaps a .txt extension for .bproj', () => {
    expect(toProjectFileName('untitled.txt')).toBe('untitled.bproj');
  });

  it('swaps a .bas extension for .bproj', () => {
    expect(toProjectFileName('game.bas')).toBe('game.bproj');
  });

  it('appends .bproj when there is no extension', () => {
    expect(toProjectFileName('game')).toBe('game.bproj');
  });

  it('is a no-op when already a .bproj', () => {
    expect(toProjectFileName('game.bproj')).toBe('game.bproj');
  });
});
