import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  EscapeEntry,
  EscapeTableData,
} from '../docs/reference/data/types';

import { zx81Charset } from '../src/dialects/zx81/charset';
import { zx80Charset } from '../src/dialects/zx80/charset';
import { decodeSpan as spectrumDecodeSpan } from '../src/dialects/zxspectrum/charset';
import { decodeSpan as bbcDecodeSpan } from '../src/dialects/bbcmicro/charset';
import { petsciiToText } from '../src/dialects/commodore64/petscii';
import { decodeSpan as trs80DecodeSpan } from '../src/dialects/trs80/charset';
import { decodeSpan as atomDecodeSpan } from '../src/dialects/atom/charset';
import { decodeSpan as cpcDecodeSpan } from '../src/dialects/cpc464/charset';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../docs/reference/data/escapes');

/**
 * Seed a draft escape table for each dialect by enumerating the canonical
 * decode of every byte 0x00-0xFF and keeping the escape-shaped forms: named
 * escapes become one draft row each (description TODO), the raw `{0xNN}`-style
 * forms collapse into a single catch-all row. The drafts are then hand-
 * enriched (categories, descriptions, parse-only alias rows) - like
 * gen-reference-scaffold.mts, an existing file is never overwritten, and the
 * cross-check suite (escape-crosscheck.test.ts) verifies the enriched result.
 */
interface Source {
  id: string;
  varName: string;
  title: string;
  machines: string[];
  decode(byte: number): string;
  isEscapeForm(text: string): boolean;
  rawPattern: RegExp;
  rawSpelling: string;
}

const SOURCES: Source[] = [
  {
    id: 'zx81',
    varName: 'zx81Escapes',
    title: 'ZX81 escape codes',
    machines: ['Sinclair ZX81'],
    decode: (b) => zx81Charset.glyph(b),
    isEscapeForm: (t) => t.startsWith('\\') || t.startsWith('%'),
    rawPattern: /^\\\{[0-9A-F]{2}\}$/,
    rawSpelling: '\\{NN}',
  },
  {
    id: 'zx80',
    varName: 'zx80Escapes',
    title: 'ZX80 escape codes',
    machines: ['Sinclair ZX80'],
    decode: (b) => zx80Charset.glyph(b),
    isEscapeForm: (t) => t.startsWith('\\') || t.startsWith('%'),
    rawPattern: /^\\\{[0-9A-F]{2}\}$/,
    rawSpelling: '\\{NN}',
  },
  {
    id: 'zxspectrum',
    varName: 'zxspectrumEscapes',
    title: 'ZX Spectrum escape codes',
    machines: ['Sinclair ZX Spectrum 48K', 'Sinclair ZX Spectrum 128K'],
    decode: (b) => spectrumDecodeSpan(Uint8Array.of(b), 0, 1).text,
    isEscapeForm: (t) => t.startsWith('\\') || /^\{.*\}$/.test(t),
    rawPattern: /^\{0x[0-9A-F]{2}\}$/,
    rawSpelling: '{0xNN}',
  },
  {
    id: 'bbc',
    varName: 'bbcEscapes',
    title: 'BBC escape codes',
    machines: ['BBC Micro Model B', 'BBC Master'],
    decode: (b) => bbcDecodeSpan(Uint8Array.of(b), 0, 1).text,
    isEscapeForm: (t) => /^\{.*\}$/.test(t),
    rawPattern: /^\{0x[0-9A-F]{2}\}$/,
    rawSpelling: '{0xNN}',
  },
  {
    id: 'commodore64',
    varName: 'commodore64Escapes',
    title: 'Commodore 64 escape codes',
    machines: ['Commodore 64'],
    decode: (b) => petsciiToText(b),
    isEscapeForm: (t) => /^\{.*\}$/.test(t),
    rawPattern: /^\{\$[0-9a-f]{2}\}$/,
    rawSpelling: '{$xx}',
  },
  {
    id: 'trs80',
    varName: 'trs80Escapes',
    title: 'TRS-80 escape codes',
    machines: ['TRS-80 Model I (Level II BASIC)'],
    decode: (b) => trs80DecodeSpan(Uint8Array.of(b), 0, 1).text,
    isEscapeForm: (t) => /^\{.+\}$/.test(t),
    rawPattern: /^\{0x[0-9A-F]{2}\}$/,
    rawSpelling: '{0xNN}',
  },
  {
    id: 'atom',
    varName: 'atomEscapes',
    title: 'Acorn Atom escape codes',
    machines: ['Acorn Atom'],
    decode: (b) => atomDecodeSpan(Uint8Array.of(b), 0, 1).text,
    isEscapeForm: (t) => /^\{.+\}$/.test(t),
    rawPattern: /^\{0x[0-9A-F]{2}\}$/,
    rawSpelling: '{0xNN}',
  },
  {
    id: 'cpc',
    varName: 'cpcEscapes',
    title: 'Amstrad CPC escape codes',
    machines: ['Amstrad CPC 464', 'Amstrad CPC 6128'],
    decode: (b) => cpcDecodeSpan(Uint8Array.of(b), 0, 1).text,
    isEscapeForm: (t) => /^\{.+\}$/.test(t),
    rawPattern: /^\{0x[0-9A-F]{2}\}$/,
    rawSpelling: '{0xNN}',
  },
];

function scaffold(src: Source): EscapeTableData {
  const entries: EscapeEntry[] = [];
  let hasRaw = false;
  let rawExample: { source: string; bytes: number[] } | undefined;
  for (let b = 0; b < 256; b++) {
    const text = src.decode(b);
    if (!src.isEscapeForm(text)) continue;
    if (src.rawPattern.test(text)) {
      hasRaw = true;
      rawExample ??= { source: text, bytes: [b] };
      continue;
    }
    entries.push({
      escape: text,
      bytes: `0x${b.toString(16).toUpperCase().padStart(2, '0')}`,
      category: 'uncategorised',
      description: 'TODO',
      codes: [b],
      example: { source: text, bytes: [b] },
    });
  }
  if (hasRaw) {
    entries.push({
      escape: src.rawSpelling,
      bytes: 'any',
      category: 'raw',
      description: 'TODO: any raw byte with no printable form.',
      codes: 'rest',
      example: rawExample!,
    });
  }
  return {
    title: src.title,
    machines: src.machines,
    categories: [
      { id: 'uncategorised', label: 'Uncategorised' },
      { id: 'raw', label: 'Raw bytes' },
    ],
    entries,
  };
}

mkdirSync(dataDir, { recursive: true });

for (const src of SOURCES) {
  const file = resolve(dataDir, `${src.id}.ts`);
  if (existsSync(file)) {
    console.log(`skip (exists): docs/reference/data/escapes/${src.id}.ts`);
    continue;
  }
  const data = scaffold(src);
  const body =
    `// Escape-code table for the ${data.title} page.\n` +
    `// Seeded from the dialect charset by scripts/gen-escape-scaffold.mts, then\n` +
    `// hand-enriched (categories, descriptions, parse-only alias rows). Edit by\n` +
    `// hand; the generator skips this file once it exists. Kept honest by\n` +
    `// escapes/escape-crosscheck.test.ts.\n` +
    `import type { EscapeTableData } from '../types';\n\n` +
    `export const ${src.varName}: EscapeTableData = ${JSON.stringify(data, null, 2)};\n`;
  writeFileSync(file, body, 'utf8');
  console.log(
    `wrote docs/reference/data/escapes/${src.id}.ts (${data.entries.length} draft rows)`,
  );
}
