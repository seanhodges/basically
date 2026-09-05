import { describe, it, expect } from 'vitest';
import { samcoupe } from './index';

describe('samcoupe dialect', () => {
  // The seam the whole app talks to: everything above is reached through
  // these members, so one test that they are wired to each other is worth
  // more here than a second test of any one of them.
  it('tokenizes, builds an image and reads it back', () => {
    const src = '10 PRINT "hi"\n20 GO TO 10';
    const r = samcoupe.tokenize(src, { programName: 'demo' });
    expect(r.errors).toEqual([]);
    expect(r.byteSize).toBe(r.programBytes.length);
    expect(r.image.length).toBeGreaterThan(80);
    expect(samcoupe.detokenize(r.image)).toBe(src);
    expect(samcoupe.detokenizeWithReport!(r.image).autoStart).toBe(10);
    expect(samcoupe.lint('10 LET playernames$="a"')).toHaveLength(1);
    expect(samcoupe.languageSupport()).toBeTruthy();
  });

  // The transfer seam: what the app offers as a file, what it takes back, and
  // the cassette path that has to agree with both.
  it('offers the tape both ways round', () => {
    expect(samcoupe.buildTargets.map((t) => t.fileExtension)).toEqual([
      'tap',
      'wav',
    ]);
    expect(samcoupe.binaryImports).toEqual([
      { extension: '.tap', label: 'Import .TAP…' },
    ]);

    const src = '10 PRINT "hi"\n20 GO TO 10';
    const audio = samcoupe.audio!;
    const decoded = audio.decodeSamples!(
      audio.buildSamples(src, 'demo', false),
      audio.sampleRate,
    );
    expect(decoded.programName).toBe('demo');
    expect(decoded.source).toBe(src);
    expect(decoded.warnings).toEqual([]);
    // Exported load-only, so the recovered tape names no auto-start line.
    expect(decoded.autoStart).toBeUndefined();
  });
});
