/**
 * Code-construct (block) completion templates.
 *
 * Where a plain keyword completion inserts just the word, a construct expands
 * the whole skeleton of a conditional, loop or subroutine/procedure — IntelliJ
 * "live template" style — and drops the caret on the first thing the programmer
 * needs to fill in, Tabbing through the rest.
 *
 * A template's {@link ConstructTemplate.lines} use CodeMirror snippet field
 * syntax: `${1:default}` is an ordered, editable field (repeat the same number
 * to link occurrences, e.g. the loop variable in FOR and NEXT), and `${0}` is
 * the resting caret reached last. The first line replaces the typed keyword and
 * stays on the current editor line; each later line becomes its own
 * auto-numbered BASIC line (see {@link buildCompletionSource}).
 */
export interface ConstructTemplate {
  /** Completion label and match prefix, e.g. "IF", "FOR", "DEFPROC". */
  label: string;
  /** Snippet lines; the first stays on the current line, the rest are numbered. */
  lines: string[];
  /** Short popup detail, e.g. "FOR … NEXT loop". */
  detail?: string;
  /** Completion icon type; defaults to 'keyword'. */
  type?: string;
}

/** `IF cond THEN …` on a single line (no dialect here has multi-line IF). */
function ifThen(): ConstructTemplate {
  return {
    label: 'IF',
    lines: ['IF ${1:condition} THEN ${0}'],
    detail: 'IF … THEN',
  };
}

/**
 * A counting loop spread across three lines with the body line as the resting
 * caret and the control variable linked between FOR and NEXT.
 */
function forNext(): ConstructTemplate {
  return {
    label: 'FOR',
    lines: ['FOR ${1:I}=${2:1} TO ${3:10}', '${0}', 'NEXT ${1:I}'],
    detail: 'FOR … NEXT loop',
  };
}

/** A `REPEAT … UNTIL cond` post-condition loop (BBC). */
function repeatUntil(): ConstructTemplate {
  return {
    label: 'REPEAT',
    lines: ['REPEAT', '${0}', 'UNTIL ${1:condition}'],
    detail: 'REPEAT … UNTIL loop',
  };
}

/** A `DO … UNTIL cond` post-condition loop (Acorn Atom). */
function doUntil(): ConstructTemplate {
  return {
    label: 'DO',
    lines: ['DO', '${0}', 'UNTIL ${1:condition}'],
    detail: 'DO … UNTIL loop',
  };
}

/** A subroutine-call construct, e.g. `GOSUB <line>` (spelling varies). */
function gosub(word: string): ConstructTemplate {
  return {
    label: word,
    lines: [`${word} \${0:line}`],
    detail: 'call subroutine',
  };
}

/**
 * A command whose argument is a string literal, e.g. `PRINT "…"` or
 * `LOAD "filename"`. Expands the keyword with an empty quoted argument and drops
 * the caret between the quotes. Only added for dialects that actually have the
 * command (see the per-dialect arrays below).
 */
function stringCmd(word: string, detail: string): ConstructTemplate {
  return {
    label: word,
    lines: [`${word} "\${0}"`],
    detail,
  };
}

/**
 * One-line descriptions for the bracketed functions, shared across dialects
 * (a function means the same wherever it appears). Used as the completion
 * `detail` in {@link fn}.
 */
const FN_DETAIL: Record<string, string> = {
  ABS: 'absolute value',
  SGN: 'sign (-1, 0 or 1)',
  INT: 'integer part',
  USR: 'call machine code',
  FRE: 'free memory',
  POS: 'cursor column',
  RND: 'random number',
  PEEK: 'read a byte of memory',
  LEN: 'length of a string',
  STR$: 'number as a string',
  VAL: 'string as a number',
  ASC: 'code of the first character',
  CHR$: 'character for a code',
  LEFT$: 'leftmost characters',
  RIGHT$: 'rightmost characters',
  MID$: 'substring',
  STRING$: 'a run of repeated characters',
  INSTR: 'position of a substring',
  POINT: 'read a screen pixel',
  OPENIN: 'open a file for input',
  OPENUP: 'open a file for update',
  OPENOUT: 'open a file for output',
  EVAL: 'evaluate an expression string',
  INKEY: 'read the keyboard (timed)',
  INKEY$: 'read a key as a string',
  ADVAL: 'read an analogue value',
  VARPTR: 'address of a variable',
  INP: 'read an I/O port',
  EOF: 'at end of file?',
  LOC: 'current file position',
  LOF: 'length of a file',
  MKI$: 'integer as bytes',
  MKS$: 'single as bytes',
  MKD$: 'double as bytes',
  CINT: 'convert to integer',
  CSNG: 'convert to single',
  CDBL: 'convert to double',
  FIX: 'truncate to integer',
  CVI: 'bytes as an integer',
  CVS: 'bytes as a single',
  CVD: 'bytes as a double',
  CODE: 'code of the first character',
  TL$: 'string without its first character',
  SCREEN$: 'character at a screen cell',
  ATTR: 'attributes of a screen cell',
};

/**
 * A function-call construct: the required arguments in brackets, one numbered
 * placeholder each. In `argspec`, `'s'` emits a quoted string field (`"${n}"`)
 * and any other character a bare field (`${n}`); optional arguments are left
 * out. `gap` is the text between the name and `(` — a space for the Spectrum's
 * `POINT (x, y)` idiom, empty elsewhere. e.g. `fn('INSTR', 'ss')` →
 * `INSTR("${1}", "${2}")`, `fn('INKEY', 'n')` → `INKEY(${1})`.
 */
function fn(word: string, argspec: string, gap = ''): ConstructTemplate {
  const params = [...argspec]
    .map((t, i) => (t === 's' ? `\${${i + 1}}` : `\${${i + 1}}`))
    .join(', ');
  return {
    label: word,
    lines: [`${word}${gap}(${params})`],
    detail: FN_DETAIL[word],
    type: 'function',
  };
}

/** Expand a compact `[word, argspec]` table into function constructs. */
function fns(table: [string, string][], gap = ''): ConstructTemplate[] {
  return table.map(([word, argspec]) => fn(word, argspec, gap));
}

/** The string-literal commands common to both ZX80 and ZX81. */
const ZX_BASE: ConstructTemplate[] = [
  ifThen(),
  forNext(),
  gosub('GOSUB'),
  stringCmd('PRINT', 'print a string'),
  stringCmd('LOAD', 'load "filename"'),
  stringCmd('SAVE', 'save "filename"'),
];
/** ZX81 additionally has LPRINT (the ZX80 has no printer support). */
const ZX81: ConstructTemplate[] = [
  ...ZX_BASE,
  stringCmd('LPRINT', 'print a string to the printer'),
];
/** ZX80's functions do use parentheses (unlike the ZX81's space syntax). */
const ZX80: ConstructTemplate[] = [
  ...ZX_BASE,
  ...fns([
    ['RND', 'n'],
    ['PEEK', 'n'],
    ['USR', 'n'],
    ['ABS', 'n'],
    ['CODE', 's'],
    ['CHR$', 'n'],
    ['STR$', 'n'],
    ['TL$', 's'],
  ]),
];

/** Spectrum writes the call as two words, "GO SUB", and has DEF FN. */
const SPECTRUM: ConstructTemplate[] = [
  ifThen(),
  forNext(),
  gosub('GO SUB'),
  {
    label: 'DEF FN',
    lines: ['DEF FN ${1:f}(${2:x})=${0}'],
    detail: 'define a function',
  },
  stringCmd('PRINT', 'print a string'),
  stringCmd('LPRINT', 'print a string to the printer'),
  stringCmd('LOAD', 'load "filename"'),
  stringCmd('SAVE', 'save "filename"'),
  stringCmd('MERGE', 'merge "filename"'),
  stringCmd('VERIFY', 'verify "filename"'),
  // Spectrum writes these two-argument functions with a space before the '('.
  ...fns(
    [
      ['POINT', 'nn'],
      ['SCREEN$', 'nn'],
      ['ATTR', 'nn'],
    ],
    ' ',
  ),
];
/** The 128K adds PLAY (music strings on the AY chip); the 48K has no PLAY. */
const SPECTRUM128: ConstructTemplate[] = [
  ...SPECTRUM,
  stringCmd('PLAY', 'play a music string'),
];

/** BBC adds REPEAT/UNTIL loops and PROC/FN procedures. */
const BBC: ConstructTemplate[] = [
  ifThen(),
  forNext(),
  repeatUntil(),
  gosub('GOSUB'),
  {
    label: 'DEFPROC',
    lines: ['DEF PROC${1:name}', '${0}', 'ENDPROC'],
    detail: 'define a procedure',
  },
  { label: 'PROC', lines: ['PROC${0:name}'], detail: 'call a procedure' },
  {
    label: 'DEFFN',
    lines: ['DEF FN${1:name}(${2:args})=${0}'],
    detail: 'define a function',
  },
  stringCmd('PRINT', 'print a string'),
  stringCmd('LOAD', 'load "filename"'),
  stringCmd('SAVE', 'save "filename"'),
  stringCmd('CHAIN', 'load and run "filename"'),
  stringCmd('OSCLI', 'run an OS command'),
  ...fns([
    ['OPENIN', 's'],
    ['OPENUP', 's'],
    ['OPENOUT', 's'],
    ['ABS', 'n'],
    ['ADVAL', 'n'],
    ['ASC', 's'],
    ['EVAL', 's'],
    ['INKEY', 'n'],
    ['INKEY$', 'n'],
    ['INSTR', 'ss'],
    ['INT', 'n'],
    ['LEN', 's'],
    ['POINT', 'nn'],
    ['SGN', 'n'],
    ['USR', 'n'],
    ['VAL', 's'],
    ['CHR$', 'n'],
    ['LEFT$', 'sn'],
    ['MID$', 'sn'],
    ['RIGHT$', 'sn'],
    ['STR$', 'n'],
    ['STRING$', 'ns'],
  ]),
];

const C64: ConstructTemplate[] = [
  ifThen(),
  forNext(),
  gosub('GOSUB'),
  stringCmd('PRINT', 'print a string'),
  stringCmd('LOAD', 'load "filename"'),
  stringCmd('SAVE', 'save "filename"'),
  stringCmd('VERIFY', 'verify "filename"'),
  ...fns([
    ['ABS', 'n'],
    ['ASC', 's'],
    ['CHR$', 'n'],
    ['FRE', 'n'],
    ['INT', 'n'],
    ['LEFT$', 'sn'],
    ['LEN', 's'],
    ['MID$', 'sn'],
    ['PEEK', 'n'],
    ['POS', 'n'],
    ['RIGHT$', 'sn'],
    ['RND', 'n'],
    ['SGN', 'n'],
    ['STR$', 'n'],
    ['USR', 'n'],
    ['VAL', 's'],
  ]),
];

const ATOM: ConstructTemplate[] = [
  ifThen(),
  forNext(),
  doUntil(),
  gosub('GOSUB'),
  stringCmd('PRINT', 'print a string'),
  stringCmd('LOAD', 'load "filename"'),
  stringCmd('SAVE', 'save "filename"'),
  ...fns([
    ['ABS', 'n'],
    ['SGN', 'n'],
  ]),
];

const TRS80: ConstructTemplate[] = [
  ifThen(),
  forNext(),
  gosub('GOSUB'),
  stringCmd('PRINT', 'print a string'),
  stringCmd('LPRINT', 'print a string to the printer'),
  stringCmd('LOAD', 'load "filename"'),
  stringCmd('SAVE', 'save "filename"'),
  stringCmd('MERGE', 'merge "filename"'),
  ...fns([
    ['ABS', 'n'],
    ['ASC', 's'],
    ['CDBL', 'n'],
    ['CHR$', 'n'],
    ['CINT', 'n'],
    ['CSNG', 'n'],
    ['CVD', 's'],
    ['CVI', 's'],
    ['CVS', 's'],
    ['EOF', 'n'],
    ['FIX', 'n'],
    ['FRE', 'n'],
    ['INP', 'n'],
    ['INSTR', 'ss'],
    ['INT', 'n'],
    ['LEFT$', 'sn'],
    ['LEN', 's'],
    ['LOC', 'n'],
    ['LOF', 'n'],
    ['MID$', 'sn'],
    ['MKD$', 'n'],
    ['MKI$', 'n'],
    ['MKS$', 'n'],
    ['PEEK', 'n'],
    ['POINT', 'nn'],
    ['POS', 'n'],
    ['RIGHT$', 'sn'],
    ['RND', 'n'],
    ['SGN', 'n'],
    ['STR$', 'n'],
    ['STRING$', 'nn'],
    ['USR', 'n'],
    ['VAL', 's'],
    ['VARPTR', 'n'],
  ]),
];

/** Construct templates per dialect id (see {@link Dialect.id}). */
export const constructsByDialect: Record<string, ConstructTemplate[]> = {
  zx81: ZX81,
  zx80: ZX80,
  zxspectrum: SPECTRUM,
  zxspectrum128: SPECTRUM128,
  bbcmicro: BBC,
  bbcmaster: BBC,
  commodore64: C64,
  atom: ATOM,
  trs80: TRS80,
};

/**
 * Build the CodeMirror snippet template for a construct: the first line as-is,
 * each continuation line prefixed with its planned BASIC line number (or, when
 * numbering is off, joined as plain newlines).
 */
export function buildConstructSnippet(
  lines: string[],
  continuationNos: number[] | null,
): string {
  if (continuationNos === null) return lines.join('\n');
  return [
    lines[0]!,
    ...lines.slice(1).map((l, i) => `${continuationNos[i]} ${l}`),
  ].join('\n');
}
