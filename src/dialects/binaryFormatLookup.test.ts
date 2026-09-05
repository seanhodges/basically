import { describe, expect, it } from 'vitest';
import { dialects } from './registry';
import { dialectsForExtension } from './binaryFormatLookup';

describe('binary format lookup', () => {
  it('names every dialect that declares an extension, not just one of them', () => {
    for (const dialect of dialects) {
      for (const format of dialect.binaryImports ?? []) {
        const ext = format.extension.replace(/^\./, '');
        const expected = dialects.filter((d) =>
          (d.binaryImports ?? []).some(
            (f) =>
              f.extension.replace(/^\./, '').toLowerCase() ===
              ext.toLowerCase(),
          ),
        );
        expect(
          dialectsForExtension(`prog.${ext}`),
          `${dialect.id} ${format.extension}`,
        ).toEqual(expected);
        expect(expected).toContain(dialect);
      }
    }
  });

  it('matches case-insensitively and finds nothing for an unregistered extension', () => {
    expect(dialectsForExtension('GAME.P')).toEqual(
      dialectsForExtension('game.p'),
    );
    expect(dialectsForExtension('prog.nosuchformat')).toEqual([]);
    expect(dialectsForExtension('noextension')).toEqual([]);
  });
});
