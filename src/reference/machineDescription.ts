// The machine, described to the AI assistant from the same tables the
// documentation site renders.
//
// Everything here is read from the reference data next door, which the
// crosscheck tests pin to the real dialects - so what the assistant is told and
// what the user is shown cannot disagree, and every machine is described to the
// same standard rather than from a more famous relative.
//
// Pure and framework-free, like ./compare.ts: it takes the machine's identity
// and its reference table, reads its siblings for the rest, and returns a
// string. Nothing here reaches the dialect registry or an emulator core.
//
// **The output must be byte-stable for a given machine.** The composed system
// prompt is what the providers' prefix caching keys on, so every section is
// derived from module-level constants through pure functions in a fixed order,
// with an explicit sort and no iteration-order dependence.
import { sortEntries } from './sort';
import { escapeTableForMachine, tableForMachine } from './compare';
import { KEYWORD_DOMAINS, type KeywordDomain } from './domains';
import { domainGuidance } from './domain-guidance';
import { portingFacts } from './facts';
import type { MemoryMap } from '../dialects/types';
import type {
  EscapeTableData,
  PortingFacts,
  ReferenceEntry,
  ReferenceTableData,
} from './types';

/**
 * Who the machine is, as the app already knows it. Taken as an argument rather
 * than looked up, so this module never needs the dialect registry - the caller
 * has a `Dialect` in hand and these are four of its existing fields plus the
 * docs page it reads from.
 */
export interface MachineIdentity {
  /** Dialect id, e.g. 'vic20'. Selects this machine's rows and facts. */
  id: string;
  name: string;
  manufacturer: string;
  year: number;
  /** Reference page slug, as `referencePageOf` in src/dialects/ derives it. */
  page: string;
}

/**
 * How a keyword's capability domain is titled in the command list.
 *
 * Exported for `./portDescription.ts`, which titles the same domains in the
 * per-port findings: the standing machine description and the findings sent with
 * a request are read as one document, so "Memory and hardware" must not become
 * "Memory & hardware" halfway down it.
 */
export const DOMAIN_TITLES: Record<KeywordDomain, string> = {
  'control-flow': 'Control flow',
  data: 'Data',
  numeric: 'Numbers',
  strings: 'Strings',
  'text-screen': 'Text screen',
  graphics: 'Graphics',
  colour: 'Colour',
  sound: 'Sound',
  input: 'Input',
  storage: 'Storage',
  'memory-hardware': 'Memory and hardware',
  'program-editing': 'Program editing',
  'error-handling': 'Error handling',
};

/** `15360` → `15,360`, without depending on the runtime's locale. */
function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function describeIdentity(
  machine: MachineIdentity,
  facts: PortingFacts,
): string {
  const lines = [
    `- ${machine.manufacturer} ${machine.name} (${machine.year}), running ${facts.basicDialect}.`,
    `- ${groupDigits(facts.freeRamBytes)} bytes free for BASIC.`,
  ];
  if (facts.programStart !== undefined) {
    lines.push(`- The BASIC program area starts at ${facts.programStart}.`);
  }
  if (facts.screenBase !== undefined) {
    lines.push(`- Screen memory starts at ${facts.screenBase}.`);
  }
  return `THIS MACHINE\n${lines.join('\n')}`;
}

function describeLanguageRules(facts: PortingFacts): string {
  const lines = [`- Line numbers: ${facts.lineNumberRange}.`];
  lines.push(
    facts.statementSeparator === null
      ? '- ONE statement per line: this machine has no statement separator.'
      : `- Several statements fit on a line, separated by ${facts.statementSeparator}.`,
  );
  lines.push(
    facts.elseSupported
      ? '- IF … THEN … ELSE is available.'
      : '- There is NO ELSE: put the negative case on another line, or invert the test.',
  );
  switch (facts.letRequired) {
    case 'required':
      lines.push('- LET is REQUIRED on every assignment.');
      break;
    case 'optional':
      lines.push('- LET is optional on assignments.');
      break;
    case 'none':
      lines.push('- There is no LET keyword; assign directly.');
      break;
  }
  lines.push(`- Variable names: ${facts.variableNaming}`);
  lines.push(`- Numbers: ${facts.numberHandling}`);
  if (facts.exponentOperator !== undefined) {
    lines.push(`- Raise to a power with ${facts.exponentOperator}.`);
  } else {
    lines.push('- There is no power operator; multiply or loop instead.');
  }
  // Bitwise-vs-value logic and the truth value are the two facts an assistant
  // writing for the wrong machine gets wrong silently. It generates `IF A AND B`
  // and `X=X+(A>B)` with Microsoft habits, both of which a Spectrum accepts and
  // then answers differently.
  lines.push(
    facts.logicalOperators === 'bitwise'
      ? '- AND, OR and NOT combine their operands bit by bit on integers.'
      : facts.logicalOperators === 'logical'
        ? '- AND, OR and NOT are NOT bitwise: they reduce their operands to a truth value, so A AND B and A OR B are 1 or 0 and NOT 5 is 0.'
        : '- AND, OR and NOT are NOT bitwise: A AND B is A when B is non-zero and 0 otherwise; A OR B is 1 when B is non-zero and A otherwise.',
  );
  lines.push(
    `- A true comparison evaluates to ${facts.comparisonTrue}; false is 0.`,
  );
  const integer = [
    facts.integerDivisionOperator &&
      `integer division is ${facts.integerDivisionOperator}`,
    facts.remainderOperator && `remainder is ${facts.remainderOperator}`,
    facts.xorOperator && `exclusive-OR is ${facts.xorOperator}`,
  ].filter(Boolean);
  lines.push(
    integer.length === 0
      ? '- There is no integer-division, remainder or exclusive-OR operator; use INT(a/b) and a-b*INT(a/b).'
      : `- Where they exist: ${integer.join(', ')}.`,
  );
  const notation =
    facts.addressNotation === 'hex'
      ? `hexadecimal${facts.hexPrefix !== undefined ? ` (written ${facts.hexPrefix}nnnn)` : ''}`
      : 'decimal';
  lines.push(
    `- Writing to memory: ${facts.memoryWriteSyntax} — addresses in ${notation}.`,
  );
  return `LANGUAGE RULES\n${lines.join('\n')}`;
}

/**
 * The printable characters this machine simply does not have.
 *
 * Empty string for a machine that covers printable ASCII, rather than a heading
 * saying it lacks nothing: a section with nothing under it is something to
 * reason about, and the absence says the same thing at no cost. It also keeps
 * this block constant per machine, which is what the byte-stability the
 * providers' prefix caching depends on is made of.
 *
 * Stated as "anywhere in a program" because the mistake it prevents is the
 * subtle one. That a ZX81 has no `!` is easy to accept for a variable name and
 * easy to forget for `PRINT "HELLO!"` - and the charset does not care which it
 * is.
 */
function describeCharacterSet(facts: PortingFacts): string {
  if (facts.unsupportedCharacters.length === 0) return '';
  return [
    'CHARACTERS THIS MACHINE DOES NOT HAVE',
    `- ${facts.unsupportedCharacters.join(' ')}`,
    '- These have no glyph on this machine and cannot appear anywhere in a program — not in a string, not in a REM, not in a name. Rewrite the text rather than using one.',
  ].join('\n');
}

/**
 * How this machine spells the control codes its character set holds.
 *
 * The counterpart to the command list: the assistant is told which control codes
 * a port must replace, and without this it has no way to write the replacement.
 * Grouped by what the codes do, in the table's own category order, which is
 * editorial - the codes a screen layout depends on lead.
 *
 * Operand-carrying forms keep their placeholder spelling (`{INK n}`), because
 * that is the row's own spelling and the description says what the operand is.
 */
function describeEscapes(escapes: EscapeTableData): string {
  const shown = escapes.entries.filter((e) => e.parseOnly !== true);
  if (shown.length === 0) return '';
  const parts = ['CONTROL CODES, AND HOW THIS MACHINE SPELLS THEM'];
  for (const category of escapes.categories) {
    const inCategory = shown.filter((e) => e.category === category.id);
    if (inCategory.length === 0) continue;
    parts.push(
      `\n${category.label}:\n${inCategory
        .map((e) => `- ${e.escape}: ${e.description}`)
        .join('\n')}`,
    );
  }
  return parts.join('\n');
}

function describeCapabilities(facts: PortingFacts): string {
  return [
    'SCREEN, COLOUR AND SOUND',
    `- Screen: ${facts.screen}`,
    // The prose above says the same thing in the fact rows' own words, which is
    // not something a print position can be checked against. These two numbers
    // are, and they are the boot screen's - the one a program lands on before it
    // selects anything else.
    `- The text screen at switch-on is ${facts.textScreen.columns} columns by ${facts.textScreen.rows} rows, so columns run 0-${facts.textScreen.columns - 1} and rows 0-${facts.textScreen.rows - 1}. Do not print outside that.`,
    `- Colour: ${facts.colour}`,
    `- Sound: ${facts.sound}`,
  ].join('\n');
}

/**
 * How long a program waits here, and how long it takes to do anything.
 *
 * Both halves of the same fact. A pause written as a counting loop is a duration
 * expressed in this machine's speed, so a count copied from another machine -
 * or recalled from one - runs for a different length of time, and nothing about
 * the program says so. The speed is quoted as the emulator's because that is
 * where it was measured and what the user will actually see; claiming it of the
 * original hardware would be a stronger statement than the measurement supports.
 *
 * The wait idiom leads: a delay put on the machine's own clock needs no speed
 * figure at all, which is why it is the better answer whenever the machine has
 * one.
 */
function describeTiming(facts: PortingFacts): string {
  const lines = [`- Wait with ${facts.waitIdiom.text}.`];
  if (facts.loopSpeed !== undefined) {
    lines.push(
      `- An empty counting loop runs about ${groupDigits(facts.loopSpeed)} iterations a second here, measured in this IDE's own emulator — not a figure about the original hardware. A delay written as a counting loop is that speed written into the program, so pick counts against this figure rather than from habit.`,
    );
  }
  return `TIMING AND WAITING\n${lines.join('\n')}`;
}

/**
 * An address in this machine's own notation: `&3000`, `#8400`, `53280`.
 *
 * Shared with `./portDescription.ts` so a region named in the standing machine
 * description and the same region named in a port's findings are written the
 * same way - the two are read as one document, and a reader who has to work out
 * that `&5C00` and `23552` are one address is doing the work this is for.
 */
export function formatAddress(
  value: number,
  facts: PortingFacts | undefined,
): string {
  if (facts?.addressNotation !== 'hex') return `${value}`;
  return `${facts.hexPrefix ?? '&'}${value.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * Where things are in memory, for a program that addresses it directly.
 *
 * The machine's whole layout rather than the two addresses the identity section
 * already names, because a program that reads memory is asking for something
 * particular - the keyboard, a clock, the system variables - and the address it
 * needs is only findable if the regions are named. A read of the wrong address
 * does not fail: it returns a number that means nothing, which is the quietest
 * way a generated program can be wrong.
 *
 * ROM is called out on top of whatever the region's own note says, because it is
 * the one region where a write is accepted and does nothing at all, and not
 * every note mentions it.
 *
 * Absent for a machine whose dialect declares no map. Half a layout is worse
 * than none here - an address absent from a partial list looks like an address
 * the machine does not have.
 */
function describeMemoryMap(map: MemoryMap, facts: PortingFacts): string {
  const lines = map.regions.map((region) => {
    const span = `${formatAddress(region.start, facts)}-${formatAddress(region.end, facts)}`;
    const readOnly = region.kind === 'rom' ? ' [read-only]' : '';
    const note = region.note !== undefined ? ` ${region.note}` : '';
    return `- ${span} ${region.label}${readOnly}:${note}`;
  });
  if (map.udgBase !== undefined) {
    lines.push(
      `- User-defined graphics start at ${formatAddress(map.udgBase, facts)}.`,
    );
  }
  return [
    'WHERE THINGS ARE IN MEMORY',
    `- The address space runs ${formatAddress(0, facts)}-${formatAddress(map.addressSpace - 1, facts)}. There is nothing above that to address.`,
    ...lines,
  ].join('\n');
}

/** One command's line: name, syntactic class, usage, what it does. */
function describeEntry(entry: ReferenceEntry): string {
  const tag = entry.tag !== undefined ? ` [${entry.tag}]` : '';
  return `- ${entry.name} (${entry.kind})${tag}: ${entry.syntax} — ${entry.description}`;
}

/**
 * Every command, function and operator this machine has, grouped by what it is
 * for. Grouped rather than alphabetical because the mistake being prevented is
 * reaching for a command the machine does not have: a model scanning "Graphics"
 * sees at once what this machine's graphics actually are.
 */
function describeCommands(entries: ReferenceEntry[]): string {
  const parts = [
    'EVERY COMMAND, FUNCTION AND OPERATOR THIS MACHINE HAS',
    'This list is complete. If a word is not in it, this machine does not have it — do not use it.',
  ];
  for (const domain of KEYWORD_DOMAINS) {
    const inDomain = entries.filter((e) => e.domain === domain);
    if (inDomain.length === 0) continue;
    parts.push(
      `\n${DOMAIN_TITLES[domain]}:\n${sortEntries(inDomain, 'name', 'asc')
        .map(describeEntry)
        .join('\n')}`,
    );
  }
  // Rows carrying no domain would otherwise vanish silently. Every BASIC row has
  // one (BasicReferenceTableData makes it mandatory), so this is a guard against
  // a future table, not a case that fires today.
  const undomained = entries.filter((e) => e.domain === undefined);
  if (undomained.length > 0) {
    parts.push(
      `\nOther:\n${sortEntries(undomained, 'name', 'asc')
        .map(describeEntry)
        .join('\n')}`,
    );
  }
  return parts.join('\n');
}

/**
 * What to do where this machine is short of a capability, and what to write in
 * place of a command it does not have.
 *
 * Both halves are anchored to this machine rather than to a pair of them, so
 * they are correct whatever the user is used to writing - which is the point:
 * the advice already written for exactly this case beats the model's memory of
 * how a different machine does it.
 */
function describeShortfalls(
  machine: MachineIdentity,
  facts: PortingFacts,
): string {
  const cells = domainGuidance
    .filter((g) => g.to === machine.page && g.support !== 'full')
    .slice()
    .sort(
      (a, b) =>
        KEYWORD_DOMAINS.indexOf(a.domain) - KEYWORD_DOMAINS.indexOf(b.domain),
    );
  const lines: string[] = [];
  for (const cell of cells) {
    if (cell.instead === undefined) continue;
    lines.push(
      `- ${DOMAIN_TITLES[cell.domain]} (${cell.support === 'none' ? 'not supported' : 'partial'}): ${cell.instead}`,
    );
    if (cell.example !== undefined) {
      lines.push(`  ${cell.example.caption}:`);
      for (const code of cell.example.code) lines.push(`    ${code}`);
    }
  }
  if (facts.substitutions.length > 0) {
    // Labelled by the command the writer went looking for, because only about
    // half the notes name it themselves - the rest answer straight into what to
    // write instead ("Write ?addr=val for a byte"), which is useless without
    // knowing the question it answers.
    lines.push(
      '\nCommands this machine does NOT have, and what to write instead:',
    );
    for (const sub of facts.substitutions) {
      lines.push(`- ${sub.keyword} → ${sub.note}`);
    }
  }
  if (lines.length === 0) return '';
  return `WHERE THIS MACHINE IS SHORT\n${lines.join('\n')}`;
}

/**
 * The machine's whole language definition, as the assistant is told it.
 *
 * `table` is the machine's reference page, passed in because the caller loads it
 * on demand - one page per chunk, so a session pays only for the machines it
 * actually talks about.
 *
 * `memoryMap` comes from the dialect rather than from the reference data, and is
 * passed in for the same reason `table` is: this module never reaches the
 * registry, and the caller already holds the `Dialect`. Optional because a
 * dialect may declare no map, in which case the machine is described without one
 * exactly as the porting guide draws none.
 *
 * Throws when a machine has no facts entry: `facts-crosscheck.test.ts` requires
 * one per registered dialect, so a missing entry is a broken build rather than a
 * machine to describe half-way.
 */
export function describeMachine(
  machine: MachineIdentity,
  table: ReferenceTableData,
  escapes?: EscapeTableData,
  memoryMap?: MemoryMap,
): string {
  const facts = portingFacts.find((f) => f.id === machine.id);
  if (facts === undefined) {
    throw new Error(`no porting facts for machine "${machine.id}"`);
  }
  const entries = tableForMachine(table, machine.id).entries;
  const sections = [
    describeIdentity(machine, facts),
    describeLanguageRules(facts),
    // Between the language rules and the hardware, where it belongs: what the
    // machine will accept as a program, not what it can draw.
    describeCharacterSet(facts),
    describeCapabilities(facts),
    // With the hardware it is a property of, and above the command list rather
    // than below it: a delay is written while the program is being planned, and
    // the command list is long enough to bury anything after it.
    describeTiming(facts),
    memoryMap !== undefined ? describeMemoryMap(memoryMap, facts) : '',
    describeCommands(entries),
    escapes !== undefined
      ? describeEscapes(escapeTableForMachine(escapes, machine.id))
      : '',
    describeShortfalls(machine, facts),
  ];
  return sections.filter((s) => s !== '').join('\n\n');
}
