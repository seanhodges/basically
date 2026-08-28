/**
 * Measuring a run must not change it.
 *
 * The claim is that a measured run executes the same instructions, takes the
 * same emulated time and paints the same screen as an unmeasured one - which is
 * what lets recording be always-on rather than a mode the user has to remember.
 * It is not free of risk on every core: most machines only read a cell they
 * already expose, but the Acorns run their CPU in whole budgets and are sliced
 * while measuring, and the CPCs' run loop and debug loop were folded onto one
 * stepper to carry the charge. Those are the cases this proves.
 *
 * One machine per emulator wiring family rather than every registered machine:
 * the thing at risk is the *wiring*, and `lineProfiling.test.ts` already boots
 * every machine to check what it measures. Each family runs two machines of the
 * same dialect from the same program - one armed, one not - for the same number
 * of frames, and their screens have to agree afterwards.
 *
 * Which family a machine belongs to is hand-decided, but *that* it belongs to
 * one is not: the claims below are crosschecked against the registry, so a
 * machine wired to its core in a way none of these covers fails here until it
 * joins a family or starts one.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects, getDialect } from './registry';
import {
  bootMachine,
  installNodeRomLoading,
  runFrames,
  screenText,
} from './bootHarness';

const BOOT_TIMEOUT_MS = 60_000;

/**
 * One dialect per way a profiled machine is wired to its core: the in-tree Z80
 * machines, the shared 6502, viciious, jsbeeb, the CPC's own Z80 loop, and the
 * PMD 85, whose run loop and debug loop were folded onto one stepper to carry
 * the charge the way the CPC's were.
 */
const FAMILIES: Record<string, string[]> = {
  /** The self-contained Z80 machines under src/dialects/<id>/. */
  zxspectrum: ['zxspectrum', 'zxspectrum128', 'zx80', 'zx81'],
  /** The shared cpu6502 core. */
  pet: ['pet', 'vic20', 'atom'],
  /** viciious. */
  commodore64: ['commodore64'],
  /** jsbeeb. */
  bbcmicro: ['bbcmicro', 'bbcmaster'],
  /** The CPC's own Z80 run loop. */
  cpc464: ['cpc464', 'cpc6128'],
  /** 8080 object code through the shared i8080 layer. */
  pmd85: ['pmd85'],
  /** Its own bus over the shared cpu6502 core. */
  apple1: ['apple1'],
  /** ANTIC's own bus over the shared cpu6502 core. */
  atari800: ['atari800', 'atari400'],
};

/** Machines with no profiled run to compare, and why. */
const NOT_PROFILED: Record<string, string> = {
  // The 8K BASIC image carries no redistribution grant and does not ship, so
  // there is no CPU to run here at all - the same split the loop-speed and
  // memory-activity batteries make.
  altair8800: 'its ROM does not ship, so no run can be measured',
  // The default backend interprets BASIC statements rather than executing a CPU
  // over a RAM image, so there is no run loop to fold a profiler onto (see
  // memoryActivity.test.ts).
  trs80: 'the interpreter backend executes no CPU over a RAM image',
};

/** Prints as it counts, so the screen carries the run's whole history. */
const PROBE = '10 FOR I=1 TO 40\n20 PRINT I;\n30 NEXT I\n40 GOTO 10\n';
const FRAMES = 300;

describe('measuring a run does not change it', () => {
  let undoRomLoading: () => void;
  beforeAll(() => {
    undoRomLoading = installNodeRomLoading();
  });
  afterAll(() => undoRomLoading());

  for (const id of Object.keys(FAMILIES)) {
    it(
      `${id} reaches the same state measured or not`,
      async () => {
        const dialect = getDialect(id);
        const { image, errors } = dialect.tokenize(PROBE);
        expect(errors).toEqual([]);

        const run = async (measured: boolean) => {
          const machine = await bootMachine(dialect);
          try {
            machine.loadProgram(image);
            await new Promise((r) => setTimeout(r, 0));
            if (measured) machine.setProfileRecording?.(true);
            await runFrames(machine, FRAMES);
            return {
              screen: screenText(machine),
              line: machine.currentLine?.() ?? null,
              costs: machine.drainProfile?.() ?? null,
            };
          } finally {
            machine.dispose();
          }
        };

        const measured = await run(true);
        const plain = await run(false);
        expect(measured.screen).toBe(plain.screen);
        expect(measured.line).toBe(plain.line);
        // And the measured run really was measured, so the agreement above is
        // two runs of the same program rather than two recordings of nothing.
        expect(measured.costs?.length ?? 0).toBeGreaterThan(0);
        expect(plain.costs).toBeNull();
      },
      BOOT_TIMEOUT_MS,
    );
  }
});

describe('every registered machine is covered by a profiling family', () => {
  it('claims each dialect exactly once, or excuses it by name', () => {
    const claimed = Object.values(FAMILIES).flat();
    expect(new Set(claimed).size, 'a machine is claimed twice').toBe(
      claimed.length,
    );
    const covered = new Set([...claimed, ...Object.keys(NOT_PROFILED)]);
    expect(
      dialects.map((d) => d.id).filter((id) => !covered.has(id)),
      'claim the machine in FAMILIES under the representative whose wiring it ' +
        'shares, or excuse it in NOT_PROFILED with a reason',
    ).toEqual([]);
  });

  it('claims and excuses only registered dialects', () => {
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of [
      ...Object.keys(FAMILIES),
      ...Object.values(FAMILIES).flat(),
      ...Object.keys(NOT_PROFILED),
    ]) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
  });

  // A representative that does not stand for itself would leave its own family
  // measured by a machine outside it.
  it('runs each representative as a member of the family it heads', () => {
    for (const [id, members] of Object.entries(FAMILIES)) {
      expect(members, `${id} does not claim itself`).toContain(id);
    }
  });
});
