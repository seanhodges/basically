import { trs80Charset } from '../charset';
import { trs80WordByToken } from '../keywords';

/**
 * One lexical unit of a tokenized line body. The interpreter never re-parses
 * source text — it lexes directly over the bytes {@link tokenizeProgram}
 * produced (keyword tokens ≥0x80, ASCII runs for numbers/names, quoted strings),
 * so imported `.bas`/`.cas` images run too.
 */
export type Lexeme =
  | { kind: 'kw'; token: number; word: string }
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'name'; name: string }
  | { kind: 'punct'; ch: string };

const QUOTE = 0x22;

function isDigit(b: number): boolean {
  return b >= 0x30 && b <= 0x39;
}
function isLetter(b: number): boolean {
  return (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a);
}

/**
 * Lex one tokenized line body (no link / line-number header, no trailing 0x00).
 * Keyword expansion is suspended inside strings — a graphics byte (0x80–0xBF)
 * that collides with a token value is taken as a string character, not a keyword.
 */
export function lexBody(body: Uint8Array): Lexeme[] {
  const out: Lexeme[] = [];
  let i = 0;
  while (i < body.length) {
    const b = body[i]!;

    if (b === 0x20) {
      i++; // spaces between tokens are not significant
      continue;
    }

    if (b === QUOTE) {
      i++;
      let s = '';
      while (i < body.length && body[i] !== QUOTE) {
        s += trs80Charset.glyph(body[i]!);
        i++;
      }
      if (i < body.length) i++; // closing quote
      out.push({ kind: 'str', value: s });
      continue;
    }

    if (b >= 0x80) {
      const word = trs80WordByToken.get(b);
      out.push({ kind: 'kw', token: b, word: word ?? '?' });
      i++;
      continue;
    }

    if (
      isDigit(b) ||
      (b === 0x2e && i + 1 < body.length && isDigit(body[i + 1]!))
    ) {
      let num = '';
      while (i < body.length && isDigit(body[i]!))
        num += String.fromCharCode(body[i++]!);
      if (body[i] === 0x2e) {
        num += '.';
        i++;
        while (i < body.length && isDigit(body[i]!))
          num += String.fromCharCode(body[i++]!);
      }
      const e = body[i];
      if (e === 0x45 || e === 0x65 || e === 0x44 || e === 0x64) {
        let exp = 'E';
        i++;
        if (body[i] === 0x2b || body[i] === 0x2d)
          exp += String.fromCharCode(body[i++]!);
        while (i < body.length && isDigit(body[i]!))
          exp += String.fromCharCode(body[i++]!);
        if (exp.length > 1) num += exp;
      }
      out.push({ kind: 'num', value: Number(num) });
      continue;
    }

    if (isLetter(b)) {
      let name = '';
      while (i < body.length && (isLetter(body[i]!) || isDigit(body[i]!))) {
        name += String.fromCharCode(body[i++]!);
      }
      const suffix = body[i];
      if (
        suffix === 0x24 ||
        suffix === 0x25 ||
        suffix === 0x21 ||
        suffix === 0x23
      ) {
        name += String.fromCharCode(body[i++]!);
      }
      out.push({ kind: 'name', name: name.toUpperCase() });
      continue;
    }

    out.push({ kind: 'punct', ch: String.fromCharCode(b) });
    i++;
  }
  return out;
}

/** Mutable cursor over a line's lexemes, shared by the executor and evaluator. */
export class Stream {
  pos = 0;
  constructor(public readonly lx: Lexeme[]) {}

  eof(): boolean {
    return this.pos >= this.lx.length;
  }
  peek(): Lexeme | undefined {
    return this.lx[this.pos];
  }
  advance(): Lexeme | undefined {
    return this.lx[this.pos++];
  }
  /** The keyword word at the cursor, or undefined if it isn't a keyword. */
  peekKw(): string | undefined {
    const t = this.lx[this.pos];
    return t?.kind === 'kw' ? t.word : undefined;
  }
  /** Consume the next lexeme iff it is the given keyword word. */
  eatKw(word: string): boolean {
    if (this.peekKw() === word) {
      this.pos++;
      return true;
    }
    return false;
  }
  peekPunct(): string | undefined {
    const t = this.lx[this.pos];
    return t?.kind === 'punct' ? t.ch : undefined;
  }
  eatPunct(ch: string): boolean {
    if (this.peekPunct() === ch) {
      this.pos++;
      return true;
    }
    return false;
  }
}
