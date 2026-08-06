// The argument vocabulary every BASIC reference row writes its placeholders from:
// what an argument *is*, in the words the machine's own documentation would use.
//
// Two tiers. {@link CORE_PLACEHOLDERS} is closed and shared, and holds only names at
// least two pages need; anything peculiar to one machine goes in that page's own
// `placeholders` list on its table data. The split is the one the escape tables
// already use for their `categories`, and it is what lets each reference page carry a
// legend for exactly the placeholders it uses - `ReferenceTable.vue` is handed a table
// and nothing else, so a page's vocabulary has to travel with its data.
//
// Placeholder names are never compared between pages: `compare.ts` `syntaxShape`
// erases everything inside `<…>` before diffing, because two pages naming one slot
// differently is a difference between documents, not between machines. So a per-page
// name cannot leak into the porting comparison. What the comparison does see - how
// many arguments, whether they are bracketed - is what the rules below keep honest.
//
// ## How a syntax string is written
//
// R0. **The machine's real syntax outranks every rule below.** These rules govern how
//     an argument is named and spaced, never what the machine accepts. Where a machine
//     requires a quoted literal, a missing space, an extra sigil or a fixed constant,
//     the row shows it and the rules yield. A row that bends a rule says why.
// R1. Every argument is a `<…>` token from the core or from this page's own list. No
//     bare words, no quoted placeholders, no uppercase stand-ins.
// R2. Optional is `[…]`. Repetition is `<x>[, <x>]…`, with the ellipsis *outside* the
//     bracket: `[, <var>]…` reads as "and more of those", where `[, <var>…]` reads as
//     one optional thing that happens to contain an ellipsis.
// R3. One space after a comma or semicolon separating arguments; spaces around `=` and
//     binary operators; none after `(` or before `)`; and none introduced inside a
//     keyword's own spelling or between a keyword and a sigil belonging to it -
//     `PRINT#`, `?<addr>`, `FN<name>`.
// R4. ` | ` between alternative whole forms; an unspaced `|` between single-character
//     alternatives inside a bracket group, as in `[;|,]`.
// R5. A placeholder stands for the whole argument, quotes included - never
//     `"<string>"`. A quoted literal appears only where the machine accepts no
//     expression there, and then the placeholder names the role: `<prompt>`.
// R6. `#` binds to its placeholder: `#<file>`, `#<stream>`, never `# <file>`. Whether
//     it attaches to the keyword (`PRINT#<file>`) or follows it (`OPEN #<file>`) is
//     the machine's business, per R0.
// R7. A keyword that is only ever a fragment of a larger statement shows the smallest
//     enclosing form that makes it legal, with its own arguments spelled out. The
//     `STEP` row reads `FOR <numvar> = <number> TO <number> STEP <number>`, because a
//     cell reading `STEP` teaches nothing and cannot be compared with anything.
// R8. A pseudo-variable shows `NAME` when it can only be read and
//     `NAME | NAME = <value>` when it can be assigned. This is a machine difference,
//     not a notation one - the BBC's `TIME` is assignable and the Amstrad's is not, so
//     both rows are already right and neither should be "normalised" to the other.
// R9. The syntax cell is syntax. No parenthesised prose: counts and limits that will
//     not fit the notation belong in the description.
// R10. A concrete literal stays where the machine accepts only that literal, as in
//     `FRE(0)` or `TRACE ON | TRACE OFF`. R0 in practice.
// R11. `…` means repetition and nothing else. Where it once meant "and so on"
//     (`REM …`) it becomes a real placeholder.
// R12. An operator row shows its operands: `<number> < <number>`, not `<`.
//
// ## Tie-break rules for choosing a placeholder
//
// 1. **Name the argument for what it does, not for its type, wherever one keyword's
//    arguments mean different things.** `POKE <addr>, <byte>` beats
//    `POKE <number>, <number>`. Where they mean the same thing - a list of values,
//    both operands of `+` - the type is the honest name and a role would be invented.
// 2. **A file is a file and a stream is a screen region.** They look alike, both being
//    a small number after a `#`, and are unrelated: `<file>` is the number a file was
//    opened on, `<stream>` is one of the Amstrad's eight screen windows. Splitting
//    them is also what frees `<channel>` to mean a sound channel, which is the only
//    thing the BBC's `SOUND` ever meant by it.
// 3. **Where two machines' own documentation names one slot differently, each page
//    uses its machine's word,** and the word goes in that page's list rather than the
//    core. The Acorn machines describe sound in amplitude and the Amstrad in volume;
//    neither page should be made to speak the other's language. This is fidelity, not
//    drift - unlike `<expr>` versus `<expression>`, which was two spellings of one
//    word.
// 4. **Type words say nothing that is not already a fact elsewhere.** `<int>` was
//    retired for this: the same `POKE` was `<int>` on one page and `<number>` on four
//    others, every one of these BASICs rounds a fractional argument rather than
//    rejecting it, and whether a machine has fractions at all is already reported as
//    its own porting fact. `<cond>` went the same way - none of these BASICs has a
//    boolean type, and `IF <number> THEN` is what seven pages already said.
// 5. **Prefer an existing name to a new one.** A placeholder used once, on one page,
//    is usually a `<number>` that wanted a better description instead.

/**
 * The placeholders shared across the BASIC reference pages, in canonical order: the
 * order a page's argument legend lists them in. Roughly values → variables → the
 * program → the screen → colour → sound → input → storage → the machine.
 *
 * Closed, and deliberately holds only what two or more pages need - see
 * {@link Placeholder} for the per-page half. `meaning` is reader-facing: it is what
 * the legend on each reference page shows, so it describes the argument rather than
 * the type behind it.
 */
export const CORE_PLACEHOLDERS = [
  // Values, where the type is the most useful thing to say about the argument.
  { id: 'number', meaning: 'a numeric expression' },
  { id: 'string', meaning: 'a string expression' },
  {
    id: 'expr',
    meaning: 'a value of either type, where the keyword takes both',
  },
  { id: 'byte', meaning: 'a value from 0 to 255' },
  { id: 'constant', meaning: 'a literal number or string, not an expression' },

  // Variables, where the keyword assigns to its argument rather than reading it.
  { id: 'var', meaning: 'a variable of either type' },
  { id: 'numvar', meaning: 'a numeric variable' },
  { id: 'strvar', meaning: 'a string variable' },
  { id: 'letter', meaning: 'a single letter' },

  // The program itself.
  { id: 'line', meaning: 'a line number' },
  { id: 'statement', meaning: 'one BASIC statement' },
  { id: 'comment', meaning: 'free text, to the end of the line' },
  {
    id: 'name',
    meaning: 'a name the program defines for a function or procedure',
  },
  { id: 'param', meaning: 'a parameter, where the definition introduces it' },
  { id: 'arg', meaning: 'a value, where the call passes it' },

  // Positions and counts within a string or a list.
  { id: 'start', meaning: 'the position something starts at, counting from 1' },
  { id: 'length', meaning: 'how many characters' },

  // The screen: graphics coordinates, text cells and modes.
  { id: 'x', meaning: 'a horizontal graphics coordinate' },
  { id: 'y', meaning: 'a vertical graphics coordinate' },
  { id: 'dx', meaning: 'a horizontal distance from the current position' },
  { id: 'dy', meaning: 'a vertical distance from the current position' },
  { id: 'col', meaning: 'a text column' },
  { id: 'row', meaning: 'a text row' },
  { id: 'mode', meaning: 'a screen mode' },
  { id: 'action', meaning: 'which of several things the keyword should do' },

  // Colour.
  { id: 'colour', meaning: 'a colour, by number' },

  // Sound.
  { id: 'channel', meaning: 'a sound channel' },
  { id: 'pitch', meaning: 'how high a note sounds' },
  { id: 'duration', meaning: 'how long a sound lasts' },
  { id: 'envelope', meaning: 'an envelope, by number' },

  // Input.
  {
    id: 'prompt',
    meaning: 'text shown before the input; a literal, not an expression',
  },

  // Storage.
  { id: 'file', meaning: 'an open file, by the number it was opened on' },
  { id: 'filename', meaning: 'the name of a file on tape or disc' },

  // The machine.
  { id: 'addr', meaning: 'a memory address' },
  { id: 'port', meaning: 'an input/output port, by number' },
] as const;

/** One shared placeholder id, derived from {@link CORE_PLACEHOLDERS}. */
export type CorePlaceholder = (typeof CORE_PLACEHOLDERS)[number]['id'];

/**
 * A placeholder and what it stands for: one of {@link CORE_PLACEHOLDERS}, or one a
 * single page declares for a concept peculiar to its machine.
 */
export interface Placeholder {
  /** The name as it appears between the angle brackets, e.g. `stream`. */
  id: string;
  /** Reader-facing gloss, lower-case: it reads as "`<stream>` — a screen window". */
  meaning: string;
}

/** Every core id, for membership tests. */
const CORE_IDS: ReadonlySet<string> = new Set(
  CORE_PLACEHOLDERS.map((p) => p.id),
);

/**
 * Placeholder occurrences in a usage string, in order, without their brackets.
 *
 * Requiring a lower-case identifier between the brackets is what keeps the relational
 * operators out. The `<` row's usage is `<number> < <number> | <string> < <string>`,
 * and its bare `<` is followed by a space, so only the four real placeholders match;
 * `<=` and `<>` fail on their second character. Anything else beginning with `<` is a
 * typo, and `reference-data.test.ts` scans for exactly that.
 */
export function placeholderTokens(syntax: string): string[] {
  return [...syntax.matchAll(/<([a-z][a-z0-9]*)>/g)].map((m) => m[1]);
}

/** True for a core placeholder id. */
export function isCorePlaceholder(id: string): id is CorePlaceholder {
  return CORE_IDS.has(id);
}

/**
 * The vocabulary entries a page actually uses, core order first and then the page's
 * own - what its argument legend lists, so no page is asked to explain a placeholder
 * it never writes. Unknown tokens are ignored here and reported by the conformance
 * test instead, which can name the row they came from.
 */
export function placeholdersUsed(
  entries: readonly { syntax: string }[],
  extension: readonly Placeholder[],
): Placeholder[] {
  const used = new Set(entries.flatMap((e) => placeholderTokens(e.syntax)));
  return [
    ...CORE_PLACEHOLDERS.filter((p) => used.has(p.id)),
    ...extension.filter((p) => used.has(p.id)),
  ];
}
