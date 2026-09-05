import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The client and the host as they are actually run: two processes, a real
 * socket, a real worker thread.
 *
 * Everything else about this change is unit-tested over streams and stubs,
 * which is where the reasoning belongs. What only the real thing can show is
 * that the bundles agree on an address, that a machine survives one process
 * ending and another starting, and that the answers are the same either way -
 * so that is all this file does.
 *
 * The host is left where the client's own discovery finds it, and each test
 * runs the client the way a user would.
 */

const root = path.resolve(__dirname, '../..');
const client = path.join(root, 'scripts', 'headless', 'dist', 'cli.mjs');

/** A build is needed before any of this means anything. */
const built = existsSync(client);

/**
 * The client, run as a command, with its streams and exit code.
 *
 * Spawned rather than `execFile`d because a program read from standard input
 * needs that stream closed to know the program has ended, and the promisified
 * `execFile` has no way to write one.
 */
function basically(
  args: string[],
  stdin?: string,
): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [client, ...args], { cwd: root });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString('utf8')));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? -1, out, err }));
    if (stdin !== undefined) child.stdin.write(stdin);
    child.stdin.end();
  });
}

let temporary = '';

beforeAll(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), 'basically-e2e-'));
  // Whatever an earlier run left holding a machine is not this run's host.
  if (built) await basically(['server', 'stop']);
}, 60_000);

afterAll(async () => {
  if (built) await basically(['server', 'stop']);
  if (temporary) await rm(temporary, { recursive: true, force: true });
}, 60_000);

describe.skipIf(!built)('the client and the host, as they are run', () => {
  it('starts a host for a caller that finds none, without being asked', async () => {
    const listed = await basically(['machines']);
    expect(listed.code).toBe(0);
    expect(listed.out).toMatch(/zx81/);
    const status = await basically(['server', 'status', '--json']);
    expect(JSON.parse(status.out)).toMatchObject({ running: true });
  }, 60_000);

  it('answers the same whether the host was already running or not', async () => {
    // The second call reaches the host the first one started.
    const first = await basically(['machines', '--json']);
    const second = await basically(['machines', '--json']);
    expect(second.out).toBe(first.out);
    expect(JSON.parse(first.out).length).toBeGreaterThan(0);
  }, 60_000);

  it('reads a program from standard input, as a pipe would give it', async () => {
    const linted = await basically(['lint', '-m', 'zx81'], '10 PRINT "HI"\n');
    expect(linted.code).toBe(0);
    expect(linted.err).toMatch(/0 problems/);
  }, 60_000);

  it('writes the file a build produces, where the caller asked', async () => {
    const source = path.join(temporary, 'prog.bas');
    const built = path.join(temporary, 'prog.p');
    await writeFile(source, '10 PRINT "HI"\n', 'utf8');
    const result = await basically([
      'build',
      source,
      '-m',
      'zx81',
      '-o',
      built,
    ]);
    expect(result.code).toBe(0);
    expect(existsSync(built)).toBe(true);
    expect(readFileSync(built).length).toBeGreaterThan(0);
  }, 60_000);

  it("separates the caller's mistake from the program's, through the host", async () => {
    // An unknown machine is the caller's; a program that cannot be built is the
    // program's. The host decides which, and the client reports what it decided.
    const badRequest = await basically(['info', 'pdp11']);
    expect(badRequest.code).toBe(1);
    expect(badRequest.err).toMatch(/no registered machine/);

    const badProgram = await basically(
      ['lint', '-m', 'zx81'],
      '10 PRINT "HI\n',
    );
    expect(badProgram.code).toBe(2);
  }, 60_000);

  it('keeps standard output to the product alone', async () => {
    // Everything about how the work went - including anything the host had to
    // say - goes to standard error, so `$(...)` sees the answer and nothing else.
    const listed = await basically(['machines', '--json']);
    expect(() => JSON.parse(listed.out)).not.toThrow();
    expect(listed.out).not.toMatch(/basically-server/);
  }, 60_000);
});

describe.skipIf(!built)('a machine held between commands', () => {
  const source = () => path.join(temporary, 'wait.bas');

  beforeAll(async () => {
    await writeFile(
      source(),
      '10 PRINT "FIRST"\n20 INPUT A$\n30 PRINT "SAW ";A$\n',
      'utf8',
    );
  }, 60_000);

  it('leaves nothing held for a run that did not ask to keep it', async () => {
    await basically(['run', source(), '-m', 'zx81', '--frames', '60']);
    const status = await basically(['server', 'status', '--json']);
    expect(JSON.parse(status.out).holding).toBeNull();
  }, 120_000);

  it('holds the machine a run asked to keep, across separate commands', async () => {
    const ran = await basically([
      'run',
      source(),
      '-m',
      'zx81',
      '--hold',
      '--frames',
      '200',
    ]);
    expect(ran.code).toBe(0);
    expect(ran.out).toMatch(/FIRST/);

    // A separate process entirely, reaching the machine the last one left.
    const status = await basically(['server', 'status', '--json']);
    expect(JSON.parse(status.out).holding).toBe('ZX81');

    const looked = await basically(['look']);
    expect(looked.code).toBe(0);
    expect(looked.out).toMatch(/FIRST/);
  }, 120_000);

  it('reads the screen twice without disturbing it', async () => {
    // Reading costs no frames, so nothing about the machine may change between
    // one look and the next.
    const first = await basically(['look', '--json']);
    const second = await basically(['look', '--json']);
    expect(second.out).toBe(first.out);
  }, 120_000);

  it('acts on the machine, and the next command sees what that did', async () => {
    const before = await basically(['look', '--json']);
    const driven = await basically(['drive', 'PRESS H; PRESS I']);
    expect(driven.code).toBe(0);
    const after = await basically(['look', '--json']);
    expect(after.out).not.toBe(before.out);
  }, 120_000);

  it('writes a picture of the machine that is up', async () => {
    const picture = path.join(temporary, 'held.png');
    const shot = await basically(['screenshot', picture]);
    expect(shot.code).toBe(0);
    const bytes = readFileSync(picture);
    // A PNG, by its signature, rather than merely a file that exists.
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }, 120_000);

  it('measures the run in the machine own terms, off the machine still up', async () => {
    const timed = await basically(['time', '--json']);
    expect(timed.code).toBe(0);
    expect(JSON.parse(timed.out)).toBeTruthy();
  }, 120_000);

  it('lets the machine go when asked, and says so afterwards', async () => {
    await basically([
      'run',
      source(),
      '-m',
      'zx81',
      '--hold',
      '--frames',
      '60',
    ]);
    expect(
      JSON.parse((await basically(['server', 'status', '--json'])).out).holding,
    ).toBe('ZX81');
    // `run` without --hold releases; so does stopping the host.
    await basically(['run', source(), '-m', 'zx81', '--frames', '60']);
    expect(
      JSON.parse((await basically(['server', 'status', '--json'])).out).holding,
    ).toBeNull();
  }, 120_000);

  it('says how to get a machine when asked for one and none is held', async () => {
    const looked = await basically(['look']);
    expect(looked.code).toBe(1);
    expect(looked.err).toMatch(/No machine is up/);
  }, 60_000);
});

describe.skipIf(!built)('stopping the host', () => {
  it('reports that none was running rather than failing', async () => {
    await basically(['server', 'stop']);
    const again = await basically(['server', 'stop', '--json']);
    expect(again.code).toBe(0);
    expect(JSON.parse(again.out)).toMatchObject({ running: false });
  }, 60_000);

  it('says none is running rather than starting one to be asked', async () => {
    // Asking after a host is not asking for one; a command that needs one
    // starts it, and this is not that.
    await basically(['server', 'stop']);
    const status = await basically(['server', 'status', '--json']);
    expect(status.code).toBe(0);
    expect(JSON.parse(status.out)).toMatchObject({ running: false });
  }, 60_000);

  it('starts one again for the next command that needs it', async () => {
    const listed = await basically(['machines']);
    expect(listed.code).toBe(0);
    const status = await basically(['server', 'status', '--json']);
    expect(JSON.parse(status.out)).toMatchObject({
      running: true,
      holding: null,
    });
    await basically(['server', 'stop']);
  }, 60_000);
});
