import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type { Duplex } from 'node:stream';
import { RunError } from '../../src/dialects/headless/runError';
import { findMachine } from '../../src/dialects/machineLookup';
import { addressDirectory, hostAddress } from '../../src/server/address';
import {
  bundleDirectory,
  currentEnvironment,
  readBuildId,
} from '../../src/server/environment';
import {
  AddressInUse,
  listenOn,
  serveConnection,
} from '../../src/server/listener';
import { IDLE_MS, watchLifetime } from '../../src/server/lifetime';
import { divertLogging } from '../../src/server/logging';
import {
  createInProcessHolder,
  createWorkerHolder,
  type MachineHolder,
  type MessageChannelLike,
} from '../../src/server/machineWorker';
import {
  CONVERSATIONS,
  isConversation,
  type Conversation,
} from '../../src/server/protocol';
import { createSessions } from '../../src/server/sessions';
import { runLsp } from './lsp.mts';
import { runMcpServer } from './mcp.mts';

/**
 * The host: the toolchain outside the browser, kept running.
 *
 * This is the process around it - argv in, an address bound or the process's
 * own streams taken, a worker started per caller that wants a machine, and the
 * exit code set. Nothing that decides an answer is here; that is all under
 * `src/server/`, shared with the single-caller path.
 *
 * Two ways to be reached, and the difference is only which streams a
 * conversation gets. `--stdio` serves exactly one caller over this process's
 * own streams and is what an editor or an agent that starts the toolchain
 * itself uses - unchanged, and the reason nothing anyone has configured
 * breaks. Otherwise the host listens, and every caller that finds it gets a
 * connection and a session of its own.
 */

/** The caller asked for something impossible. */
const EXIT_BAD_REQUEST = 1;

const err = (text: string) => process.stderr.write(text);

interface Args {
  serving: Conversation[];
  /** Serve one caller over this process's own streams rather than listening. */
  stdio: boolean;
  machine?: string;
  idleMs: number;
}

function usage(): string {
  return `basically-server - the Basically toolchain, kept running

  basically-server [--ops] [--lsp] [--mcp] [options]

Serves the conversations named, or all of them when none is named:

  --ops           the command line's operations
  --lsp           an editor's language server
  --mcp           an agent's Model Context Protocol server

Options:

  --stdio         serve one caller over this process's own streams instead of
                  listening; exactly one conversation must be named
  -m, --machine   the machine a request naming none is read as
  --idle <ms>     stop after this long with no caller connected (default ${IDLE_MS})
  --address       print the address a host of this build listens on, and exit
  -h, --help      this text
`;
}

function parseArgs(argv: string[]): Args | 'help' | 'address' {
  const serving: Conversation[] = [];
  let stdio = false;
  let machine: string | undefined;
  let idleMs = IDLE_MS;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const named = arg.startsWith('--') ? arg.slice(2) : '';
    if (arg === '-h' || arg === '--help') return 'help';
    if (arg === '--address') return 'address';
    if (isConversation(named)) {
      if (!serving.includes(named)) serving.push(named);
      continue;
    }
    if (arg === '--stdio') {
      stdio = true;
      continue;
    }
    if (arg === '-m' || arg === '--machine') {
      machine = argv[++i];
      if (machine === undefined) throw new RunError(`${arg} needs a machine`);
      continue;
    }
    if (arg === '--idle') {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new RunError('--idle needs a number of milliseconds');
      }
      idleMs = value;
      continue;
    }
    throw new RunError(`no option "${arg}"`);
  }

  // Naming none means all of them: a host started without being asked for
  // should be able to answer whoever turns up next.
  if (serving.length === 0) serving.push(...CONVERSATIONS);
  if (stdio && serving.length !== 1) {
    throw new RunError(
      '--stdio serves one caller over one pair of streams, so exactly one of ' +
        '--ops, --lsp or --mcp must be named',
    );
  }
  return { serving, stdio, machine, idleMs };
}

/** A machine in a worker of its own, started from the bundle beside this one. */
function workerHolder(
  directory: string,
  defaultMachine?: string,
): MachineHolder {
  return createWorkerHolder(() => {
    const worker = new Worker(path.join(directory, 'machineWorker.mjs'), {
      workerData: defaultMachine === undefined ? {} : { defaultMachine },
      // The worker's own output would otherwise interleave with whatever this
      // host is serving on its standard streams.
      stdout: true,
      stderr: true,
    });
    worker.stderr.pipe(process.stderr);
    return {
      port: worker as unknown as MessageChannelLike,
      terminate: () => worker.terminate().then(() => undefined),
    };
  });
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'help') {
    process.stdout.write(usage());
    return 0;
  }
  const environment = currentEnvironment();
  const directory = bundleDirectory(import.meta.url);
  const buildId = readBuildId(directory);
  if (parsed === 'address') {
    process.stdout.write(`${hostAddress(buildId, environment)}\n`);
    return 0;
  }
  const args = parsed;

  // A machine that is not registered is the caller's mistake to fail on before
  // anything is served, exactly as every operation refuses one; naming none is
  // fine, since a caller may say which machine it means per request.
  if (args.machine !== undefined && !findMachine(args.machine)) {
    throw new RunError(`no registered machine "${args.machine}"`);
  }
  const options =
    args.machine === undefined ? {} : { defaultMachine: args.machine };

  if (args.stdio) {
    // One caller, over this process's own streams. The machine stays in this
    // process because there is only ever one caller to hold one for, which is
    // the arrangement that existed before there was a host at all.
    const [only] = args.serving;
    if (only === 'lsp') {
      await runLsp(args.machine);
      return 0;
    }
    if (only === 'mcp') {
      await runMcpServer(args.machine);
      return 0;
    }
    const restore = divertLogging();
    try {
      await serveOverStdio(options);
    } finally {
      restore();
    }
    return 0;
  }

  const address = hostAddress(buildId, environment);
  const sessions = createSessions(() => workerHolder(directory, args.machine));
  let listening: Awaited<ReturnType<typeof listenOn>> | null = null;

  // Resolved by the shutdown, whichever thing asked for it. Until then the
  // listener itself is what keeps the process alive; there is nothing to poll.
  let stopped: () => void = () => {};
  const untilStopped = new Promise<void>((resolve) => {
    stopped = resolve;
  });

  // Connections, not sessions: the command line's session outlives each of its
  // commands, so counting sessions would keep the host alive forever.
  let connections = 0;

  const life = watchLifetime(
    {
      connected: () => connections,
      shutdown: async () => {
        await sessions.closeAll();
        await listening?.close();
        stopped();
      },
    },
    args.idleMs,
  );

  try {
    listening = await listenOn(address, addressDirectory(environment), {
      serving: args.serving,
      sessions,
      serveEditor: (connection: Duplex) => {
        life.touch();
        void runLsp(args.machine, { input: connection, output: connection });
      },
      serveAgent: (connection: Duplex) => {
        life.touch();
        void runMcpServer(args.machine, {
          input: connection,
          output: connection,
        });
      },
      stop: () => void life.stop(),
      attach: () => {
        connections += 1;
        life.touch();
        return () => {
          connections -= 1;
          // The wait starts from the last caller leaving, not from the last
          // one arriving.
          life.touch();
        };
      },
      note: (message) => err(`[basically-server] ${message}\n`),
    });
  } catch (error) {
    life.cancel();
    if (error instanceof AddressInUse) {
      // Another host of this build got there first, which is the arrangement
      // working rather than a failure: one host ends up serving everyone.
      err(`[basically-server] a host is already listening on ${address}\n`);
      return 0;
    }
    throw error;
  }

  err(`[basically-server] serving ${args.serving.join(', ')} on ${address}\n`);
  // Whatever ends the host - the idle timer, a caller asking it to stop, a
  // signal - goes through the same shutdown, so no machine is left running.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => void life.stop());
  }
  await untilStopped;
  return 0;
}

/** The operations conversation over this process's own streams. */
function serveOverStdio(options: { defaultMachine?: string }): Promise<void> {
  const sessions = createSessions(() => createInProcessHolder(options));
  return new Promise<void>((resolve) => {
    const connection = Object.assign(process.stdin, {
      write: (chunk: Buffer | string) => process.stdout.write(chunk),
      writableEnded: false,
    }) as unknown as Duplex;
    serveConnection(connection, {
      serving: ['ops'],
      sessions,
      serveEditor: () => {},
      serveAgent: () => {},
      stop: () => {
        void sessions.closeAll().then(resolve);
      },
      note: (message) => err(`[basically-server] ${message}\n`),
    });
    process.stdin.on('end', () => void sessions.closeAll().then(resolve));
  });
}

main()
  .then((code) => {
    if (code !== 0) process.exit(code);
  })
  .catch((error: unknown) => {
    if (error instanceof RunError) {
      err(`${error.message}\n`);
      process.exit(EXIT_BAD_REQUEST);
    }
    throw error;
  });
