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
import { REPO_ATTRIBUTION_URL } from './romCache';

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
A CLI for Basically - write, run and ship games and programs for real hardware from your 
browser. https://ba.sical.ly/

usage: basically <operation> [options]

  machines   list all the machines Basically can support
  info       describe a machine: memory, rules, keywords, formats
  lint       check for problems in a source listing
  build      write a program as a tape or disk file the machine can load
  run        run a program headless, report what the screen shows, and how it ended (ROM required)
  check      check a program against an assertion script, report a pass or failure (ROM required)
  convert    read a tape or disk file back into source code

"run --hold" leaves a machine running until stopped, the following operations act on the running machine:

  drive      press keys and wait, through a schedule of actions
  look       report what is on the screen
  screenshot write a picture of the screen
  view       project the screen to an address a web view can be pointed at
  profile    report where the run's time and memory went
  time       report how long the run took and how it ended
  variables  report what the program's variables hold
  expect     judge the machine against written expectations
  server     start, stop, or ask after the host these run on

Other CLI-specific modes and operations:

  roms       say where the machine ROM images come from, obtain them, discard them
  lsp        serve an editor over the Language Server Protocol
  mcp        serve an agent over the Model Context Protocol

 Where an operation takes a program, the path may be "-", or left out, to read it from 
 standard input.

"basically <operation> --help" says what one operation takes. Some operations require 
ROM images. See "basically roms --help".
`.trimStart();

const OPERATION_USAGE: Record<Operation, string> = {
  machines: `
list every registered machine, and whether this installation can run it

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

Error messages go to standard output; the exit code says whether any was fatal.
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
`.trimStart(),

  run: `
run a program on its machine and report what the screen shows

usage: basically run [file] -m <machine> [options]

  [file]            the program, or "-"/nothing to read standard input
  -m, --machine     the machine to run on
  --frames <n>      run exactly n frames instead of waiting for the program;
                    with --keys, n more frames after the keys are pressed
  --max-frames <n>  cap on that wait (default 4000); not with --keys
  --keys <script>   a schedule of keys to press and when (see below); needs
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
  --rom-root <dir>  read ROMs from this directory rather than from where the
                    toolchain was installed; overrides BASICALLY_ROM_ROOT,
                    which says the same thing once for the installation

A --keys script is one action per line, or several separated by ";".

${actionLines()}

Keys are named the same way on every machine - the letters, the digits, SPACE,
ENTER and SHIFT everywhere, and DELETE, ESCAPE, CTRL, TAB, the cursor keys and
the function keys wherever the machine has them. "basically info <machine>"
lists the keys that machine answers to.
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
  --rom-root <dir>  read ROMs from this directory rather than from where the
                    toolchain was installed; overrides BASICALLY_ROM_ROOT,
                    which says the same thing once for the installation

A file of expectations is a script: the same actions "run --keys" takes,
with expectations mixed in, one per line or several separated by ";".

${actionLines()}
`.trimStart(),

  drive: `
act on the running machine, through a script of what to press and when

usage: basically drive '<script>' [--json]

  --json   report what each action did as JSON

Acts on the machine a "run --hold" left up, stopping at the first action that
fails. Actions, separated by newlines or by semicolons outside quotes:

${actionLines()}
`,

  look: `
show what's on the screen of the running machine

usage: basically look [--json]

  --json   report the screen as JSON rather than as lines
`,

  screenshot: `
save a picture of the screen of the running machine

usage: basically screenshot <file.png> [--json]

  -o, --out <file>   where to write the picture; may also be given as the
                     first argument
  --json             report the picture's size and colours as JSON
`,

  view: `
project the screen of the running machine, so it can be watched from elsewhere

usage: basically view [--stop] [--json]

  --stop   give the view up; the machine stays up and can still be acted on
  --json   report the address as JSON

Prints an address anything that can show a web page can be pointed at - a
browser tab, or a frame inside an application of your own. The view mirrors the
machine and never drives it, so the machine advances only when a command asks it
to and no measurement changes for having been watched.

The address is reachable from this computer only, and holding it is the whole of
what admits a viewer: treat it as a secret. A viewer sees the screen and can do
nothing else - it cannot press a key, run a program, or reach any operation. The
view ends when the machine is released or the host stops; asking again while one
is open reports the address it already has.
`,

  profile: `
report where the run's time and memory went, on the running machine

usage: basically profile [--json]

  --json   report the measurements as JSON

Every figure is in the emulated machine's own terms, so it does not depend on
the computer the run happened on. A machine that cannot report which line it is
executing says so rather than reporting nothing.
`,

  time: `
report how long the run took and how it ended, on the running machine

usage: basically time [--json]

  --json   report the timing as JSON
`,

  variables: `
report what the program's variables hold, on the running machine

usage: basically variables [--json]

  --json   report the variables as JSON
`,

  expect: `
judge the running machine against written expectations

usage: basically expect <checks.txt> [--json]

  -e, --expect <file>   the expectations to judge against; may also be given as
                        the first argument, or "-" for standard input
  --json                report the verdict as JSON
`,

  roms: `
say where the machine ROM images come from, obtain them, or discard them

usage: basically roms [status|accept|fetch|clear] [--json]

  status   say which images are being read from where, what is held, and when
           the published set was last checked (the default). Never downloads
           anything and never asks anything
  accept   agree to the images being downloaded, and download them
  fetch    check the published set for changes and download what is new or
           changed, whether or not a check was due
  clear    discard the downloaded images and the agreement to download them
  --json   report the answer as JSON

The images are the machines' original firmware. They are not part of this tool, they are
provided separately, and they carry their own terms.

See ${REPO_ATTRIBUTION_URL}.
`,

  server: `
start, stop, or ask after the Basically server instance

usage: basically server [start|stop|status] [--json]

  start    start a host if none is running, and say where it listens
  stop     stop the running host, letting go of any machine it holds
  status   say whether a host is running, what it serves, and what it holds
           (the default)
  --json   report the answer as JSON
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
`.trimStart(),

  mcp: `
serve an agent over the Model Context Protocol

usage: basically mcp --stdio [-m <machine>]

  --stdio           the only transport; required
  -m, --machine     a machine every request defaults to, when nothing is
                    specified by the program or caller; optional

Point your client's server configuration at this command - most clients run a
server as a child process over stdio. For example, a generic client config
might read:

  { "command": "basically", "args": ["mcp", "--stdio"] }

Note: Only one machine can be run at a time, the server is not multi-tenant.
`.trimStart(),
};

/** The summary, or one operation's own help. */
export function usage(topic?: Operation): string {
  return topic === undefined ? SUMMARY : OPERATION_USAGE[topic];
}
