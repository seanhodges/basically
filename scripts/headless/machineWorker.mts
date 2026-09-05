import { parentPort, workerData } from 'node:worker_threads';
import { serveMachineWorker, type MessageChannelLike } from '../../src/server/machineWorker';
import { divertLogging } from '../../src/server/logging';

/**
 * The thread one caller's machine runs in.
 *
 * A thread rather than the host's own because the stand-ins a machine needs
 * outside a browser go on `globalThis`, and each worker has one of its own -
 * which is what lets a host hold a machine for every caller at once. See
 * `src/server/machineWorker.ts`.
 *
 * Nothing decides an answer here: this is the entry point, and the machine and
 * the calls against it are the shared module's.
 */

if (!parentPort) throw new Error('this entry point is only run as a worker');

// The machines announce the ROMs they load on `console.log`. In a worker that
// reaches the host's standard output, which belongs to whatever the host is
// serving - so it goes to standard error here as it does everywhere else.
divertLogging();

const options = (workerData ?? {}) as { defaultMachine?: string };
serveMachineWorker(parentPort as unknown as MessageChannelLike, options);
