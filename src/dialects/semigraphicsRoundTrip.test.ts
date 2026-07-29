import { describe, expect, it } from 'vitest';
import { getDialect } from './registry';
import { SEMIGRAPHIC_CODES, IN_SCOPE } from './semigraphicsAudit';
import { exportImportRoundTrip } from './exportRoundTripHarness';
import type { GraphicEntry } from '../keyboard/layoutSchema';

/**
 * The end-to-end guarantee for the machines whose graphics this change covers:
 * what the palette offers is what the editor holds, what the tokenizer stores,
 * and what comes back off the hardware format.
 *
 * Table-driven over the seven in-scope dialects. Every exception is named and
 * explained rather than skipped, so a regression that quietly loses a character
 * shows up as a changed list instead of a passing test.
 */

interface Case {
  id: string;
  /** Build target used for the export/import leg. */
  target: string;
  /**
   * Palette codes whose character tokenizes to a *lower* code with an identical
   * character-ROM bitmap: `code -> the code it really encodes to`. The charset is
   * injective (one text form per byte), so a twin cannot have a character of its
   * own; the palette still lists it under its real key because the physical
   * keyboard does, and on screen the result is the same shape.
   */
  twins?: Record<number, number>;
  /**
   * Codes in the machine's graphics range that no key on it produces, so the
   * palette cannot offer them.
   */
  unreachable?: Record<number, string>;
  /** Palette codes outside the declared graphics range, and why they belong. */
  outsideRange?: Record<number, string>;
  /** Entries that are not a graphics character in text, and why. */
  notText?: Record<number, string>;
}

/** The Commodore twins: the same four on every machine that has those keys. */
const C64_TWINS: Record<number, number> = {
  // C= H draws the same two-eighths bar as C= G ($A5).
  0xb4: 0xa5,
  // C= N draws the same right-hand bar as C= M ($A7).
  0xaa: 0xa7,
  // SHIFT C is the same horizontal line as SHIFT * ($C0).
  0xc3: 0xc0,
  // SHIFT - is the same vertical line as SHIFT B ($C2).
  0xdd: 0xc2,
};

const CASES: Case[] = [
  { id: 'zx80', target: 'o-file' },
  { id: 'zx81', target: 'p-file' },
  {
    id: 'zxspectrum',
    target: 'tap-file',
    notText: {
      // The blank graphic. Its text form is a space, which encodes to 0x20;
      // there is no way to type 0x80 and no reason to (it prints as a space).
      0x80: 'the blank graphic renders as a space',
    },
  },
  {
    id: 'zxspectrum128',
    target: 'tap-file',
    notText: { 0x80: 'the blank graphic renders as a space' },
  },
  ...(['bbcmicro', 'bbcmaster'] as const).map((id) => ({
    id,
    target: 'bbc-file',
    unreachable: {
      0xa0: 'the blank mosaic; its text form would be a space, so it has none',
    },
  })),
  {
    id: 'commodore64',
    target: 'c64-prg',
    twins: C64_TWINS,
    unreachable: {
      0xa0: 'the C= space (inverse space) is not printed on a key front',
      0xde: 'C= ↑ has no graphic on its key front - only SHIFT ↑ (π)',
    },
    outsideRange: {
      0xff: 'π (SHIFT ↑) is a real PETSCII code above the graphics block',
    },
  },
  {
    id: 'vic20',
    target: 'vic20-prg',
    twins: C64_TWINS,
    unreachable: {
      0xa0: 'the C= space (inverse space) is not printed on a key front',
      0xde: 'C= ↑ has no graphic on its key front - only SHIFT ↑ (π)',
    },
    outsideRange: {
      0xff: 'π (SHIFT ↑) is a real PETSCII code above the graphics block',
    },
  },
  {
    id: 'pet',
    target: 'pet-prg',
    twins: { 0xc3: C64_TWINS[0xc3]!, 0xdd: C64_TWINS[0xdd]! },
    // The PET graphics keyboard has no Commodore key, so only the SHIFT set is
    // printed on it: half the PETSCII graphics range is simply not typeable on
    // this machine, and the palette says so by not offering them.
    unreachable: Object.fromEntries(
      [
        0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xaa, 0xab, 0xac,
        0xad, 0xae, 0xaf, 0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8,
        0xb9, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf, 0xdc, 0xde, 0xdf,
      ].map((code) => [code, 'in the C= set, which the PET keyboard lacks']),
    ),
    outsideRange: {
      0xff: 'π (SHIFT ↑) is a real PETSCII code above the graphics block',
    },
  },
  {
    id: 'trs80',
    target: 'trs80-cas',
    unreachable: {
      0x80: 'the blank cell; its text form would be a space, so it has none',
    },
  },
  ...(['cpc464', 'cpc6128'] as const).map((id) => ({
    id,
    target: `${id}-bas`,
    unreachable: {
      0x80: 'the blank cell; its text form would be a space, so it has none',
    },
  })),
  {
    id: 'atom',
    target: 'atom-atm',
    unreachable: {
      0xa0: 'the blank cell; its text form would be a space, so it has none',
    },
  },
];

const hex = (code: number): string => `0x${code.toString(16)}`;

/** The palette entries of a dialect, flattened across its sections. */
const paletteOf = (id: string): GraphicEntry[] =>
  (getDialect(id).keyboardLayout.graphicsPalette?.sections ?? []).flatMap(
    (s) => s.entries,
  );

/** Entries whose character is expected to be the code's own text form. */
const textEntries = (kase: Case): GraphicEntry[] =>
  paletteOf(kase.id).filter((e) => !(e.code in (kase.notText ?? {})));

describe('semigraphics round trip', () => {
  it('covers every in-scope dialect', () => {
    expect(CASES.map((c) => c.id).sort()).toEqual([...IN_SCOPE].sort());
  });

  describe.each(CASES)('$id', (kase) => {
    const dialect = getDialect(kase.id);
    const entries = paletteOf(kase.id);

    it('offers a palette at all', () => {
      expect(entries.length).toBeGreaterThan(0);
    });

    it('encodes each palette character to the single byte it stands for', () => {
      for (const entry of textEntries(kase)) {
        const expected = kase.twins?.[entry.code] ?? entry.code;
        expect(
          [...dialect.charset.toMachine(entry.char)],
          `${entry.key} -> ${hex(entry.code)}`,
        ).toEqual([expected]);
      }
    });

    it('names every twin, and no more', () => {
      // A character that encodes to another code is either a known
      // visually-identical twin or a bug; this is the assertion that turns the
      // drift into a list somebody has to change deliberately.
      const drifting = textEntries(kase)
        .filter(
          (e) =>
            dialect.charset.toMachine(e.char).length !== 1 ||
            dialect.charset.toMachine(e.char)[0] !== e.code,
        )
        .map((e) => e.code);
      expect(drifting.sort((a, b) => a - b).map(hex)).toEqual(
        Object.keys(kase.twins ?? {})
          .map(Number)
          .sort((a, b) => a - b)
          .map(hex),
      );
    });

    it('renders each code back to exactly the character the palette inserts', () => {
      // So a program detokenized from an image shows what was typed.
      for (const entry of textEntries(kase)) {
        if (kase.twins && entry.code in kase.twins) continue;
        expect(
          dialect.charset.toUnicode(Uint8Array.of(entry.code)),
          `${hex(entry.code)} (${entry.key})`,
        ).toBe(entry.char);
      }
    });

    it('offers each code once, inside the machine graphics range', () => {
      const seen = new Set<number>();
      for (const entry of entries) {
        expect(seen.has(entry.code), `${hex(entry.code)} offered twice`).toBe(
          false,
        );
        seen.add(entry.code);
      }
      const declared = new Set(SEMIGRAPHIC_CODES[kase.id] ?? []);
      const outside = [...seen]
        .filter((code) => !declared.has(code))
        .sort((a, b) => a - b);
      expect(outside.map(hex)).toEqual(
        Object.keys(kase.outsideRange ?? {})
          .map(Number)
          .sort((a, b) => a - b)
          .map(hex),
      );
    });

    it('reaches every graphics code the machine can type', () => {
      const declared = SEMIGRAPHIC_CODES[kase.id] ?? [];
      const offered = new Set(entries.map((e) => e.code));
      const missing = declared
        .filter((code) => !offered.has(code))
        .sort((a, b) => a - b);
      // Anything the palette leaves out is a code with no key of its own -
      // listed, with the reason, in the case above.
      expect(missing.map(hex)).toEqual(
        Object.keys(kase.unreachable ?? {})
          .map(Number)
          .sort((a, b) => a - b)
          .map(hex),
      );
    });

    /** `10 PRINT "…"` lines carrying every palette character. */
    const program = (): string => {
      const chars = textEntries(kase).map((e) => e.char);
      const lines: string[] = [];
      for (let i = 0; i < chars.length; i += 8) {
        lines.push(
          `${10 + lines.length * 10} PRINT "${chars.slice(i, i + 8).join('')}"`,
        );
      }
      return lines.join('\n') + '\n';
    };

    it('tokenizes a program of every graphic into an image holding the bytes', () => {
      const { image, errors } = dialect.tokenize(program());
      expect(errors).toEqual([]);
      const bytes = new Set(image);
      for (const entry of textEntries(kase)) {
        const stored = kase.twins?.[entry.code] ?? entry.code;
        expect(bytes.has(stored), `${hex(stored)} (${entry.key})`).toBe(true);
      }
    });

    it('survives an export and import through the hardware format', async () => {
      const source = program();
      const outcome = await exportImportRoundTrip(
        dialect,
        source,
        'graphics',
        [],
        { targetId: kase.target },
      );
      expect(outcome.errors).toEqual([]);
      expect(outcome.programByteExact).toBe(true);
      // The recovered text is the source again, character for character - the
      // point of a canonical text form.
      expect(outcome.source.trimEnd()).toBe(source.trimEnd());
    });
  });
});
