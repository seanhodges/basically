// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

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

import { hasRom } from '../dialects/bootHarness';
import { findMachine } from '../dialects/headless/runListing';
import { letterCaseFor } from '../dialects/letterCase';
import type { LetterCaseFacts } from '../dialects/letterCase';
import { locateRoms } from './roms';
import type { EditorKeyword, MemoryMap } from '../dialects/types';
import { RunError } from '../dialects/headless/runListing';

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
  keywords: KeywordDescription[];
  buildTargets: BuildTargetDescription[];
  /** Binary formats this machine's programs can be read back from. */
  binaryImports: { extension: string; label: string }[];
}

export function describeMachine(name: string): MachineDescription {
  const dialect = findMachine(name);
  if (!dialect) throw new RunError(`no registered machine "${name}"`);
  locateRoms();

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
    romPresent: hasRom(dialect),
    programRamBytes: dialect.programRamBytes,
    memoryMap: dialect.memoryMap ?? null,
    basic: {
      statementSeparator: dialect.statementSeparator,
      crunched: dialect.crunched === true,
      binaryLines: dialect.supportsBinaryLines === true,
      letterCase: letterCaseFor(dialect.id) ?? null,
      operators,
    },
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

function bytes(n: number): string {
  return `${n} bytes (${(n / 1024).toFixed(1)}K)`;
}

/**
 * The readable form: the same facts, with the keywords as bare words.
 *
 * A machine's full keyword table - every signature and every line of
 * documentation - is not something a person reads in a terminal, and it is
 * exactly what a program reading the JSON wants. So the two forms differ here
 * and nowhere else.
 */
export function formatMachineDescription(machine: MachineDescription): string {
  const { basic } = machine;
  const lines = [
    `${machine.name} (${machine.id}) - ${machine.manufacturer}, ${machine.year}`,
    machine.description,
    '',
    `BASIC          ${machine.basicDialect}${
      machine.basicFamily ? ` (${machine.basicFamily})` : ''
    }`,
    `program RAM    ${bytes(machine.programRamBytes)}`,
    `ROM here       ${machine.romPresent ? 'yes' : 'no'}`,
  ];

  if (machine.memoryMap) {
    const map = machine.memoryMap;
    const unit = map.addressUnit === 'word' ? 'words' : 'bytes';
    lines.push(
      `memory map     ${map.regions.length} regions over ${map.addressSpace} ${unit}`,
    );
  }

  lines.push(
    '',
    'BASIC RULES',
    `  statements per line  ${
      basic.statementSeparator === null
        ? 'one'
        : `separated by "${basic.statementSeparator}"`
    }`,
    `  spaces               ${
      basic.crunched ? 'ignored outside strings (crunched)' : 'significant'
    }`,
    `  binary line records  ${basic.binaryLines ? 'accepted' : 'not accepted'}`,
  );
  if (basic.letterCase) {
    const c = basic.letterCase;
    lines.push(
      `  lower-case glyphs    ${c.lowerCase}`,
      `  lower-case keywords  ${c.keywordScan}${c.lenient ? ' (the editor is lenient)' : ''}`,
      `  variable names       case ${c.nameCase}`,
      `  stored text          case ${c.encoding}`,
    );
  }
  if (basic.operators.length > 0) {
    lines.push(`  operators            ${basic.operators.join(' ')}`);
  }

  lines.push(
    '',
    `KEYWORDS (${machine.keywords.length}) - --json carries each one's signature and documentation`,
    ...wrap(machine.keywords.map((k) => k.word)),
    '',
    'BUILDS TO',
    ...machine.buildTargets.map(
      (t) =>
        `  ${t.id.padEnd(12)} ${t.label}` +
        `${t.fileExtension ? ` (.${t.fileExtension})` : ''}` +
        `${t.supportsBlocks ? ' [carries memory blocks]' : ''}`,
    ),
  );

  if (machine.binaryImports.length > 0) {
    lines.push(
      '',
      'IMPORTS FROM',
      // The extension a binary import declares carries its own dot; a build
      // target's does not.
      ...machine.binaryImports.map(
        (i) => `  ${i.extension.padEnd(12)} ${i.label}`,
      ),
    );
  }
  return `${lines.join('\n')}\n`;
}

/** Words as indented lines of at most 76 columns. */
function wrap(words: readonly string[]): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line !== '' && `${line} ${word}`.length > 76) {
      lines.push(line);
      line = '';
    }
    line = line === '' ? `  ${word}` : `${line} ${word}`;
  }
  if (line !== '') lines.push(line);
  return lines;
}
