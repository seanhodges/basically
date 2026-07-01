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
const ZX80: ConstructTemplate[] = ZX_BASE;

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
];

const C64: ConstructTemplate[] = [
  ifThen(),
  forNext(),
  gosub('GOSUB'),
  stringCmd('PRINT', 'print a string'),
  stringCmd('LOAD', 'load "filename"'),
  stringCmd('SAVE', 'save "filename"'),
  stringCmd('VERIFY', 'verify "filename"'),
];

const ATOM: ConstructTemplate[] = [
  ifThen(),
  forNext(),
  doUntil(),
  gosub('GOSUB'),
  stringCmd('PRINT', 'print a string'),
  stringCmd('LOAD', 'load "filename"'),
  stringCmd('SAVE', 'save "filename"'),
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
