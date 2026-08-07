import type { KeywordDomain } from './domains';
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

/** Everything one escape-codes sub-page renders. */
export interface EscapeTableData {
  /** Page/table title, e.g. "ZX81 escape codes". */
  title: string;
  /** Machines the escape set covers, for the page intro. */
  machines: string[];
  /** Ordered filter chips; ids referenced by `EscapeEntry.category` and `?cat=`. */
  categories: { id: string; label: string }[];
  entries: EscapeEntry[];
}

/**
 * One command that several dialects provide under different spellings, keyed by
 * page slug: `{ commodore: 'CLR', bbc: 'CLEAR' }`. The comparison reports these
 * as a rename to carry out rather than as a command lost plus an unrelated
 * command gained.
 *
 * Page-scoped on purpose. A spelling can mean something else entirely on a page
 * that is simply left out of the map: the Atom's `CLEAR` selects a screen mode,
 * so `atom` is absent from the clear-variables group and its `CLEAR` is left to
 * be reported as the {@link FalseFriend} it is.
 */
export interface KeywordEquivalence {
  /** Stable id for the shared command, e.g. "clear-variables". Not shown. */
  concept: string;
  /** Page slug → the spelling that page uses. Two or more entries. */
  spellings: Record<string, string>;
}

/**
 * One spelling that several dialects provide with materially different
 * meanings, keyed by page slug. The exact dual of {@link KeywordEquivalence}:
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
  /** Page slug → what it means there. Two or more entries, not all equal. */
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
 * Pinned by porting-crosscheck.test.ts (real slugs, `from` ≠ `to`, no duplicate
 * ordered pair, notes within the same reading budget as the other prose).
 */
export interface PairPortingNotes {
  /** Source page slug being ported *from*. */
  from: string;
  /** Target page slug being ported *to*. */
  to: string;
  /** A few short notes specific to this ordered pair. */
  notes: PairPortingNote[];
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
 *    `exponentOperator`, `screen`, `colour`, `sound`. (`screen` is prose, not
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
  /** Variable-naming rule, e.g. "single letter A–Z" or "long names, A–Z0–9". */
  variableNaming: string;
  /**
   * How the dialect handles numbers: floating point, or integer-only with the
   * range it holds. Required, because whether the target has fractions at all
   * decides how much of a port is arithmetic - an integer-only machine
   * truncates every division and needs every fractional calculation rescaled -
   * and nothing else in these facts implies it.
   */
  numberHandling: string;
  /** Exponent operator spelling ("**", "^", "↑"), or undefined if the dialect has none. */
  exponentOperator?: string;
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
