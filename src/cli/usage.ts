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
  check      check a program against what it should do
  convert    read a machine's own binary program file back into BASIC

On the machine a "run --hold" left up:

  drive      press keys and wait, through a schedule of actions
  look       report what is on the screen
  screenshot write a picture of the screen
  profile    report where the run's time and memory went
  time       report how long the run took and how it ended
  variables  report what the program's variables hold
  expect     judge the machine against written expectations
  server     start, stop, or ask after the host these run on

  lsp        serve an editor over the Language Server Protocol
  mcp        serve an agent over the Model Context Protocol

Every operation but "run" and "check" works with no ROM present. Where an operation takes a
program, the path may be "-", or left out, to read it from standard input.

The operations above act on one machine, held between commands: "run --hold" leaves the
machine it booted running, and each of them acts on it until "server stop" or a
"run --hold" for another program. The same capabilities are reachable as options on a
single "run" - --keys, --screen-text, --screenshot, --profile, --time, --variables - for a
caller that wants an answer and no machine afterwards.

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
  --hold            leave the machine running afterwards, for "drive", "look",
                    "profile" and the rest to act on; without it the machine is
                    let go when the run is reported
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

  check: `
check a program against what it should do, and report a pass or a failure

usage: basically check [file] -m <machine> -e <path> [--json]

  [file]            the program, or "-"/nothing to read standard input
  -m, --machine     the machine to check the program on
  -e, --expect      the expectations to check against, or "-" to read them
                    from standard input; needs the machine's ROM
  --json            the verdict as JSON on standard output rather than as a
                    readable report
  --rom-root <dir>  read ROMs from this public/ rather than the checkout's

A file of expectations is a schedule: the same actions "run --keys" takes,
with expectations mixed in, one per line or several separated by ";". It is
run in the order it is written, so an expectation asks what is true at that
point - and text a program prints and then clears is waited for rather than
expected at the end.

${actionLines()}

The check passes when every action was carried out and every expectation held,
and fails at the first that did not, naming its line and showing the screen as
it stood. An expectation nobody here can settle - "EXPECT SHOWS", or a reading
this machine cannot give - is reported as unevaluated and counted as neither.
A file with a line the parser cannot read, or a machine whose ROM is missing,
is refused before anything boots.
`.trimStart(),

  drive: `
act on the machine that is up, through a schedule of what to press and when

usage: basically drive '<schedule>' [--json]

  --json   report what each action did as JSON

Acts on the machine a "run --hold" left up, stopping at the first action that
fails. Actions, separated by newlines or by semicolons outside quotes:

${actionLines()}
`,

  look: `
report what is on the screen of the machine that is up

usage: basically look [--json]

  --json   report the screen as JSON rather than as lines

Costs no frames: reading the screen never advances the machine.
`,

  screenshot: `
write a picture of the screen of the machine that is up

usage: basically screenshot <file.png> [--json]

  -o, --out <file>   where to write the picture; may also be given as the
                     first argument
  --json             report the picture's size and colours as JSON
`,

  profile: `
report where the run's time and memory went, on the machine that is up

usage: basically profile [--json]

  --json   report the measurements as JSON

Every figure is in the emulated machine's own terms, so it does not depend on
the computer the run happened on. A machine that cannot report which line it is
executing says so rather than reporting nothing.
`,

  time: `
report how long the run took and how it ended, on the machine that is up

usage: basically time [--json]

  --json   report the timing as JSON
`,

  variables: `
report what the program's variables hold, on the machine that is up

usage: basically variables [--json]

  --json   report the variables as JSON
`,

  expect: `
judge the machine that is up against written expectations

usage: basically expect <checks.txt> [--json]

  -e, --expect <file>   the expectations to judge against; may also be given as
                        the first argument, or "-" for standard input
  --json                report the verdict as JSON

The same file "check" takes: a schedule of actions with EXPECT lines mixed in.
Unlike "check", which boots a machine of its own, this judges the machine a
"run --hold" left up.
`,

  server: `
start, stop, or ask after the host the toolchain runs on

usage: basically server [start|stop|status] [--json]

  start    start a host if none is running, and say where it listens
  stop     stop the running host, letting go of any machine it holds
  status   say whether a host is running, what it serves, and what it holds
           (the default)
  --json   report the answer as JSON

A host is started for you by any command that needs one, so "start" is only for
warming one up in advance. A host stops on its own once nothing has needed it
for a while.
`,
  convert: `
read a machine's own binary program file back into the BASIC it holds

usage: basically convert [file] [-m <machine>] [-o <path>]

  [file]            the machine's own program file, or "-"/nothing to read
                     standard input
  -m, --machine     the machine the file belongs to; optional when the
                     file's own extension matches exactly one registered
                     machine, and overrides that inference when both settle it
  -o, --out         where to write the recovered BASIC; standard output when
                     absent

Where the file's format matches more than one machine, the machine must be
named: the operation declines rather than guess. Anything the conversion
could not carry over - a warning, a block of bytes that is not BASIC, an
auto-start line - is reported on standard error rather than dropped. This is
the reverse of "basically build"; that is where the other direction lives.
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

  mcp: `
serve an agent over the Model Context Protocol

usage: basically mcp --stdio [-m <machine>]

  --stdio           the only transport; required
  -m, --machine     a machine every request defaults to, when nothing is
                    specified by the program or caller; optional

Every operation this command line has is offered to the client, and one machine
is held between requests: running a program leaves it up, so the client can
look at it, act on it, measure it and check it without running the program
again. Running a second program lets the first machine go, and disconnecting
lets go of whatever is up.

Point your client's server configuration at this command - most clients run a
server as a child process over stdio. For example, a generic client config
might read:

  { "command": "basically", "args": ["mcp", "--stdio"] }

The server holds its streams open for the conversation and has no verdict to
report, so it exits 0 when the client disconnects; starting it with a bad
option, or a machine that is not registered, exits 1 without serving anything.
`.trimStart(),
};

/** The summary, or one operation's own help. */
export function usage(topic?: Operation): string {
  return topic === undefined ? SUMMARY : OPERATION_USAGE[topic];
}
