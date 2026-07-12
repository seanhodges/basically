import { zx80Charset, NEWLINE, QUOTE, QUOTE_IMAGE } from './charset';
import { keywordByToken } from './keywords';

const WORDLIKE = /[A-Z0-9$"%▘▝▀▖▌▞▛▒█▟▙▄▜▐▚▗\\]/;

/**
 * Convert a tokenized ZX80 program area back into editable text. Lines are
 * `u16 BE line number` + body + NEWLINE (no length field), and there is no
 * inline numeric value to skip - numbers are stored as their digit characters.
 * Spacing is normalized; re-tokenizing the result round-trips byte-for-byte.
 */
export function detokenizeProgram(program: Uint8Array): string {
  const lines: string[] = [];
  let p = 0;

  while (p + 2 <= program.length) {
    const lineNo = (program[p]! << 8) | program[p + 1]!;
    p += 2;

    let text = `${lineNo} `;
    // Set after emitting a word keyword: insert a space before the next
    // word-like token so "GOTO" + "10" renders as "GOTO 10".
    let pendingBoundary = false;
    let inString = false;

    const emit = (s: string, wordlike: boolean) => {
      if (s === '') return;
      const lastChar = text[text.length - 1]!;
      const needsGap =
        (pendingBoundary && wordlike) ||
        (wordlike &&
          /^[A-Z]/.test(s) &&
          WORDLIKE.test(lastChar) &&
          s.length > 1);
      if (needsGap && lastChar !== ' ') text += ' ';
      text += s;
      pendingBoundary = false;
    };

    while (p < program.length) {
      const b = program[p]!;
      if (b === NEWLINE) {
        p++;
        break;
      }

      if (inString) {
        if (b === QUOTE) {
          text += '"';
          inString = false;
        } else if (b === QUOTE_IMAGE) {
          text += '""';
        } else {
          text += zx80Charset.toUnicode([b]);
        }
        p++;
        continue;
      }

      if (b === QUOTE) {
        emit('"', true);
        inString = true;
        p++;
        continue;
      }
      const kw = keywordByToken.get(b);
      if (kw) {
        if (kw.word === 'REM') {
          emit('REM', true);
          // Rest of the line (up to the NEWLINE) is literal text, stored
          // verbatim - every byte round-trips as its charset form and trailing
          // spaces are significant. The ZX80 has no line-length field, so the
          // body cannot contain 0x76 (it would end the line on real hardware).
          let end = p + 1;
          while (end < program.length && program[end] !== NEWLINE) end++;
          // Trailing spaces would be eaten by the tokenizer's per-line trim, so
          // emit them as \{00} escapes to keep the REM body byte-exact.
          const rest = escapeTrailingSpaces(
            zx80Charset.toUnicode(program.slice(p + 1, end)),
          );
          if (rest !== '') text += ' ' + rest;
          p = end;
          continue;
        }
        if (/[A-Z]/.test(kw.word[0]!)) {
          emit(kw.word, true);
          pendingBoundary = true;
        } else {
          emit(kw.word, false); // symbol tokens: + - * / ** = > < ; , ( )
        }
        p++;
        continue;
      }
      const s = zx80Charset.toUnicode([b]);
      emit(s, /[A-Z0-9$%\\]/.test(s[0] ?? ''));
      p++;
    }

    lines.push(text.replace(/\s+$/, ''));
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}

/**
 * Emit a trailing run of spaces (charset code 0x00) as \{00} escapes so it
 * survives the tokenizer's per-line trim. Spaces elsewhere are left readable.
 */
function escapeTrailingSpaces(text: string): string {
  return text.replace(/ +$/, (run) => '\\{00}'.repeat(run.length));
}

/**
 * Structural problems in a tokenized ZX80 program area (the ZX80 has no
 * line-length field, so the only detectable one is a final line with no
 * NEWLINE terminator). Reported through the import-fidelity report channel.
 */
export function structuralWarnings(program: Uint8Array): string[] {
  if (program.length > 0 && program[program.length - 1] !== NEWLINE) {
    return [
      'The program area is truncated: the last line has no NEWLINE ' +
        'terminator.',
    ];
  }
  return [];
}
