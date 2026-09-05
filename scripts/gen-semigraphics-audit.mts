import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  auditAll,
  graphicsFacts,
  requiredCodepoints,
  type ByteClass,
  type DialectAudit,
} from '../src/dialects/semigraphicsAudit';

/**
 * Regenerate the matrix in docs/contributing/semigraphics-support.md from the
 * dialects themselves. Everything between the markers is owned by this script;
 * the prose around them is hand-written and left alone.
 *
 * Unlike gen-escape-scaffold.mts (whose output is hand-enriched, so it never
 * overwrites), this always rewrites - the document is a report, not a draft.
 * semigraphics-support.test.ts regenerates and diffs, so a stale committed copy
 * fails the suite.
 */

const here = dirname(fileURLToPath(import.meta.url));
const docPath = resolve(here, '../docs/contributing/semigraphics-support.md');

const BEGIN = '<!-- semigraphics:begin -->';
const END = '<!-- semigraphics:end -->';

const hex = (code: number): string =>
  `0x${code.toString(16).toUpperCase().padStart(2, '0')}`;

const codepoint = (cp: number): string =>
  `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

/** Collapse a sorted code list into `0x80-0x8F, 0xA0` style ranges. */
function ranges(codes: number[]): string {
  if (codes.length === 0) return '—';
  const sorted = [...codes].sort((a, b) => a - b);
  const out: string[] = [];
  let start = sorted[0]!;
  let prev = start;
  for (const code of sorted.slice(1)) {
    if (code === prev + 1) {
      prev = code;
      continue;
    }
    out.push(start === prev ? hex(start) : `${hex(start)}-${hex(prev)}`);
    start = code;
    prev = code;
  }
  out.push(start === prev ? hex(start) : `${hex(start)}-${hex(prev)}`);
  return out.join(', ');
}

const plural = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`;

function countBy(
  facts: Array<{ cls: ByteClass }>,
): Partial<Record<ByteClass, number>> {
  const out: Partial<Record<ByteClass, number>> = {};
  for (const f of facts) out[f.cls] = (out[f.cls] ?? 0) + 1;
  return out;
}

function summaryTable(audits: DialectAudit[]): string {
  const head = [
    '| Machine | In scope | Graphics bytes | Unicode glyph | …astral | Named escape | Raw escape only | Typeable |',
    '| --- | :-: | --- | --: | --: | --: | --: | --- |',
  ];
  const rows = audits.map((a) => {
    if (a.declared === null) {
      return `| ${a.name} | ${a.inScope ? '✅' : '—'} | _not established_ | — | — | — | — | — |`;
    }
    // An empty declaration is the opposite claim to a null one: the hardware has
    // been read and it has no graphics codes. Counting zeros of everything would
    // read as a gap rather than as an absence.
    if (a.declared.length === 0) {
      return `| ${a.name} | ${a.inScope ? '✅' : '—'} | _none_ | — | — | — | — | — |`;
    }
    const facts = graphicsFacts(a);
    const n = countBy(facts);
    const glyphs = (n['glyph-bmp'] ?? 0) + (n['glyph-astral'] ?? 0);
    const typeable = facts.filter((f) => f.typeable).length;
    return (
      `| ${a.name} | ${a.inScope ? '✅' : '—'} | ${facts.length} (${ranges(a.declared)}) ` +
      `| ${glyphs} | ${n['glyph-astral'] ?? 0} | ${n['escape-named'] ?? 0} ` +
      `| ${n['escape-raw'] ?? 0} | ${typeable}/${facts.length} |`
    );
  });
  return [...head, ...rows].join('\n');
}

function detail(audits: DialectAudit[]): string {
  const out: string[] = [];
  for (const a of audits) {
    out.push(`### ${a.name}`, '');
    if (a.declared === null) {
      out.push(
        'Which bytes this machine treats as block graphics has not been',
        'established from a primary source, so nothing is claimed here.',
        '',
      );
      continue;
    }
    if (a.declared.length === 0) {
      out.push(
        'This machine has no block graphics at all - not a range nobody has',
        'read off it yet, but a character set with no mosaic in it. Every byte',
        'it can display is an ordinary character; see the citation beside its',
        'entry in src/dialects/semigraphicsAudit.ts for how that was',
        'established.',
        '',
      );
      continue;
    }
    const facts = graphicsFacts(a);
    const n = countBy(facts);
    out.push(
      `Charset family \`${a.probeId}\`. Graphics bytes ${ranges(a.declared)}.`,
      '',
    );
    const parts = Object.entries(n)
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([cls, count]) => `${count} ${cls}`);
    out.push(`Spelled as: ${parts.join(', ')}.`, '');

    const unmapped = facts.filter(
      (f) => f.cls === 'escape-raw' || f.cls === 'control',
    );
    const untypeable = facts.filter((f) => !f.typeable);
    if (unmapped.length > 0) {
      out.push(
        unmapped.length === 1
          ? `**Gap:** 1 graphics byte has no character of its own and renders as a raw escape: ${ranges(unmapped.map((f) => f.code))}.`
          : `**Gap:** ${unmapped.length} graphics bytes have no character of their own and render as raw escapes: ${ranges(unmapped.map((f) => f.code))}.`,
        '',
      );
    }
    if (untypeable.length > 0) {
      out.push(
        `**Gap:** ${plural(untypeable.length, 'graphics byte', 'graphics bytes')} cannot be typed on the on-screen keyboard: ${ranges(untypeable.map((f) => f.code))}.`,
        '',
      );
    }
    if (unmapped.length === 0 && untypeable.length === 0) {
      out.push(
        'No gaps: every graphics byte has its own character and can be typed.',
        '',
      );
    }
  }
  return out.join('\n');
}

function codepointTable(audits: DialectAudit[]): string {
  const users = new Map<number, Set<string>>();
  for (const a of audits) {
    for (const { text, cls } of a.bytes) {
      if (cls !== 'glyph-bmp' && cls !== 'glyph-astral') continue;
      for (const ch of text) {
        const cp = ch.codePointAt(0)!;
        (users.get(cp) ?? users.set(cp, new Set()).get(cp)!).add(a.id);
      }
    }
  }
  const head = [
    '| Codepoint | Character | Plane | Used by |',
    '| --- | :-: | --- | --- |',
  ];
  const rows = requiredCodepoints(audits).map((cp) => {
    const plane = cp >= 0x10000 ? 'astral' : 'BMP';
    const who = [...users.get(cp)!].sort().join(', ');
    return `| \`${codepoint(cp)}\` | ${String.fromCodePoint(cp)} | ${plane} | ${who} |`;
  });
  return [...head, ...rows].join('\n');
}

const audits = auditAll();
const astral = requiredCodepoints(audits).filter((cp) => cp >= 0x10000);

const generated = [
  BEGIN,
  '',
  '<!-- Generated by scripts/gen-semigraphics-audit.mts. Do not edit by hand:',
  '     run `npm run gen:semigraphics`. Prose outside the markers is kept. -->',
  '',
  '## Support matrix',
  '',
  summaryTable(audits),
  '',
  '"Typeable" counts graphics bytes reachable by typing on the on-screen',
  'keyboard, including its graphics palette. "…astral" counts the characters',
  'outside the Basic Multilingual Plane, which almost no installed monospace',
  'font covers - those are the ones that need the bundled face.',
  '',
  '## Per-machine detail',
  '',
  detail(audits),
  '## Characters the machines need',
  '',
  `${requiredCodepoints(audits).length} distinct non-ASCII codepoints, ${astral.length} of them astral.`,
  'This is the exact set the bundled character-graphics font is subset to.',
  '',
  codepointTable(audits),
  '',
  END,
].join('\n');

const doc = readFileSync(docPath, 'utf8');
const start = doc.indexOf(BEGIN);
const stop = doc.indexOf(END);
if (start === -1 || stop === -1) {
  throw new Error(`${docPath} is missing the ${BEGIN} / ${END} markers`);
}
const next = doc.slice(0, start) + generated + doc.slice(stop + END.length);
writeFileSync(docPath, next, 'utf8');
console.log(
  `wrote docs/contributing/semigraphics-support.md (${audits.length} dialects, ${requiredCodepoints(audits).length} codepoints)`,
);
