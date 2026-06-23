import { trs80Charset } from '../charset';
import type { BasicLine } from './program';

const QUOTE = 0x22;
const COLON = 0x3a;
const REM = 0x93;
const DATA = 0x88;

function decode(body: Uint8Array, from: number, to: number): string {
  let s = '';
  for (let i = from; i < to; i++) s += trs80Charset.glyph(body[i]!);
  return s;
}

/**
 * Split one DATA statement's text into items, honouring quotes and trimming.
 * Mirrors Microsoft BASIC: leading spaces before an item are skipped, so a
 * quoted item keeps only what is between the quotes (`DATA "###"` is three
 * characters, not a leading-space-padded four), and anything after a closing
 * quote up to the next comma is ignored. Unquoted items are trimmed.
 */
function splitItems(text: string): string[] {
  const items: string[] = [];
  let cur = '';
  let inQuote = false;
  let quoted = false;
  let afterQuote = false;
  for (const ch of text) {
    if (inQuote) {
      if (ch === '"') inQuote = false;
      else cur += ch;
    } else if (ch === ',') {
      items.push(quoted ? cur : cur.trim());
      cur = '';
      quoted = false;
      afterQuote = false;
    } else if (afterQuote) {
      // Ignore stray characters between a closing quote and the comma.
    } else if (ch === '"') {
      // Drop any leading whitespace gathered before the opening quote.
      if (cur.trim() === '') cur = '';
      inQuote = true;
      quoted = true;
      afterQuote = true;
    } else {
      cur += ch;
    }
  }
  items.push(quoted ? cur : cur.trim());
  return items;
}

/**
 * Gather every DATA item in program order into a flat list (the READ pointer
 * walks it; RESTORE rewinds it). Scans the raw tokenized bytes so spacing and
 * unquoted text survive; keyword expansion is suspended in strings and after
 * REM, just like the tokenizer that produced them.
 */
export function collectData(lines: BasicLine[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const b = line.body;
    let i = 0;
    let inStr = false;
    while (i < b.length) {
      const c = b[i]!;
      if (inStr) {
        if (c === QUOTE) inStr = false;
        i++;
        continue;
      }
      if (c === QUOTE) {
        inStr = true;
        i++;
        continue;
      }
      if (c === REM) break; // rest of line is a comment
      if (c === DATA) {
        i++;
        const start = i;
        let q = false;
        while (i < b.length) {
          const d = b[i]!;
          if (q) {
            if (d === QUOTE) q = false;
          } else if (d === QUOTE) {
            q = true;
          } else if (d === COLON) {
            break;
          }
          i++;
        }
        for (const item of splitItems(decode(b, start, i))) out.push(item);
        continue;
      }
      i++;
    }
  }
  return out;
}
