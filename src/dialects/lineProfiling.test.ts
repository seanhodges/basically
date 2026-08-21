/**
 * What every registered machine measures about a run, checked against the
 * machine rather than against a written-down list.
 *
 * Per-line costs are accumulated by each machine inside the step function its
 * ordinary run and its debug slices both funnel through - `stepInstruction` on
 * the Z80 machines, `tickOnce`/`tick` on the Commodores, a sliced `runCycles` on
 * the Acorns, a statement on the TRS-80's interpreter. The instrumentation is
 * per machine, but the fact it has to produce is one fact, so it is checked once
 * here over the registry instead of fourteen times in fourteen files.
 *
 * The probe program is deliberately the plainest hot loop there is, and
 * tokenizes on every dialect:
 *
 *     10 LET A=0      <- runs once, before recording is armed
 *     20 LET A=A+1    <- the loop's work
 *     30 GOTO 20      <- the loop's jump
 *
 * so line 20 must dominate, line 30 must be second, and line 10 must not appear
 * at all - it had already run when the recorder was armed, which is also what
 * proves nothing is charged retrospectively.
 *
 * A second probe churns strings, for the other half of what a machine measures:
 * the bytes charged to the line that took them. See {@link CHURN} below.
 *
 * Each probe is then re-measured through `debugStep`, because that is how a
 * program is usually run: a debug session opens on an ordinary press of Play
 * for every dialect that models line debugging, so a machine charging only on
 * its plain frame path measures nothing the user ever asks for. The PMD 85 did
 * exactly that - its debug loop stepped the CPU itself and never reached the
 * charge - and nothing here noticed, every case above driving `runFrame`.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects } from './registry';
import {
  bootMachine,
  installNodeRomLoading,
  runFrames,
  runUntil,
} from './bootHarness';
import { MEMORY_SAMPLE_FRAMES, RunProfiler } from '../app/runProfile';
import type { LineCost, MachineEmulator } from './types';

/** Booting the real ROMs dominates every case here (see c64Machine.test.ts). */
const BOOT_TIMEOUT_MS = 60_000;

const PROBE = '10 LET A=0\n20 LET A=A+1\n30 GOTO 20\n';
/** Frames given to reach the loop; the slowest ROM boot plus its injected RUN. */
const SETTLE_FRAMES = 400;
/** Frames measured. Long enough that a slice's worth of noise cannot matter. */
const MEASURED_FRAMES = 200;
/** Debug slices measured. A slice is a frame's cycles, so a handful is plenty. */
const DEBUG_SLICES = 20;

/**
 * Machines that cannot report per-line costs, and why.
 *
 * Two of them for the reason `debugCapability.test.ts` records for the
 * step-through debugger - a cost can only be charged to a line the machine can
 * name, and neither of these can name one. The third for the other half of the
 * same question: a cost is charged in CPU cycles, and a backend that interprets
 * statements rather than executing a CPU has none to charge. Written down so
 * each absence reads as a decision; the crosscheck below keeps it honest.
 */
const NO_LINE_COSTS: Record<string, string> = {
  atom: 'no readable "line being executed" cell',
  altair8800: 'the 8K BASIC image does not ship, so nothing can be derived',
  trs80:
    'the interpreter executes statements, so there are no cycles to charge',
};

/**
 * Machines that cannot report their BASIC memory figures, and why.
 *
 * The TRS-80 backend interprets BASIC statements rather than executing a Z80
 * over a RAM image, so it has no BASIC pointers to read a used/free split out
 * of - there is no figure to report rather than a figure left unread.
 */
const NO_MEMORY_FIGURES: Record<string, string> = {
  trs80: 'the interpreter has no RAM image, so there are no BASIC pointers',
};

/**
 * The memory probe: a loop that repeatedly extends a string and then drops it.
 *
 *     10 LET A$=""
 *     20 FOR I=1 TO 20     <- the loop's frame
 *     30 LET A$=A$+"X"     <- the only line that takes memory
 *     40 NEXT I
 *     50 LET A$=""         <- gives it back
 *     60 GOTO 20
 *
 * Bounded at twenty characters on purpose. A string left to grow without limit
 * fills the heap, and a Commodore then spends the whole measured window inside
 * line 30 reclaiming - the very stall this figure exists to explain, but with no
 * change of line in it, so nothing can be charged and the probe measures
 * nothing. Dropping the string each pass keeps the churn without the stall.
 */
const CHURN =
  '10 LET A$=""\n' +
  '20 FOR I=1 TO 20\n' +
  '30 LET A$=A$+"X"\n' +
  '40 NEXT I\n' +
  '50 LET A$=""\n' +
  '60 GOTO 20\n';

/** Frames measured for the memory probe; the slowest machine needs the room. */
const CHURN_FRAMES = 300;

/**
 * Machines whose reported in-use figure does not move as {@link CHURN} runs, and
 * why, so no line is charged for it.
 *
 * This is the coverage of the figure itself, not of the attribution: bytes are
 * charged wherever the machine's own account moves, so the per-line reading
 * covers exactly what the memory chart above it covers and never more. The
 * Acorns report `VARTOP - PAGE` and the Amstrads `arrEnd - programStart`, and
 * both were measured flat across the probe - a program's string churn happens
 * outside the range either figure spans, so neither the chart nor the per-line
 * reading can see it.
 *
 * The ZX80 is here for a different reason: its ROM has no string concatenation,
 * so the probe stops on an error and there is nothing to charge. That is the
 * machine, not the measurement.
 */
const NO_CHURN_IN_FIGURE: Record<string, string> = {
  bbcmicro: 'string churn happens outside PAGE..VARTOP, the range it reports',
  bbcmaster: 'string churn happens outside PAGE..VARTOP, the range it reports',
  cpc464: 'string churn happens above the ceiling its figure counts up to',
  cpc6128: 'string churn happens above the ceiling its figure counts up to',
  zx80: 'the ROM has no string concatenation, so the probe cannot churn',
};

function costOf(costs: readonly LineCost[], line: number): number {
  return costs.find((c) => c.line === line)?.cost ?? 0;
}

function bytesOf(costs: readonly LineCost[], line: number): number {
  return costs.find((c) => c.line === line)?.allocated ?? 0;
}

function reclaimedOf(costs: readonly LineCost[], line: number): number {
  return costs.find((c) => c.line === line)?.reclaimed ?? 0;
}

/**
 * Slices a running program the way the IDE's debug session does: no
 * breakpoints, so it never pauses and simply advances a frame's worth of
 * cycles at a time.
 */
async function measureDebugSlices(
  machine: MachineEmulator,
  slices: number,
): Promise<LineCost[] | null> {
  machine.drainProfile?.(); // costs so far belong to the frame-path probe
  for (let i = 0; i < slices; i++) {
    machine.debugStep!({ breakpoints: new Set(), mode: 'run', fromLine: null });
    // Yielded on the same cadence as the harness's frame loop, for the same
    // reason: the jsbeeb and Commodore cores settle work on timers.
    if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return machine.drainProfile?.() ?? null;
}

/** Boot, run the probe to its loop, then measure it. */
async function measureProbe(
  machine: MachineEmulator,
  image: Uint8Array,
  frames = MEASURED_FRAMES,
): Promise<LineCost[] | null> {
  // Disarmed first: a second probe on the same machine must not inherit the
  // first one's costs, nor the memory baseline it left behind.
  machine.setProfileRecording?.(false);
  machine.loadProgram(image);
  // The Commodore and Acorn machines queue their boot-and-inject on a
  // microtask; let it land before running frames at them.
  await new Promise((r) => setTimeout(r, 0));
  await runFrames(machine, SETTLE_FRAMES);
  machine.setProfileRecording?.(true);
  await runFrames(machine, frames);
  return machine.drainProfile?.() ?? null;
}

describe('every registered machine measures what it can', () => {
  let undoRomLoading: () => void;
  beforeAll(() => {
    undoRomLoading = installNodeRomLoading();
  });
  afterAll(() => undoRomLoading());

  for (const dialect of dialects) {
    it(
      `${dialect.id} charges a run's time to the lines that ran`,
      async () => {
        const machine = await bootMachine(dialect);
        try {
          const arms = typeof machine.setProfileRecording === 'function';
          const drains = typeof machine.drainProfile === 'function';
          expect(
            arms,
            `${dialect.id} implements one half of the profile seam but not the other`,
          ).toBe(drains);
          expect(
            arms,
            `${dialect.id} ${arms ? 'can' : 'cannot'} report per-line costs, ` +
              `so it should ${arms ? 'not ' : ''}be listed in NO_LINE_COSTS`,
          ).toBe(!(dialect.id in NO_LINE_COSTS));

          const reportsMemory = typeof machine.readMemoryStats === 'function';
          expect(
            reportsMemory,
            `${dialect.id} ${reportsMemory ? 'can' : 'cannot'} report memory ` +
              `figures, so it should ${reportsMemory ? 'not ' : ''}be listed ` +
              'in NO_MEMORY_FIGURES',
          ).toBe(!(dialect.id in NO_MEMORY_FIGURES));

          // Off by default: nothing measures a machine nobody armed.
          expect(machine.drainProfile?.() ?? null).toBeNull();

          const { image, errors } = dialect.tokenize(PROBE);
          expect(errors).toEqual([]);
          const costs = await measureProbe(machine, image);
          if (!arms) {
            expect(costs).toBeNull();
            return;
          }
          expect(costs).not.toBeNull();
          const measured = costs!;
          expect(
            measured.length,
            `${dialect.id} measured nothing over ${MEASURED_FRAMES} frames`,
          ).toBeGreaterThan(0);

          const work = costOf(measured, 20);
          const jump = costOf(measured, 30);
          expect(
            work,
            'the loop body should be the hottest line',
          ).toBeGreaterThan(jump);
          expect(
            jump,
            'the loop jump should have cost something',
          ).toBeGreaterThan(0);
          // Line 10 ran before the recorder was armed, so its cost belongs to
          // nobody: a line that did not run while measured carries no cost.
          expect(costOf(measured, 10)).toBe(0);

          // The same loop, advanced by debug slices instead of frames, on the
          // machine that is already running it - a few slices rather than a
          // second settle, because all this has to establish is that the charge
          // is on the shared step rather than on one of the two paths.
          if (typeof machine.debugStep === 'function') {
            const sliced = await measureDebugSlices(machine, DEBUG_SLICES);
            expect(
              costOf(sliced ?? [], 20),
              `${dialect.id} charges nothing while being debugged, so an ` +
                'ordinary run - which opens a debug session - measures nothing',
            ).toBeGreaterThan(0);
          }

          // The other half: bytes charged to the line that took them. Measured
          // on the same booted machine, because booting the ROM is the whole
          // cost of this file.
          const churn = dialect.tokenize(CHURN);
          expect(churn.errors).toEqual([]);
          const taken = (await measureProbe(
            machine,
            churn.image,
            CHURN_FRAMES,
          ))!;
          // Every machine that can report a memory figure attributes with it;
          // one that cannot must report cycles alone rather than zero bytes,
          // which would read as "measured, and this line took nothing".
          expect(
            taken.every(
              (c) =>
                typeof c.allocated === 'number' &&
                typeof c.reclaimed === 'number',
            ),
            `${dialect.id} ${reportsMemory ? 'reports' : 'does not report'} ` +
              'memory figures, so its drained costs should ' +
              `${reportsMemory ? '' : 'not '}carry bytes`,
          ).toBe(reportsMemory);
          if (dialect.id in NO_CHURN_IN_FIGURE) return;

          const built = bytesOf(taken, 30);
          expect(
            built,
            'the line that extends the string should carry the bytes',
          ).toBeGreaterThan(0);
          // Not the line beside it. This is the whole point of reading the
          // figure at a change of line rather than spreading a period's growth
          // over the lines that ran in it: line 40 runs exactly as often as
          // line 30 and takes nothing.
          expect(bytesOf(taken, 40)).toBe(0);
          expect(bytesOf(taken, 60)).toBe(0);
          // Nor the line that gives the string back, which takes nothing
          // whatever it reclaims - a reclaim is charged apart, and whether one
          // lands here at all is the machine's business: a Sinclair shrinks the
          // variable in place, and a Commodore leaves garbage its free figure
          // only recovers from at a collection this bounded probe need not
          // trigger.
          expect(bytesOf(taken, 50)).toBe(0);
          // Which line the reclaim lands on is the ROM's business, so nothing
          // is asserted about it here. Measured across the probe: the Sinclairs
          // give the bytes back on 40 and 50, as NEXT and the empty assignment
          // drop the old copies; the PET and VIC-20 collect inside line 30
          // itself, which then both takes and reclaims; and the C64 reclaims
          // nothing at all, its heap being large enough that a probe bounded at
          // twenty characters never triggers a collection. All three readings
          // are correct, and only the first would survive a per-line
          // expectation. What must hold everywhere is that a reclaim is charged
          // apart from a taking, which the per-line arithmetic covers in
          // `lineCostRecorder.test.ts` against scripted figures.
          //
          // What does hold on every one of them: the jump back moves no memory
          // in either direction. A reclaim charged there would mean the figure
          // was being read somewhere other than at a change of line.
          expect(reclaimedOf(taken, 60)).toBe(0);
          expect(reclaimedOf(taken, 20)).toBe(0);
        } finally {
          machine.dispose();
        }
      },
      BOOT_TIMEOUT_MS,
    );
  }

  /**
   * The case per-line charging cannot cover, and what is offered instead.
   *
   * Pricing a line needs the machine to leave it: the figure is read when the
   * executing line changes, and charged to the line that has just stopped. So a
   * program whose loop is written on one line - which BASIC invites, and which
   * is written that way precisely where speed matters - never changes line at
   * all, and has nothing charged however much memory it takes.
   *
   * The C64 because its figure counts the string heap, so the memory this takes
   * is memory it can see; the same program on a machine whose figure spans a
   * narrower range would move nothing to spread.
   */
  const ONE_LINE = '10 A$=A$+"X":GOTO 10\n';

  it(
    'spreads a rise no line could be charged over the lines that ran',
    async () => {
      const dialect = dialects.find((d) => d.id === 'commodore64')!;
      const machine = await bootMachine(dialect);
      try {
        const { image, errors } = dialect.tokenize(ONE_LINE);
        expect(errors).toEqual([]);
        machine.loadProgram(image);
        await new Promise((r) => setTimeout(r, 0));
        // Measured from the moment the program starts rather than after the
        // usual settle: this heap fills in the first few seconds, and a run
        // armed after that finds memory already at its ceiling and flat.
        const started = await runUntil(
          machine,
          () => machine.currentLine?.() !== null,
          SETTLE_FRAMES,
        );
        expect(started, 'the program never started').toBe(true);
        machine.setProfileRecording?.(true);

        // Driven exactly as the run loop drives it, because the fallback lives
        // in the profiler rather than in the machine: the machine reports what
        // it can, and the profiler prices what is left over.
        const profiler = new RunProfiler(null, [10]);
        for (let i = 0; i < MEMORY_SAMPLE_FRAMES * 12; i++) {
          await runFrames(machine, 1);
          profiler.frame(
            machine.drainProfile?.() ?? null,
            () => machine.readMemoryStats?.() ?? null,
            machine.frameHz,
          );
        }

        const profile = profiler.snapshot();
        // The premise: memory climbed over the run, and the machine charged
        // none of it, having never left the line taking it.
        const memory = profile.memory!;
        expect(memory.samples.at(-1)!.used).toBeGreaterThan(
          memory.samples[0]!.used,
        );
        const account = profile.allocations!;
        expect(
          account.accuracy,
          'the machine priced a line after all, so this program no longer ' +
            'reaches the case the fallback exists for',
        ).toBe('approximate');
        // One line ran, so the spread lands on it whole - the weighting has
        // nothing to be coarse about.
        expect(account.lines.map((a) => a.line)).toEqual([10]);
        expect(account.lines[0]!.bytes).toBeGreaterThan(0);
      } finally {
        machine.dispose();
      }
    },
    BOOT_TIMEOUT_MS,
  );

  /**
   * What the ROM names between the typed RUN and the program's first line.
   *
   * A machine reads its executing line out of BASIC's own cell, and across that
   * gap the cell holds whatever it held last: Commodore BASIC V2 reads as line 0
   * for a few thousand cycles, on both the C64 and the VIC-20. Measuring from
   * the moment the run loop arms - which is at `loadProgram`, before the ROM has
   * taken the program - therefore charges real cycles to a line the program does
   * not have, and a short run ranks it.
   *
   * The C64 because it is one of the two machines that does this. What the fix
   * turns on is not the machine, though: a line the program does not have is
   * dropped whoever named it, which is `runProfile.test.ts`.
   */
  it(
    'charges nothing to the line a ROM names before the program starts',
    async () => {
      const dialect = dialects.find((d) => d.id === 'commodore64')!;
      const machine = await bootMachine(dialect);
      try {
        const { image } = dialect.tokenize(PROBE);
        machine.loadProgram(image);
        // Armed exactly where the run loop arms it, which is the whole point:
        // the existing probes above arm after the program is already looping,
        // and never see this.
        machine.setProfileRecording?.(true);
        machine.drainProfile?.();
        await new Promise((r) => setTimeout(r, 0));

        const profiler = new RunProfiler(null, [10, 20, 30]);
        for (let i = 0; i < SETTLE_FRAMES + MEASURED_FRAMES; i++) {
          await runFrames(machine, 1);
          profiler.frame(
            machine.drainProfile?.() ?? null,
            () => machine.readMemoryStats?.() ?? null,
            machine.frameHz,
          );
        }

        const measured = profiler.snapshot().lines!;
        expect(
          measured.map((c) => c.line).sort((a, b) => a - b),
          'only lines the program has may be charged',
        ).toEqual([10, 20, 30]);
      } finally {
        machine.dispose();
      }
    },
    BOOT_TIMEOUT_MS,
  );

  it('accounts for every registered dialect either way', () => {
    // Guards the shape of the check itself: a table entry left behind by a
    // removed machine, or an emptied registry, would otherwise pass every case
    // above by doing nothing.
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of [
      ...Object.keys(NO_LINE_COSTS),
      ...Object.keys(NO_MEMORY_FIGURES),
      ...Object.keys(NO_CHURN_IN_FIGURE),
    ]) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
    expect(dialects.length - Object.keys(NO_LINE_COSTS).length).toBeGreaterThan(
      1,
    );
  });
});
