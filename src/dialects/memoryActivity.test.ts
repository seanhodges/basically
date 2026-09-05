/**
 * Every registered machine records what its CPU touches.
 *
 * The seam members are optional on `MachineEmulator` - a machine that cannot
 * tap its bus omits them and the memory-map overlay shows no live activity -
 * but "cannot" has to mean cannot. A machine that simply never had them wired
 * degrades silently: the overlay opens, paints nothing, and looks like a
 * program that touched no memory rather than like a machine that cannot say.
 * So this walks the registry, and a dialect added without the hooks fails here
 * instead.
 *
 * Behavioural rather than a `typeof` check, deliberately. The hooks are three
 * lines each and easy to write in a way that compiles and records nothing:
 * stamping on a `peek` the CPU never calls, draining a buffer the bus does not
 * fill, or forgetting the `enabled` flag so the overlay is armed for a machine
 * that reports every frame. Each case below is one of those.
 *
 * Ten frames of the ROM's own start-up is all the exercise this needs - a CPU
 * that fetches an instruction has already touched memory - so no machine is
 * booted to its prompt here.
 *
 * The hooks are demanded of every machine; only *exercising* them needs a ROM.
 * A checkout that has deleted a removable image (see
 * public/roms/ATTRIBUTION.md) runs no CPU for that machine and has nothing to
 * stamp, so the split is decided from {@link hasRom} rather than from a list.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects } from './registry';
import {
  bootMachine,
  hasRom,
  installNodeRomLoading,
  runFrames,
} from './bootHarness';
import type { Dialect, MachineEmulator } from './types';

/**
 * Machines with no memory bus to tap, and why. An exact set rather than a
 * silent skip: the decision has to be written down, and a machine that gains a
 * bus has to come out of it.
 */
const NO_MEMORY_BUS: Record<string, string> = {
  // The default backend interprets BASIC statements rather than executing a Z80
  // over a RAM image, so there are no CPU accesses to record - the same reason
  // it reports no BASIC memory figures (see lineProfiling.test.ts).
  trs80: 'the interpreter backend executes no CPU over a RAM image',
  // No CPU core exists for this machine to execute at all - no GE-2xx
  // implementation in JS or WASM - so the backend is a clean-room interpreter
  // with no core image beneath it and no access to stamp.
  ge235: 'a clean-room interpreter with no core image beneath it',
};

/** Frames of the ROM's own start-up; enough that the CPU has fetched something. */
const FRAMES = 10;

const taps = (machine: MachineEmulator): boolean =>
  typeof machine.setMemoryActivityRecording === 'function' &&
  typeof machine.drainMemoryActivity === 'function';

let restoreRomLoading: () => void;

beforeAll(() => {
  restoreRomLoading = installNodeRomLoading();
});

afterAll(() => {
  restoreRomLoading();
});

/** Run `body` against a freshly constructed machine, disposing either way. */
async function withMachine(
  dialect: Dialect,
  body: (machine: MachineEmulator) => Promise<void>,
): Promise<void> {
  const machine = await bootMachine(dialect);
  try {
    await body(machine);
  } finally {
    machine.dispose();
  }
}

describe('every registered machine records its memory activity', () => {
  for (const dialect of dialects) {
    const excused = NO_MEMORY_BUS[dialect.id];

    if (excused) {
      it(`${dialect.id} taps no bus: ${excused}`, async () => {
        await withMachine(dialect, async (machine) => {
          expect(taps(machine)).toBe(false);
        });
      }, 120000);
      continue;
    }

    it(`${dialect.id} stamps the addresses its CPU touches`, async () => {
      await withMachine(dialect, async (machine) => {
        expect(
          taps(machine),
          `${dialect.id} should offer setMemoryActivityRecording and ` +
            'drainMemoryActivity, or be listed in NO_MEMORY_BUS with a reason',
        ).toBe(true);
        // No image to run: the hooks are there, and there is no CPU to prove
        // them with.
        if (!hasRom(dialect)) return;

        // Off by default: an overlay nobody opened costs the machine nothing,
        // and a machine reporting activity unasked would keep the panel
        // repainting for the life of the session.
        await runFrames(machine, FRAMES);
        expect(
          machine.drainMemoryActivity!(),
          `${dialect.id} drained activity while recording was off`,
        ).toBeNull();

        machine.setMemoryActivityRecording!(true);
        await runFrames(machine, FRAMES);
        const hits = machine.drainMemoryActivity!();
        expect(
          hits,
          `${dialect.id} recorded nothing while armed`,
        ).not.toBeNull();

        // The buffer is indexed by CPU address, so the overlay can map a byte
        // of it onto a region of the machine's own memory map.
        const space = dialect.memoryMap?.addressSpace;
        if (space !== undefined) expect(hits!.length).toBe(space);

        const touched = hits!.reduce((n, byte) => n + (byte === 0 ? 0 : 1), 0);
        expect(
          touched,
          `${dialect.id} ran ${FRAMES} frames and touched no address`,
        ).toBeGreaterThan(0);

        // A drain hands the filled buffer over and installs a clean one, so the
        // next drain reports the next period rather than everything since the
        // overlay opened.
        const second = machine.drainMemoryActivity!()!;
        expect(second.some((byte) => byte !== 0)).toBe(false);

        // ...and disarming stops it again, which is what makes the cost of the
        // panel bounded by the panel being open.
        machine.setMemoryActivityRecording!(false);
        await runFrames(machine, FRAMES);
        expect(machine.drainMemoryActivity!()).toBeNull();
      });
    }, 120000);
  }

  it('excuses only registered dialects', () => {
    // Guards the shape of the check: an entry left behind by a removed machine
    // would otherwise excuse nothing and never say so.
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of Object.keys(NO_MEMORY_BUS)) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
  });
});
