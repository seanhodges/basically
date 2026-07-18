// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Minimal CodeMirror syntax highlighting for the assembly editor - just
 * enough colour to read a listing: mnemonics/directives, registers, labels,
 * numbers and comments. No completion or structure; the token tags reuse
 * `basicHighlightStyle`'s palette so both editors match.
 */

import type { StreamParser } from '@codemirror/language';
import { StreamLanguage } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import type { AsmEngine } from './types';

const LABEL_DEF_RE = /^[A-Za-z_][A-Za-z0-9_]*:/;
const WORD_RE = /^[A-Za-z_.][A-Za-z0-9_.]*/;
const NUMBER_RE =
  /^(\$[0-9A-Fa-f]+|%[01]+|0[Xx][0-9A-Fa-f]+|0[Bb][01]+|[0-9][0-9A-Fa-f]*[Hh]|[0-9]+)/;

/**
 * The tokenizer behind {@link asmLanguage}, exported separately so tests can
 * drive it with a bare `StringStream` without building an editor.
 */
export function asmStreamParser(engine: AsmEngine): StreamParser<object> {
  return {
    name: 'asm',
    startState: () => ({}),
    token(stream) {
      if (stream.sol() && stream.match(LABEL_DEF_RE)) return 'labelName';
      if (stream.eatSpace()) return null;
      if (stream.peek() === ';') {
        stream.skipToEnd();
        return 'meta'; // grey, like #BIN directives in the BASIC editor
      }
      if (stream.match(NUMBER_RE)) return 'number';
      const word = stream.match(WORD_RE);
      if (word) {
        const text = (word as RegExpMatchArray)[0].toUpperCase();
        if (engine.mnemonics.has(text)) return 'keyword';
        if (engine.registers.has(text)) return 'variableName';
        return 'labelName'; // a label reference
      }
      if (stream.match(/^[,()+\-#']/)) return 'operator';
      stream.next();
      return null;
    },
    languageData: {
      commentTokens: { line: ';' },
    },
  };
}

/** Build the (stateless) assembly language extension for one engine. */
export function asmLanguage(engine: AsmEngine): Extension {
  return StreamLanguage.define(asmStreamParser(engine));
}
