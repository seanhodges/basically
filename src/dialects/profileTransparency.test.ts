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
 * One machine per emulator wiring family rather than all fourteen: the thing at
 * risk is the *wiring*, and `lineProfiling.test.ts` already boots every machine
 * to check what it measures. Each family runs two machines of the same dialect
 * from the same program - one armed, one not - for the same number of frames,
 * and their screens have to agree afterwards.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { getDialect } from './registry';
import {
  bootMachine,
  installNodeRomLoading,
  runFrames,
  screenText,
} from './bootHarness';

const BOOT_TIMEOUT_MS = 60_000;

/**
 * One dialect per way a machine is wired to its core: the in-tree Z80 machines,
 * the shared 6502, viciious, jsbeeb, the CPC's own Z80 loop, and the statement
 * interpreter.
 */
const FAMILIES = [
  'zxspectrum',
  'pet',
  'commodore64',
  'bbcmicro',
  'cpc464',
  'trs80',
];

/** Prints as it counts, so the screen carries the run's whole history. */
const PROBE = '10 FOR I=1 TO 40\n20 PRINT I;\n30 NEXT I\n40 GOTO 10\n';
const FRAMES = 300;

describe('measuring a run does not change it', () => {
  let undoRomLoading: () => void;
  beforeAll(() => {
    undoRomLoading = installNodeRomLoading();
  });
  afterAll(() => undoRomLoading());

  for (const id of FAMILIES) {
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
