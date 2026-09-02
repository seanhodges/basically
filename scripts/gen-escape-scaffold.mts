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
      // The draft chip is a grab-bag until the table is split by hand, which is
      // what the `control` class means; the split then reclassifies each chip.
      { id: 'uncategorised', label: 'Uncategorised', class: 'control' },
      { id: 'raw', label: 'Raw bytes', class: 'raw-byte' },
    ],
    entries,
  };
}

/**
 * One page's seed from the charset families that share it.
 *
 * A probe is keyed by charset family and a file by page, and the two part
 * company wherever one BASIC was carried by two character generators: the ZX81
 * and the Spectrums share the Sinclair page, the Apple I and the Apple II the
 * Integer BASIC one. Seeding per family wrote a file named after a machine that
 * no page map reads, under an export name the sibling family had already taken.
 *
 * So the families are merged the way gen-reference-scaffold.mts merges keyword
 * tables. A spelling every family on the page produces stays unscoped, because
 * it is the page's; one only some produce is scoped to their dialects and
 * badged, which puts each difference in front of whoever enriches the seed
 * rather than leaving it to escape-crosscheck.test.ts. Where two families spell
 * one escape and store different bytes, the first family's claim is the one
 * seeded - a merge cannot tell that case from an agreement, and the enrichment
 * pass can.
 */
function seedPage(probes: readonly CharsetProbe[]): EscapeTableData {
  const drafts = probes.map(scaffold);
  const everyDialect = probes.flatMap((p) => p.dialects);
  const owners = new Map<string, string[]>();
  drafts.forEach((draft, i) => {
    for (const entry of draft.entries) {
      const held = owners.get(entry.escape);
      if (held) held.push(...probes[i]!.dialects);
      else owners.set(entry.escape, [...probes[i]!.dialects]);
    }
  });

  const seen = new Set<string>();
  const entries: EscapeEntry[] = [];
  drafts.forEach((draft, i) => {
    for (const entry of draft.entries) {
      if (seen.has(entry.escape)) continue;
      seen.add(entry.escape);
      const onlyOn = owners.get(entry.escape)!;
      if (onlyOn.length === everyDialect.length) {
        entries.push(entry);
        continue;
      }
      entries.push({
        ...entry,
        tag: `${probes[i]!.machines.join(' & ')} only`,
        onlyOn,
      });
    }
  });

  return {
    ...drafts[0]!,
    machines: probes.flatMap((p) => p.machines),
    entries,
  };
}

/** The probes seeding each page, in probe order. */
const byPage = new Map<string, CharsetProbe[]>();
for (const probe of CHARSET_PROBES) {
  const page = probe.page ?? probe.id;
  const probes = byPage.get(page);
  if (probes) probes.push(probe);
  else byPage.set(page, [probe]);
}

mkdirSync(dataDir, { recursive: true });

for (const [page, probes] of byPage) {
  const file = resolve(dataDir, `${page}.ts`);
  if (existsSync(file)) {
    console.log(`skip (exists): src/reference/escapes/${page}.ts`);
    continue;
  }
  const data = probes.length === 1 ? scaffold(probes[0]!) : seedPage(probes);
  const body =
    `// Escape-code table for the ${data.title} page.\n` +
    `// Seeded from the dialect charset by scripts/gen-escape-scaffold.mts, then\n` +
    `// hand-enriched (categories, descriptions, parse-only alias rows). Edit by\n` +
    `// hand; the generator skips this file once it exists. Kept honest by\n` +
    `// escapes/escape-crosscheck.test.ts.\n` +
    `import type { EscapeTableData } from '../types';\n\n` +
    `export const ${probes[0]!.varName}: EscapeTableData = ${JSON.stringify(data, null, 2)};\n`;
  writeFileSync(file, body, 'utf8');
  console.log(
    `wrote src/reference/escapes/${page}.ts (${data.entries.length} draft rows)`,
  );
}
