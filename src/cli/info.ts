// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A machine's description as a person reads it in a terminal. The facts are
 * the `info` operation's (`src/ops/info.ts`); only this layout is the command
 * line's.
 */

import type { MachineDescription } from '../ops/info';

export type { MachineDescription } from '../ops/info';

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
    `KEYS (${machine.keys.length}) - what "basically run --keys" may press here`,
    ...wrap(machine.keys),
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
