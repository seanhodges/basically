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
import { decodeBytes } from '../../src/ops/bytes';
import type { CheckOutcome } from '../../src/ops/check';
import { profileOp, timeOp, variablesOp } from '../../src/ops/measure';
import type { RunOutcome } from '../../src/ops/run';
import { hostAddress } from '../../src/server/address';
import {
  bundleDirectory,
  currentEnvironment,
  readBuildId,
} from '../../src/server/environment';
import { connectOrStart, NoHost } from '../../src/client/connect';
import {
  EXIT_BAD_PROGRAM,
  EXIT_BAD_REQUEST,
  exitCodeFor,
  HostRefused,
  inProcessClient,
  openClient,
  type HostClient,
} from '../../src/client/call';
import { realWorld } from '../../src/client/world';

/**
 * The Basically toolchain outside the browser, as a client of the host that
 * holds it.
 *
 * The split is where the code already cut. The grammar (`src/cli/args.ts`) is a
 * pure function over an argv array and stays here, because what a caller asked
 * for is the client's own business; the operations run on the host, because
 * that is where the machine is. So this is the process around a conversation -
 * argv in, files read, a call made, the answer rendered, files written, exit
 * code set - and nothing that decides an answer is in it.
 *
 * Every path is settled here and none crosses as a path. The client reads the
 * program and the expectations, resolves a ROM root against its own working
 * directory, and writes what an outcome carries as bytes. A host that never
 * resolves a relative path cannot be confused by running somewhere else.
 *
 * Two rules survive the hop unchanged. Standard output carries only the
 * product: the screen, the structured data, the problems a check found. And the
 * exit code separates the two ways a request fails - 1 for a caller who asked
 * for something impossible, 2 for a BASIC program that is itself at fault -
 * with the host saying which of those a refusal was rather than this deriving
 * one from a message. Being unable to reach a host at all is the caller's, not
 * a program's: nothing was ever asked about a program.
 */

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
 * A ROM root as the host will read it.
 *
 * Resolved here because a relative path means what it means in the directory
 * the user typed it in, and the host is somewhere else entirely.
 */
function absoluteRomRoot<T extends { romRoot?: string }>(input: T): T {
  return input.romRoot === undefined
    ? input
    : { ...input, romRoot: path.resolve(input.romRoot) };
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

/** Anything the host had to say about what a call did to the machine it holds. */
function notes(lines: string[]): void {
  for (const line of lines) err(`${line}\n`);
}

async function build(
  args: Extract<CliArgs, { operation: 'build' }>,
  host: HostClient,
) {
  const { value, notes: said } = await host.call('build', {
    ...args.input,
    source: await readProgram(args.program),
  });
  const outcome = value as {
    errors: RunOutcome['errors'];
    target: { id: string; label: string } | null;
    files: { fileName: string; base64: string; size: number }[];
    machine: { name: string };
    programBytes: number;
  };
  notes(said);
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

async function run(
  args: Extract<CliArgs, { operation: 'run' }>,
  host: HostClient,
) {
  const source = await readProgram(args.program);
  const { value, notes: said } = await host.call('run', {
    ...absoluteRomRoot(args.input),
    source,
  });
  const result = value as RunOutcome;
  // A host always leaves the machine it booted running, because that is what
  // the operations acting on one need. A run that was not asked to keep it lets
  // it go here, so `run` on its own means what it has always meant: an answer,
  // and no machine afterwards.
  if (!args.hold) await host.ask('release');
  notes(said);

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

async function check(
  args: Extract<CliArgs, { operation: 'check' }>,
  host: HostClient,
) {
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

  const { value, notes: said } = await host.call('check', {
    ...absoluteRomRoot(args.input),
    source,
    expectations,
  });
  const outcome = value as CheckOutcome;
  notes(said);

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

/** An operation on the machine that is already up: no program, no machine named. */
async function onTheHeldMachine(
  args: Extract<
    CliArgs,
    {
      operation:
        | 'drive'
        | 'look'
        | 'screenshot'
        | 'profile'
        | 'time'
        | 'variables'
        | 'expect';
    }
  >,
  host: HostClient,
): Promise<number> {
  const input =
    args.operation === 'expect'
      ? { expectations: await readProgram(args.expectations) }
      : args.input;
  const { value, notes: said, failed } = await host.call(args.operation, input);
  notes(said);

  if (args.json) {
    json(value);
  } else if (args.operation === 'screenshot') {
    const { picture } = value as {
      picture: { png: string; width: number; height: number } | null;
    };
    if (!picture) {
      // A machine whose display cannot be pictured says so, rather than
      // writing a file that is not one.
      err('this machine cannot be pictured\n');
      return EXIT_BAD_REQUEST;
    }
    const destination = args.out ?? 'screen.png';
    writeFileSync(destination, decodeBytes(picture.png));
    err(`wrote ${destination} (${picture.width}x${picture.height})\n`);
  } else {
    // Each of these has prose of its own, written for a reader rather than a
    // column layout; the command line uses it rather than inventing a second.
    const described = describeHeld(args.operation, value);
    if (described !== '') out(`${described}\n`);
  }
  // A schedule that stopped short, or an expectation that did not hold, is the
  // program at fault rather than the caller.
  return failed ? EXIT_BAD_PROGRAM : 0;
}

function describeHeld(operation: string, value: unknown): string {
  switch (operation) {
    case 'profile':
      return profileOp.describe(value as never);
    case 'time':
      return timeOp.describe(value as never);
    case 'variables':
      return variablesOp.describe(value as never);
    case 'look': {
      const screen = (value as { screen: RunOutcome['screen'] }).screen;
      return screenLines(screen).join('\n');
    }
    case 'drive': {
      const outcome = value as {
        steps: Parameters<typeof stepLines>[0];
        screen: RunOutcome['screen'];
      };
      return [
        ...stepLines(outcome.steps).map((line) => `  ${line}`),
        '',
        screenLines(outcome.screen).join('\n'),
      ].join('\n');
    }
    case 'expect':
      return formatVerdict(value as CheckOutcome);
    default:
      return '';
  }
}

/** Asking after the host itself rather than after a program or a machine. */
async function server(
  args: Extract<CliArgs, { operation: 'server' }>,
  address: string,
  connect: (neverStart?: boolean) => Promise<HostClient>,
): Promise<number> {
  if (args.action === 'stop') {
    let client: HostClient;
    try {
      client = await connect(true);
    } catch {
      // Asking to stop what is not running is not a failure: the state the
      // caller wanted is the state they have.
      if (args.json) json({ running: false, stopped: false });
      else err('no host was running\n');
      return 0;
    }
    await client.ask('stop');
    client.close();
    if (args.json) json({ running: true, stopped: true, address });
    else err(`stopped the host on ${address}\n`);
    return 0;
  }

  // Asking whether a host is running must not start one, and must not fail
  // when the answer is that none is: "there is none" is an answer.
  let client: HostClient;
  try {
    client = await connect(true);
  } catch (error) {
    if (!(error instanceof NoHost)) throw error;
    if (args.json) json({ running: false, address });
    else out(`no host is running (it would listen on ${address})\n`);
    return 0;
  }
  const status = await client.ask('status');
  client.close();
  if (args.json) {
    json({
      running: true,
      address,
      serving: status.serving,
      holding: status.holding ?? null,
    });
  } else {
    out(
      `a host is running on ${address}\n` +
        `serving ${(status.serving ?? []).join(', ')}\n` +
        `holding ${status.holding ?? 'no machine'}\n`,
    );
  }
  return 0;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  // Answered without a host: what the tool can do is the client's own knowledge,
  // and asking for help should work on a machine where no host can start.
  if (args.operation === 'help') {
    out(usage(args.topic));
    return 0;
  }

  const directory = bundleDirectory(import.meta.url);
  const environment = currentEnvironment();
  const buildId = readBuildId(directory);
  const address = hostAddress(buildId, environment);

  // `lsp` and `mcp` are servers rather than operations: the caller starting one
  // wants the streams of the process it started, so it is served here rather
  // than over a connection to somewhere else. The host serves them too, for a
  // caller that reaches it over a socket.
  if (args.operation === 'lsp' || args.operation === 'mcp') {
    return serveOverOwnStreams(args.operation, args.machine);
  }

  const connect = async (neverStart = false): Promise<HostClient> => {
    const connection = await connectOrStart({
      address,
      clearable: environment.platform !== 'win32',
      neverStart,
      // The host is looked for beside this bundle first - the build being
      // worked on rather than whatever is installed - then on PATH.
      world: realWorld(
        [directory, path.resolve(directory, '../..')],
        environment.platform,
      ),
    });
    return openClient(connection, 'ops', buildId);
  };

  /**
   * A host if one can be had, and this process if not.
   *
   * Somewhere that will not let a process be spawned, every operation still
   * has to work; what is lost is only the machine between commands, and the
   * notice says so rather than leaving the caller to wonder why the machine
   * they held is gone.
   */
  const connectOrDoItHere = async (): Promise<HostClient> => {
    try {
      return await connect();
    } catch (error) {
      if (!(error instanceof NoHost)) throw error;
      err(`${error.message}\n`);
      err('running it here instead; no machine will be held afterwards\n');
      const { divertLogging } = await import('../../src/server/logging');
      const { createInProcessHolder } =
        await import('../../src/server/machineWorker');
      divertLogging();
      return inProcessClient(createInProcessHolder());
    }
  };

  if (args.operation === 'server') {
    if (args.action === 'start') {
      const client = await connect();
      client.close();
      err(`a host is running on ${address}\n`);
      return 0;
    }
    return server(args, address, connect);
  }

  const host = await connectOrDoItHere();
  try {
    switch (args.operation) {
      case 'machines': {
        const { value } = await host.call('machines', args.input);
        if (args.json) json(value);
        else out(`${formatMachines(value as never)}\n`);
        return 0;
      }

      case 'info': {
        const { value } = await host.call('info', args.input);
        if (args.json) json(value);
        else out(formatMachineDescription(value as never));
        return 0;
      }

      case 'lint': {
        const { value } = await host.call('lint', {
          ...args.input,
          source: await readProgram(args.program),
        });
        const outcome = value as {
          machine: { name: string };
          problems: unknown[];
          fatal: boolean;
        };
        // A check's problems are its product, so they go to standard output
        // rather than where a compiler would put them; the exit code is what
        // says whether they mattered.
        if (args.json) json(outcome);
        else if (outcome.problems.length > 0) {
          out(`${formatProblems(outcome.problems as never)}\n`);
        }
        err(
          `${outcome.machine.name}: ${outcome.problems.length} problem` +
            `${outcome.problems.length === 1 ? '' : 's'}` +
            `${outcome.fatal ? ', at least one fatal' : ''}\n`,
        );
        return outcome.fatal ? EXIT_BAD_PROGRAM : 0;
      }

      case 'build':
        return await build(args, host);

      case 'run':
        return await run(args, host);

      case 'check':
        return await check(args, host);

      default:
        return await onTheHeldMachine(args, host);
    }
  } finally {
    host.close();
  }
}

/**
 * Serve one editor or one agent over this process's own streams.
 *
 * Imported only when one is asked for: the shims pull in the protocol
 * libraries, and a `lint` should not pay for them.
 */
async function serveOverOwnStreams(
  which: 'lsp' | 'mcp',
  machine: string | undefined,
): Promise<number> {
  const { findMachine } = await import('../../src/dialects/machineLookup');
  // A bad `-m` is the caller's mistake to fail on before anything is served,
  // exactly as every other operation refuses one; naming none at all is fine
  // here, unlike every other operation, since the client may say later.
  if (machine !== undefined && !findMachine(machine)) {
    throw new RunError(`no registered machine "${machine}"`);
  }
  if (which === 'lsp') {
    const { runLsp } = await import('./lsp.mts');
    await runLsp(machine);
  } else {
    const { runMcpServer } = await import('./mcp.mts');
    await runMcpServer(machine);
  }
  // The server has no verdict on a program to report - it served until the
  // client disconnected, which is success whatever the programs it served
  // turned out to have.
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    if (error instanceof RunError) {
      err(`${error.message}\n`);
      process.exit(EXIT_BAD_REQUEST);
    }
    if (error instanceof NoHost) {
      err(`${error.message}\n`);
      process.exit(EXIT_BAD_REQUEST);
    }
    if (error instanceof HostRefused) {
      err(`${error.message}\n`);
      process.exit(exitCodeFor(error));
    }
    throw error;
  });
