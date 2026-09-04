import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { encodePng } from '../../src/dialects/headless/headlessCanvas';
import {
  RunError,
  runListing,
  screenLines,
  type RunResult,
} from '../../src/dialects/headless/runListing';
import { parseArgs, type CliArgs, type ProgramInput } from '../../src/cli/args';
import { usage } from '../../src/cli/usage';
import { formatMachines, listMachines } from '../../src/cli/machines';
import { describeMachine, formatMachineDescription } from '../../src/cli/info';
import { formatProblems, lintListing } from '../../src/cli/lint';
import { buildListing } from '../../src/cli/build';
import { driveHook, parseSchedule } from '../../src/cli/drive';
import { findMachine } from '../../src/dialects/headless/runListing';
import { hasRom } from '../../src/dialects/bootHarness';
import { locateRoms } from '../../src/cli/roms';

/**
 * The Basically toolchain outside the browser.
 *
 * Everything each operation knows lives under `src/cli/`; this is the process
 * around it - argv in, standard input read, files written, streams chosen, exit
 * code set - so nothing that decides an answer has to know it is in a process.
 *
 * Two rules run through every operation. Standard output carries only the
 * product: the screen, the structured data, the problems a check found. Every
 * figure, timing and notice goes to standard error, so `| diff` and `$(...)`
 * see the answer and nothing else. And the exit code separates the two ways a
 * request fails: 1 for a caller who asked for something impossible, 2 for a
 * BASIC program that is itself at fault.
 */

/** The caller asked for something impossible. */
const EXIT_BAD_REQUEST = 1;
/** The BASIC program is at fault. */
const EXIT_BAD_PROGRAM = 2;

const out = (text: string) => process.stdout.write(text);
const err = (text: string) => process.stderr.write(text);

/** One JSON object on standard output, as a program would read it. */
function json(value: unknown): void {
  out(`${JSON.stringify(value, null, 2)}\n`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

/** The program, from the file the caller named or from standard input. */
async function readProgram(input: ProgramInput): Promise<string> {
  if (input.kind === 'stdin') {
    const source = await readStdin();
    if (source.trim() === '') throw new RunError('no program arrived on stdin');
    return source;
  }
  try {
    return readFileSync(input.path, 'utf8');
  } catch {
    throw new RunError(`cannot read "${input.path}"`);
  }
}

/**
 * Send anything the machines log to stderr for the duration of a run.
 *
 * jsbeeb announces each ROM it loads on `console.log`, which would otherwise
 * land in the middle of the screen text on stdout and make the output useless
 * to anything reading it. Restored afterwards so a later throw still reports.
 */
function divertLogging(): () => void {
  const kept = { log: console.log, info: console.info, debug: console.debug };
  const toStderr = (...parts: unknown[]) =>
    err(`${parts.map(String).join(' ')}\n`);
  console.log = toStderr;
  console.info = toStderr;
  console.debug = toStderr;
  return () => Object.assign(console, kept);
}

/** The run's figures, for the reader deciding whether to trust the picture. */
function report(result: RunResult, wrote: string | null): void {
  const { machine, timings, picture } = result;
  const ms = (n: number) => `${n.toFixed(0)}ms`;
  err(
    `${machine.name} (${machine.id}) ${machine.displayWidth}x${machine.displayHeight} ` +
      `@ ${machine.frameHz.toFixed(2)}Hz\n` +
      `program ${result.programBytes} bytes, ` +
      `${result.frames} frame${result.frames === 1 ? '' : 's'}, ` +
      // Sampling starts after loadProgram, which pumps frames of its own while
      // it types at the machine - so a short program can be over before the
      // first sample, and "stopped without being seen running" is not a fault.
      `${result.ended ? 'stopped' : 'still running at the cap'}` +
      `${result.ended && !result.started ? ' (already finished when sampling began)' : ''}\n` +
      `tokenize ${ms(timings.tokenizeMs)}  boot ${ms(timings.bootMs)}  ` +
      `load ${ms(timings.loadMs)}  run ${ms(timings.runMs)}  ` +
      `render ${ms(timings.renderMs)}  total ${ms(timings.totalMs)}\n`,
  );
  if (!machine.romPresent) {
    err(
      'this installation carries no ROM for that machine, so it drew its ' +
        'missing-image notice rather than running anything\n',
    );
  }
  if (picture) {
    err(
      `picture: ${picture.colours} distinct colours` +
        (picture.hostFontGlyphs > 0
          ? `, ${picture.hostFontGlyphs} glyphs in the stand-in font - this ` +
            'machine draws text through the host font, so the picture is ' +
            'legible rather than pixel-faithful\n'
          : ', exact - this machine hands over pixels\n'),
    );
  }
  if (wrote) err(`wrote ${wrote}\n`);
}

/** Every tokenizer problem, on standard error, the way a compiler places one. */
function reportErrors(errors: RunResult['errors']): void {
  for (const e of errors) {
    const where =
      e.column === undefined ? `${e.line}` : `${e.line}:${e.column + 1}`;
    err(`${e.fatal === false ? 'warning' : 'error'} ${where}: ${e.message}\n`);
  }
}

async function build(args: Extract<CliArgs, { operation: 'build' }>) {
  const outcome = await buildListing({
    machine: args.machine,
    source: await readProgram(args.program),
    out: args.out,
    target: args.target,
    programName: args.programName,
  });
  reportErrors(outcome.errors);
  if (outcome.target === null) {
    err('nothing was built: the program has a problem that prevents it\n');
    return EXIT_BAD_PROGRAM;
  }
  // A format that is more than one file puts the first where the caller asked -
  // so the path they wrote always means something - and the rest beside it
  // under the names the target chose.
  const directory = path.dirname(args.out);
  for (const [index, file] of outcome.files.entries()) {
    const destination =
      index === 0 ? args.out : path.join(directory, file.fileName);
    writeFileSync(destination, file.bytes);
    err(`wrote ${destination} (${file.bytes.length} bytes)\n`);
  }
  err(
    `${outcome.machine.name} ${outcome.target.label} (${outcome.target.id}), ` +
      `program ${outcome.programBytes} bytes\n`,
  );
  return 0;
}

async function run(args: Extract<CliArgs, { operation: 'run' }>) {
  const source = await readProgram(args.program);
  // Read before anything boots, so a schedule the tool cannot understand is the
  // caller's mistake rather than a run that got part-way.
  const schedule = args.keys === undefined ? null : parseSchedule(args.keys);
  const dialect = findMachine(args.machine);
  if (schedule && dialect) {
    locateRoms(args.romRoot);
    if (!hasRom(dialect)) {
      // An undriven run on a ROM-less machine draws its missing-image notice,
      // which at least says the machine boots. A driven one has nothing to
      // drive, so it is refused before a step is taken rather than reporting a
      // schedule that failed against a notice.
      throw new RunError(
        `this installation carries no ROM for ${dialect.name}, so there is ` +
          'nothing for --keys to drive',
      );
    }
  }
  const handle = schedule && dialect ? driveHook(dialect, schedule) : null;

  const restoreLogging = divertLogging();
  let result: RunResult;
  try {
    result = await runListing({
      machine: args.machine,
      source,
      frames: args.frames,
      maxFrames: args.maxFrames,
      drive: handle?.drive,
      pixels: args.screenshot !== undefined,
      romRoot: args.romRoot,
    });
  } finally {
    restoreLogging();
  }

  // A fatal diagnostic means nothing ran, which is a failed run rather than an
  // empty screen: say which line, and say so in the exit code too.
  reportErrors(result.errors);
  if (result.errors.some((e) => e.fatal !== false)) return EXIT_BAD_PROGRAM;

  let wrote: string | null = null;
  if (args.screenshot !== undefined && result.picture) {
    const { rgba, width, height } = result.picture;
    writeFileSync(args.screenshot, encodePng(rgba, width, height));
    wrote = args.screenshot;
  }

  if (args.json) {
    json({
      machine: result.machine,
      programBytes: result.programBytes,
      frames: result.frames,
      driveFrames: result.driveFrames,
      keys: handle?.report
        ? { ok: handle.report.ok, steps: handle.report.lines }
        : null,
      started: result.started,
      ended: result.ended,
      screen: result.screen,
      picture: result.picture
        ? {
            width: result.picture.width,
            height: result.picture.height,
            colours: result.picture.colours,
            hostFontGlyphs: result.picture.hostFontGlyphs,
            path: wrote,
          }
        : null,
      timings: result.timings,
    });
  } else if (args.screenText) {
    const lines = screenLines(result.screen);
    out(lines.length > 0 ? `${lines.join('\n')}\n` : '');
  }

  report(result, wrote);
  if (handle?.report) {
    // The steps go to standard error beside the run's own figures: standard
    // output carries the screen and nothing else, so `| diff` still works on a
    // driven run.
    for (const line of handle.report.lines) err(`  ${line}\n`);
    if (!handle.report.ok) {
      // The program did not reach where the schedule expected it to, which is
      // the program's fault rather than the caller's - and the screen has
      // already been printed, so the caller can see what it got instead.
      err('the schedule stopped there\n');
      return EXIT_BAD_PROGRAM;
    }
  }
  return 0;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.operation) {
    case 'help':
      out(usage(args.topic));
      return 0;

    case 'machines': {
      const machines = listMachines();
      if (args.json) json(machines);
      else out(`${formatMachines(machines)}\n`);
      return 0;
    }

    case 'info': {
      const machine = describeMachine(args.machine);
      if (args.json) json(machine);
      else out(formatMachineDescription(machine));
      return 0;
    }

    case 'lint': {
      const outcome = lintListing(
        args.machine,
        await readProgram(args.program),
      );
      // A check's problems are its product, so they go to standard output
      // rather than where a compiler would put them; the exit code is what
      // says whether they mattered.
      if (args.json) json(outcome);
      else if (outcome.problems.length > 0) {
        out(`${formatProblems(outcome.problems)}\n`);
      }
      err(
        `${outcome.machine.name}: ${outcome.problems.length} problem` +
          `${outcome.problems.length === 1 ? '' : 's'}` +
          `${outcome.fatal ? ', at least one fatal' : ''}\n`,
      );
      return outcome.fatal ? EXIT_BAD_PROGRAM : 0;
    }

    case 'build':
      return build(args);

    case 'run':
      return run(args);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    if (error instanceof RunError) {
      err(`${error.message}\n`);
      process.exit(EXIT_BAD_REQUEST);
    }
    throw error;
  });
