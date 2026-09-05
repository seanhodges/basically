import type { KeywordDomain } from './domains';
import type { EscapeClass } from './escape-classes';
import type { Placeholder } from './placeholders';
import type { PortingTopic } from './porting-topics';

/** One row of a dialect reference table. */
export interface ReferenceEntry {
  /**
   * Spelling as written, e.g. "INPUT", "MID$", "<>" for BASIC or "LD", "LDA",
   * "ORG" for assembly.
   */
  name: string;
  /**
   * `command`/`function`/`operator` for BASIC dialects; `instruction`
   * (mnemonic) and `directive` (assembler pseudo-op like ORG/DB) for the
   * per-CPU assembly references.
   */
  kind: 'command' | 'function' | 'operator' | 'instruction' | 'directive';
  /**
   * How the keyword is used, with each argument written as a `<…>` placeholder:
   * `"INPUT [<prompt>;] <var>[, <var>]…"`. The placeholder vocabulary and the
   * notation rules are in src/reference/placeholders.ts, and
   * reference-data.test.ts holds every page to them - this is not free text.
   */
  syntax: string;
  /** Brief description, including notable behaviours where relevant. */
  description: string;
  /** Optional badge, e.g. "128K only" or "Master only". */
  tag?: string;
  /**
   * Short spellings this keyword can be typed as on the machines the row
   * belongs to, shortest first - `["P."]` on the Acorns, `["?"]` for the
   * Commodore PRINT, `["pO"]` for its POKE. Absent where the machine has none,
   * which is every row on the Sinclair pages.
   *
   * Derived rather than authored, and never by hand: see ./abbreviations.ts,
   * which reads each machine's own resolution order and is what a page's
   * exported data passes through.
   */
  abbreviations?: string[];
  /**
   * Dialect ids this row exists on, when it does not exist on every machine the
   * page covers - e.g. `['cpc6128']` for a Locomotive BASIC 1.1 command. Absent
   * (the common case) means every machine on the page has it.
   *
   * Deliberately *not* named `machines`: {@link ReferenceTableData.machines}
   * already holds the page's display names ("Commodore 64", "Commodore PET"),
   * and one name for two meanings, nested, is a trap.
   *
   * This is what makes the porting comparison per-machine rather than
   * per-page - see src/reference/compare.ts `tableForMachine`.
   * The prose {@link tag} remains the human-facing badge; this is the machine-
   * readable form, and keyword-crosscheck.test.ts pins the two together by
   * requiring each dialect's selected rows to equal its own keyword table.
   *
   * Scope a row only when the machine genuinely cannot express it. What a
   * machine's *hardware* ignores is a fact, not an absent row: the Commodore
   * colour escapes exist on the monochrome PET and round-trip fine, they simply
   * have no visible effect, so they stay unscoped and the PET's `colour` fact
   * carries the truth.
   */
  onlyOn?: string[];
  /**
   * The capability this keyword provides - graphics, sound, storage and so on.
   * Optional *only* because this interface is shared with the per-CPU assembly
   * references, whose mnemonics have no BASIC capability. Every BASIC row has
   * one: the eight BASIC tables are typed as {@link BasicReferenceTableData},
   * which narrows this to required.
   */
  domain?: KeywordDomain;
}

/** Everything one reference page renders. */
export interface ReferenceTableData {
  /** Page/table title, e.g. "ZX Spectrum BASIC (48K & 128K)". */
  title: string;
  /** Machines this language set covers, for the page intro. */
  machines: string[];
  /**
   * Placeholders this page uses that the shared vocabulary does not carry, because
   * they name something peculiar to this machine - the Amstrad's `<stream>`, the
   * TRS-80's `<cell>`. Optional only because the per-CPU assembly references share
   * this interface and have a notation of their own; every BASIC page declares it,
   * `[]` included. See src/reference/placeholders.ts.
   */
  placeholders?: readonly Placeholder[];
  entries: ReferenceEntry[];
}

/**
 * A BASIC keyword row, where the capability domain is mandatory. Assignable to
 * {@link ReferenceEntry}, so every shared consumer keeps working unchanged.
 */
export interface BasicReferenceEntry extends ReferenceEntry {
  domain: KeywordDomain;
}

/**
 * A BASIC dialect's reference page. The eight BASIC data files annotate
 * themselves with this rather than {@link ReferenceTableData} so that a row
 * missing its `domain` fails `npm run typecheck` - the strongest available
 * guard on a hand-authored classification of every keyword.
 */
export interface BasicReferenceTableData extends ReferenceTableData {
  /**
   * Required on the BASIC pages, where `[]` is a statement rather than an omission:
   * "this page needs nothing beyond the shared vocabulary".
   */
  placeholders: readonly Placeholder[];
  entries: BasicReferenceEntry[];
}

/** One row of a dialect escape-code table. */
export interface EscapeEntry {
  /** Canonical source spelling, possibly with placeholders: "{INK n}", "\\a", "{RED}", "%c", "{$xx}". */
  escape: string;
  /** Human-readable stored form, e.g. "0x10 n", "0x93", "0xC0–0xFF". */
  bytes: string;
  /** Category id; must be one of the table's `categories`. */
  category: string;
  /** Brief description of the effect / meaning of the stored byte(s). */
  description: string;
  /** Parse-only alternative spellings for the same byte(s), e.g. ["{wht}"], ["▘"]. */
  aliases?: string[];
  /** Optional badge, e.g. "48K only" or "parse-only". */
  tag?: string;
  /**
   * Dialect ids this row exists on, when it does not exist on every machine the
   * page covers. See {@link ReferenceEntry.onlyOn} for the full contract - the
   * two fields mean the same thing and are filtered by the same helper.
   *
   * Rare here: a control code is a property of the charset, and the machines
   * sharing a page usually share that charset outright. The one case in the
   * tree is the Spectrum's `\a`-`\u` UDG rows for 0xA3/0xA4, which are 48K-only
   * because a 128K reads those bytes as the SPECTRUM and PLAY tokens.
   */
  onlyOn?: string[];
  /**
   * Concrete probe pinning the row to the implementation: `source` must
   * tokenize to exactly `bytes` via the dialect charset (checked by
   * escapes/escape-crosscheck.test.ts).
   */
  example: { source: string; bytes: number[] };
  /**
   * Byte values whose canonical decode this row claims (the first byte for
   * operand-carrying escapes). 'rest' = every escape-needing byte not claimed
   * by another row - at most one 'rest' row per table (the raw-byte escape).
   * Omit for parse-only rows (their bytes decode to another row's form).
   */
  codes?: number[] | 'rest';
  /** How the cross-check verifies this row. Default 'charset'. */
  probe?: 'charset' | 'float';
  /** True for spellings accepted on parse but never emitted on decode. */
  parseOnly?: boolean;
}

/** One filter chip on an escape-codes page, and what class of code it holds. */
export interface EscapeCategory {
  /** Chip id, referenced by `EscapeEntry.category` and `?cat=`. Page-scoped. */
  id: string;
  /** Chip label, in this machine's own terms. Page-scoped. */
  label: string;
  /**
   * The cross-page handle for what these codes are. `id` and `label` are named
   * in one machine's terms - `key-graphics` on the Commodore is `graphics` on
   * the Atom - so the class is what lets porting guidance be authored per class
   * of code rather than per page. See {@link EscapeClass} for the tie-breaks.
   */
  class: EscapeClass;
}

/** Everything one escape-codes sub-page renders. */
export interface EscapeTableData {
  /** Page/table title, e.g. "ZX81 escape codes". */
  title: string;
  /** Machines the escape set covers, for the page intro. */
  machines: string[];
  /** Ordered filter chips. */
  categories: EscapeCategory[];
  entries: EscapeEntry[];
}

/**
 * One command that several dialects provide under different spellings, keyed by
 * machine id: `{ commodore64: 'CLR', bbcmicro: 'CLEAR' }`. The comparison
 * reports these as a rename to carry out rather than as a command lost plus an
 * unrelated command gained.
 *
 * Partial on purpose. A spelling can mean something else entirely on a machine
 * that is simply left out of the map: the Atom's `CLEAR` selects a screen mode,
 * so `atom` is absent from the clear-variables group and its `CLEAR` is left to
 * be reported as the {@link FalseFriend} it is.
 */
export interface KeywordEquivalence {
  /** Stable id for the shared command, e.g. "clear-variables". Not shown. */
  concept: string;
  /** Machine id → the spelling that machine uses. Two or more entries. */
  spellings: Record<string, string>;
}

/**
 * One spelling that several dialects provide with materially different
 * meanings, keyed by machine id. The exact dual of {@link KeywordEquivalence}:
 * that one is a concept with many spellings, this is a spelling with many
 * concepts.
 *
 * These are the differences nothing else on the page can surface. A false
 * friend has the same name, the same `kind` and often the same syntax on both
 * sides, so it lands in none of the difference buckets while quietly changing
 * what a program computes - `LOG` is a base-10 logarithm on the Acorn machines
 * and a natural logarithm on the Commodore, Amstrad and Tandy ones.
 */
export interface FalseFriend {
  /** The shared spelling, exactly as the reference tables write it. */
  keyword: string;
  /** Machine id → what it means there. Two or more entries, not all equal. */
  meanings: Record<string, string>;
}

/**
 * One bullet of the guidance written for a machine you are porting *to*,
 * whatever you are arriving from.
 *
 * `topics` is what the bullet is about, and exists so a note for the chosen
 * ordered pair can supersede it: the pair notes are the more specific of the
 * two, and a reader met "only the first two characters of a variable name are
 * significant" once in each. See {@link PortingTopic}.
 */
export interface TargetPortingNote {
  /** The bullet as shown. */
  text: string;
  /**
   * What this bullet is about. A bullet making several points carries several
   * topics, and is dropped only where the pair notes cover all of them.
   */
  topics: PortingTopic[];
}

/**
 * One bullet of the guidance written for a single ordered pair, and what of
 * the target's own guidance it makes redundant.
 */
export interface PairPortingNote {
  /** The bullet as shown, ahead of whatever target guidance survives. */
  text: string;
  /**
   * The {@link TargetPortingNote} topics this bullet already makes for the
   * reader. Omitted where it supersedes nothing - most notes say something the
   * target guidance cannot, which is why the pair earned notes at all. Each
   * topic named must be one the target's own notes carry, or the tag is stale;
   * porting-crosscheck.test.ts fails on one that is.
   */
  covers?: PortingTopic[];
}

/**
 * Advice anchored to one *ordered* pair of pages (from → to): the few pairs
 * whose relationship is close enough, or trap-laden enough, to warrant notes
 * that the target-only {@link PortingFacts.portingNotes} and the
 * {@link FalseFriend} warnings cannot carry - e.g. that ZX80 and ZX81 spell
 * their block graphics with the same escapes but different byte values, so
 * graphics port silently wrong between the two closest machines.
 *
 * Directional on purpose: what one direction gains the other loses, so a pair
 * and its reverse are two distinct entries. Sparse: most pairs have none.
 * Pinned by porting-crosscheck.test.ts (real machine ids, no machine on both
 * sides, no duplicate ordered pair, notes within the same reading budget as the
 * other prose).
 */
export interface PairPortingNotes {
  /**
   * The machine being ported *from*, or the machines this note reads the same
   * for. Several machines are named where they share the note, never because
   * they share a reference page.
   */
  from: string | readonly string[];
  /** The machine being ported *to*, or the machines sharing the note. */
  to: string | readonly string[];
  /** A few short notes specific to this ordered pair. */
  notes: PairPortingNote[];
}

/**
 * How much of a variable name a machine keeps, as a rule rather than a sentence.
 *
 * {@link PortingFacts.variableNaming} says the same thing in prose, and the prose
 * is what the fact rows show; this is what a comparison can compute a *collision*
 * from - the two of a program's names that the target would treat as one. Three
 * questions decide that, and these fields are exactly those: how much of a name
 * survives, whether the machine restricts some names further than others, and
 * whether the type marker is part of the name.
 *
 * Re-derived against each dialect's own `lint()` by facts-crosscheck.test.ts,
 * which builds a probe program from the rule authored here and requires the
 * machine's own linter to flag it exactly when this rule says the names collide.
 */
export interface VariableSignificance {
  /**
   * Characters of a name carrying no type marker that the machine keeps, or
   * null where every character is significant.
   *
   * A number larger than any name a program actually carries (the Amstrad's 40)
   * is authored as the number, not as null: it is the machine's real rule, and
   * nothing downstream is worse off for it.
   */
  plain: number | null;
  /**
   * The same for a name carrying a type marker, which several machines restrict
   * further: the Sinclair machines' numeric names may be long while their string
   * and array names are a single letter. Equal to {@link plain} on the machines
   * that have one rule for every name.
   */
  marked: number | null;
  /**
   * Whether the type marker is part of the name, so that `AB` and `AB$` are two
   * variables while `AB$` and `ABC$` may still be one.
   *
   * False only where the machine has no markers at all (the Atom), which is why
   * it reads as a restatement of {@link markers} - but it is the question the
   * collision rule actually asks, and a machine that answered it differently
   * would need no other change here.
   */
  markerDistinguishes: boolean;
  /**
   * The type-marker characters this machine has, in the order its own
   * documentation lists them - `"$%"`, `"$%!#"`, or `""` where it has none.
   */
  markers: string;
  /**
   * Whether the machine tells `A` from `a` when it identifies a variable, so
   * that a difference in letter case is a difference in name.
   *
   * Here as well as in the machine's declared letter-case facts because this is
   * the porting side's own rule type, and the collision report needs the source
   * and the target rule side by side; `facts-crosscheck.test.ts` pins the two
   * authorings together.
   */
  caseSensitive: boolean;
}

/**
 * Whether a machine has fractions, and the range it holds where it has not.
 *
 * The structured form of {@link PortingFacts.numberHandling}, which stays as the
 * prose the fact rows show. Unlike {@link VariableSignificance} there is no
 * behavioural probe short of running a program on the emulator, so
 * facts-crosscheck.test.ts pins this to the prose only: "Integer only" exactly
 * when there are no fractions, quoting the same range. A weaker pin, honestly
 * labelled.
 */
export interface NumberHandling {
  /** Whether the machine can hold a fractional value at all. */
  fractions: boolean;
  /**
   * The range an integer-only machine holds, as two numbers. Absent where the
   * machine has fractions - a floating-point range is not what a port rescales
   * against.
   */
  range?: { min: number; max: number };
  /**
   * A separate number system this machine offers reals through, where its main
   * number path is integer-only - the Atom's floating-point ROM. Named as a
   * noun phrase, so it follows "keep them in".
   *
   * This does not make the machine one that has fractions, and {@link fractions}
   * stays false: a ported expression still lands on the integers, and the
   * separate system has its own variables to be moved into deliberately. What it
   * buys is that the truncation finding can pose the choice - fractions the
   * program depends on belong here, fractions incidental to it are rescaled -
   * instead of advising rescaling as though there were no alternative.
   *
   * Only meaningful on an integer-only machine, which facts-crosscheck.test.ts
   * enforces: a machine that has fractions offers them through its main path.
   */
  fractionsVia?: string;
}

/**
 * What a machine does with a type marker its own naming rule does not
 * recognise.
 *
 * Authored only where losing the marker is worse than a spelling change. A
 * marker the target simply has no notion of is a rename; a marker the target
 * *accepts* in the program's text and rejects when the line runs is a port that
 * loads cleanly and fails later, which is the worse of the two failures and the
 * one a reader cannot see coming.
 *
 * The marker must be absent from the machine's own
 * {@link VariableSignificance.markers} - a trap for a marker the machine has is
 * a contradiction - which facts-crosscheck.test.ts enforces.
 */
export interface MarkerTrap {
  /** The marker character, e.g. "%". */
  marker: string;
  /** What the machine does with it, phrased to follow "X% is". */
  note: string;
}

/**
 * How short a program may spell this machine's keywords, and what that costs or
 * saves.
 *
 * Three mechanisms exist across these machines and they are not variations of
 * one thing. The Acorns take a dotted prefix (`P.`); the Commodores take a
 * prefix whose last letter is shifted (`pO`); and several machines read a
 * symbol as a whole command (`?` for PRINT, `'` for REM) without taking either.
 * The Sinclairs are `none` with no symbols at all: their keywords arrive by
 * keystroke, which is an entry method rather than a spelling, and this fact
 * describes what a program's *text* may contain.
 *
 * Pinned behaviourally by facts-crosscheck.test.ts against each machine's own
 * tokenizer, in both directions: a machine authored `none` must not read the
 * notation, and the symbol list must be the one its keyword tables declare.
 */
export interface AbbreviatedEntry {
  /** How a keyword may be typed short, or 'none' where it may not. */
  style: 'dot' | 'shifted' | 'none';
  /**
   * Symbol spellings this machine's tokenizer reads as a whole command, each
   * with the keyword it stands for.
   *
   * Commands only. A symbol standing for an *operator* (`^` for `↑`) is already
   * reported by the operator facts, and carrying it here as well would put one
   * difference in two findings.
   */
  symbols: { spelling: string; keyword: string }[];
  /**
   * Whether spelling keywords short leaves a smaller stored program.
   *
   * True only where the machine stores program text as typed - the Atom, where
   * `P.` really is three bytes less than `PRINT`, in a budget under five
   * kilobytes. Every tokenizing machine stores one byte for the keyword however
   * it was typed, so abbreviating there saves nothing and the guide must never
   * offer it as a way to make room.
   */
  shrinksProgram: boolean;
}

/**
 * What a program's text has to show for a {@link ConditionalFreeMemory} region
 * to be free, restated for this side of the boundary.
 *
 * The mode command and the boot mode ride inside the condition rather than
 * beside it because the docs side has no machine to ask: a comparison holds
 * facts and a vocabulary, and the vocabulary names the command it was read
 * with. Where the two commands differ the condition is undecidable and the
 * region stays claimed - a BBC `MODE 0` and an Atom `CLEAR 0` are both mode 0
 * and are opposite ends of their machines' graphics.
 */
export type ConditionalFreeCondition =
  | { kind: 'screen-modes'; command: string; bootMode: number; modes: number[] }
  | { kind: 'without-keywords'; keywords: string[] };

/**
 * Memory a machine's hardware claims only while the program uses an optional
 * feature, restated from the dialect's own declaration.
 *
 * Two sources of truth, deliberately: this side of the app never imports
 * dialect code, so the figures are written out here and pinned byte for byte -
 * bounds, size, condition and wording - to `memoryBlocks.conditionallyFree` by
 * facts-crosscheck.test.ts. The same arrangement `freeRamBytes` already lives
 * under.
 */
export interface ConditionalFreeMemory {
  /** Inclusive first address of the region. */
  start: number;
  /** Inclusive last address of the region. */
  end: number;
  /** How much memory it is, which is what the fit report reports. */
  bytes: number;
  /** What the program's text must show. */
  condition: ConditionalFreeCondition;
  /** The condition in words, phrased to follow "free while". */
  conditionText: string;
  /** What claims the region when the condition does not hold. */
  note: string;
}

/**
 * The text screen a machine boots into, as numbers rather than as the prose
 * {@link PortingFacts.screen} states.
 *
 * The boot screen and not the machine's fullest one: a ported program lands in
 * the mode the machine powers on in, and the mode-dependent machines keep their
 * fuller story in the prose. `screen` remains what the fact rows show;
 * facts-crosscheck.test.ts requires this to be the first columns-by-rows figure
 * that prose states, so the two cannot drift.
 */
export interface TextScreen {
  /** Columns of the boot text screen. */
  columns: number;
  /** Rows of it. */
  rows: number;
}

/**
 * How a program waits on this machine, in one authored phrase.
 *
 * The half of the delay finding this side owns. Telling a reader their counting
 * loops were tuned to another machine's speed is only half an answer: the other
 * half is what to pace against instead, and every machine spells that
 * differently - a frame pause, a centisecond counter, an interrupt timer, a
 * jiffy clock read out of memory.
 *
 * `keywords` is what the phrase rests on, and every one of them must be a row on
 * this machine's own reference page (facts-crosscheck.test.ts), so a phrase
 * cannot come to name a command the machine does not have. Empty is a real
 * answer rather than an omission: a machine with no timer and no pause has
 * nothing to move a delay onto, and the finding says so instead of posing a
 * choice with one arm missing.
 */
export interface WaitIdiom {
  /** The idiom in words, phrased to follow "wait with". */
  text: string;
  /**
   * Reference rows the phrase names, each of which must exist on this machine.
   * Empty where the machine has no way to pace a wait but count.
   */
  keywords: string[];
}

/**
 * The language-rule and hardware facts a porter needs to compare, one entry per
 * dialect reference page. Split into two classes for the crosscheck test
 * (facts-crosscheck.test.ts):
 *
 *  - CROSSCHECKED against `src/dialects/<id>/`: `freeRamBytes` (← programRamBytes),
 *    `addressNotation`, `hexPrefix`, `statementSepChar` (← memoryWrites), the
 *    shape of `memoryWriteSyntax` (← memoryWrites.forms), `screenBase` /
 *    `programStart` (← memoryMap `screen` / `program` region starts), and
 *    `unsupportedCharacters` (← charset).
 *  - HAND-AUTHORED from the hardware page + tokenizer/aiProfile, with no
 *    structured source in `src/`: `lineNumberRange`, `statementSeparator`,
 *    `elseSupported`, `letRequired`, `variableNaming`, `numberHandling`,
 *    `numbers`, `exponentOperator`, `screen`, `colour`, `sound`.
 *    (`textScreen` and `waitIdiom` are authored too, and pinned to the prose
 *    beside them and to the machine's own reference rows respectively;
 *    `loopSpeed` is not authored at all but measured, and pinned within a
 *    tolerance by `src/dialects/loopSpeed.test.ts`.
 *    `variableSignificance` and `abbreviatedEntry` are authored too, but
 *    re-derived against each dialect's own `lint()` / `tokenize()` rather than
 *    only read - see their interfaces.
 *    `screen` is prose, not
 *    `displaySize` — the latter is the emulator canvas size in pixels, not the
 *    logical text/graphics screen a porter cares about; `exponentOperator` is
 *    prose because several dialects spell it with a symbol key — `↑`/`^` — that
 *    has no reference row.)
 */
export interface PortingFacts {
  /**
   * Dialect id, matching `Dialect.id` in the registry (e.g. "vic20").
   *
   * One entry per *machine*, not per reference page: a shared page describes
   * its marquee machine, which would tell a reader porting to a VIC-20 that it
   * had the C64's 38911 bytes free rather than its own 3583.
   */
  id: string;
  /**
   * The BASIC this machine runs, named as its own documentation names it -
   * "Commodore BASIC V2", "BBC BASIC IV", "Locomotive BASIC 1.1".
   *
   * Per machine rather than per page, like every other fact here: the two BBCs
   * share a reference page and run different versions of BASIC, which is
   * precisely the difference a porter reading "BBC BASIC (Micro & Master)"
   * cannot see. Pinned by facts-crosscheck.test.ts to the name the dialect's
   * own `blurb` gives, so the guide and the machine picker cannot disagree
   * about what a machine runs.
   */
  basicDialect: string;
  // --- Language rules (hand-authored) ---
  /** Valid line-number range as written, e.g. "1–9999". */
  lineNumberRange: string;
  /**
   * The same range as two numbers, so it can be compared rather than only read.
   *
   * The range the machine's own *editor* accepts - what a porter has to
   * renumber into - and not the wider range a tokenizer may be willing to
   * store. Several machines differ there deliberately: a BBC stores line
   * numbers up to 65279 and a Spectrum up to 16383 in a *loaded* program, and
   * both ROMs refuse those at the keyboard, so a port that renumbered into them
   * would produce a program the target cannot be made to accept by typing.
   *
   * Every figure is ROM-derived where the machine has a shippable ROM: see the
   * re-derivation in facts-crosscheck.test.ts, which holds each endpoint to
   * being accepted by the dialect's own tokenizer and the number just outside it
   * to being refused.
   */
  lineNumbers: { min: number; max: number };
  /** Multi-statement separator (usually ":"), or null when one statement per line. */
  statementSeparator: string | null;
  /** Whether IF…THEN…ELSE is available. */
  elseSupported: boolean;
  /** Whether LET is required, optional, or unsupported on assignment. */
  letRequired: 'required' | 'optional' | 'none';
  /**
   * How short a program may spell this machine's keywords. See
   * {@link AbbreviatedEntry} - a program's spellings are part of its text, so a
   * port has to expand the ones the target does not read.
   */
  abbreviatedEntry: AbbreviatedEntry;
  /** Variable-naming rule, e.g. "single letter A–Z" or "long names, A–Z0–9". */
  variableNaming: string;
  /**
   * The same rule in a form that can be applied to a name rather than read.
   * {@link variableNaming} above is what the fact rows show; this is what finds
   * the two names in a program that become one on this machine.
   */
  variableSignificance: VariableSignificance;
  /**
   * How the dialect handles numbers: floating point, or integer-only with the
   * range it holds. Required, because whether the target has fractions at all
   * decides how much of a port is arithmetic - an integer-only machine
   * truncates every division and needs every fractional calculation rescaled -
   * and nothing else in these facts implies it.
   */
  numberHandling: string;
  /**
   * The same fact in a form that can be compared: whether this machine has
   * fractions, and the range it holds where it has not. {@link numberHandling}
   * stays the prose the fact rows show.
   */
  numbers: NumberHandling;
  /**
   * What this machine does with type markers it does not recognise, where that
   * is worse than a spelling to change. See {@link MarkerTrap}.
   *
   * Absent on most machines, and absent is not "nothing happens": it means the
   * marker is simply not part of a name here, which the marker-loss finding
   * reports from the naming rules alone. This field is for the machines that
   * take the spelling and then fail.
   */
  markerTraps?: MarkerTrap[];
  /**
   * Exponent operator spelling ("**", "^", "↑"), or undefined if the dialect has
   * none.
   *
   * Pinned by facts-crosscheck.test.ts against the dialect's own operator set.
   * It was not, and the Atom carried no spelling at all for a machine whose
   * floating-point ROM raises to a power perfectly well - so the guide told a
   * porter to rewrite code that ran.
   */
  exponentOperator?: string;
  /** Integer-division operator ("DIV", "\\"), or undefined where there is none. */
  integerDivisionOperator?: string;
  /** Remainder operator ("MOD", "%"), or undefined where there is none. */
  remainderOperator?: string;
  /** Bitwise exclusive-OR operator ("EOR", "XOR", ":"), or undefined. */
  xorOperator?: string;
  /**
   * What AND, OR and NOT do to their operands. 'bitwise' combines them bit by
   * bit on integers - the Microsoft, Acorn and Locomotive machines, and the ZX80
   * - so `5 AND 3` is 1 and `5 OR 3` is 7. 'value' returns one of the operands:
   * on the ZX81 and the Spectrum `a AND b` is `a` when `b` is non-zero and 0
   * otherwise, so the same expressions are 5 and 1. 'logical' reduces both
   * operands to a truth value first, so `5 AND 3` and `5 OR 3` are both 1 and
   * `NOT 5` is 0 - Apple 1 Integer BASIC, which has no bitwise operator at all.
   *
   * Read off each running machine by src/dialects/operatorBattery.test.ts.
   * Nothing else in these facts implies it, and a condition that reads
   * identically on both machines gives different answers - the failure a porter
   * finds last, because nothing errors.
   *
   * Absent only where the machine has none of the three: Dartmouth BASIC has no
   * AND, OR or NOT at all, so there is no behaviour to name and a compound
   * condition has to become nested IFs.
   */
  logicalOperators?: 'bitwise' | 'value' | 'logical';
  /**
   * What a true comparison evaluates to: -1 on the Microsoft, BBC and Locomotive
   * machines and the ZX80, 1 on the ZX81, the Spectrum and the Atom.
   *
   * Also measured rather than authored. It is what decides whether the counting
   * idiom `X=X+(A>B)` adds or subtracts after a port.
   *
   * Absent where a comparison is not a value: on the GE-235 it exists only
   * between IF and THEN, so `X=X+(A>B)` is not a program there at all.
   */
  comparisonTrue?: -1 | 1;
  /**
   * Printable ASCII (0x20-0x7E) this machine's character set has no glyph for,
   * in code-point order - e.g. the ZX81's `!`. Empty where the machine covers
   * printable ASCII in full (the TRS-80 and the Atom).
   *
   * Only printable ASCII. The bytes with no printable form at all are the
   * machine's control codes and graphics characters, which the escape tables
   * describe; listing a block graphic here would report one difference twice
   * under two names.
   *
   * Pinned to `src/dialects/<id>/charset.ts` by facts-crosscheck.test.ts, which
   * re-derives it from the charset rather than trusting the prose - a character
   * the guide wrongly says is unavailable is advice to rewrite working code.
   */
  unsupportedCharacters: string[];
  // --- Hardware ---
  /** Text/graphics screen summary, e.g. "32×24 text; 256×192 bitmap". */
  screen: string;
  /**
   * The same screen as numbers, for the boot mode only. See {@link TextScreen} -
   * {@link screen} stays the prose the fact rows show, and this is what a
   * program's own print positions can be checked against.
   */
  textScreen: TextScreen;
  /**
   * How fast this machine runs BASIC, as empty counting-loop iterations a
   * second, measured in this product's own emulators by
   * `src/dialects/loopSpeed.test.ts`.
   *
   * Measured rather than authored, and never quoted as a fact about the original
   * hardware: it is what a ported program will actually exhibit *here*, which is
   * the honest claim and also the one the reader can check. The constant lives
   * here because the docs site cannot boot an emulator; the benchmark is the
   * crosscheck, and a machine whose emulator changes speed fails it loudly.
   *
   * Absent for a machine this project cannot benchmark - one with no
   * redistributable ROM to boot. A comparison with a speed missing on either
   * side reports nothing about delays, which is the same way doubt runs
   * everywhere else here.
   */
  loopSpeed?: number;
  /**
   * How a program waits on this machine. See {@link WaitIdiom} - the delay
   * finding names it as the alternative to retuning the counts.
   */
  waitIdiom: WaitIdiom;
  /**
   * Screen-memory base address, in this machine's own hex convention
   * ("$4000", "&C000"). Optional: omitted for the ZX80/ZX81, whose display file
   * has no dedicated region, and the TRS-80, which has no structured memory map.
   * Pinned to the dialect's first `screen` memoryMap region by
   * facts-crosscheck.test.ts.
   */
  screenBase?: string;
  /**
   * BASIC program-text start address, same convention ("$0801", "&0170").
   * Optional: omitted only for the TRS-80 (no memory map). Pinned to the
   * dialect's `program` memoryMap region start - the C64 value is the true text
   * start ($0801), one byte past the region start, which the crosscheck allows.
   */
  programStart?: string;
  /** Free RAM for a BASIC program, in bytes (← Dialect.programRamBytes). */
  freeRamBytes: number;
  /**
   * Memory this machine claims only for an optional feature, which a program
   * whose own text proves the feature unused may take (←
   * memoryBlocks.conditionallyFree). Absent on every machine holding no region
   * whose condition a program's text can decide - which is most of them, and by
   * design: a condition the comparison cannot check is one it refuses to make.
   *
   * Never part of {@link freeRamBytes}. That figure is the boot state, and it
   * stays the boot state everywhere it is shown; this is reported separately and
   * only where the program is under fit pressure.
   */
  conditionallyFree?: ConditionalFreeMemory[];
  /** Colour capability summary. */
  colour: string;
  /** Sound capability summary. */
  sound: string;
  /** How the dialect writes memory, e.g. "POKE addr,val" or "?addr=val". */
  memoryWriteSyntax: string;
  /** Address notation (← Dialect.addressNotation, defaults to 'hex'). */
  addressNotation: 'hex' | 'dec';
  /** Hex literal prefix where the dialect has one, e.g. "&" (← memoryWrites.hexPrefix). */
  hexPrefix?: string;
  /** Statement separator inside a memory-write form, if any (← memoryWrites.statementSep). */
  statementSepChar?: string;
  // --- Porting guidance (hand-authored) ---
  /**
   * What to watch for when writing *for* this machine, whatever you are coming
   * from. Kept to a few short bullets: the comparison already shows the fact
   * rows and the keyword lists, so these earn their place only by saying what
   * those cannot. Capped by porting-crosscheck.test.ts.
   *
   * A bullet is dropped for a pair whose own notes already make its every
   * point - see {@link TargetPortingNote} and {@link PairPortingNote}.
   */
  portingNotes: TargetPortingNote[];
  /**
   * "If you need X here, do this instead", for commands this dialect does not
   * have. Shown against the command in the difference lists rather than in a
   * section of its own.
   *
   * Deliberately partial: written where it helps, and a command without one
   * still appears in the comparison exactly as it does now. Each `keyword` must
   * be absent from this dialect (otherwise the advice is redundant) - checked
   * by porting-crosscheck.test.ts.
   */
  substitutions: { keyword: string; note: string }[];
}

/**
 * A facts entry as authored. Either complete in itself, or naming a relative to
 * inherit from with `extends` and stating only what differs.
 *
 * Without it, every machine would mean another copy of the same
 * paragraphs: the VIC-20 and the C64 share every language rule and differ only
 * in hardware, so the VIC-20 states its screen, colour, sound and addresses and
 * inherits the rest. Prose written once cannot drift from itself, and the
 * fields the crosscheck pins are exactly the ones a sibling has to restate.
 */
export type PortingFactsEntry = { id: string; extends?: string } & Partial<
  Omit<PortingFacts, 'id'>
>;

/**
 * Resolve authored entries into complete ones by folding each `extends` base
 * in beneath its overrides.
 *
 * One level only - a base may not itself extend - which keeps "what does this
 * machine actually say?" answerable by reading two entries rather than a chain.
 * An entry naming a missing or extending base throws: the alternative is a
 * silently half-populated fact table.
 */
/**
 * Whether a machine writes memory with `?addr=val` rather than `POKE`, read off
 * the write syntax the facts already report.
 *
 * That decides how a memory map's region detail offers to read an address back -
 * `?32768` on a BBC or an Atom, `PEEK 32768` everywhere else - and asking the
 * facts avoids a second list of which machines those are. Every surface that
 * draws a map outside the emulator (the porting guide's pair, the hardware
 * pages' single maps) asks this, so they all ask it of the same field.
 */
export function writesByIndirection(facts: PortingFacts): boolean {
  return /^[?!]/.test(facts.memoryWriteSyntax);
}

export function resolvePortingFacts(
  entries: readonly PortingFactsEntry[],
): PortingFacts[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  return entries.map((entry) => {
    if (entry.extends === undefined) return entry as PortingFacts;
    const base = byId.get(entry.extends);
    if (!base) {
      throw new Error(
        `porting facts "${entry.id}" extends unknown entry "${entry.extends}"`,
      );
    }
    if (base.extends !== undefined) {
      throw new Error(
        `porting facts "${entry.id}" extends "${base.id}", which itself ` +
          `extends "${base.extends}" - inheritance is one level only`,
      );
    }
    // `extends` is dropped: a resolved entry stands alone.
    const { extends: _base, ...own } = entry;
    const merged: Record<string, unknown> = { ...base, ...own };
    delete merged.extends;
    return merged as unknown as PortingFacts;
  });
}
