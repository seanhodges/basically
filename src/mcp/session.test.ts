import { afterEach, describe, expect, it } from 'vitest';
import { parseDriveScript, runDriveScript } from '../app/driveScript';
import { decodeBytes } from '../ops/bytes';
import type { FrameSink, ViewFrame } from '../dialects/headless/frameTap';
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
function serving(view?: FrameSink): ServerMachine {
  server = createServerMachine(view);
  return server;
}

/** A viewer that takes every frame offered and keeps them. */
function watching(): FrameSink & { frames: ViewFrame[] } {
  const frames: ViewFrame[] = [];
  return {
    frames,
    watching: () => true,
    free: () => true,
    send: (frame) => frames.push(frame),
  };
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

/**
 * The one guarantee this whole arrangement rests on: a machine that is being
 * watched is the same machine.
 *
 * Every measurement is counted in the machine's own frames and cycles, and a
 * view spends none of them, so those are identical rather than close. The
 * host's own clock is not identical - nothing timed on a real computer twice
 * is - but the view's cost is accounted for and taken back out, so the watched
 * run must not be systematically the slower of the two.
 */
describe('a machine that is being watched', () => {
  /** Something to measure: a loop that prints, and its running total. */
  const MEASURED = '10 FOR I=1 TO 200\n20 LET S=S+I\n30 NEXT I\n40 PRINT S\n';

  /**
   * A fixed count rather than "until it ends", so both runs spend exactly the
   * same frames and enough of them for the tap to sample several times.
   */
  const FRAMES = 60;

  it('answers exactly as it would unwatched, and reports no longer for it', async () => {
    const unwatched = serving();
    const alone = await unwatched.run({
      machine: 'zx81',
      source: MEASURED,
      frames: FRAMES,
    });
    const aloneSession = unwatched.session()!;
    const aloneReadings = {
      profile: aloneSession.measurements().profile,
      timing: aloneSession.timing(),
      variables: aloneSession.variables(),
      screen: aloneSession.readText(),
    };
    unwatched.dispose();

    const viewer = watching();
    const watched = serving(viewer);
    const seen = await watched.run({
      machine: 'zx81',
      source: MEASURED,
      frames: FRAMES,
    });
    watched.settleView();
    const seenSession = watched.session()!;

    // Somebody really was watching, or the comparison proves nothing.
    expect(viewer.frames.length).toBeGreaterThan(1);

    // Machine time: identical, not merely close.
    expect(seen.frames).toBe(alone.frames);
    expect(seenSession.measurements().profile).toEqual(aloneReadings.profile);
    expect(seenSession.timing()).toEqual(aloneReadings.timing);
    expect(seenSession.variables()).toEqual(aloneReadings.variables);
    expect(seenSession.readText()).toEqual(aloneReadings.screen);

    // Host time: what the view cost is taken back out, so the reported run
    // time stays a figure about the run. Compared with room for the ordinary
    // variation between two runs on a shared machine - the assertion is that
    // watching does not add its cost, not that a clock repeats itself.
    const encoding = viewer.frames.reduce((sum, f) => sum + f.png.length, 0);
    expect(encoding).toBeGreaterThan(0);
    expect(seen.timings.runMs).toBeLessThan(alone.timings.runMs * 3 + 50);
  }, 40_000);

  it('advances no frames while nothing is asked of it', async () => {
    const viewer = watching();
    const server = serving(viewer);
    await server.run({ machine: 'zx81', source: WAITING, frames: 40 });
    const session = server.session()!;

    const before = session.readText();
    const sampled = viewer.frames.length;
    // Nothing between the two reads but time, which the machine does not run
    // on: a view is a mirror, and a mirror asks for no frames.
    await new Promise((r) => setTimeout(r, 50));
    expect(session.readText()).toEqual(before);
    expect(viewer.frames.length).toBe(sampled);
  }, 30_000);
});

/**
 * Stopping a program on a line, on the machine the server holds.
 *
 * Here rather than over a stub because the questions are about the held
 * machine: whether the lines in force survive between requests as the machine
 * does, whether the stop leaves the machine where it stopped, and whether a
 * machine nobody asked to stop is the machine it was before.
 */
describe('the held machine stopping on a line', () => {
  /** A loop, so the same line is reached more than once. */
  const COUNTING =
    '10 LET A=0\n' +
    '20 LET A=A+1\n' +
    '30 IF A<4 THEN GOTO 20\n' +
    '40 PRINT A\n';

  it('stops the run before the line it was told to, and leaves the machine there', async () => {
    const server = serving();
    const result = await server.run({
      machine: 'zx81',
      source: COUNTING,
      breakpoints: [30],
    });

    expect(result.stoppedAt).toBe(30);
    // A run that stopped is not a run that ended, and says so structurally.
    expect(result.ended).toBe(false);
    const session = server.session()!;
    expect(session.position()).toMatchObject({ line: 30, running: true });
    // The lines the run was given are the lines in force afterwards, so a
    // later continue stops where the run would have.
    expect(session.breakpoints()).toEqual([30]);
    expect(session.variables()).toContainEqual(
      expect.objectContaining({ name: 'A', value: '1' }),
    );
  }, 30_000);

  it('keeps the lines in force between requests, and steps on from where it stopped', async () => {
    const server = serving();
    await server.run({
      machine: 'zx81',
      source: COUNTING,
      breakpoints: [30],
    });
    const session = server.session()!;

    // Nothing is remembered by the caller: the machine is asked, a step later.
    expect(session.stepLine(400)).toMatchObject({
      ending: 'stopped',
      line: 20,
    });
    expect(session.continueRun(400)).toMatchObject({
      ending: 'stopped',
      line: 30,
    });
    expect(session.variables()).toContainEqual(
      expect.objectContaining({ name: 'A', value: '2' }),
    );
    // Changed between stops, and the program then runs to its end.
    session.setBreakpoints([]);
    expect(session.continueRun(800).ending).toBe('ended');
    expect(shows(server, '4')).toBe(true);
  }, 30_000);

  it('leaves a machine nobody asked to stop exactly as it was', async () => {
    const server = serving();
    const result = await server.run({ machine: 'zx81', source: COUNTING });

    // The ordinary path, and the ordinary answers: the program ran to its end
    // and its picture was settled afterwards.
    expect(result.stoppedAt).toBeNull();
    expect(result.ended).toBe(true);
    expect(shows(server, '4')).toBe(true);
    expect(server.session()!.breakpoints()).toEqual([]);
  }, 30_000);

  it('runs to the end when the line it was told to stop before is never reached', async () => {
    const server = serving();
    const asked = await server.run({
      machine: 'zx81',
      source: COUNTING,
      breakpoints: [999],
    });
    server.dispose();
    const plain = await serving().run({ machine: 'zx81', source: COUNTING });

    expect(asked.stoppedAt).toBeNull();
    expect(asked.ended).toBe(true);
    // The same run it would have been with nothing asked for.
    expect(asked.screen?.lines).toEqual(plain.screen?.lines);
  }, 40_000);

  it('takes the same emulated time as a run with nothing named to stop on', async () => {
    // Frames are the machine's own clock, so "the same emulated time" is the
    // same frame count: stopping is reachable, and a run nobody stopped pays
    // nothing for it.
    const server = serving();
    const asked = await server.run({
      machine: 'zx81',
      source: COUNTING,
      breakpoints: [999],
    });
    server.dispose();
    const plain = await serving().run({ machine: 'zx81', source: COUNTING });

    expect(asked.frames).toBe(plain.frames);
  }, 40_000);

  it('gives two callers two machines that stop independently', async () => {
    // One server is one caller; a host gives each of its callers its own.
    const mine = serving();
    const yours = createServerMachine();
    try {
      await mine.run({ machine: 'zx81', source: COUNTING, breakpoints: [30] });
      const stopped = mine.session()!;
      // Running a second program here would let the first machine go - one
      // machine per process - so the second caller is asked about without
      // booting: the lines in force are this caller's alone.
      expect(stopped.breakpoints()).toEqual([30]);
      expect(yours.session()).toBeNull();
      stopped.setBreakpoints([20]);
      expect(stopped.breakpoints()).toEqual([20]);
      expect(yours.session()).toBeNull();
    } finally {
      yours.dispose();
    }
  }, 30_000);
});
