// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The command line's help text: the summary, and one block per operation.
 *
 * Plain strings rather than anything derived from {@link parseArgs}, because
 * what an option means is not something a parser knows - and a caller reading
 * help wants the sentence, not the shape.
 */

import { DRIVE_ACTIONS } from '../app/driveScript';
import type { Operation } from './args';

/** The actions a schedule accepts, as help lists them: syntax, then meaning. */
function actionLines(): string {
  const width = 29;
  const rows = [
    ...DRIVE_ACTIONS.map((a) => [a.syntax, a.meaning]),
    ['# ...', 'a comment'],
  ];
  return rows
    .map(([syntax, meaning]) => {
      const words = meaning!.split(' ');
      const lines: string[] = [];
      let line = '';
      for (const word of words) {
        if (line !== '' && `${line} ${word}`.length > 78 - width - 2) {
          lines.push(line);
          line = '';
        }
        line = line === '' ? word : `${line} ${word}`;
      }
      lines.push(line);
      const head = `  ${syntax!.padEnd(width)}${syntax!.length > width ? '  ' : ''}`;
      return [
        `${head}${lines[0]}`,
        ...lines.slice(1).map((l) => `${' '.repeat(width + 2)}${l}`),
      ].join('\n');
    })
    .join('\n');
}

const SUMMARY = `
the Basically toolchain, outside the browser

usage: basically <operation> [options]

  machines   list every machine, and whether its ROM is here
  info       describe one machine: its memory, rules, keywords and formats
  lint       report a program's problems without running it
  build      write a program as a file the machine loads
  run        run a program and report its screen
  lsp        serve an editor over the Language Server Protocol

Every operation but "run" works with no ROM present. Where an operation takes a
program, the path may be "-", or left out, to read it from standard input.

"basically <operation> --help" says what one operation takes.
`.trimStart();

const OPERATION_USAGE: Record<Operation, string> = {
  machines: `
list every registered machine

usage: basically machines [--json]

  --json   report the machines as JSON rather than a table
`.trimStart(),

  info: `
describe one machine in full: no ROM is read and no machine is booted

usage: basically info <machine> [--json]

  <machine>   a machine's id or its name, e.g. zx81 or "ZX Spectrum"
  --json      the whole description, including every keyword's signature and
              documentation, rather than a readable summary
`.trimStart(),

  lint: `
report a program's problems without running it: no ROM, no emulator

usage: basically lint [file] [-m <machine>] [--json]

  [file]            the program, or "-"/nothing to read standard input
  -m, --machine     the machine to check the program against; optional when
                    the program declares one with a "#MACHINE <machine>" line,
                    and overrides the declaration when both are given
  --json            the problems as JSON rather than one per line

The problems go to standard output; the exit code says whether any was fatal.
`.trimStart(),

  build: `
write a program as the transfer format its machine really loads

usage: basically build [file] [-m <machine>] -o <path> [-t <target>]
                       [--program-name <name>]

  [file]            the program, or "-"/nothing to read standard input
  -m, --machine     the machine to build for; optional when the program
                    declares one with a "#MACHINE <machine>" line, and
                    overrides the declaration when both are given
  -o, --out         where to write the first file produced
  -t, --target      a build target id (basically info lists them); by default
                    the target whose extension matches --out, else the
                    machine's first
  --program-name    the name the machine stores the program under; derived
                    from --out when absent

A format that is more than one file writes the rest beside --out under their
own names. Every path written is reported on standard error.
`.trimStart(),

  run: `
run a program on its machine and report what the screen shows

usage: basically run [file] -m <machine> [options]

  [file]            the program, or "-"/nothing to read standard input
  -m, --machine     the machine to run on
  --frames <n>      run exactly n frames instead of waiting for the program;
                    with --keys, n more frames after the schedule
  --max-frames <n>  cap on that wait (default 4000); not with --keys
  --keys <script>   a schedule of what to press and when (see below); needs
                    the machine's ROM
  --screen-text     report the screen as text (the default when nothing else
                    is asked for)
  --screenshot <p>  write a picture of the screen to p; may be asked for
                    alongside --screen-text, from the same run
  --profile         report where the run's time and memory went: the
                    costliest lines as shares of the run, summed over the
                    program's routines, and BASIC RAM over the run
  --time            report how long the run took, in the machine's own time,
                    and how it ended
  --variables       report what the program's variables hold at the end
  --json            one JSON object on standard output instead of the text
  --rom-root <dir>  read ROMs from this public/ rather than the checkout's

A schedule is one action per line, or several separated by ";". A run given one
ends where the schedule ends, so the screen reported is the one the last action
left, and a step that could not be carried out fails the run.

${actionLines()}

Keys are named the same way on every machine - the letters, the digits, SPACE,
ENTER and SHIFT everywhere, and DELETE, ESCAPE, CTRL, TAB, the cursor keys and
the function keys wherever the machine has them. "basically info <machine>"
lists the names that machine answers to.
`.trimStart(),

  lsp: `
serve an editor over the Language Server Protocol: no ROM, no emulator

usage: basically lsp --stdio [-m <machine>]

  --stdio           the only transport; required
  -m, --machine     a machine every document defaults to, when the editor
                    sets none of its own; optional, since a listing's own
                    "#MACHINE" declaration or the editor's own setting can say
                    later, once the server has started

Point your editor's language-client configuration at this command - most
editors run a language server as a child process over stdio. For example, a
generic LSP client config might read:

  { "command": "basically", "args": ["lsp", "--stdio"] }

The server holds its streams open for the conversation and has no verdict to
report, so it exits 0 when the editor disconnects; starting it with a bad
option, or a machine that is not registered, exits 1 without serving anything.
`.trimStart(),
};

/** The summary, or one operation's own help. */
export function usage(topic?: Operation): string {
  return topic === undefined ? SUMMARY : OPERATION_USAGE[topic];
}
