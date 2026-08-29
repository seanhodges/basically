import { describe, expect, it } from 'vitest';
import {
  auditAll,
  graphicsFacts,
  requiredCodepoints,
  typeableCodes,
  IN_SCOPE,
  SEMIGRAPHIC_CODES,
} from './semigraphicsAudit';
import { dialects } from './registry';
import { getDialect } from './registry';

describe('semigraphics audit', () => {
  const audits = auditAll();

  it('covers every registered dialect, in registry order', () => {
    expect(audits.map((a) => a.id)).toEqual(dialects.map((d) => d.id));
  });

  it('classifies all 256 bytes of every dialect exactly once', () => {
    for (const audit of audits) {
      expect(audit.bytes.length, audit.id).toBe(256);
      expect(
        audit.bytes.map((b) => b.code),
        audit.id,
      ).toEqual(Array.from({ length: 256 }, (_, i) => i));
    }
  });

  it('declares graphics codes only for dialects that are registered', () => {
    for (const id of Object.keys(SEMIGRAPHIC_CODES)) {
      expect(
        dialects.some((d) => d.id === id),
        `SEMIGRAPHIC_CODES names unregistered dialect "${id}"`,
      ).toBe(true);
    }
  });

  it('declares each dialect graphics codes, or records them as unestablished', () => {
    // A dialect missing from the table entirely would silently read as
    // "unestablished" - make the omission deliberate instead.
    for (const d of dialects) {
      expect(
        Object.prototype.hasOwnProperty.call(SEMIGRAPHIC_CODES, d.id),
        `${d.id} is not mentioned in SEMIGRAPHIC_CODES`,
      ).toBe(true);
    }
  });

  it('declares graphics codes in range and without duplicates', () => {
    for (const [id, codes] of Object.entries(SEMIGRAPHIC_CODES)) {
      if (codes === null) continue;
      expect(new Set(codes).size, `${id} repeats a code`).toBe(codes.length);
      for (const code of codes) {
        expect(code, `${id} declares ${code}`).toBeGreaterThanOrEqual(0);
        expect(code, `${id} declares ${code}`).toBeLessThanOrEqual(0xff);
      }
    }
  });

  it('scopes the machines whose graphics are guaranteed end to end', () => {
    for (const id of IN_SCOPE) {
      expect(
        dialects.some((d) => d.id === id),
        `IN_SCOPE names unregistered dialect "${id}"`,
      ).toBe(true);
    }
    // Every registered machine: the Sinclair, Acorn (BBC and Atom),
    // Commodore, Tandy and Amstrad families.
    expect([...IN_SCOPE].sort()).toEqual([
      'atom',
      'bbcmaster',
      'bbcmicro',
      'commodore64',
      'cpc464',
      'cpc6128',
      'cpc664',
      'pet',
      'trs80',
      'vic20',
      'zx80',
      'zx81',
      'zxspectrum',
      'zxspectrum128',
    ]);
  });

  it('finds typeable characters on every dialect', () => {
    // Every machine can at least type its letters; an empty set means the
    // keyboard walk broke rather than that the machine has no keys.
    for (const d of dialects) {
      expect(typeableCodes(d).size, d.id).toBeGreaterThan(0);
    }
  });

  it('reports the Sinclair block graphics as fully typeable', () => {
    // The ZX80/ZX81 graphics layers reach every graphics code; this is the
    // regression anchor for the palette migration, which must not lose any.
    for (const id of ['zx81', 'zx80']) {
      const audit = audits.find((a) => a.id === id)!;
      const missing = graphicsFacts(audit).filter((f) => !f.typeable);
      expect(
        missing.map((f) => f.code.toString(16)),
        id,
      ).toEqual([]);
    }
  });

  it('reports the Spectrum graphics as typeable from the palette', () => {
    // The gap this change closed: the charset could always represent the block
    // graphics, and now the keyboard can produce them too - all but the blank
    // graphic at 0x80, whose text form is a space (there is nothing to type).
    const audit = audits.find((a) => a.id === 'zxspectrum')!;
    const facts = graphicsFacts(audit);
    expect(facts.some((f) => f.cls === 'glyph-bmp')).toBe(true);
    expect(
      facts.filter((f) => !f.typeable).map((f) => f.code),
      'only the blank graphic should be untypeable',
    ).toEqual([0x80]);
  });

  it('agrees with each charset about what a graphics character encodes to', () => {
    // Whatever the audit calls a glyph must round-trip: the font subset and the
    // palette both trust this.
    for (const audit of audits) {
      const dialect = getDialect(audit.id);
      for (const { code, text, cls } of audit.bytes) {
        if (cls !== 'glyph-bmp' && cls !== 'glyph-astral') continue;
        expect(
          [...dialect.charset.toMachine(text)],
          `${audit.id} 0x${code.toString(16)} (${text})`,
        ).toEqual([code]);
      }
    }
  });

  it('lists required codepoints sorted, non-ASCII and deduplicated', () => {
    const points = requiredCodepoints(audits);
    expect(points.length).toBeGreaterThan(0);
    expect(new Set(points).size).toBe(points.length);
    expect([...points].sort((a, b) => a - b)).toEqual(points);
    for (const cp of points) expect(cp).toBeGreaterThanOrEqual(0x80);
  });
});
