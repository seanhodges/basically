import { decodeSpan, ENTER, NUMBER_MARKER, QUOTE } from './charset';
import type { KeywordInfo } from '../types';
import { spectrumKeywords } from './keywords';
import { encodeSpectrumNumber } from './numbers';
import { floatOverrideNotation } from './floatOverride';

const WORDLIKE = /[A-Za-z0-9$↑£©▘▝▀▖▌▞▛▗▚▐▜▄▙▟█]/;

/** Identifier char, matching the tokenizer's number-start test. */
const IDENT = /[A-Za-z0-9$]/;

/** Bytes that can form a printed numeric literal (digits, '.', 'E', '+', '-'). */
const NUMBER_CHAR = new Set<number>([
  ...Array.from({ length: 10 }, (_, d) => 0x30 + d), // 0-9
  0x2e, // .
  0x45, // E
  0x2b, // +
  0x2d, // -
]);

/**
 * The printed number ending just before the NUMBER_MARKER: the maximal grammar
 * match that is a suffix of the character codes preceding the marker (so the `5`
 * in `A+5`, not `+5`). Empty when no digits precede the marker.
 */
function printedNumberBefore(program: Uint8Array, marker: number): string {
  let s = marker;
  while (s > 0 && NUMBER_CHAR.has(program[s - 1]!)) s--;
  let chars = '';
  for (let k = s; k < marker; k++) chars += String.fromCharCode(program[k]!);
  const m = /(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?$/.exec(chars);
  return m ? m[0] : '';
}

function bytesEqual(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length < 5 || b.length < 5) return false;
  for (let k = 0; k < 5; k++)
    if ((a[k]! & 0xff) !== (b[k]! & 0xff)) return false;
  return true;
}

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
 * so they tokenize back to the same bytes. Outside strings the same escape
 * notation is emitted for control sequences, UDGs and any other non-plain byte
 * (the tokenizer now accepts `{...}` / `\x` escapes there too), so nothing is
 * dropped. A numeric constant whose stored 5-byte form disagrees with its
 * printed digits (a protection trick) gets a `{=…}` override so it round-trips.
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
    // Mirrors the tokenizer's `prevSignificant`: the previous significant char
    // the *re-tokenized* source would carry (a space after a keyword or an
    // escape, the char itself after a plain byte, '0' after a number). Only
    // used to tell an identifier-continuation digit (`A1`) from a number-start
    // digit, which decides whether a loose display-digit run needs escaping.
    let prevSig = ' ';
    // In-string decode cap: the current segment's closing quote (or bodyEnd),
    // so a control byte's operands can never swallow the string terminator.
    let segEnd = bodyEnd;

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
      // ENTER ends the line — except inside a string, where an interior 0x0D
      // is data (poked listings) and round-trips as {0x0D}.
      if (b === ENTER && (!inString || i >= bodyEnd)) break;

      if (inString) {
        if (b === QUOTE) {
          text += '"';
          inString = false;
          prevSig = '"';
          i++;
        } else {
          const span = decodeSpan(program, i, segEnd);
          text += span.text;
          i += span.length;
        }
        continue;
      }

      if (b === QUOTE) {
        emit('"', true);
        inString = true;
        i++;
        segEnd = bodyEnd;
        for (let j = i; j < bodyEnd; j++) {
          if (program[j] === QUOTE) {
            segEnd = j;
            break;
          }
        }
        continue;
      }
      if (b === NUMBER_MARKER) {
        // marker + 5-byte form; the printable digits precede it. Usually the
        // form is just the canonical encoding of those digits and can be
        // dropped (the tokenizer re-derives it). When it differs (a protection
        // trick, or absent digits) emit a `{=…}` override so it survives.
        const stored = program.slice(i + 1, i + 6);
        const printed = printedNumberBefore(program, i);
        let canonical = false;
        if (printed !== '') {
          try {
            canonical = bytesEqual(
              encodeSpectrumNumber(parseFloat(printed)),
              stored,
            );
          } catch {
            canonical = false;
          }
        }
        if (!canonical) {
          text += floatOverrideNotation(stored);
          // A `{=…}` override ends in `}`, not a digit, so emit()'s trailing-
          // wordlike check won't separate a following keyword (`{=0.8}THEN`);
          // the tokenizer would then read prevSignificant as the override's
          // '0' and reject the keyword, emitting it as text. Flag a boundary so
          // a following word-like token gets its space, as a bare digit would.
          pendingBoundary = true;
        }
        prevSig = '0';
        i += 6;
        continue;
      }
      // Loose display digits: a numeric run at a number-start position that is
      // NOT immediately followed by the 0x0E marker. Real tapes poke filler
      // (trailing spaces, embedded colour-control codes) between a constant's
      // printed digits and its number marker - Quicksilva's "Mined Out" does
      // this to colour the listing. At run time the ROM's number scanner skips
      // the filler to reach the marker, so it works on hardware; but emitting
      // the digits plainly would let the tokenizer grow a *second*, adjacent
      // marker of its own, so the re-tokenized line reads `250 <form> {colour}
      // <form>` and the ROM trips "C nonsense in BASIC" on the stray marker.
      // Escape each digit byte to raw {0xNN}: the digits still LIST as before
      // and the real value round-trips through the separated marker's {=…}
      // override.
      if (((b >= 0x30 && b <= 0x39) || b === 0x2e) && !IDENT.test(prevSig)) {
        let ahead = '';
        for (let j = i; j < bodyEnd; j++) {
          const c = program[j]!;
          const isNumChar =
            (c >= 0x30 && c <= 0x39) ||
            c === 0x2e ||
            c === 0x45 ||
            c === 0x65 ||
            c === 0x2b ||
            c === 0x2d;
          if (!isNumChar) break;
          ahead += String.fromCharCode(c).toUpperCase();
        }
        const m = /^(\d+(\.\d*)?|\.\d+)(E[+-]?\d+)?/.exec(ahead);
        if (m && m[0] !== '.' && program[i + m[0].length] !== NUMBER_MARKER) {
          for (let k = i; k < i + m[0].length; k++)
            text += `{0x${program[k]!.toString(16).padStart(2, '0').toUpperCase()}}`;
          i += m[0].length;
          pendingBoundary = false;
          prevSig = ' ';
          continue;
        }
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
        prevSig = ' ';
        i++;
        continue;
      }
      // Any other byte: decode to its editor form so nothing is dropped.
      // decodeSpan yields `{0xNN}` / `{INK n}` / `\a` escapes for control and
      // graphics bytes and a plain character otherwise; the tokenizer now
      // accepts those escapes outside strings too, so they round-trip.
      const span = decodeSpan(program, i, bodyEnd);
      emit(span.text, WORDLIKE.test(span.text[0] ?? ''));
      // A single plain char re-tokenizes as itself; a multi-char escape
      // (`{INK 7}`, `\a`, `{0xNN}`) leaves the tokenizer at a space boundary.
      prevSig = span.text.length === 1 ? span.text : ' ';
      i += span.length;
    }

    lines.push(text.replace(/\s+$/, ''));
    p += len;
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}
