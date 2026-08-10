// What moving *this* program between two machines involves, described to the AI
// assistant from the same tables the porting comparison renders.
//
// It sits beside ./machineDescription.ts because the two are halves of one
// answer. That one composes a machine's own definition for the (cached) system
// prompt - what the target *is*, the same every time. This one composes what a
// particular port of a particular program requires, which varies with the
// program and therefore travels in the user turn. Same register, same section
// shape, so the assistant reads one document rather than two pasted together.
//
// The recipe is the comparison page's recipe. `DialectCompare.vue` computes the
// same diffs from the same functions with the same arguments, and narrows them
// with the same three helpers; every step here mirrors a computed property
// there. Where the two could drift, portDescription.test.ts is what holds them
// together - a command the program never used must never reach a request.
//
// Pure and framework-free like ./compare.ts: it takes the two machines'
// identities and reference tables, reads its siblings for the rest, and returns
// a string. Nothing here reaches the dialect registry or an emulator core, which
// is what keeps it node-testable and lets the app load it on demand.
import {
  capabilitySections,
  composeGuidance,
  conditionallyFreeForProgram,
  diffEscapes,
  diffForProgram,
  diffKeywords,
  escapeDiffForProgram,
  escapeSections,
  escapeTableForMachine,
  falseFriendsForProgram,
  integerRangeNarrowingForProgram,
  carriesMachineCodeGuidance,
  delaysForProgram,
  lineNumbersForProgram,
  lostCapabilitiesForProgram,
  positionsForProgram,
  machineCodeForProgram,
  markerLossForProgram,
  programFitForTarget,
  readLandingsForProgram,
  spellingExpansionsForProgram,
  statementLayoutForProgram,
  tableForMachine,
  truncatedArithmeticForProgram,
  unsupportedCharactersForProgram,
  variableCollisionsForProgram,
  writeLandingsForProgram,
  type DelayLoops,
  type EscapeChange,
  type FalseFriendWarning,
  type IntegerRangeNarrowing,
  type KeywordChange,
  type KeywordDiff,
  type KeywordRename,
  type LineNumberChange,
  type MachineCodeRoutine,
  type MarkerLoss,
  type PairGuidance,
  type PositionCheck,
  type ProgramSize,
  type ProgramVocabulary,
  type ReadLanding,
  type SpellingExpansion,
  type StatementLayoutChange,
  type TruncatedArithmetic,
  type VariableCollision,
  type WriteLanding,
} from './compare';
// Type-only, exactly as in ./compare.ts, and for the same reason: a memory map
// is plain data that arrives as an argument, and the import erases at build
// time rather than reaching a runtime module in `src/dialects/`.
import type { MemoryMap } from '../dialects/types';
import { domainGuidance } from './domain-guidance';
import { KEYWORD_DOMAINS } from './domains';
import { escapeGuidance } from './escape-guidance';
import { portingFacts } from './facts';
import { DOMAIN_TITLES, type MachineIdentity } from './machineDescription';
import { falseFriends, keywordEquivalences, pairPortingNotes } from './porting';
import type {
  ConditionalFreeMemory,
  EscapeTableData,
  PortingFacts,
  ReferenceEntry,
  ReferenceTableData,
} from './types';

/**
 * One end of the port: who the machine is, plus the two tables belonging to its
 * reference *page*.
 *
 * The tables are arguments rather than imports because they are what must stay
 * code-split - some twelve thousand lines the app pulls in only when a port is
 * actually asked for. Everything else this module needs (porting data, facts,
 * domain guidance) is module-level constant data it imports directly, exactly as
 * `machineDescription.ts` does.
 *
 * The tables belong to the page and the machine narrows them; see
 * {@link tableForMachine}.
 */
export interface PortSide extends MachineIdentity {
  /** The machine's reference page, loaded on demand by the caller. */
  table: ReferenceTableData;
  /** Its escape table, where its page has one. */
  escapes?: EscapeTableData;
  /**
   * Its memory layout, where the IDE describes one. Absent for a machine whose
   * layout it cannot describe, which leaves the program's writes unjudged
   * rather than judged against a guess - the same rule the comparison page
   * follows when it draws no maps at all for such a pair.
   */
  memoryMap?: MemoryMap;
}

/** `- Commodore C64 (1982), running Commodore BASIC V2.`, less the bullet. */
function nameMachine(side: PortSide): string {
  const facts = portingFacts.find((f) => f.id === side.id);
  // Composed on a click, unlike the crosscheck-guarded machine description: a
  // machine with no facts entry is named without its BASIC rather than throwing
  // and losing the whole report. facts-crosscheck.test.ts makes this
  // unreachable today.
  const basic = facts !== undefined ? `, running ${facts.basicDialect}` : '';
  return `${side.manufacturer} ${side.name} (${side.year})${basic}`;
}

/**
 * Who is being ported to whom, and where the rest of this came from.
 *
 * The provenance sentence is the point of the section: the assistant has its own
 * recollection of both machines, and this exists to be preferred to it.
 */
function describeHeader(from: PortSide, to: PortSide): string {
  return [
    'PORTING THIS PROGRAM',
    `- From: ${nameMachine(from)}.`,
    `- To: ${nameMachine(to)}.`,
    `- What follows is this project's own reference data for these two machines, narrowed to the commands and control codes this program actually uses. Prefer it to your recollection of either machine.`,
  ].join('\n');
}

/**
 * The prose guidance for this pair, unnarrowed.
 *
 * Guidance states rules that hold for any program on this pair ("there is no
 * ELSE"), so narrowing it to the program's vocabulary would drop advice about
 * the very commands the port has to introduce. Pair notes lead and target notes
 * follow, the order `composeGuidance` composed them in - it already drops a
 * target note whose every point a pair note has made.
 */
function describeGuidance(guidance: PairGuidance): string {
  const notes = [...guidance.pairNotes, ...guidance.targetNotes];
  if (notes.length === 0) return '';
  return `BEFORE YOU START\n${notes.map((n) => `- ${n}`).join('\n')}`;
}

/**
 * The language rules that differ between the two machines.
 *
 * The one section here that is not narrowed, and deliberately: a rule holds
 * whatever commands a program uses, so narrowing "one statement per line" to a
 * program's vocabulary would drop it precisely when the port needs it. The
 * *differences* are the narrowing - the target's own rules are already in the
 * system prompt, and restating them all would pay for the whole fact table on
 * every conversion turn to say what has already been said.
 *
 * Same rows and same order as the comparison page's fact table, less the ones
 * that are hardware rather than language: what the machine draws and sounds with
 * is reported through the capability sections, which say what to do about it.
 */
function describeLanguageRuleChanges(from: PortSide, to: PortSide): string {
  const a = portingFacts.find((f) => f.id === from.id);
  const b = portingFacts.find((f) => f.id === to.id);
  if (a === undefined || b === undefined) return '';
  // Language rules only. The hardware figures are reported through the
  // capability sections, which say what to do about them, and the target's own
  // are already in the system prompt - so a "Free program RAM" row here would
  // put a hardware difference under a heading that says it is a language rule.
  const rows: [string, (f: PortingFacts) => string][] = [
    ['Numbers', (f) => f.numberHandling],
    ['Variable names', (f) => f.variableNaming],
    [
      'Conditionals',
      (f) => (f.elseSupported ? 'IF … THEN … ELSE' : 'IF … THEN only, no ELSE'),
    ],
    [
      'Statements per line',
      (f) =>
        f.statementSeparator === null
          ? 'one per line'
          : `several, separated by ${f.statementSeparator}`,
    ],
    [
      'LET on assignment',
      (f) =>
        ({ required: 'required', optional: 'optional', none: 'not used' })[
          f.letRequired
        ],
    ],
    ['Exponent operator', (f) => f.exponentOperator ?? 'none'],
    [
      'Integer division and remainder',
      (f) =>
        [f.integerDivisionOperator, f.remainderOperator]
          .filter(Boolean)
          .join(' and ') || 'neither - use INT(a/b) and a-b*INT(a/b)',
    ],
    [
      'AND, OR and NOT',
      (f) =>
        f.logicalOperators === 'bitwise'
          ? 'bitwise on integers'
          : 'value logic - A AND B is A or 0',
    ],
    ['Exclusive-OR', (f) => f.xorOperator ?? 'none'],
    ['A true comparison', (f) => String(f.comparisonTrue)],
    ['Line numbers', (f) => f.lineNumberRange],
    ['Writing memory', (f) => f.memoryWriteSyntax],
  ];
  const lines = rows
    .filter(([, get]) => get(a) !== get(b))
    .map(([label, get]) => `- ${label}: ${get(a)} → ${get(b)}`);
  if (lines.length === 0) return '';
  return `LANGUAGE RULES THAT CHANGE\n${lines.join('\n')}`;
}

/**
 * The characters this program uses that the target has no glyph for.
 *
 * Named one by one rather than counted: the replacement is a judgement about
 * the text around each one ("HELLO!" loses its `!`, `A$(1)` cannot keep its
 * brackets), and a count says none of that.
 */
function describeCharactersToReplace(
  characters: string[],
  to: PortSide,
): string {
  if (characters.length === 0) return '';
  return [
    `CHARACTERS THIS PROGRAM USES THAT ${to.name.toUpperCase()} DOES NOT HAVE`,
    `- ${characters.join(' ')}`,
    '- These have no glyph on the target and cannot appear anywhere in the converted program — not in a string, not in a REM, not in a name.',
  ].join('\n');
}

/**
 * How this program's statement layout has to change.
 *
 * Names the lines, which is the whole point of the section: the rule is already
 * in the system prompt and in the guidance prose, and what neither can say is
 * which of *these* lines it falls on.
 */
function describeStatementLayout(
  change: StatementLayoutChange | null,
  to: PortSide,
): string {
  if (change === null) return '';
  const lines = change.lines.join(', ');
  const what =
    change.to === null
      ? `${to.name} takes one statement per line, so every "${change.from}" becomes a new line. Renumber the program afterwards and fix the line references.`
      : `${to.name} separates statements with "${change.to}", not "${change.from}". The lines keep their shape; only the separator changes.`;
  const projected = change.projected;
  return [
    'STATEMENT LAYOUT',
    `- ${what}`,
    `- Editor lines to change: ${lines}`,
    ...(projected
      ? [
          projected.overflows
            ? `- The split turns ${projected.from} lines into ${projected.to}, which ${to.name}'s line numbers cannot hold however they are renumbered. Merge statements or shorten the program.`
            : `- The split turns ${projected.from} lines into ${projected.to}.`,
        ]
      : []),
  ].join('\n');
}

/**
 * Line numbers the target machine's editor will not accept.
 *
 * A rule the assistant cannot infer from the program: the numbers are valid
 * where they were written, and the machine they are going to simply stops
 * lower. Nothing about the program's text shows it.
 */
function describeLineNumbers(
  change: LineNumberChange | null,
  to: PortSide,
): string {
  if (change === null) return '';
  const ends: string[] = [];
  if (change.belowMinimum)
    ends.push(`its lowest is ${change.lowest}, below ${change.min}`);
  if (change.aboveMaximum)
    ends.push(`its highest is ${change.highest}, above ${change.max}`);
  return [
    'LINE NUMBERS',
    `- ${to.name} numbers lines ${change.min}-${change.max}, and ${ends.join(', and ')}.`,
    '- Renumber the program into that range and fix every GOTO, GOSUB and other line reference with it.',
  ].join('\n');
}

/**
 * The program's variable names the target machine cannot tell apart.
 *
 * The same class of failure as the false friends below, and reported beside
 * them: nothing fails to tokenize, no command list has a row for it, and two of
 * the program's variables quietly become one. What the target reduces them to is
 * named because a replacement has to avoid colliding with a third name.
 */
function describeVariableCollisions(
  collisions: VariableCollision[],
  to: PortSide,
): string {
  if (collisions.length === 0) return '';
  const lines = collisions.map(
    (c) => `- ${c.names.join(' and ')} all become "${c.key}".`,
  );
  return [
    `VARIABLE NAMES ${to.name.toUpperCase()} CANNOT TELL APART`,
    ...lines,
    '- Rename these so they differ within what the target keeps, and change every use.',
  ].join('\n');
}

/**
 * The type markers this program's names carry that the target does not have.
 *
 * Beside the collisions above, because the failure is the same kind: the names
 * port unchanged and the promise their marker made stops being kept. The two
 * ways that goes wrong are reported apart, since they need opposite reactions -
 * a marker the target takes and then fails on is found the first time the line
 * runs, and a precision it silently drops may never be found at all.
 *
 * The `Decide:` line is the part this document cannot settle: whether the
 * program leans on the type its marker named is a fact about what the program
 * is for, not about its text.
 */
function describeMarkerLoss(losses: MarkerLoss[], to: PortSide): string {
  if (losses.length === 0) return '';
  const lines = losses.map((loss) => {
    const names = loss.names.join(', ');
    const what =
      loss.trap !== undefined
        ? `${to.name} has no such type and does not reject the spelling: a name like this is ${loss.trap}, so the port loads looking finished`
        : loss.precision
          ? `${to.name} has no such type, so these are held as its ordinary numbers and the extra digits go silently — check any arithmetic that depends on them`
          : `${to.name} has no such type, so the type goes with the marker's spelling, not just the name`;
    return `- ${loss.marker} (${loss.meaning}) on ${names}: ${what}.`;
  });
  return [
    `TYPE MARKERS ${to.name.toUpperCase()} DOES NOT HAVE`,
    ...lines,
    '- Decide: for each of these names, whether the program depends on the type its marker promised — keep that by hand where it does, and drop the marker where it does not.',
  ].join('\n');
}

/**
 * Arithmetic this program does that the target truncates.
 *
 * The range is named because rescaling is the fix and the range is what the
 * rescaled values have to fit. Stated as arithmetic to check rather than as a
 * defect found: whether a division divides exactly cannot be known without
 * running the program.
 *
 * A target that reaches reals through a system of its own turns the advice into
 * a decision: the Atom's floating-point ROM will hold a fraction the program
 * depends on, and rescaling is right only where the fractions are incidental.
 * Which they are is not in the program's text, so the line poses it rather than
 * choosing - and the imperative is dropped along with the choice, or the
 * decision would be posed under an answer already given.
 */
function describeTruncatedArithmetic(
  change: TruncatedArithmetic | null,
  to: PortSide,
): string {
  if (change === null) return '';
  const what = [
    change.divides ? 'divides' : '',
    change.fractionalLiteral ? 'carries fractional values' : '',
  ]
    .filter((s) => s !== '')
    .join(' and ');
  return [
    'ARITHMETIC THAT TRUNCATES',
    `- ${to.name} has no fractions at all: it holds whole numbers from ${change.min} to ${change.max}, and every division truncates.`,
    change.fractionsVia === undefined
      ? `- This program ${what}, so rescale that arithmetic — work in tenths or hundredths, or reorder so the multiply comes before the divide.`
      : `- This program ${what}, and every one of those calculations lands on the integers.`,
    ...(change.fractionsVia !== undefined
      ? [
          `- Decide: if this program's fractions are essential, keep them in ${change.fractionsVia}; if they are incidental, rescale to whole numbers — work in tenths or hundredths.`,
        ]
      : []),
  ].join('\n');
}

/**
 * Values this program carries that the target's narrower integer range cannot
 * hold.
 *
 * Beside the truncated arithmetic, and silent in the same way: both machines
 * hold whole numbers, nothing divides, and a value simply does not arrive. The
 * ranges are both named because the finding is the distance between them.
 *
 * Present for the pair whether or not the program's text names an offending
 * value, since an expression can overflow with every literal in it small - the
 * named values are the definite half, and the `Decide:` line is the rest.
 */
function describeIntegerRangeNarrowing(
  change: IntegerRangeNarrowing | null,
  from: PortSide,
  to: PortSide,
): string {
  if (change === null) return '';
  return [
    `VALUES ${to.name.toUpperCase()} CANNOT HOLD`,
    `- ${from.name} holds whole numbers from ${change.from.min} to ${change.from.max}; ${to.name} holds ${change.to.min} to ${change.to.max}.`,
    change.values.length > 0
      ? `- Values in this program's own text beyond that: ${change.values.join(', ')}.`
      : `- No value in this program's own text is beyond it, but a result can be: arithmetic written against the wider range has to be checked against the narrower one.`,
    '- Decide: rescale these values so they fit the range, or restructure the arithmetic so its results stay inside it.',
  ].join('\n');
}

/**
 * Where this program's layout falls on the target machine's screen.
 *
 * A finding about numbers rather than commands, which is why nothing else here
 * can carry it: `PRINT AT 5,35` ports to a 32-column machine as `PRINT AT 5,35`
 * and lands off the edge. Every position is named, because a layout is moved
 * one position at a time and a count says nothing about which.
 *
 * The `Decide:` line is posed once rather than per position, and it is the real
 * question: whether the layout is redrawn for the target's screen or whatever
 * falls outside it is cut. That depends on what the screen is *for* - a title
 * centred on 64 columns wants centring on 32, a game board wants its shape -
 * and the program's text does not say.
 */
function describePositions(
  check: PositionCheck | null,
  from: PortSide,
  to: PortSide,
): string {
  if (check === null) return '';
  const lines: string[] = [
    `- ${from.name} boots into ${check.from.columns}×${check.from.rows} characters; ${to.name} boots into ${check.to.columns}×${check.to.rows}.`,
  ];
  if (check.cells.length > 0) {
    lines.push(
      `- Positions the ${to.name} screen does not contain: ${check.cells
        .map((c) => `row ${c.row}, column ${c.column}`)
        .join('; ')}.`,
    );
  }
  if (check.columns.length > 0) {
    lines.push(`- Columns beyond its width: ${check.columns.join(', ')}.`);
  }
  if (check.offsets.length > 0) {
    lines.push(`- Offsets beyond its screen: ${check.offsets.join(', ')}.`);
  }
  if (check.widthEncoded) {
    lines.push(
      `- This program positions by a single offset from the start of the screen, and an offset encodes the width it was written for: ${check.from.columns} columns here, ${check.to.columns} there. Every one of them has to be recomputed for the target's width, in range or not.`,
    );
  }
  if (check.otherModes) {
    lines.push(
      `- This program selects screen modes, so the check above describes the screen ${to.name} boots into rather than whichever one the program ends up on.`,
    );
  }
  lines.push(
    `- Decide: reflow the layout for the ${to.name}'s screen, or clip what falls outside it.`,
  );
  return [
    `WHERE THIS PROGRAM PRINTS ON THE ${to.name.toUpperCase()} SCREEN`,
    ...lines,
  ].join('\n');
}

/**
 * The delays this program carries, and what the target's speed does to them.
 *
 * Beside the positions and silent in the same way: an empty counting loop is a
 * pause whose length is the source machine's speed, so it ports perfectly and
 * takes a different length of time. The ratio is always said to be this
 * project's emulators' - it is measured there, it is not a claim about the
 * original hardware, and it is also exactly what the reader's converted program
 * will do here.
 *
 * The decision has two courses where the target has a clock of its own and one
 * where it has not, and the line says which rather than offering an alternative
 * that does not exist.
 */
function describeDelays(delays: DelayLoops | null, to: PortSide): string {
  if (delays === null) return '';
  const faster = delays.ratio >= 1;
  const factor = (faster ? delays.ratio : 1 / delays.ratio).toFixed(1);
  return [
    'LOOPS THAT ONLY PASS TIME',
    `- Editor lines opening a loop that counts and does nothing else: ${delays.lines.join(', ')}. These are delays, and their counts are the source machine's speed written into the program.`,
    `- Measured in this IDE's emulators, ${to.name} runs the same empty loop ${factor}× ${faster ? 'faster' : 'slower'} (${delays.fromSpeed} against ${delays.toSpeed} iterations a second). Every pause changes by that factor. This is the emulators' figure, not a claim about the original hardware — and it is what the converted program will do here.`,
    delays.hasClock
      ? `- Decide, for each: retune the count for the new speed, or put the delay on the ${to.name}'s own clock — ${delays.clock}.`
      : `- Retune each count for the new speed. There is no second course here: ${delays.clock}.`,
  ].join('\n');
}

/**
 * The commands both machines spell alike and mean differently.
 *
 * Nothing else here can surface these: they match on name, kind and usually
 * syntax, so they reach none of the diff buckets while still changing what the
 * program computes.
 */
function describeFalseFriends(
  warnings: FalseFriendWarning[],
  from: PortSide,
  to: PortSide,
): string {
  if (warnings.length === 0) return '';
  const lines = warnings.map(
    (w) => `- ${w.keyword}: ${w.from} on ${from.name}; ${w.to} on ${to.name}.`,
  );
  return `SAME WORD, DIFFERENT MEANING\n${lines.join('\n')}`;
}

/**
 * What the program loses, by capability: the commands, then the advice written
 * for that capability on this target, then the per-command substitutions.
 *
 * `newlyAvailable` is `[]` rather than filtered afterwards, so what the target
 * *adds* cannot reach a request by accident - it is not work this port
 * requires. `DomainGuidance.example` code blocks are left out too:
 * `describeMachine` already puts them in the system prompt verbatim, and they
 * are the bulkiest part of the guidance.
 */
function describeLostCommands(
  diff: KeywordDiff,
  guidance: PairGuidance,
  targetTable: ReferenceTableData,
  targetFacts: PortingFacts | undefined,
  to: PortSide,
): string {
  const sections = capabilitySections(
    diff.mustReplace,
    [],
    targetTable,
    KEYWORD_DOMAINS,
    domainGuidance,
    // Page-keyed: domain guidance is written per BASIC, not per machine.
    to.page,
  );
  if (sections.length === 0) return '';
  const decided = new Set(
    targetFacts !== undefined
      ? lostCapabilitiesForProgram(targetFacts, sections)
      : [],
  );
  const lines: string[] = [];
  for (const section of sections) {
    const title =
      section.domain !== undefined ? DOMAIN_TITLES[section.domain] : 'Other';
    lines.push(
      `- ${title}: ${section.entries.map((e: ReferenceEntry) => e.name).join(', ')}`,
    );
    const advice =
      section.domain !== undefined
        ? guidance.domains.get(section.domain)?.instead
        : undefined;
    if (advice !== undefined) lines.push(`  Instead: ${advice}`);
    // The question the advice above cannot answer, asked where the capability
    // is gone outright rather than renamed: a program uses colour and sound as
    // decoration, which a port drops, and as information, which it has to
    // re-encode or the program silently stops working. Which one this program
    // was doing is not in its text.
    if (section.domain !== undefined && decided.has(section.domain)) {
      lines.push(
        `  Decide, for each: where the ${section.domain} was decoration, drop it; where it told things apart, re-encode it by the means named above.`,
      );
    }
    // Per-command advice still sits with its command, as it does on the page.
    for (const entry of section.entries) {
      const note = guidance.substitutions.get(entry.name);
      if (note !== undefined) lines.push(`  - ${entry.name} → ${note}`);
    }
  }
  return `COMMANDS THIS PROGRAM USES THAT ${to.name.toUpperCase()} DOES NOT HAVE\n${lines.join('\n')}`;
}

/**
 * Short spellings the program uses that the target does not read.
 *
 * Renaming's twin, so it sits with the mechanical work and just ahead of it: the
 * command survives the port and only the way it is written changes. The trap
 * rides the same line it belongs to - a spelling the target reads as something
 * of its own does not stop the program, it changes what the program does, and
 * the expansion is what removes that.
 *
 * Only what the reader has to expand. The other direction - the short spellings
 * the target would accept - is deliberately never handed over: conversions are
 * written in full spellings.
 */
function describeExpansions(
  expansions: SpellingExpansion[],
  to: PortSide,
): string {
  if (expansions.length === 0) return '';
  const lines = expansions.map((e) => {
    const trap =
      e.differentMeaning !== undefined
        ? ` (unexpanded, ${to.name} reads ${e.spelling} as ${e.differentMeaning} rather than failing)`
        : '';
    return `- ${e.spelling} → ${e.keyword}${trap}`;
  });
  return `SPELLINGS TO WRITE OUT IN FULL\n${lines.join('\n')}`;
}

/** Commands both machines have under different spellings. */
function describeRenames(renamed: KeywordRename[]): string {
  if (renamed.length === 0) return '';
  const lines = renamed.map((r) => `- ${r.from.name} → ${r.to.name}`);
  return `COMMANDS TO RENAME\n${lines.join('\n')}`;
}

/** `PRINT AT <row>,<col> (command)` - one end of a usage change. */
function describeUsage(entry: ReferenceEntry): string {
  return `${entry.syntax} (${entry.kind})`;
}

/**
 * Commands both machines have that are written differently.
 *
 * The bracketing-only changes are named together in one run: they are one habit
 * to correct across every one of them, and a line each would bury the two kinds
 * of change that genuinely need reading.
 */
function describeUsageChanges(
  changes: KeywordChange[],
  from: PortSide,
  to: PortSide,
): string {
  if (changes.length === 0) return '';
  const parens = changes.filter((c) => c.change === 'parens');
  const rest = changes.filter((c) => c.change !== 'parens');
  const lines: string[] = [];
  if (parens.length > 0) {
    lines.push(
      `- Bracketing differs on ${to.name}, so follow its usage for: ${parens
        .map((c) => c.name)
        .join(', ')}`,
    );
  }
  for (const change of rest) {
    lines.push(
      `- ${change.name}: ${describeUsage(change.from)} on ${from.name}; ${describeUsage(change.to)} on ${to.name}.`,
    );
  }
  return `COMMANDS WHOSE USAGE DIFFERS\n${lines.join('\n')}`;
}

/**
 * The control codes the program uses that the target has no equivalent of,
 * grouped by what they do in the source table's own category order.
 *
 * `mustReplace` only. `escapeDiffForProgram` narrows that bucket and no other,
 * so narrowing `behaviourChanged` would mean new comparison logic and a fresh
 * source of drift; "the control codes that must change" is this bucket.
 */
function describeLostEscapes(
  entries: EscapeTableData['entries'],
  sourceEscapes: EscapeTableData,
  to: PortSide,
): string {
  if (entries.length === 0) return '';
  // A line each rather than a run per category, unlike the commands: a control
  // code's description is what says how to replace it, and the narrowing leaves
  // few enough of them that each can afford one. The grouping still orders them,
  // which is what `escapeSections` is for - the classes the target cannot
  // express at all lead, and the source page's editorial order breaks the ties.
  // The guidance table is passed for that ranking alone - the report names the
  // codes and their meanings, and what the assistant is asked to do with them is
  // the instruction the whole request ends in.
  const lines = escapeSections(
    entries,
    sourceEscapes,
    escapeGuidance,
    to.page,
  ).flatMap((s) =>
    s.entries.map((e) => `- ${e.escape} (${s.label}): ${e.description}`),
  );
  return `CONTROL CODES THIS PROGRAM USES THAT ${to.name.toUpperCase()} DOES NOT HAVE\n${lines.join('\n')}`;
}

/**
 * The control codes both machines spell alike and store differently.
 *
 * Its own section rather than a line in the one above, because the work is
 * different in kind: there is nothing in the program's text to search for. The
 * spelling survives the port untouched and means something else at the other
 * end - the ZX80 and ZX81 block graphics being the case this exists for, two
 * machines close enough that a port between them looks finished.
 *
 * Both byte forms are named, because that is the whole finding.
 */
function describeChangedEscapes(
  changes: EscapeChange[],
  from: PortSide,
  to: PortSide,
): string {
  if (changes.length === 0) return '';
  const lines = changes.map(
    (c) =>
      `- ${c.escape}: stores ${c.from.bytes} on ${from.name}, ${c.to.bytes} on ${to.name} — ${c.to.description}`,
  );
  return `CONTROL CODES THAT KEEP THEIR SPELLING AND CHANGE MEANING\n${lines.join('\n')}`;
}

/**
 * Where this program's writes land on the target machine.
 *
 * The finding nothing in the program's text can carry: the addresses are valid
 * where they were written, they survive the port unchanged, and on the target
 * they reach whatever that machine keeps there. No command list, control-code
 * table or language rule reports it.
 *
 * Both regions are named for the verdicts that have two halves, because either
 * alone leaves the assistant to guess the other - a write aimed at the screen
 * that reaches the BASIC program text is a different job from one that reaches
 * a spare page of RAM. Every address in a group is named rather than counted:
 * unlike the comparison page there is nothing here to click on, and the
 * addresses are what the edits are made at.
 *
 * An approximate address says so. The assistant is told the verdict is an
 * estimate rather than being handed a conclusion the analysis cannot support.
 */
function describeWriteLandings(
  landings: WriteLanding[],
  from: PortSide,
  to: PortSide,
): string {
  if (landings.length === 0) return '';
  const lines = landings.map((landing) => {
    const addresses = landing.addresses.join(', ');
    const aimed = `${landing.from?.label ?? 'memory'} on ${from.name}`;
    const reached = landing.to?.label ?? '';
    const verdict = {
      'different-kind': `${aimed}; ${reached} on ${to.name} — the write reaches something else entirely.`,
      'read-only': `${aimed}; ${reached} on ${to.name}, which is read-only — the write has no effect at all, and the line looks skipped.`,
      outside: `${aimed}. ${to.name} has no such address, so the write has nowhere to go.`,
      'same-kind': `${aimed}; ${reached} on ${to.name} — the same kind of memory in a different place, so the address still has to change.`,
    }[landing.verdict];
    const estimate = landing.approximate
      ? ' The address could only be estimated, so this is an estimate: the region is right, the exact byte may not be.'
      : '';
    return `- ${addresses}: ${verdict}${estimate}`;
  });
  return `WHERE THIS PROGRAM'S WRITES LAND ON THE ${to.name.toUpperCase()}\n${lines.join('\n')}`;
}

/**
 * Where this program's reads land on the target machine.
 *
 * Beside the writes, and for the same reason they exist: the addresses survive
 * the port untouched and reach whatever the other machine keeps there. The
 * failure is quieter - the program does not corrupt anything, it computes with
 * numbers that mean nothing - which is precisely why nothing else reports it.
 *
 * Both regions are named on every verdict that has two, because naming what the
 * program was really asking for is what lets the assistant find the target's own
 * way of asking it. There is no read-only verdict: a read of ROM returns real
 * bytes on both machines, and the finding is that they are different bytes.
 */
function describeReadLandings(
  landings: ReadLanding[],
  from: PortSide,
  to: PortSide,
): string {
  if (landings.length === 0) return '';
  const lines = landings.map((landing) => {
    const addresses = landing.addresses.join(', ');
    const aimed = `${landing.from?.label ?? 'memory'} on ${from.name}`;
    const reached = landing.to?.label ?? '';
    const verdict = {
      'different-kind': `${aimed}; ${reached} on ${to.name} — the read returns something else entirely.`,
      outside: `${aimed}. ${to.name} has no such address, so there is nothing there to read.`,
      'same-kind': `${aimed}; ${reached} on ${to.name} — the same kind of memory in a different place, so the address still has to change.`,
    }[landing.verdict];
    const estimate = landing.approximate
      ? ' The address could only be estimated, so this is an estimate: the region is right, the exact byte may not be.'
      : '';
    return `- ${addresses}: ${verdict}${estimate}`;
  });
  return `WHERE THIS PROGRAM'S READS LAND ON THE ${to.name.toUpperCase()}\n${lines.join('\n')}`;
}

/**
 * The machine code this program reaches, and the decision each routine puts to
 * the reader.
 *
 * The one finding here that is categorical rather than comparative: no
 * substitution, rename or piece of advice ports a Z80 routine to a 6502, and
 * even between two Z80 machines the ROM calls, the screen layout and the
 * interrupt timing underneath it are another machine's. So the section does not
 * offer a translation - it states what the routines are and poses the question
 * that actually moves the port forward, one per routine: what does this one do?
 * A sound effect, a scroll or a speed-up is re-achieved with the target's own
 * means once that is known, and cannot be until it is.
 *
 * Where the guidance above already says how machine code travels between these
 * two machines, this points at it rather than saying it again.
 */
function describeMachineCode(
  routines: MachineCodeRoutine[],
  crossReference: boolean,
  from: PortSide,
  to: PortSide,
): string {
  if (routines.length === 0) return '';
  const lines = routines.map((routine) => {
    const named = routine.call ?? `the block "${routine.block?.name}"`;
    const where = routine.block
      ? `inside the attached block "${routine.block.name}" (${routine.block.size} bytes at ${routine.block.address})`
      : routine.region
        ? `in ${routine.region.label}`
        : `at ${routine.address}`;
    const estimate = routine.approximate
      ? ' The address could only be estimated.'
      : '';
    return `- ${named}: ${where}.${estimate} Decide: establish what this routine does, then do that with the ${to.name}'s own means.`;
  });
  const preamble =
    `These are ${from.name} processor code, not BASIC: nothing on the ${to.name} ` +
    `runs them and no substitution carries them across.`;
  const pointer = crossReference
    ? '\n- The guidance above already says how machine code travels between these two machines; carrying it is a separate job from re-achieving it.'
    : '';
  return `MACHINE CODE THIS PROGRAM REACHES\n${preamble}\n${lines.join('\n')}${pointer}`;
}

/** An address in the target machine's own notation: `&3000`, `#8400`, `53280`. */
function address(value: number, facts: PortingFacts | undefined): string {
  if (facts?.addressNotation !== 'hex') return `${value}`;
  return `${facts.hexPrefix ?? '&'}${value.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * Memory the target holds that this program's own text proves free, and the
 * decision it puts to the reader.
 *
 * Only reached under fit pressure - {@link conditionallyFreeForProgram} is what
 * enforces that - so this is never the comparison advertising what the target
 * adds. It is part of the answer to "will this fit", which is a question about
 * the program.
 *
 * The `Decide:` line is the point of the section. The alternatives are real and
 * the choice is not this document's to make: memory that only exists while the
 * program stays out of the graphics modes is worth having or it is not,
 * depending on what the port is for, and the assistant is asked to settle that
 * from what the program does rather than to be told which way to go.
 */
function describeConditionallyFreeMemory(
  regions: ConditionalFreeMemory[],
  facts: PortingFacts | undefined,
  to: PortSide,
): string {
  if (regions.length === 0) return '';
  const lines = regions.map(
    (region) =>
      `- ${address(region.start, facts)}-${address(region.end, facts)}: ` +
      `${region.bytes.toLocaleString('en-GB')} bytes of ${region.note}, free while ${region.conditionText}. ` +
      `This program's text meets that condition as written.`,
  );
  return [
    `MEMORY THE ${to.name.toUpperCase()} HOLDS BEYOND THE PROGRAM AREA`,
    ...lines,
    `- Decide: put this program's data and machine code there, keeping the condition true, or shorten the program instead.`,
  ].join('\n');
}

/**
 * What this port requires, as the assistant is told it.
 *
 * `vocabulary` is required rather than nullable: a request is never assembled
 * without a readable program (`src/ai/portReport.ts` declines instead), so a
 * null case would be unreachable code pretending to be a policy. It narrows
 * what is reported to what the program actually uses - the same narrowing the
 * comparison page applies to what it displays, and the reason a request's size
 * is bounded by the program rather than by the distance between the machines.
 *
 * Total: a machine with no facts entry, a pair with no escape tables and a pair
 * with nothing to report all compose. The caller reaches this on a click, and
 * degrading is what decision 7 of the design buys.
 */
export function describePort(
  from: PortSide,
  to: PortSide,
  vocabulary: ProgramVocabulary,
  size: ProgramSize | null = null,
): string {
  const sourceTable = tableForMachine(from.table, from.id);
  const targetTable = tableForMachine(to.table, to.id);
  // `from`/`to` stay *page* slugs here: the cross-dialect spelling data
  // (equivalences, false friends, pair notes, domain guidance) is a property of
  // the BASIC, which every machine on a page shares. `tableForMachine` above
  // takes the machine *id*. Both sit on `MachineIdentity`, so the mistake is
  // available at every one of these call sites - portDescription.test.ts is
  // what keeps it made correctly.
  const diff = diffForProgram(
    diffKeywords(sourceTable, targetTable, {
      from: from.page,
      to: to.page,
      equivalences: keywordEquivalences,
    }),
    vocabulary,
  );
  const guidance = composeGuidance({
    from: from.page,
    to: to.page,
    targetFacts: portingFacts.find((f) => f.id === to.id),
    pairNotes: pairPortingNotes,
    falseFriends,
    domainGuidance,
  });

  const sourceEscapes =
    from.escapes !== undefined
      ? escapeTableForMachine(from.escapes, from.id)
      : undefined;
  const targetEscapes =
    to.escapes !== undefined
      ? escapeTableForMachine(to.escapes, to.id)
      : undefined;
  const escapes =
    sourceEscapes !== undefined && targetEscapes !== undefined
      ? escapeDiffForProgram(
          diffEscapes(sourceEscapes, targetEscapes),
          vocabulary,
        )
      : undefined;

  const targetFacts = portingFacts.find((f) => f.id === to.id);
  const sourceFacts = portingFacts.find((f) => f.id === from.id);
  const characters =
    targetFacts !== undefined
      ? unsupportedCharactersForProgram(targetFacts, vocabulary)
      : [];
  const layout =
    sourceFacts !== undefined && targetFacts !== undefined
      ? statementLayoutForProgram(sourceFacts, targetFacts, vocabulary)
      : null;
  const lineNumbers =
    targetFacts !== undefined
      ? lineNumbersForProgram(targetFacts, vocabulary)
      : null;
  const collisions =
    sourceFacts !== undefined && targetFacts !== undefined
      ? variableCollisionsForProgram(sourceFacts, targetFacts, vocabulary)
      : [];
  const truncated =
    targetFacts !== undefined
      ? truncatedArithmeticForProgram(targetFacts, vocabulary)
      : null;
  const markerLoss =
    sourceFacts !== undefined && targetFacts !== undefined
      ? markerLossForProgram(sourceFacts, targetFacts, vocabulary)
      : [];
  const rangeNarrowing =
    sourceFacts !== undefined && targetFacts !== undefined
      ? integerRangeNarrowingForProgram(sourceFacts, targetFacts, vocabulary)
      : null;
  const expansions =
    targetFacts !== undefined
      ? spellingExpansionsForProgram(targetFacts, vocabulary)
      : [];
  const positions =
    sourceFacts !== undefined && targetFacts !== undefined
      ? positionsForProgram(sourceFacts, targetFacts, vocabulary)
      : null;
  const delays =
    sourceFacts !== undefined && targetFacts !== undefined
      ? delaysForProgram(sourceFacts, targetFacts, vocabulary)
      : null;
  // Gated inside `conditionallyFreeForProgram`: no size means no fit report,
  // which means no pressure, which means nothing to report here.
  const conditionallyFree =
    targetFacts !== undefined
      ? conditionallyFreeForProgram(
          targetFacts,
          vocabulary,
          programFitForTarget(targetFacts, size),
        )
      : [];

  const header = describeHeader(from, to);
  const findings = [
    describeGuidance(guidance),
    describeLanguageRuleChanges(from, to),
    describeFalseFriends(
      falseFriendsForProgram(guidance.falseFriends, vocabulary),
      from,
      to,
    ),
    // Beside the false friends, and for the same reason: these are the findings
    // that fail silently, so they lead the ones that fail loudly.
    describeVariableCollisions(collisions, to),
    // The markers sit with the collisions: both are findings about the names
    // the program already has, and both survive the port looking untouched.
    describeMarkerLoss(markerLoss, to),
    describeTruncatedArithmetic(truncated, to),
    describeIntegerRangeNarrowing(rangeNarrowing, from, to),
    // With the silent failures, because that is what they are: the layout and
    // the pauses port without an error and arrive wrong, and no command list,
    // control-code table or language rule reports either.
    describePositions(positions, from, to),
    describeDelays(delays, to),
    describeLostCommands(diff, guidance, targetTable, targetFacts, to),
    describeExpansions(expansions, to),
    describeRenames(diff.renamed),
    describeUsageChanges(diff.behaviourChanged, from, to),
    sourceEscapes !== undefined && escapes !== undefined
      ? describeLostEscapes(escapes.mustReplace, sourceEscapes, to)
      : '',
    escapes !== undefined
      ? describeChangedEscapes(escapes.behaviourChanged, from, to)
      : '',
    // Where the comparison page puts it: with the memory layout, after the
    // control codes. Empty for a pair either of whose layouts is undescribed,
    // which is the condition that leaves that page drawing no maps either.
    describeWriteLandings(
      writeLandingsForProgram(from.memoryMap, to.memoryMap, vocabulary),
      from,
      to,
    ),
    // Beside the writes: the same addresses read the wrong way round, and the
    // same condition on both machines' layouts being described.
    describeReadLandings(
      readLandingsForProgram(from.memoryMap, to.memoryMap, vocabulary),
      from,
      to,
    ),
    // After both, and not gated on either layout: a routine is machine code
    // whether or not the map that would name its address exists.
    describeMachineCode(
      machineCodeForProgram(from.memoryMap, vocabulary),
      carriesMachineCodeGuidance(guidance),
      from,
      to,
    ),
    describeCharactersToReplace(characters, to),
    describeStatementLayout(layout, to),
    describeLineNumbers(lineNumbers, to),
    // Last: it is the only section that hands back room rather than asking for
    // work, and it is read against everything above it - the lines the port has
    // to grow are what put the program under the pressure that reports it.
    describeConditionallyFreeMemory(conditionallyFree, targetFacts, to),
  ].filter((s) => s !== '');

  // An empty comparison is a finding, not an absence: without this line the
  // assistant would read the header and be left to decide for itself whether
  // the port had been worked out and come back clean, or not worked out at all.
  if (findings.length === 0) {
    return `${header}\n\nNothing this program uses is missing from the ${to.name}, spelled differently there, or treated differently there.`;
  }
  return [header, ...findings].join('\n\n');
}
