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
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects } from './registry';
import { bootMachine, installNodeRomLoading, runFrames } from './bootHarness';
import type { LineCost, MachineEmulator } from './types';

/** Booting the real ROMs dominates every case here (see c64Machine.test.ts). */
const BOOT_TIMEOUT_MS = 60_000;

const PROBE = '10 LET A=0\n20 LET A=A+1\n30 GOTO 20\n';
/** Frames given to reach the loop; the slowest ROM boot plus its injected RUN. */
const SETTLE_FRAMES = 400;
/** Frames measured. Long enough that a slice's worth of noise cannot matter. */
const MEASURED_FRAMES = 200;

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

function costOf(costs: readonly LineCost[], line: number): number {
  return costs.find((c) => c.line === line)?.cost ?? 0;
}

/** Boot, run the probe to its loop, then measure it. */
async function measureProbe(
  machine: MachineEmulator,
  image: Uint8Array,
): Promise<LineCost[] | null> {
  machine.loadProgram(image);
  // The Commodore and Acorn machines queue their boot-and-inject on a
  // microtask; let it land before running frames at them.
  await new Promise((r) => setTimeout(r, 0));
  await runFrames(machine, SETTLE_FRAMES);
  machine.setProfileRecording?.(true);
  await runFrames(machine, MEASURED_FRAMES);
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
        } finally {
          machine.dispose();
        }
      },
      BOOT_TIMEOUT_MS,
    );
  }

  it('accounts for every registered dialect either way', () => {
    // Guards the shape of the check itself: a table entry left behind by a
    // removed machine, or an emptied registry, would otherwise pass every case
    // above by doing nothing.
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of [
      ...Object.keys(NO_LINE_COSTS),
      ...Object.keys(NO_MEMORY_FIGURES),
    ]) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
    expect(dialects.length - Object.keys(NO_LINE_COSTS).length).toBeGreaterThan(
      1,
    );
  });
});
