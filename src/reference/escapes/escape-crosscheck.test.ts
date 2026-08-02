/**
 * Pins every escape-table row (and the tables' completeness) to the real
 * dialect implementations, so the docs cannot drift from the code:
 *
 *  1. Probe: each row's `example.source` (and each alias) must parse to
 *     exactly `example.bytes` through the dialect's own charset parser, and
 *     a canonical single-byte row must decode back to its spelling.
 *  2. Coverage: enumerating 0x00–0xFF, every byte whose canonical decode is
 *     an escape form must be claimed by a row's `codes` or fall to the
 *     table's `'rest'` row (whose decode must match the raw-escape pattern).
 *     A new named escape added in a charset fails here until the docs row
 *     exists - "every escape code" stays true as the code evolves.
 *  3. Table-driven extras: parse-only spellings that never appear in decode
 *     enumeration (Sinclair backslash graphics, petcat aliases, {CBM-x} and
 *     {SHIFT-x}) are checked against their source tables.
 *
 * Coverage (2) guards a second seam as well. The porting guide narrows itself
 * to the open program by matching the *byte values* it reports across the
 * IDE↔docs iframe boundary (`PROGRAM_VOCABULARY_FIELDS` in
 * src/components/DocsDrawer.tsx) against each row's `codes`. A byte no row
 * claims falls to the `'rest'` row, so a named escape added to a charset
 * without its docs row would quietly report the raw-byte escape instead of the
 * code the program actually used - which is the drift this check already
 * forbids.
 *
 * This test may reach the dialect registry freely: vitest runs it in node and
 * neither the VitePress bundle nor the IDE's own includes *.test.ts, so the
 * escape data itself stays free of dialect code.
 */
import { describe, expect, it } from 'vitest';
import type { EscapeEntry, EscapeTableData } from '../types';

import { zx81Escapes } from './zx81';
import { zx80Escapes } from './zx80';
import { zxspectrumEscapes } from './zxspectrum';
import { bbcEscapes } from './bbc';
import { commodoreEscapes } from './commodore';
import { trs80Escapes } from './trs80';
import { atomEscapes } from './atom';
import { cpcEscapes } from './cpc';
import { dialects } from '../../dialects/registry';

import {
  CHARSET_PROBES,
  type CharsetProbe,
} from '../../dialects/charsetProbes';
import {
  ESCAPES as ZX81_ESCAPES,
  GRAPHIC_UNICODE as ZX81_GRAPHICS,
} from '../../dialects/zx81/charset';
import {
  ESCAPES as ZX80_ESCAPES,
  GRAPHIC_UNICODE as ZX80_GRAPHICS,
} from '../../dialects/zx80/charset';
import {
  floatOverrideNotation as zx81FloatNotation,
  parseFloatOverride as zx81ParseFloat,
} from '../../dialects/zx81/zxfloat';
import {
  floatOverrideNotation as spectrumFloatNotation,
  parseFloatOverride as spectrumParseFloat,
} from '../../dialects/zxspectrum/floatOverride';
import { TELETEXT_NAMES } from '../../dialects/bbcmicro/charset';
import { PETCAT_ALIASES } from '../../dialects/commodore64/petscii';
import {
  C64_COMMODORE_GRAPHICS,
  C64_SHIFT_GRAPHICS,
} from '../../dialects/commodore64/graphics';

/** A float-override probe, for the two dialects whose docs carry float rows. */
interface FloatProbe {
  parse(source: string): number[] | null;
  notation(bytes: number[]): string;
}

/** Adapt a parseFloatOverride to a whole-source parser. */
function floatParserFor(
  parseOverride: (
    text: string,
    i: number,
  ) => { bytes: number[]; end: number } | null,
): (source: string) => number[] | null {
  return (source) => {
    const parsed = parseOverride(source, 0);
    if (!parsed || parsed.end !== source.length) return null;
    return parsed.bytes;
  };
}

/**
 * What the shared charset probes don't carry: the docs table each family is
 * pinned against, and the float-override probe where the page documents one.
 * Keyed by charset-probe id, so a new probe without a table fails loudly below
 * rather than silently going unchecked.
 */
const EXTRAS: Record<string, { data: EscapeTableData; float?: FloatProbe }> = {
  zx81: {
    data: zx81Escapes,
    float: {
      parse: floatParserFor(zx81ParseFloat),
      notation: zx81FloatNotation,
    },
  },
  zx80: { data: zx80Escapes },
  zxspectrum: {
    data: zxspectrumEscapes,
    float: {
      parse: floatParserFor(spectrumParseFloat),
      notation: spectrumFloatNotation,
    },
  },
  bbc: { data: bbcEscapes },
  commodore: { data: commodoreEscapes },
  trs80: { data: trs80Escapes },
  atom: { data: atomEscapes },
  cpc: { data: cpcEscapes },
};

type Adapter = CharsetProbe & { data: EscapeTableData; float?: FloatProbe };

const ADAPTERS: [string, Adapter][] = CHARSET_PROBES.map((probe) => {
  const extra = EXTRAS[probe.id];
  if (!extra) {
    throw new Error(
      `charset probe "${probe.id}" has no escape table registered in EXTRAS`,
    );
  }
  return [probe.id, { ...probe, ...extra }];
});

describe.each(ADAPTERS)('escape cross-check: %s', (_id, adapter) => {
  const { data } = adapter;

  it('every example (and alias) parses to its documented bytes', () => {
    for (const e of data.entries) {
      if (e.probe === 'float') continue;
      expect(adapter.parse(e.example.source), e.escape).toEqual(
        e.example.bytes,
      );
      for (const alias of e.aliases ?? []) {
        expect(adapter.parse(alias), `${e.escape} alias ${alias}`).toEqual(
          e.example.bytes,
        );
      }
    }
  });

  it('canonical single-byte rows decode back to their spelling', () => {
    for (const e of data.entries) {
      if (e.probe === 'float' || e.parseOnly) continue;
      if (!Array.isArray(e.codes) || e.codes.length !== 1) continue;
      // Operand-carrying escapes ({INK n}: 2+ stored bytes) can't be decoded
      // from their control byte alone; the parse probe already pins them.
      if (e.example.bytes.length !== 1) continue;
      expect(adapter.decode(e.codes[0]!), e.escape).toBe(e.example.source);
    }
  });

  it('float-override rows survive a parse/notation round-trip', () => {
    const floats = data.entries.filter((e) => e.probe === 'float');
    if (floats.length === 0) return;
    expect(adapter.float, 'float adapter').toBeDefined();
    for (const e of floats) {
      const bytes = adapter.float!.parse(e.example.source);
      expect(bytes, e.escape).toEqual(e.example.bytes);
      // The notation for those bytes must itself parse back to the same
      // bytes (the canonical spelling may be the decimal form).
      const notation = adapter.float!.notation(e.example.bytes);
      expect(adapter.float!.parse(notation), `${e.escape} notation`).toEqual(
        e.example.bytes,
      );
    }
  });

  it('covers every escape-needing byte 0x00-0xFF', () => {
    const claimed = new Map<number, string>();
    let restRow: EscapeEntry | undefined;
    for (const e of data.entries) {
      if (e.codes === 'rest') {
        restRow = e;
      } else {
        for (const c of e.codes ?? []) {
          expect(claimed.has(c), `byte ${c} claimed twice`).toBe(false);
          claimed.set(c, e.escape);
        }
      }
    }
    for (let b = 0; b < 256; b++) {
      const text = adapter.decode(b);
      const needsEscape = adapter.isEscapeForm(text);
      const claim = claimed.get(b);
      if (claim !== undefined) {
        // A claimed byte must genuinely decode to an escape form.
        expect(
          needsEscape,
          `${claim} claims 0x${b.toString(16)} (${text})`,
        ).toBe(true);
      } else if (needsEscape) {
        // Unclaimed escape byte: it must be the raw catch-all's shape.
        expect(
          restRow,
          `no rest row for 0x${b.toString(16)} (${text})`,
        ).toBeDefined();
        expect(
          adapter.rawPattern.test(text),
          `0x${b.toString(16)} decodes to ${text}, which no row documents`,
        ).toBe(true);
      }
    }
  });
});

describe('escape cross-check: table-driven extras', () => {
  it('every BBC teletext name has a row', () => {
    const spellings = new Set(bbcEscapes.entries.map((e) => e.escape));
    for (const name of Object.values(TELETEXT_NAMES)) {
      expect(spellings.has(`{${name}}`), name).toBe(true);
    }
  });

  it('every petcat alias appears as a C64 row or alias', () => {
    const spellings = new Set(
      commodoreEscapes.entries.flatMap((e) => [e.escape, ...(e.aliases ?? [])]),
    );
    for (const name of Object.keys(PETCAT_ALIASES)) {
      expect(spellings.has(`{${name}}`), name).toBe(true);
    }
  });

  it('every C64 letter-key graphic has a {CBM-x}/{SHIFT-x} row', () => {
    const spellings = new Set(commodoreEscapes.entries.map((e) => e.escape));
    // A graphic printed on no key (`key` is optional - the CPC and TRS-80
    // printed none) has no {CBM-x} spelling to look for.
    for (const { key } of C64_COMMODORE_GRAPHICS) {
      if (key && /^[A-Z]$/.test(key)) {
        expect(spellings.has(`{CBM-${key.toLowerCase()}}`), key).toBe(true);
      }
    }
    for (const { key } of C64_SHIFT_GRAPHICS) {
      if (key && /^[A-Z]$/.test(key)) {
        expect(spellings.has(`{SHIFT-${key.toLowerCase()}}`), key).toBe(true);
      }
    }
  });

  it('every Sinclair backslash escape has a row, with its glyph as alias', () => {
    for (const [table, escapes, graphics] of [
      [zx81Escapes, ZX81_ESCAPES, ZX81_GRAPHICS],
      [zx80Escapes, ZX80_ESCAPES, ZX80_GRAPHICS],
    ] as const) {
      const byEscape = new Map(table.entries.map((e) => [e.escape, e]));
      for (const [key, code] of Object.entries(escapes)) {
        const row = byEscape.get(`\\${key}`);
        expect(row, `${table.title}: \\${key}`).toBeDefined();
        expect(row!.example.bytes, `${table.title}: \\${key}`).toEqual([code]);
        const glyph = graphics[code];
        if (glyph !== undefined) {
          expect(
            row!.aliases ?? [],
            `${table.title}: \\${key} glyph`,
          ).toContain(glyph);
        }
      }
    }
  });
});

/**
 * Machine scoping on escape rows.
 *
 * The probes above stay per-*family*, and deliberately so: a control code is a
 * property of the charset, and machines sharing a reference page share their
 * charset module outright (`pet/charset.ts` and `vic20/charset.ts` both
 * re-export `c64Charset`; the 128K Spectrum's extends the 48K's). Running the
 * same parse probe once per machine would assert the same thing three times.
 *
 * What *is* per-machine is `onlyOn`, and it needs guarding in two directions:
 * a row must not name a machine its page does not cover, and - the trap this
 * change nearly fell into - a row must not be scoped away from a machine whose
 * charset still accepts it. The Commodore colour codes are the worked example:
 * they are meaningless on a monochrome PET but parse and round-trip there
 * exactly as on a C64, so scoping them off the PET would tell a porter to
 * replace `{red}` while this file's own probe kept proving the PET accepts it.
 * What the hardware ignores is a fact (`PortingFacts.colour`), not an absent
 * row.
 */
describe('escape machine scoping', () => {
  const pageOf = (d: { id: string; docsReference?: string }) =>
    d.docsReference ?? d.id;

  it('every onlyOn names a machine the page covers', () => {
    for (const [id, adapter] of ADAPTERS) {
      const onPage = new Set(
        dialects.filter((d) => pageOf(d) === id).map((d) => d.id),
      );
      for (const entry of adapter.data.entries) {
        for (const scoped of entry.onlyOn ?? []) {
          expect(
            onPage,
            `${id}: ${entry.escape} scoped to ${scoped}`,
          ).toContain(scoped);
        }
      }
    }
  });

  it('a scoped row still parses on the machines it names', () => {
    for (const [id, adapter] of ADAPTERS) {
      for (const entry of adapter.data.entries) {
        if (!entry.onlyOn || entry.probe === 'float') continue;
        expect(
          adapter.parse(entry.example.source),
          `${id}: ${entry.escape}`,
        ).toEqual(entry.example.bytes);
      }
    }
  });

  // Pins the enumeration this change is built on, so a future scoping has to be
  // a deliberate act rather than a quiet one.
  it('scopes only the Spectrum UDG rows that a 128K reads as tokens', () => {
    const scoped = ADAPTERS.flatMap(([id, adapter]) =>
      adapter.data.entries
        .filter((e) => e.onlyOn)
        .map((e) => `${id}:${e.escape}`),
    );
    expect(scoped.sort()).toEqual(['zxspectrum:\\t', 'zxspectrum:\\u']);
  });
});
