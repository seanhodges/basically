import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RunError, screenLines } from '../../src/dialects/headless/runListing';
import { stepLines } from '../../src/app/driveScript';
import { parseArgs, type CliArgs, type ProgramInput } from '../../src/cli/args';
import { usage } from '../../src/cli/usage';
import { formatMachines } from '../../src/cli/machines';
import { formatMachineDescription } from '../../src/cli/info';
import { formatProblems } from '../../src/cli/lint';
import { formatVerdict } from '../../src/cli/check';
import { cliContext } from '../../src/cli/roms';
import { findMachine } from '../../src/dialects/machineLookup';
import { decodeBytes } from '../../src/ops/bytes';
import { buildOp } from '../../src/ops/build';
import { checkOp, type CheckOutcome } from '../../src/ops/check';
import { infoOp } from '../../src/ops/info';
import { lintOp } from '../../src/ops/lint';
import { machinesOp } from '../../src/ops/machines';
import { profileOp, timeOp, variablesOp } from '../../src/ops/measure';
import { runOp, type RunOutcome } from '../../src/ops/run';
import { runLsp } from './lsp.mts';
import { runMcpServer } from './mcp.mts';

/**
 * The Basically toolchain outside the browser.
 *
 * Everything each operation knows lives under `src/ops/`, shared with the
 * assistant; `src/cli/` holds the grammar, the help and the renderers that are
 * the command line's own. This is the process around them - argv in, standard
 * input read, files written, streams chosen, exit code set - so nothing that
 * decides an answer has to know it is in a process.
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
export function divertLogging(): () => void {
  const kept = { log: console.log, info: console.info, debug: console.debug };
  const toStderr = (...parts: unknown[]) =>
    err(`${parts.map(String).join(' ')}\n`);
  console.log = toStderr;
  console.info = toStderr;
  console.debug = toStderr;
  return () => Object.assign(console, kept);
}

/** The run's figures, for the reader deciding whether to trust the picture. */
function report(result: RunOutcome, wrote: string | null): void {
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
function reportErrors(errors: RunOutcome['errors']): void {
  for (const e of errors) {
    const where =
      e.column === undefined ? `${e.line}` : `${e.line}:${e.column + 1}`;
    err(`${e.fatal === false ? 'warning' : 'error'} ${where}: ${e.message}\n`);
  }
}

async function build(args: Extract<CliArgs, { operation: 'build' }>) {
  const outcome = await buildOp.run(
    { ...args.input, source: await readProgram(args.program) },
    cliContext(),
  );
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
    writeFileSync(destination, decodeBytes(file.base64));
    err(`wrote ${destination} (${file.size} bytes)\n`);
  }
  err(
    `${outcome.machine.name} ${outcome.target.label} (${outcome.target.id}), ` +
      `program ${outcome.programBytes} bytes\n`,
  );
  return 0;
}

async function run(args: Extract<CliArgs, { operation: 'run' }>) {
  const source = await readProgram(args.program);

  const restoreLogging = divertLogging();
  let result: RunOutcome;
  try {
    result = await runOp.run(
      { ...args.input, source },
      cliContext(args.input.romRoot),
    );
  } finally {
    restoreLogging();
  }

  // A fatal diagnostic means nothing ran, which is a failed run rather than an
  // empty screen: say which line, and say so in the exit code too.
  reportErrors(result.errors);
  if (result.errors.some((e) => e.fatal !== false)) return EXIT_BAD_PROGRAM;

  let wrote: string | null = null;
  if (args.screenshot !== undefined && result.picture) {
    writeFileSync(args.screenshot, decodeBytes(result.picture.png));
    wrote = args.screenshot;
  }

  if (args.json) {
    // The picture's bytes have gone to their file, so the JSON names the file
    // rather than carrying them; the errors have gone to standard error.
    const { picture, profile, time, variables } = result;
    json({
      machine: result.machine,
      programBytes: result.programBytes,
      frames: result.frames,
      driveFrames: result.driveFrames,
      keys: result.keys,
      started: result.started,
      ended: result.ended,
      screen: result.screen,
      picture: picture
        ? {
            width: picture.width,
            height: picture.height,
            colours: picture.colours,
            hostFontGlyphs: picture.hostFontGlyphs,
            path: wrote,
          }
        : null,
      timings: result.timings,
      ...(profile !== undefined ? { profile } : {}),
      ...(time !== undefined ? { time } : {}),
      ...(variables !== undefined ? { variables } : {}),
    });
  } else {
    // What was asked for is the product, each on standard output, in the order
    // the screen has always come first.
    const sections: string[] = [];
    if (args.input.screenText) {
      const lines = screenLines(result.screen);
      if (lines.length > 0) sections.push(lines.join('\n'));
    }
    if (result.profile) sections.push(profileOp.describe(result.profile));
    if (result.time) sections.push(timeOp.describe(result.time));
    if (result.variables) {
      sections.push(variablesOp.describe(result.variables));
    }
    if (sections.length > 0) out(`${sections.join('\n\n')}\n`);
  }

  report(result, wrote);
  if (result.keys) {
    // The steps go to standard error beside the run's own figures: standard
    // output carries the screen and nothing else, so `| diff` still works on a
    // driven run.
    for (const line of stepLines(result.keys.steps)) err(`  ${line}\n`);
    if (!result.keys.ok) {
      // The program did not reach where the schedule expected it to, which is
      // the program's fault rather than the caller's - and the screen has
      // already been printed, so the caller can see what it got instead.
      err('the schedule stopped there\n');
      return EXIT_BAD_PROGRAM;
    }
  }
  return 0;
}

async function check(args: Extract<CliArgs, { operation: 'check' }>) {
  if (args.program.kind === 'stdin' && args.expectations.kind === 'stdin') {
    // Standard input is one stream: reading the program from it leaves nothing
    // for the expectations, and a check against no expectations is not one.
    throw new RunError(
      'the program and the expectations cannot both come from standard input',
    );
  }
  // Both read before anything boots, so an unreadable file is the caller's
  // mistake rather than a check that got part-way.
  const source = await readProgram(args.program);
  const expectations = await readProgram(args.expectations);

  const restoreLogging = divertLogging();
  let outcome: CheckOutcome;
  try {
    outcome = await checkOp.run(
      { ...args.input, source, expectations },
      cliContext(args.input.romRoot),
    );
  } finally {
    restoreLogging();
  }

  reportErrors(outcome.errors);
  if (outcome.errors.some((e) => e.fatal !== false)) return EXIT_BAD_PROGRAM;

  // The verdict is the check's product, so it goes to standard output; the
  // machine's own figures go to standard error beside it.
  if (args.json) json(outcome);
  else out(`${formatVerdict(outcome)}\n`);
  err(
    `${outcome.machine.name} (${outcome.machine.id}), ` +
      `program ${outcome.programBytes} bytes, ${outcome.frames} frame` +
      `${outcome.frames === 1 ? '' : 's'}\n`,
  );
  // A failing expectation is the program not doing what was written, which is
  // the program at fault rather than the caller.
  return outcome.passed ? 0 : EXIT_BAD_PROGRAM;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.operation) {
    case 'help':
      out(usage(args.topic));
      return 0;

    case 'machines': {
      const machines = await machinesOp.run(args.input, cliContext());
      if (args.json) json(machines);
      else out(`${formatMachines(machines)}\n`);
      return 0;
    }

    case 'info': {
      const machine = await infoOp.run(args.input, cliContext());
      if (args.json) json(machine);
      else out(formatMachineDescription(machine));
      return 0;
    }

    case 'lint': {
      const outcome = await lintOp.run(
        { ...args.input, source: await readProgram(args.program) },
        cliContext(),
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

    case 'check':
      return check(args);

    case 'lsp': {
      // A bad `-m` is the caller's mistake to fail on before anything is
      // served, exactly as every other operation refuses one; naming none at
      // all is fine here, unlike every other operation, since the editor may
      // say later.
      if (args.machine !== undefined && !findMachine(args.machine)) {
        throw new RunError(`no registered machine "${args.machine}"`);
      }
      await runLsp(args.machine);
      // The server has no verdict on a program to report - it served until
      // the editor disconnected, which is success whatever the programs it
      // served turned out to have.
      return 0;
    }

    case 'mcp': {
      // As for `lsp`: a machine that is not registered is refused before
      // anything is served, and naming none is not a mistake, since the
      // client may say which machine it means on each request.
      if (args.machine !== undefined && !findMachine(args.machine)) {
        throw new RunError(`no registered machine "${args.machine}"`);
      }
      await runMcpServer(args.machine);
      // Served until the client disconnected, which is success whatever the
      // programs it served turned out to have.
      return 0;
    }
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
