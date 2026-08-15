import {
  StreamLanguage,
  LanguageSupport,
  HighlightStyle,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { CompletionSource } from '@codemirror/autocomplete';
import type { EditorKeyword } from '../dialects/types';
import {
  spellingAt,
  type KeywordSpellings,
} from '../dialects/keywordSpellings';
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
   * Operator spellings to style beyond the ones in the keyword table: the
   * machine's own `Dialect.operators` (the Sinclair `↑`, the BBC's symbolic
   * set), plus any alias spelling the tokenizer accepts but the machine never
   * lists back, such as `^` for `↑` on the Commodores. Any length - one
   * character joins the operator character class, longer spellings are matched
   * ahead of it, longest first.
   *
   * What is *not* here is not styled. That is the point: the shared set used to
   * speak for every machine, so a ZX81 with no `?` character coloured one navy
   * and the `↑` five machines raise to a power with was in no list at all.
   */
  operators?: readonly string[];
  /**
   * How this machine lets a program spell its keywords short, from
   * {@link ../dialects/keywordSpellings}. Archive listings are written in those
   * notations, so a pasted program contains them and the tokenizer already
   * reads them: a BBC `P.` tokenizes to PRINT and a C64 `pO` to POKE. Without
   * this the highlighter and the variable scanner would disagree with the
   * tokenizer about the same text, colouring `P.` as a name and a full stop and
   * reporting `P` as a variable the program does not have.
   *
   * Omitted only by a machine that abbreviates nothing; `dialectSpellings.test.ts`
   * fails a registered machine that has spellings and does not pass them.
   */
  spellings?: KeywordSpellings;
}

/**
 * Punctuation every dialect styles like an operator, whatever its operator set.
 *
 * Statement and argument punctuation rather than arithmetic: these separate the
 * parts of a line on every machine here, and `.` is the decimal point. The
 * operators proper come from the dialect - see
 * {@link BasicLanguageOptions.operators}.
 */
const PUNCTUATION_CHARS = ';,():.';

/** Escape a single character for safe inclusion in a regex character class. */
function escapeForCharClass(ch: string): string {
  return /[\\\]^-]/.test(ch) ? `\\${ch}` : ch;
}

/** Escape a character for use outside a class, where more of them are special. */
function escapeForPattern(ch: string): string {
  return /[\\^$.|?*+()[\]{}]/.test(ch) ? `\\${ch}` : ch;
}

/**
 * The two operator matchers a dialect needs, from every spelling it has.
 *
 * Split by length rather than by where the spelling came from: a single
 * character joins the `^[…]` class, and anything longer becomes an alternation
 * tried ahead of it, longest first so `<=` beats `<`. Both are built once per
 * dialect rather than per token, and `multi` is null for a dialect with no
 * multi-character operator.
 *
 * The alternation changes no colour today, because every multi-character
 * spelling any of these machines has (`**`, `<=`, `>=`, `<>`) is also two of
 * its own operator characters, and adjacent operator tokens render as one run.
 * It is here so that a spelling in the list is matched as the list gives it -
 * silently ignoring part of what a dialect declares is the failure this whole
 * seam exists to stop.
 */
function buildOperatorMatchers(spellings: readonly string[]): {
  single: RegExp;
  multi: RegExp | null;
} {
  const chars = new Set([...PUNCTUATION_CHARS]);
  const long: string[] = [];
  for (const spelling of spellings) {
    if ([...spelling].length === 1) chars.add(spelling);
    else if (spelling.length > 1) long.push(spelling);
  }
  const single = new RegExp(
    `^[${[...chars].map(escapeForCharClass).join('')}]`,
  );
  long.sort((a, b) => b.length - a.length);
  const multi = long.length
    ? new RegExp(
        `^(?:${long.map((s) => [...s].map(escapeForPattern).join('')).join('|')})`,
      )
    : null;
  return { single, multi };
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
  const spellings = options.spellings;
  // The symbolic half of the keyword table is what `kinds` above throws away,
  // and it is exactly what the operator matchers want: `**` on a ZX81, `^` on a
  // CPC, the Atom's `?` and `&`. The dialect's own `operators` cover what its
  // machine stores some other way again.
  const { single: operatorRe, multi: multiOperatorRe } = buildOperatorMatchers([
    ...keywords
      .filter((k) => k.kind === 'operator' && !/^[A-Z]/.test(k.word))
      .map((k) => k.word),
    ...(options.operators ?? []),
  ]);

  /**
   * The tag a keyword wears, by the role its table gives it. REM is the one
   * that changes what comes after it, so it reports that through `state`.
   */
  const tagFor = (keyword: string, state: BasicStreamState): string => {
    if (keyword === 'REM') {
      state.afterRem = true;
      return 'keyword';
    }
    const kind = kinds.get(keyword);
    if (kind === 'function') return 'functionName';
    if (kind === 'operator') return 'operator';
    return 'keyword';
  };

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

      // A keyword spelled short - `P.`, `pO`, `?`, `'`. Tried ahead of the
      // identifier run so the dot or the shifted letter that marks the spelling
      // is read as part of it rather than as an operator after a name, and
      // ahead of the operator class so a symbol standing for a whole command is
      // that command. Which spellings a machine takes, and what each resolves
      // to, is its own ROM's scan order - see ../dialects/keywordSpellings.
      if (spellings) {
        const short = spellingAt(stream.string, stream.pos, spellings);
        if (short) {
          for (let i = 0; i < short.length; i++) stream.next();
          return tagFor(short.keyword, state);
        }
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
          return tagFor(kw, state);
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
            // Colour by role: functions orange, operators (AND/OR/TO…) navy,
            // commands purple.
            return tagFor(candidate, state);
          }
        }
        stream.match(varRe);
        return 'variableName';
      }

      if (stream.match(/^\d+(\.\d*)?(E[+-]?\d+)?/i)) return 'number';
      if (hexRe && stream.match(hexRe)) return 'number'; // BBC &FF
      if (binRe && stream.match(binRe)) return 'number'; // BBC %1010
      if (multiOperatorRe && stream.match(multiOperatorRe)) return 'operator';
      if (graphicsEscapes && stream.match(/^[%\\]../)) return 'atom'; // graphics escape / inverse
      if (stream.match(operatorRe)) return 'operator';
      // A run of the machine's own characters - block graphics, PETSCII, the
      // user-defined graphics. They are not keywords, names or numbers, so
      // without this they fell through to the default (dimmed) style, which is
      // exactly the wrong emphasis for the shapes a program draws with. Tagged
      // like the escape spellings above so both forms of the same character
      // look alike. The `u` flag makes the class match a whole code point, so
      // an astral character (the Spectrum's user-defined graphics) is one unit.
      if (stream.match(/^[\u0080-\u{10FFFF}]+/u)) return 'atom';
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
