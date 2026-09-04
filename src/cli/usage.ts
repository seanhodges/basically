// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The command line's help text: the summary, and one block per operation.
 *
 * Plain strings rather than anything derived from {@link parseArgs}, because
 * what an option means is not something a parser knows - and a caller reading
 * help wants the sentence, not the shape.
 */

import type { Operation } from './args';

const SUMMARY = `
the Basically toolchain, outside the browser

usage: basically <operation> [options]

  machines   list every machine, and whether its ROM is here
  info       describe one machine: its memory, rules, keywords and formats
  lint       report a program's problems without running it
  build      write a program as a file the machine loads
  run        run a program and report its screen

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

usage: basically lint [file] -m <machine> [--json]

  [file]            the program, or "-"/nothing to read standard input
  -m, --machine     the machine to check the program against
  --json            the problems as JSON rather than one per line

The problems go to standard output; the exit code says whether any was fatal.
`.trimStart(),

  build: `
write a program as the transfer format its machine really loads

usage: basically build [file] -m <machine> -o <path> [-t <target>]
                       [--program-name <name>]

  [file]            the program, or "-"/nothing to read standard input
  -m, --machine     the machine to build for
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
  --json            one JSON object on standard output instead of the text
  --rom-root <dir>  read ROMs from this public/ rather than the checkout's

A schedule is one action per line, or several separated by ";". A run given one
ends where the schedule ends, so the screen reported is the one the last action
left, and a step that could not be carried out fails the run.

  PRESS <key>[+<key>...] [n]   press keys together, held for n frames
  JOY <up|down|left|right|fire|fire2> [n]   hold a joystick control
  WAIT <n>                     let the program run on for n frames
  WAIT FOR "<text>" [n]        run until that text is on screen, giving up
                               after n frames
  WAIT END [n]                 run until the program stops, giving up after n
  # ...                        a comment

Keys are named the same way on every machine - the letters, the digits, SPACE,
ENTER and SHIFT everywhere, and DELETE, ESCAPE, CTRL, TAB, the cursor keys and
the function keys wherever the machine has them. "basically info <machine>"
lists the names that machine answers to.
`.trimStart(),
};

/** The summary, or one operation's own help. */
export function usage(topic?: Operation): string {
  return topic === undefined ? SUMMARY : OPERATION_USAGE[topic];
}
