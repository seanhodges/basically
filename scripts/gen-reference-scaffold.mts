import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { KeywordInfo } from '../src/dialects/types';
import type {
  ReferenceEntry,
  ReferenceTableData,
} from '../docs/reference/data/types';

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

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../docs/reference/data');

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
];

mkdirSync(dataDir, { recursive: true });

for (const { id, varName, data } of sets) {
  const file = resolve(dataDir, `${id}.ts`);
  if (existsSync(file)) {
    console.log(`skip (exists): docs/reference/data/${id}.ts`);
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
  console.log(
    `wrote docs/reference/data/${id}.ts (${data.entries.length} entries)`,
  );
}
