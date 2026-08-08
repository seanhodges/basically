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
  diffEscapes,
  diffForProgram,
  diffKeywords,
  escapeDiffForProgram,
  escapeSections,
  escapeTableForMachine,
  falseFriendsForProgram,
  lineNumbersForProgram,
  statementLayoutForProgram,
  tableForMachine,
  unsupportedCharactersForProgram,
  type EscapeChange,
  type FalseFriendWarning,
  type KeywordChange,
  type KeywordDiff,
  type KeywordRename,
  type LineNumberChange,
  type PairGuidance,
  type ProgramVocabulary,
  type StatementLayoutChange,
} from './compare';
import { domainGuidance } from './domain-guidance';
import { KEYWORD_DOMAINS } from './domains';
import { portingFacts } from './facts';
import { DOMAIN_TITLES, type MachineIdentity } from './machineDescription';
import { falseFriends, keywordEquivalences, pairPortingNotes } from './porting';
import type {
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
    // Per-command advice still sits with its command, as it does on the page.
    for (const entry of section.entries) {
      const note = guidance.substitutions.get(entry.name);
      if (note !== undefined) lines.push(`  - ${entry.name} → ${note}`);
    }
  }
  return `COMMANDS THIS PROGRAM USES THAT ${to.name.toUpperCase()} DOES NOT HAVE\n${lines.join('\n')}`;
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
  // few enough of them that each can afford one. The category still orders them,
  // which is what `escapeSections` is for - the source table's category order is
  // editorial, so the codes a screen layout depends on lead.
  const lines = escapeSections(entries, sourceEscapes).flatMap((s) =>
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

  const header = describeHeader(from, to);
  const findings = [
    describeGuidance(guidance),
    describeLanguageRuleChanges(from, to),
    describeFalseFriends(
      falseFriendsForProgram(guidance.falseFriends, vocabulary),
      from,
      to,
    ),
    describeLostCommands(diff, guidance, targetTable, to),
    describeRenames(diff.renamed),
    describeUsageChanges(diff.behaviourChanged, from, to),
    sourceEscapes !== undefined && escapes !== undefined
      ? describeLostEscapes(escapes.mustReplace, sourceEscapes, to)
      : '',
    escapes !== undefined
      ? describeChangedEscapes(escapes.behaviourChanged, from, to)
      : '',
    describeCharactersToReplace(characters, to),
    describeStatementLayout(layout, to),
    describeLineNumbers(lineNumbers, to),
  ].filter((s) => s !== '');

  // An empty comparison is a finding, not an absence: without this line the
  // assistant would read the header and be left to decide for itself whether
  // the port had been worked out and come back clean, or not worked out at all.
  if (findings.length === 0) {
    return `${header}\n\nNothing this program uses is missing from the ${to.name}, spelled differently there, or treated differently there.`;
  }
  return [header, ...findings].join('\n\n');
}
