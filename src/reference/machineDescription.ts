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
  /** Reference page slug (`Dialect.docsReference ?? Dialect.id`). */
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
  }
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
    `- Colour: ${facts.colour}`,
    `- Sound: ${facts.sound}`,
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
 * Throws when a machine has no facts entry: `facts-crosscheck.test.ts` requires
 * one per registered dialect, so a missing entry is a broken build rather than a
 * machine to describe half-way.
 */
export function describeMachine(
  machine: MachineIdentity,
  table: ReferenceTableData,
  escapes?: EscapeTableData,
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
    describeCommands(entries),
    escapes !== undefined
      ? describeEscapes(escapeTableForMachine(escapes, machine.id))
      : '',
    describeShortfalls(machine, facts),
  ];
  return sections.filter((s) => s !== '').join('\n\n');
}
