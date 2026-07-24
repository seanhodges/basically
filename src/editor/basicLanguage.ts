import {
  StreamLanguage,
  LanguageSupport,
  HighlightStyle,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { CompletionSource } from '@codemirror/autocomplete';
import type { EditorKeyword } from '../dialects/types';
import { outlineCapabilities } from './programOutline';
import { makeVariableSource, type VarNameRules } from './variables';
import { crunchMatcher, makeCrunchMatcher } from './crunch';

interface BasicStreamState {
  afterRem: boolean;
}

/** Dialect-specific lexical quirks for variable names and escapes. */
export interface BasicLanguageOptions {
  /** Extra characters allowed inside a variable name, beyond letters/digits
   *  (e.g. `_` for BBC BASIC). Default none. */
  nameChars?: string;
  /** Type-suffix characters that may terminate a variable name. Default `$`
   *  (string vars); BBC adds `%` for integer vars. */
  suffixChars?: string;
  /** Whether `%`/`\` introduce a two-char graphics/inverse-video escape
   *  (ZX81/Spectrum block graphics). Default true; false for BBC, where `%`
   *  is a variable suffix / binary-literal prefix. */
  graphicsEscapes?: boolean;
  /** Prefix introducing a hexadecimal number literal (e.g. `&` for BBC). */
  hexPrefix?: string;
  /** Prefix introducing a binary number literal (e.g. `%` for BBC). */
  binaryPrefix?: string;
  /**
   * Greedy position-independent keyword matching - Microsoft-BASIC "code
   * crunching" (C64/TRS-80), where the ROM ignores spaces so `POKEA,10` is
   * `POKE A,10`. When set, the highlighter, variable scanner and completion
   * sources split identifier runs the way the ROM tokenizer will, instead of
   * requiring a keyword to consume the whole run. Default false.
   */
  crunched?: boolean;
  /**
   * Extra single characters a dialect styles as operators, on top of the shared
   * symbolic-operator set. Used by the Acorn Atom for its indirection/bitwise
   * operators `!` (word), `%` (remainder), `&` (AND) and `\` (OR) - `?`, `$` and
   * `:` are already in the shared set. Default none. Each character is added to
   * the operator character class verbatim (escaped), so pass bare characters.
   */
  extraOperators?: string;
}

/** The symbolic single characters every dialect highlights as an operator. */
const BASE_OPERATOR_CHARS = '+-*/=<>;,():?$£^.';

/** Escape a single character for safe inclusion in a regex character class. */
function escapeForCharClass(ch: string): string {
  return /[\\\]^-]/.test(ch) ? `\\${ch}` : ch;
}

/**
 * The `^[…]` single-operator matcher, combining the shared symbolic operators
 * with any dialect {@link BasicLanguageOptions.extraOperators}. Each character is
 * escaped for a character class as needed (`-`, `^`, `]`, `\`), so ordering
 * doesn't matter. Built once per dialect rather than per token.
 */
function buildOperatorRegex(extra = ''): RegExp {
  const chars = (BASE_OPERATOR_CHARS + extra)
    .split('')
    .map(escapeForCharClass)
    .join('');
  return new RegExp(`^[${chars}]`);
}

/**
 * The two identifier regexes a dialect needs, derived from its name/suffix
 * rules. `headRe` is the leading identifier run used for keyword-prefix matching
 * (letters + name extras + `$`, no digits, so `GOTO100` still reads as a
 * keyword); `varRe` is the whole variable token (letter, then letters/digits/
 * name extras, then an optional single type suffix). Shared by the highlighter
 * here and the variable scanner in {@link ./variables}, so both agree on what a
 * variable looks like. Both are anchored at the start (`^`).
 */
export function buildIdentifierRegexes(options: BasicLanguageOptions = {}): {
  headRe: RegExp;
  varRe: RegExp;
} {
  const nameChars = options.nameChars ?? '';
  const suffixChars = options.suffixChars ?? '$';
  return {
    headRe: new RegExp(`^[A-Za-z][A-Za-z${nameChars}$]*`),
    varRe: new RegExp(`^[A-Za-z][A-Za-z0-9${nameChars}]*[${suffixChars}]?`),
  };
}

/**
 * Colours commands, functions, operators, variables and literals distinctly.
 * Pairs with the token tags emitted by {@link buildBasicLanguage}: every token
 * known to the dialect gets its own dark colour, while unknown/invalid tokens
 * fall through to the default (grey) style so they stand out as suspect.
 */
export const basicHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#708' }, // commands (purple)
  { tag: tags.comment, color: '#708' }, // REM comments (purple, like keywords)
  { tag: tags.function(tags.variableName), color: '#c85000' }, // functions (dark orange)
  { tag: tags.labelName, color: '#9a7d00' }, // line numbers (dark yellow)
  { tag: tags.variableName, color: '#006600' }, // variables (dark green)
  { tag: tags.operator, color: '#000080' }, // operators (navy)
  { tag: tags.string, color: '#000000' }, // string literals (black)
  { tag: tags.number, color: '#000000' }, // numeric literals (black)
  { tag: tags.atom, color: '#000000' }, // graphics glyphs (black)
  { tag: tags.meta, color: '#888888' }, // #BIN directives (grey)
]);

/**
 * Build a CodeMirror LanguageSupport for a line-numbered BASIC dialect from
 * its keyword table. Dialect-scoped data (autocomplete) rides on
 * languageData so several dialects can coexist.
 */
export function buildBasicLanguage(
  keywords: EditorKeyword[],
  completionSource: CompletionSource,
  options: BasicLanguageOptions = {},
): LanguageSupport {
  // word -> kind, for alphabetic keywords (symbolic ops never match here).
  const kinds = new Map<string, EditorKeyword['kind']>(
    keywords.filter((k) => /^[A-Z]/.test(k.word)).map((k) => [k.word, k.kind]),
  );
  const maxWordLen = Math.max(...[...kinds.keys()].map((w) => w.length));

  const graphicsEscapes = options.graphicsEscapes ?? true;
  const hexRe = options.hexPrefix
    ? new RegExp(`^${options.hexPrefix}[0-9A-Fa-f]+`)
    : null;
  const binRe = options.binaryPrefix
    ? new RegExp(`^${options.binaryPrefix}[01]+`)
    : null;
  const { headRe, varRe } = buildIdentifierRegexes(options);
  const crunch = options.crunched ? makeCrunchMatcher(kinds.keys()) : null;
  const operatorRe = buildOperatorRegex(options.extraOperators);

  const language = StreamLanguage.define<BasicStreamState>({
    name: 'basic',
    startState: () => ({ afterRem: false }),
    tokenTable: {
      functionName: tags.function(tags.variableName),
    },
    token(stream, state) {
      if (stream.sol()) {
        state.afterRem = false;
        // #BIN directives carry an opaque binary payload, not code.
        if (stream.match(/^\s*#bin(?![^\s])/i)) {
          stream.skipToEnd();
          return 'meta';
        }
        if (stream.match(/^\s*\d+/)) return 'labelName';
      }
      if (state.afterRem) {
        stream.skipToEnd();
        return 'comment';
      }
      if (stream.eatSpace()) return null;

      if (stream.match('"')) {
        while (!stream.eol()) {
          if (stream.match('""')) continue;
          if (stream.match('"')) return 'string';
          stream.next();
        }
        return 'string';
      }

      const word = stream.match(headRe, false);
      if (word && crunch) {
        // Crunched (MS-BASIC) mode: longest keyword at this exact position,
        // whatever follows it - `POKEA` is POKE + variable A. No keyword here
        // means variable characters up to the next glued keyword (`SCORE` is
        // SC + OR + E, exactly what the ROM stores).
        const rest = stream.string.slice(stream.pos);
        const kw = crunch.keywordAt(rest, 0);
        if (kw) {
          for (let i = 0; i < kw.length; i++) stream.next();
          if (kw === 'REM') {
            state.afterRem = true;
            return 'keyword';
          }
          const kind = kinds.get(kw);
          if (kind === 'function') return 'functionName';
          if (kind === 'operator') return 'operator';
          return 'keyword';
        }
        const run = varRe.exec(rest)?.[0] ?? rest[0]!;
        const j = crunch.firstInteriorKeyword(rest, run.length);
        const len = j === -1 ? run.length : j;
        for (let i = 0; i < len; i++) stream.next();
        return 'variableName';
      }
      if (word) {
        const text = (word as RegExpMatchArray)[0].toUpperCase();
        // Longest keyword prefix of this identifier-run
        for (let len = Math.min(text.length, maxWordLen); len >= 2; len--) {
          const candidate = text.slice(0, len);
          const kind = kinds.get(candidate);
          if (kind === undefined) continue;
          // keyword must consume the whole identifier-run unless it ends in $
          if (len === text.length || candidate.endsWith('$')) {
            for (let i = 0; i < len; i++) stream.next();
            if (candidate === 'REM') {
              state.afterRem = true;
              return 'keyword';
            }
            // Colour by role: functions orange, operators (AND/OR/TO…) navy,
            // commands purple.
            if (kind === 'function') return 'functionName';
            if (kind === 'operator') return 'operator';
            return 'keyword';
          }
        }
        stream.match(varRe);
        return 'variableName';
      }

      if (stream.match(/^\d+(\.\d*)?(E[+-]?\d+)?/i)) return 'number';
      if (hexRe && stream.match(hexRe)) return 'number'; // BBC &FF
      if (binRe && stream.match(binRe)) return 'number'; // BBC %1010
      if (stream.match(/^(\*\*|<=|>=|<>)/)) return 'operator';
      if (graphicsEscapes && stream.match(/^[%\\]../)) return 'atom'; // graphics escape / inverse
      if (stream.match(operatorRe)) return 'operator';
      stream.next();
      return null;
    },
    languageData: {
      commentTokens: { line: 'REM ' },
    },
  });

  // The document-scanning variable source reuses the same identifier regexes
  // and keyword set, so it agrees with the highlighter on what a variable is.
  const keywordSet = new Set(kinds.keys());
  const rules: VarNameRules = {
    headRe,
    varRe,
    keywords: keywordSet,
    maxWordLen,
    hexRe,
    callPrefixes: ['PROC', 'FN'].filter((w) => keywordSet.has(w)),
    crunch,
  };
  const variableSource = makeVariableSource(
    rules,
    outlineCapabilities(keywords),
  );

  return new LanguageSupport(language, [
    language.data.of({ autocomplete: completionSource }),
    language.data.of({ autocomplete: variableSource }),
    ...(crunch ? [crunchMatcher.of(crunch)] : []),
  ]);
}
