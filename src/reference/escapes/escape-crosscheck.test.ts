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

import { escapePages } from '../pages';
import { dialects } from '../../dialects/registry';
import { referencePageOf } from '../../dialects/referencePage';

import {
  CHARSET_PROBES,
  codeCountOf,
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
 * What neither the shared charset probes nor the shared page map carries: the
 * float-override probe, for the two pages whose docs carry float rows. Keyed by
 * charset-probe id, which is the page slug the tables are keyed by too.
 */
const FLOATS: Record<string, FloatProbe> = {
  zx81: {
    parse: floatParserFor(zx81ParseFloat),
    notation: zx81FloatNotation,
  },
  zxspectrum: {
    parse: floatParserFor(spectrumParseFloat),
    notation: spectrumFloatNotation,
  },
};

type Adapter = CharsetProbe & { data: EscapeTableData; float?: FloatProbe };

/**
 * The rows of `page` that belong to one charset family: those scoped to a
 * machine the family covers, plus the unscoped ones every machine on the page
 * has.
 *
 * A page covers a family of BASIC and a charset is a property of the machine,
 * so two families can share a page - the Apple I and the Apple II share the
 * Integer BASIC page, the ZX81 and the Spectrums the Sinclair one - and each
 * probe must be read against its own rows. Running a probe over the whole page
 * would ask an Apple I to parse `{INVA}`.
 */
export function rowsForFamily(
  page: EscapeTableData,
  dialectIds: readonly string[],
): EscapeTableData {
  return {
    ...page,
    entries: page.entries.filter(
      (e) => !e.onlyOn || e.onlyOn.some((id) => dialectIds.includes(id)),
    ),
  };
}

const ADAPTERS: [string, Adapter][] = CHARSET_PROBES.map((probe) => {
  const page = escapePages[probe.page ?? probe.id];
  if (!page) {
    throw new Error(
      `charset probe "${probe.id}" has no escape table in src/reference/pages.ts`,
    );
  }
  const data = rowsForFamily(page, probe.dialects);
  return [probe.id, { ...probe, data, float: FLOATS[probe.id] }];
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
    for (let b = 0; b < codeCountOf(adapter); b++) {
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
    const spellings = new Set(escapePages.bbc!.entries.map((e) => e.escape));
    for (const name of Object.values(TELETEXT_NAMES)) {
      expect(spellings.has(`{${name}}`), name).toBe(true);
    }
  });

  it('every petcat alias appears as a C64 row or alias', () => {
    const spellings = new Set(
      escapePages.commodore!.entries.flatMap((e) => [
        e.escape,
        ...(e.aliases ?? []),
      ]),
    );
    for (const name of Object.keys(PETCAT_ALIASES)) {
      expect(spellings.has(`{${name}}`), name).toBe(true);
    }
  });

  it('every C64 key graphic has a {CBM-x}/{SHIFT-x} row', () => {
    const spellings = new Set(
      escapePages.commodore!.entries.map((e) => e.escape),
    );
    // Both faces of the symbol keys count too, not just the letters: the
    // charset accepts {SHIFT-*} and {CBM-+} exactly as it accepts {SHIFT-a}.
    // A graphic printed on no key (`key` is optional - the CPC and TRS-80
    // printed none) has no {CBM-x} spelling to look for.
    for (const { key } of C64_COMMODORE_GRAPHICS) {
      if (key) {
        expect(spellings.has(`{CBM-${key.toLowerCase()}}`), key).toBe(true);
      }
    }
    for (const { key } of C64_SHIFT_GRAPHICS) {
      if (key) {
        expect(spellings.has(`{SHIFT-${key.toLowerCase()}}`), key).toBe(true);
      }
    }
  });

  it('every Sinclair backslash escape has a row, with its glyph as alias', () => {
    for (const [table, escapes, graphics] of [
      // The ZX81's share of the Sinclair page: the Spectrums' backslash rows on
      // it are UDGs, spelled from a different table entirely.
      [
        rowsForFamily(escapePages.sinclair!, ['zx81']),
        ZX81_ESCAPES,
        ZX81_GRAPHICS,
      ],
      [escapePages.zx80!, ZX80_ESCAPES, ZX80_GRAPHICS],
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
  it('every onlyOn names a machine the page covers', () => {
    for (const [id, page] of Object.entries(escapePages)) {
      const onPage = new Set(
        dialects.filter((d) => referencePageOf(d) === id).map((d) => d.id),
      );
      for (const entry of page.entries) {
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

  // Two quite different scopings live on these pages, and only one of them is
  // interesting.
  //
  // A page split across charset families scopes nearly every row, because a row
  // is a property of one generator: that is bookkeeping, and pinning the
  // hundred-odd spellings it produces would say nothing. What matters is a row
  // scoped *within* a family - one machine of a family reading a code its
  // relatives do not - because that is a claim about the hardware, and the
  // enumeration below is what makes it a deliberate act rather than a quiet
  // one.
  it('scopes only the rows a machine genuinely reads differently', () => {
    const withinFamily = ADAPTERS.flatMap(([id, adapter]) =>
      adapter.data.entries
        .filter(
          (e) =>
            e.onlyOn && adapter.dialects.some((d) => !e.onlyOn!.includes(d)),
        )
        .map((e) => `${id}:${e.escape}`),
    );
    expect(withinFamily.sort()).toEqual(['zxspectrum:\\t', 'zxspectrum:\\u']);
  });

  // The other half of the same rule: on a page whose machines do not share a
  // charset, every row that names a code must say whose it is. Only the
  // catch-alls may stand unscoped, and each of those is scoped anyway.
  it('leaves no row unattributed on a page split across charsets', () => {
    const familiesOn = new Map<string, number>();
    for (const [, adapter] of ADAPTERS) {
      const page = adapter.page ?? adapter.id;
      familiesOn.set(page, (familiesOn.get(page) ?? 0) + 1);
    }
    for (const [page, families] of familiesOn) {
      if (families < 2) continue;
      const unscoped = escapePages[page]!.entries.filter((e) => !e.onlyOn);
      for (const row of unscoped) {
        expect(
          row.codes,
          `${page}: ${row.escape} names a code but no machine`,
        ).toBe('rest');
      }
    }
  });
});
