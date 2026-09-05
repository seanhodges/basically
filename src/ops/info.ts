/**
 * One machine described in full, from what the machine itself declares.
 *
 * Everything below is read off the dialect - its memory budget and map, its
 * BASIC's rules, its keyword table, its build targets and its binary imports -
 * so a machine cannot be described here in terms it does not answer to. Nothing
 * is duplicated into a table beside the registry, and nothing here boots a
 * machine or reads a ROM: this is what a person or a program needs in order to
 * write BASIC for the machine, not to run it.
 */

import { letterCaseFor } from '../dialects/letterCase';
import type { LetterCaseFacts } from '../dialects/letterCase';
import { keyVocabulary } from '../keyboard/keyNames';
import type { EditorKeyword, MemoryMap } from '../dialects/types';
import { RunError } from '../dialects/headless/runError';
import { requireMachine } from './resolve';
import type { OpContext, Operation } from './types';

/** A keyword as the machine's own table spells and documents it. */
export type KeywordDescription = EditorKeyword;

export interface BuildTargetDescription {
  id: string;
  label: string;
  /** Extension without the dot, absent for a target that writes no file. */
  fileExtension?: string;
  /** Whether this target carries the document's memory blocks. */
  supportsBlocks: boolean;
}

/** What this machine's BASIC makes of the text of a program. */
export interface BasicRules {
  /** What separates two statements on a line, or null for one per line. */
  statementSeparator: string | null;
  /** Whether the ROM ignores spaces and takes the longest keyword it can. */
  crunched: boolean;
  /** Whether the tokenizer takes `#BIN` verbatim line records. */
  binaryLines: boolean;
  /** What the machine makes of letter case, in its four independent parts. */
  letterCase: LetterCaseFacts | null;
  /**
   * Every operator spelling this BASIC has: the symbolic entries in the keyword
   * table plus the ones the machine stores as plain characters and so declares
   * separately.
   */
  operators: string[];
}

export interface MachineDescription {
  id: string;
  name: string;
  manufacturer: string;
  year: number;
  /** The BASIC this machine runs, as its own documentation names it. */
  basicDialect: string;
  /** The family that BASIC belongs to, where it is not the version's own name. */
  basicFamily?: string;
  description: string;
  /** Whether this installation carries the machine's ROM. */
  romPresent: boolean;
  /** Bytes a BASIC program may occupy, as the machine's byte counter budgets it. */
  programRamBytes: number;
  /** The machine's address space, where it declares one. */
  memoryMap: MemoryMap | null;
  basic: BasicRules;
  /** The key names this machine answers to when a run is given a schedule. */
  keys: string[];
  keywords: KeywordDescription[];
  buildTargets: BuildTargetDescription[];
  /** Binary formats this machine's programs can be read back from. */
  binaryImports: { extension: string; label: string }[];
}

export interface InfoInput {
  /** A machine's id or name; the context's default machine when absent. */
  machine?: string;
}

export function describeMachine(
  input: InfoInput,
  ctx: OpContext,
): MachineDescription {
  const name = input.machine ?? ctx.defaultMachine;
  if (name === undefined) {
    throw new RunError('info wants a machine (basically machines lists them)');
  }
  const dialect = requireMachine(name);

  const symbolic = dialect.keywords
    .filter((k) => k.kind === 'operator')
    .map((k) => k.word);
  const operators = [...new Set([...symbolic, ...(dialect.operators ?? [])])];

  return {
    id: dialect.id,
    name: dialect.name,
    manufacturer: dialect.manufacturer,
    year: dialect.year,
    basicDialect: dialect.basicDialect,
    basicFamily: dialect.basicFamily,
    description: dialect.blurb,
    romPresent: ctx.roms.present(dialect),
    programRamBytes: dialect.programRamBytes,
    memoryMap: dialect.memoryMap ?? null,
    basic: {
      statementSeparator: dialect.statementSeparator,
      crunched: dialect.crunched === true,
      binaryLines: dialect.supportsBinaryLines === true,
      letterCase: letterCaseFor(dialect.id) ?? null,
      operators,
    },
    keys: keyVocabulary(dialect.keyboardLayout),
    keywords: dialect.keywords.map((k) => ({
      word: k.word,
      kind: k.kind,
      signature: k.signature,
      doc: k.doc,
    })),
    buildTargets: dialect.buildTargets.map((t) => ({
      id: t.id,
      label: t.label,
      fileExtension: t.fileExtension,
      supportsBlocks: t.supportsBlocks === true,
    })),
    binaryImports: (dialect.binaryImports ?? []).map((i) => ({ ...i })),
  };
}

/**
 * The description as a model is told it: the facts a program is written
 * against, with the keywords as bare words. The full keyword table is in the
 * system prompt already, so repeating every signature here would only cost.
 */
export function describeMachineForModel(machine: MachineDescription): string {
  const { basic } = machine;
  const lines = [
    `${machine.name} (${machine.id}) - ${machine.manufacturer}, ${machine.year}. ${machine.description}`,
    `BASIC: ${machine.basicDialect}${machine.basicFamily ? ` (${machine.basicFamily})` : ''}.`,
    `Program RAM: ${machine.programRamBytes} bytes. ROM here: ${machine.romPresent ? 'yes' : 'no'}.`,
    `Statements per line: ${
      basic.statementSeparator === null
        ? 'one'
        : `several, separated by "${basic.statementSeparator}"`
    }. Spaces: ${basic.crunched ? 'ignored outside strings' : 'significant'}. ` +
      `Binary line records: ${basic.binaryLines ? 'accepted' : 'not accepted'}.`,
  ];
  if (basic.letterCase) {
    const c = basic.letterCase;
    lines.push(
      `Letter case: lower-case glyphs ${c.lowerCase}; lower-case keywords ${c.keywordScan}; ` +
        `variable names case ${c.nameCase}; stored text case ${c.encoding}.`,
    );
  }
  if (basic.operators.length > 0) {
    lines.push(`Operators: ${basic.operators.join(' ')}`);
  }
  lines.push(
    `Keys a schedule may press (${machine.keys.length}): ${machine.keys.join(', ')}`,
    `Keywords (${machine.keywords.length}): ${machine.keywords.map((k) => k.word).join(' ')}`,
    'Builds to: ' +
      machine.buildTargets
        .map(
          (t) =>
            `${t.id} (${t.label}${t.fileExtension ? `, .${t.fileExtension}` : ''})`,
        )
        .join('; '),
  );
  if (machine.binaryImports.length > 0) {
    lines.push(
      'Imports from: ' +
        machine.binaryImports
          .map((i) => `${i.extension} (${i.label})`)
          .join('; '),
    );
  }
  return lines.join('\n');
}

export const infoOp: Operation<InfoInput, MachineDescription> = {
  name: 'info',
  summary: 'Describe one machine: its memory, rules, keywords and formats.',
  description:
    'Describe a machine from what it declares: its BASIC and the rules that ' +
    'BASIC has for the text of a program, its program RAM, the key names a ' +
    'schedule may press, its keywords, and the file formats it builds to and ' +
    'reads from. Nothing is booted. With no machine named, describes the one ' +
    'this conversation is for.',
  input: {
    type: 'object',
    properties: {
      machine: {
        type: 'string',
        description: "A machine's id or name; this conversation's when absent.",
      },
    },
    additionalProperties: false,
  },
  needs: 'roms',
  cli: { kind: 'operation', name: 'info' },
  assistant: { kind: 'tool' },
  mcp: { kind: 'tool' },
  run: describeMachine,
  describe: describeMachineForModel,
};
