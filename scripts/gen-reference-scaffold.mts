import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { KeywordInfo } from '../src/dialects/types';
import type {
  ReferenceEntry,
  ReferenceTableData,
} from '../src/reference/types';

import { zx81Keywords, zx81Operators } from '../src/dialects/zx81/keywords';
import { zx80Keywords } from '../src/dialects/zx80/keywords';
import {
  spectrumKeywords,
  spectrumOperators,
} from '../src/dialects/zxspectrum/keywords';
import {
  SPECTRUM_KEYWORD,
  PLAY_KEYWORD,
} from '../src/dialects/zxspectrum128/keywords';
import { bbcKeywords } from '../src/dialects/bbcmicro/keywords';
import { c64Keywords } from '../src/dialects/commodore64/keywords';
import { atomKeywords } from '../src/dialects/atom/keywords';
import { trs80Keywords } from '../src/dialects/trs80/keywords';
import { locoKeywordTable } from '../src/dialects/cpc464/keywords';
import { altair8800Keywords } from '../src/dialects/altair8800/keywords';
import {
  apple1Keywords,
  apple1Operators,
} from '../src/dialects/apple1/keywords';
import {
  apple2Keywords,
  apple2Operators,
} from '../src/dialects/apple2/keywords';
import {
  apple2plusKeywords,
  apple2plusOperators,
} from '../src/dialects/apple2plus/keywords';
import {
  atariKeywords,
  atariOperators,
} from '../src/dialects/atari800/keywords';
import { hb10pKeywords, hb10pOperators } from '../src/dialects/hb10p/keywords';
import { ge235Keywords, ge235Operators } from '../src/dialects/ge235/keywords';
import { z80Engine } from '../src/asm/z80';
import { m6502Engine } from '../src/asm/m6502';
import type { AsmEngine } from '../src/asm/types';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../src/reference');

/** The assembler directives both engines add on top of the CPU mnemonics. */
const ASM_DIRECTIVES = ['ORG', 'DB', 'DW', 'DS'];

/**
 * Seed asm reference rows straight from an engine's own instruction set:
 * one `instruction` row per mnemonic (minus the shared directives) plus a
 * `directive` row per directive. Descriptions are left blank for the
 * hand-enrichment pass, exactly like the BASIC scaffolds.
 */
function asmEntries(engine: AsmEngine): ReferenceEntry[] {
  const instructions = [...engine.mnemonics]
    .filter((m) => !ASM_DIRECTIVES.includes(m))
    .sort();
  return [
    ...instructions.map(
      (name): ReferenceEntry => ({
        name,
        kind: 'instruction',
        syntax: name,
        description: '',
      }),
    ),
    ...ASM_DIRECTIVES.map(
      (name): ReferenceEntry => ({
        name,
        kind: 'directive',
        syntax: name,
        description: '',
      }),
    ),
  ];
}

/** Copy a keyword into a draft row; the enrichment passes rewrite syntax/description. */
function toEntry(k: KeywordInfo, tag?: string): ReferenceEntry {
  return {
    name: k.word,
    kind: k.kind,
    syntax: k.signature ?? k.word,
    description: k.doc ?? '',
    ...(tag ? { tag } : {}),
  };
}

/** De-duplicate by name (some dialects list aliases), keeping the first occurrence. */
function dedupe(entries: ReferenceEntry[]): ReferenceEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => (seen.has(e.name) ? false : seen.add(e.name)));
}

/** Seed a row for an operator the dialect declares outside its keyword table. */
function operatorEntry(name: string): ReferenceEntry {
  return { name, kind: 'operator', syntax: name, description: '' };
}

/** One machine's - or one model group's - share of a page several of them read. */
interface Contributor {
  /** Badge for a word this contributor has and its page-mates have not. */
  tag: string;
  keywords: readonly KeywordInfo[];
  /**
   * Operators the dialect declares rather than holding in its keyword table
   * (see src/dialects/operators.ts). The reference page lists both.
   */
  operators?: readonly string[];
}

/**
 * The rows of a page whose machines do not share one vocabulary, badged by who
 * has what: a word more than one contributor spells is unbadged, and one only a
 * single contributor has carries that contributor's tag.
 *
 * The badge is all a seed can say. Which machine ids a row belongs to is
 * `ReferenceEntry.onlyOn`, and the enrichment pass writes it - the scaffolder
 * knows model groups ("the Spectrums") and not registry ids. What the badge
 * does is put every difference in front of whoever enriches the file, instead
 * of leaving it to be noticed when keyword-crosscheck.test.ts fails.
 */
function sharedPage(contributors: readonly Contributor[]): ReferenceEntry[] {
  const words = contributors.map(
    (c) => new Set([...c.keywords.map((k) => k.word), ...(c.operators ?? [])]),
  );
  const soleTag = (word: string): string | undefined => {
    const holders = contributors.filter((_, i) => words[i]!.has(word));
    return holders.length === 1 ? holders[0]!.tag : undefined;
  };
  return dedupe(
    contributors.flatMap((c) => [
      ...c.keywords.map((k) => toEntry(k, soleTag(k.word))),
      ...(c.operators ?? []).map((word) => {
        const tag = soleTag(word);
        return tag ? { ...operatorEntry(word), tag } : operatorEntry(word);
      }),
    ]),
  );
}

const sets: { id: string; varName: string; data: ReferenceTableData }[] = [
  {
    // The page slug, not a dialect id: one page covers the ZX81 and both
    // Spectrums, which share a BASIC and not much of a vocabulary. Naming a set
    // after either machine made the generator write a second, empty file every
    // time it ran, because it never saw the enriched sinclair.ts beside it.
    id: 'sinclair',
    varName: 'sinclairReference',
    data: {
      title: 'Sinclair BASIC',
      machines: [
        'Sinclair ZX81',
        'Sinclair ZX Spectrum 48K',
        'Sinclair ZX Spectrum 128K',
      ],
      entries: sharedPage([
        { tag: 'ZX81 only', keywords: zx81Keywords, operators: zx81Operators },
        {
          tag: 'Spectrum only',
          keywords: spectrumKeywords,
          operators: spectrumOperators,
        },
        { tag: '128K only', keywords: [SPECTRUM_KEYWORD, PLAY_KEYWORD] },
      ]),
    },
  },
  {
    id: 'zx80',
    varName: 'zx80Reference',
    data: {
      title: 'ZX80 integer BASIC',
      machines: ['Sinclair ZX80'],
      entries: dedupe(zx80Keywords.map((k) => toEntry(k))),
    },
  },
  {
    id: 'bbc',
    varName: 'bbcReference',
    data: {
      title: 'BBC BASIC (Micro & Master)',
      machines: ['BBC Micro Model B', 'BBC Master'],
      entries: dedupe(bbcKeywords.map((k) => toEntry(k))),
    },
  },
  {
    // The page slug, not a dialect id: one table covers all three Commodore
    // machines. Naming it after the C64 made the generator write a second,
    // empty src/reference/commodore64.ts every time it ran, because it never
    // saw the enriched commodore.ts sitting beside it.
    id: 'commodore',
    varName: 'commodoreReference',
    data: {
      title: 'Commodore BASIC',
      machines: ['Commodore 64', 'Commodore VIC-20', 'Commodore PET'],
      entries: dedupe(c64Keywords.map((k) => toEntry(k))),
    },
  },
  {
    id: 'atom',
    varName: 'atomReference',
    data: {
      title: 'Acorn Atom BASIC',
      machines: ['Acorn Atom'],
      entries: dedupe(atomKeywords.map((k) => toEntry(k))),
    },
  },
  {
    id: 'trs80',
    varName: 'trs80Reference',
    data: {
      title: 'TRS-80 Level II BASIC',
      machines: ['TRS-80 Model I (Level II BASIC)'],
      entries: dedupe(trs80Keywords.map((k) => toEntry(k))),
    },
  },
  {
    id: 'cpc',
    varName: 'cpcReference',
    data: {
      title: 'Amstrad CPC Locomotive BASIC (1.0 & 1.1)',
      machines: ['Amstrad CPC 464', 'Amstrad CPC 6128'],
      // 1.1-only additions carry `since: 'basic11'`; tag them so the shared page
      // marks what the BASIC 1.0 464 rejects (the '128K only' precedent).
      entries: dedupe(
        locoKeywordTable.map((k) =>
          toEntry(k, k.since === 'basic11' ? 'BASIC 1.1 only' : undefined),
        ),
      ),
    },
  },
  {
    id: 'altair8800',
    varName: 'altair8800Reference',
    data: {
      title: 'Altair 8K BASIC',
      machines: ['MITS Altair 8800'],
      entries: dedupe(altair8800Keywords.map((k) => toEntry(k))),
    },
  },
  {
    // The page slug, not a dialect id: one page covers both revisions of the
    // interpreter, the Apple I's and the Apple II's. As with the Sinclair page
    // above, a set named after either machine wrote an empty file beside the
    // enriched integer-basic.ts on every run.
    id: 'integer-basic',
    varName: 'integerBasicReference',
    data: {
      title: 'Integer BASIC',
      machines: ['Apple I', 'Apple II'],
      entries: sharedPage([
        {
          tag: 'Apple I only',
          keywords: apple1Keywords,
          operators: apple1Operators,
        },
        {
          tag: 'Apple II only',
          keywords: apple2Keywords,
          operators: apple2Operators,
        },
      ]),
    },
  },
  {
    // The page slug, not the dialect id: the II Plus cannot share the II's
    // page, the two BASICs sharing more than a dozen spellings with different
    // meanings and reference-data.test.ts banning duplicate names on a page.
    id: 'applesoft',
    varName: 'applesoftReference',
    data: {
      title: 'Applesoft BASIC',
      machines: ['Apple II Plus'],
      // As the Apple II above: the symbolic operators are declared on the
      // dialect rather than held in the keyword table, and the reference page
      // lists both. Here the two overlap - Applesoft tokenizes `+`, `<` and the
      // rest - so `dedupe` keeps the keyword row and only the two-token
      // comparisons (`<=`, `<>` and their reversed spellings) come from the
      // operator list.
      entries: dedupe([
        ...apple2plusKeywords.map((k) => toEntry(k)),
        ...apple2plusOperators.map(
          (word): ReferenceEntry => ({
            name: word,
            kind: 'operator',
            syntax: word,
            description: '',
          }),
        ),
      ]),
    },
  },
  {
    id: 'atari',
    varName: 'atariReference',
    data: {
      title: 'Atari BASIC',
      machines: ['Atari 800', 'Atari 400'],
      // The symbolic operators are declared on the dialect rather than held in
      // the keyword table, and the reference page lists both (see
      // src/dialects/operators.ts), so seed a row for each of them too.
      entries: dedupe([
        ...atariKeywords.map((k) => toEntry(k)),
        ...atariOperators.map(
          (word): ReferenceEntry => ({
            name: word,
            kind: 'operator',
            syntax: word,
            description: '',
          }),
        ),
      ]),
    },
  },
  {
    // The page slug, not the dialect id: MSX is a standard, and every machine
    // built to it runs this same BASIC, so the page is named for the standard
    // the way `cpc` is named for Locomotive BASIC rather than for the 464.
    id: 'msx',
    varName: 'msxReference',
    data: {
      title: 'MSX BASIC',
      machines: ['Sony HB-10P'],
      // The relational spellings MSX BASIC accepts but stores as two tokens are
      // declared on the dialect rather than held in the keyword table, and the
      // reference page lists both (see src/dialects/operators.ts).
      entries: dedupe([
        ...hb10pKeywords.map((k) => toEntry(k)),
        ...hb10pOperators.map(
          (word): ReferenceEntry => ({
            name: word,
            kind: 'operator',
            syntax: word,
            description: '',
          }),
        ),
      ]),
    },
  },
  {
    // The page slug is the dialect id here, but the title is the language: this
    // is Dartmouth BASIC, and the GE-235 is the machine that ran it.
    id: 'dartmouth',
    varName: 'dartmouthReference',
    data: {
      title: 'Dartmouth BASIC',
      machines: ['GE-235'],
      // Every operator is punctuation the compiler reads a character at a time
      // rather than a word in the keyword table, so the reference page's rows
      // for them are seeded from the dialect's operator list (see
      // src/dialects/operators.ts).
      entries: dedupe([
        ...ge235Keywords.map((k) => toEntry(k)),
        ...ge235Operators.map(
          (word): ReferenceEntry => ({
            name: word,
            kind: 'operator',
            syntax: word,
            description: '',
          }),
        ),
      ]),
    },
  },
  {
    id: 'z80-assembly',
    varName: 'z80AssemblyReference',
    data: {
      title: 'Z80 assembly',
      machines: [
        'Sinclair ZX81',
        'Sinclair ZX80',
        'Sinclair ZX Spectrum (48K & 128K)',
        'TRS-80 Model I',
      ],
      entries: asmEntries(z80Engine),
    },
  },
  {
    id: 'm6502-assembly',
    varName: 'm6502AssemblyReference',
    data: {
      title: '6502 assembly',
      machines: [
        'Commodore 64',
        'Commodore VIC-20',
        'Commodore PET',
        'BBC Micro',
        'BBC Master',
        'Acorn Atom',
        'Apple I',
        'Apple II',
        'Apple II Plus',
        'Atari 800',
        'Atari 400',
      ],
      entries: asmEntries(m6502Engine),
    },
  },
];

mkdirSync(dataDir, { recursive: true });

for (const { id, varName, data } of sets) {
  const file = resolve(dataDir, `${id}.ts`);
  if (existsSync(file)) {
    console.log(`skip (exists): src/reference/${id}.ts`);
    continue;
  }
  const body =
    `// Reference table data for the ${data.title} page.\n` +
    `// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,\n` +
    `// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;\n` +
    `// the generator skips this file once it exists.\n` +
    `import type { ReferenceTableData } from './types';\n\n` +
    `export const ${varName}: ReferenceTableData = ${JSON.stringify(data, null, 2)};\n`;
  writeFileSync(file, body, 'utf8');
  console.log(`wrote src/reference/${id}.ts (${data.entries.length} entries)`);
}
