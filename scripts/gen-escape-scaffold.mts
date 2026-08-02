import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EscapeEntry, EscapeTableData } from '../src/reference/types';

import {
  CHARSET_PROBES,
  type CharsetProbe,
} from '../src/dialects/charsetProbes';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../src/reference/escapes');

/**
 * Seed a draft escape table for each dialect by enumerating the canonical
 * decode of every byte 0x00-0xFF and keeping the escape-shaped forms: named
 * escapes become one draft row each (description TODO), the raw `{0xNN}`-style
 * forms collapse into a single catch-all row. The drafts are then hand-
 * enriched (categories, descriptions, parse-only alias rows) - like
 * gen-reference-scaffold.mts, an existing file is never overwritten, and the
 * cross-check suite (escape-crosscheck.test.ts) verifies the enriched result.
 *
 * How to drive each charset comes from src/dialects/charsetProbes.ts, shared
 * with the cross-check and the semigraphics audit so the three cannot disagree
 * about what a dialect's escapes look like.
 */
function scaffold(src: CharsetProbe): EscapeTableData {
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

for (const src of CHARSET_PROBES) {
  const file = resolve(dataDir, `${src.id}.ts`);
  if (existsSync(file)) {
    console.log(`skip (exists): src/reference/escapes/${src.id}.ts`);
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
    `wrote src/reference/escapes/${src.id}.ts (${data.entries.length} draft rows)`,
  );
}
