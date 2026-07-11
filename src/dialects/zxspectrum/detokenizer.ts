import {
  decodeSpan,
  plainChar,
  CONTROL_CODES,
  ENTER,
  NUMBER_MARKER,
  QUOTE,
} from './charset';
import type { KeywordInfo } from '../types';
import { spectrumKeywords } from './keywords';

const WORDLIKE = /[A-Za-z0-9$↑£©▘▝▀▖▌▞▛▗▚▐▜▄▙▟█]/;

const tokenMapCache = new WeakMap<KeywordInfo[], Map<number, KeywordInfo>>();

/** Memoized token→keyword lookup for a given keyword table. */
function tokenMapFor(keywords: KeywordInfo[]): Map<number, KeywordInfo> {
  const cached = tokenMapCache.get(keywords);
  if (cached) return cached;
  const map = new Map<number, KeywordInfo>(keywords.map((k) => [k.token, k]));
  tokenMapCache.set(keywords, map);
  return map;
}

/**
 * Convert a tokenized ZX Spectrum program area back into editable text.
 * Spacing is normalized (a single space wherever two word-like tokens meet);
 * the inline 5-byte numeric forms are dropped, keeping the printed digits.
 * Inside strings and REM bodies, UDGs come out as `\a`-`\u` escapes and
 * embedded control sequences as `{INK n}`-style directives (see charset.ts),
 * so they tokenize back to the same bytes. Outside strings, control sequences
 * only colour the listing on a real Spectrum — they (and any other
 * unrepresentable byte there) are dropped.
 * The `keywords` table defaults to the 48K set; the 128K passes its extended
 * table so SPECTRUM/PLAY detokenize.
 */
export function detokenizeProgram(
  program: Uint8Array,
  keywords: KeywordInfo[] = spectrumKeywords,
): string {
  const keywordByToken = tokenMapFor(keywords);
  const lines: string[] = [];
  let p = 0;

  while (p + 4 <= program.length) {
    const lineNo = (program[p]! << 8) | program[p + 1]!;
    const len = program[p + 2]! | (program[p + 3]! << 8);
    p += 4;
    const end = Math.min(p + len, program.length);
    // Decode against the body only, so a control byte just before the ENTER
    // terminator can't swallow it as an operand.
    const bodyEnd = end > p && program[end - 1] === ENTER ? end - 1 : end;

    let text = `${lineNo} `;
    let pendingBoundary = false;
    let inString = false;

    const emit = (s: string, wordlike: boolean) => {
      if (s === '') return;
      const lastChar = text[text.length - 1]!;
      const firstChar = s[0]!;
      const needsGap =
        (pendingBoundary && (wordlike || WORDLIKE.test(firstChar))) ||
        (wordlike && /[A-Za-z]/.test(firstChar) && WORDLIKE.test(lastChar));
      if (needsGap && lastChar !== ' ') text += ' ';
      text += s;
      pendingBoundary = false;
    };

    let i = p;
    while (i < end) {
      const b = program[i]!;
      if (b === ENTER) break;

      if (inString) {
        if (b === QUOTE) {
          text += '"';
          inString = false;
          i++;
        } else {
          const span = decodeSpan(program, i, bodyEnd);
          text += span.text;
          i += span.length;
        }
        continue;
      }

      if (b === QUOTE) {
        emit('"', true);
        inString = true;
        i++;
        continue;
      }
      if (b === NUMBER_MARKER) {
        i += 6; // marker + 5-byte form; the printable digits precede it
        continue;
      }
      // Control sequences outside strings are listing decoration with no
      // runtime effect — drop them, operands included.
      const ctrl = CONTROL_CODES[b];
      if (ctrl) {
        i += 1 + ctrl.operands;
        continue;
      }
      const kw = keywordByToken.get(b);
      if (kw) {
        if (kw.word === 'REM') {
          emit('REM', true);
          let rest = '';
          let j = i + 1;
          while (j < bodyEnd) {
            const span = decodeSpan(program, j, bodyEnd);
            rest += span.text;
            j += span.length;
          }
          if (rest !== '') text += ' ' + rest;
          i = end;
          break;
        }
        emit(kw.word, /[A-Za-z]/.test(kw.word[0]!));
        if (/[A-Za-z#]/.test(kw.word[kw.word.length - 1]!)) {
          pendingBoundary = true;
        }
        i++;
        continue;
      }
      const s = plainChar(b);
      // Bytes with no plain character (UDGs, stray controls…) would need an
      // escape, which the tokenizer only accepts inside strings/REM — drop.
      if (s !== undefined) emit(s, WORDLIKE.test(s));
      i++;
    }

    lines.push(text.replace(/\s+$/, ''));
    p += len;
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}
