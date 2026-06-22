import { describe, it, expect } from 'vitest';
import { programNameFromFileName } from './files';

describe('programNameFromFileName', () => {
  it('strips the extension and uppercases', () => {
    expect(programNameFromFileName('game.bas')).toBe('GAME');
  });

  it('truncates to 10 characters', () => {
    expect(programNameFromFileName('superlongname.bas')).toBe('SUPERLONGN');
  });

  it('handles names without an extension', () => {
    expect(programNameFromFileName('readme')).toBe('README');
  });

  it('falls back to PROGRAM for an empty stem', () => {
    expect(programNameFromFileName('.bas')).toBe('PROGRAM');
    expect(programNameFromFileName('')).toBe('PROGRAM');
  });

  it('derives from the untitled default', () => {
    expect(programNameFromFileName('untitled.bas')).toBe('UNTITLED');
  });
});
