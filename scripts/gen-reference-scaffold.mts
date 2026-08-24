import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { KeywordInfo } from '../src/dialects/types';
import type {
  ReferenceEntry,
  ReferenceTableData,
} from '../src/reference/types';

import { zx81Keywords } from '../src/dialects/zx81/keywords';
import { zx80Keywords } from '../src/dialects/zx80/keywords';
import { spectrumKeywords } from '../src/dialects/zxspectrum/keywords';
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
import { apple1Keywords } from '../src/dialects/apple1/keywords';
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

const sets: { id: string; varName: string; data: ReferenceTableData }[] = [
  {
    id: 'zx81',
    varName: 'zx81Reference',
    data: {
      title: 'ZX81 BASIC',
      machines: ['Sinclair ZX81'],
      entries: dedupe(zx81Keywords.map((k) => toEntry(k))),
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
    id: 'zxspectrum',
    varName: 'zxspectrumReference',
    data: {
      title: 'ZX Spectrum BASIC (48K & 128K)',
      machines: ['Sinclair ZX Spectrum 48K', 'Sinclair ZX Spectrum 128K'],
      entries: dedupe([
        ...spectrumKeywords.map((k) => toEntry(k)),
        toEntry(SPECTRUM_KEYWORD, '128K only'),
        toEntry(PLAY_KEYWORD, '128K only'),
      ]),
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
    id: 'commodore64',
    varName: 'commodore64Reference',
    data: {
      title: 'Commodore BASIC',
      machines: ['Commodore 64'],
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
    id: 'apple1',
    varName: 'apple1Reference',
    data: {
      title: 'Apple 1 Integer BASIC',
      machines: ['Apple I'],
      entries: dedupe(apple1Keywords.map((k) => toEntry(k))),
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
