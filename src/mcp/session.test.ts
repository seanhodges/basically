import { afterEach, describe, expect, it } from 'vitest';
import { parseDriveScript, runDriveScript } from '../app/driveScript';
import { decodeBytes } from '../ops/bytes';
import { createServerMachine, type ServerMachine } from './session';

/**
 * The machine the server holds: it stays up between calls, it advances only
 * when a call asks it to, and there is never more than one of it.
 *
 * The ZX81 because it is the cheapest machine to boot that reports its screen,
 * its variables and its line costs.
 */

/** A program that prints and then waits for a key, so a run leaves it waiting. */
const WAITING =
  '10 PRINT "PRESS A KEY"\n' +
  '20 IF INKEY$="" THEN GOTO 20\n' +
  '30 PRINT "IT WENT ON"\n';

let server: ServerMachine | null = null;

/** A server whose machine is let go however the test ends. */
function serving(): ServerMachine {
  server = createServerMachine();
  return server;
}

afterEach(() => {
  server?.dispose();
  server = null;
});

const lines = (s: ServerMachine) => s.session()!.readText()?.lines ?? [];
const shows = (s: ServerMachine, text: string) =>
  lines(s).some((line) => line.includes(text));

describe('the machine the server holds', () => {
  it('runs a program and keeps the machine it ran on', async () => {
    const server = serving();
    const result = await server.run({
      machine: 'zx81',
      source: '10 LET A=7\n20 PRINT A\n',
    });
    expect(result.errors).toEqual([]);
    expect(result.ended).toBe(true);
    expect(result.screen?.lines.some((l) => l.includes('7'))).toBe(true);

    // The run is over and the machine is still there to be asked about.
    const held = server.held();
    expect(held?.dialect.id).toBe('zx81');
    expect(held!.session.variables()).toContainEqual(
      expect.objectContaining({ name: 'A', value: '7' }),
    );
    // Measured once, over the run, without anybody asking for it in advance.
    expect(held!.session.measurements().profile?.lines.length).toBeGreaterThan(
      0,
    );
    expect(held!.session.timing()?.ending).toBe('finished');
  }, 20_000);

  it('shows a later call what an earlier one did to the machine', async () => {
    const server = serving();
    // Enough frames for the program to print and reach its key loop, where it
    // stays: nothing advances the machine once the run's own frames are spent.
    await server.run({ machine: 'zx81', source: WAITING, frames: 60 });
    expect(shows(server, 'PRESS A KEY')).toBe(true);
    expect(shows(server, 'IT WENT ON')).toBe(false);

    // A separate call acts on the machine the run left waiting...
    const session = server.session()!;
    const report = runDriveScript(
      session,
      parseDriveScript('PRESS A; WAIT FOR "IT WENT ON"'),
    );
    expect(report.ok).toBe(true);
    // ...and a call after that reads the screen that action left.
    expect(shows(server, 'IT WENT ON')).toBe(true);
  }, 20_000);

  it('spends frames only where a call asks for them, and reads without spending any', async () => {
    const server = serving();
    await server.run({ machine: 'zx81', source: WAITING, frames: 40 });
    const session = server.session()!;

    const before = session.readText();
    // Nothing between the two reads, including time: the machine does not run
    // on a clock of its own, so the second read is the first.
    await new Promise((r) => setTimeout(r, 30));
    expect(session.readText()).toEqual(before);

    // A call that acts spends the frames it needs, and the screen moves on.
    const report = runDriveScript(
      session,
      parseDriveScript('PRESS A; WAIT FOR "IT WENT ON"'),
    );
    expect(report.frames).toBeGreaterThan(0);
    expect(shows(server, 'IT WENT ON')).toBe(true);
  }, 20_000);

  it('paints the display of the machine that is up', async () => {
    const server = serving();
    await server.run({ machine: 'zx81', source: '10 PRINT "HI"\n' });
    const picture = server.session()!.capture()!;
    expect(picture.width).toBe(server.held()!.machine.displayWidth);
    expect([...decodeBytes(picture.png).subarray(0, 4)]).toEqual([
      0x89, 0x50, 0x4e, 0x47,
    ]);
  }, 20_000);

  it('lets the first machine go when a second program is run', async () => {
    const server = serving();
    await server.run({ machine: 'zx81', source: '10 PRINT "FIRST"\n' });
    const first = server.held()!;

    await server.run({ machine: 'zx81', source: '10 PRINT "SECOND"\n' });
    const second = server.held()!;
    expect(second.machine).not.toBe(first.machine);
    // Only one is up, and it is the newer one: the screen is the second
    // program's, never the first's.
    expect(shows(server, 'SECOND')).toBe(true);
    expect(shows(server, 'FIRST')).toBe(false);
  }, 30_000);

  it('leaves whatever is up alone when the program cannot run at all', async () => {
    const server = serving();
    await server.run({ machine: 'zx81', source: '10 PRINT "FIRST"\n' });
    const first = server.held()!;

    const result = await server.run({ machine: 'zx81', source: '' });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(server.held()).toBe(first);
    expect(shows(server, 'FIRST')).toBe(true);
  }, 30_000);

  it('lets the machine go on disposal, and says nothing is up', async () => {
    const server = serving();
    await server.run({ machine: 'zx81', source: '10 PRINT "HI"\n' });
    expect(server.session()).not.toBeNull();

    server.dispose();
    expect(server.held()).toBeNull();
    expect(server.session()).toBeNull();
    // Disposal of nothing is not an error: a client that disconnects without
    // ever running a program is the ordinary case.
    expect(() => server.dispose()).not.toThrow();
  }, 20_000);

  it("refuses a machine that is not registered as the caller's mistake", async () => {
    const server = serving();
    await expect(
      server.run({ machine: 'zx82', source: '10 PRINT 1\n' }),
    ).rejects.toThrow(/no registered machine/);
    expect(server.held()).toBeNull();
  });
});
