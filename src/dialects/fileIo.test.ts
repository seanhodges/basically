/**
 * Every registered machine says whether it captures the files a running program
 * saves, and every machine that says it does is made to prove it - both within
 * a run and across two of them.
 *
 * The IDE hands the same virtual filesystem to every machine at construction
 * (`src/components/EmulatorPane.tsx`), and taking that argument is not evidence
 * of using it. Four machines took it and never read it again for as long as it
 * existed. Nothing found them: the machine constructors use their `opts` object
 * for `roms`, so the compiler never fires on the field beside it, and the store
 * is a constructor argument, so - unlike `debugStep` in `debugCapability.test.ts`
 * - there is no member on the returned machine to probe. So `capturesDataFiles`
 * is declared by hand and this is where the claim is settled.
 *
 * Behavioural for the machines that claim it, and a round trip rather than a
 * write: a machine can be wired to fill the store and never serve a load out of
 * it, and a check that only watched `save` would call that working. The programs
 * come from `fileIoProbes.ts`, lifted from each machine's own file-I/O test.
 *
 * Then the same machine is run a second time, on a program that only loads,
 * against the store the first run filled. That is the cross-run guarantee the
 * IDE now makes - a start restores the machine's files rather than emptying
 * them, so a program reads on one run what it saved on an earlier one - and it
 * is a claim about each machine's load path rather than about the store: no
 * machine's code changed to gain it, which is precisely why nothing in a
 * machine would fail if one of them stopped answering out of a store it did not
 * fill itself. Every machine that captures files is held to it; the ones that
 * capture none are excused here by the same table that excuses them above.
 *
 * Structural for the machines that do not, and deliberately so. Proving that
 * negative means running the file statement, which is the thing those machines
 * cannot do, and on several of them it waits rather than failing - burning the
 * whole frame budget per machine to discover what {@link NO_DATA_FILE_TRAPS}
 * already says. The hang is the finding, and it belongs in the reason text.
 *
 * What that costs is worth naming: this cannot tell a machine with no traps from
 * one whose traps are broken. The gap closes at the transition rather than in
 * the steady state - a machine gaining traps must set the flag to leave the
 * table, and setting the flag moves it into the behavioural branch, so traps
 * cannot be acquired without being run or lost without failing here.
 *
 * Only the claimants boot; the machines in the table below cost nothing, which
 * is why this battery is a fraction of what `loopSpeed.test.ts` pays to run a
 * program on every registered machine. A claimant whose wiring breaks does not
 * fail fast, though - it waits out its frame budget first, which is what the
 * per-case timeout is sized for.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects } from './registry';
import {
  bootMachine,
  hasRom,
  installNodeRomLoading,
  runUntil,
  screenText,
} from './bootHarness';
import {
  FILE_IO_PROBES,
  FILE_IO_PROBE_BY_DIALECT,
  FILE_IO_RESTORE_OK,
  FILE_IO_RESTORE_SENTINEL,
  FILE_IO_SENTINEL,
} from './fileIoProbes';
import type { MachineFileEntry, MachineFileStore } from './types';

/** Booting a real ROM and running a BASIC program to its end; see loopSpeed.test.ts. */
const BOOT_TIMEOUT_MS = 120000;

/**
 * The machines that do not capture a program's files, and why.
 *
 * Some of these are not hardware limitations and are not written as if they
 * were: the machine is handed the store, declares it in its constructor, and
 * never reads it. Those entries are outstanding work, and saying so is the
 * point - a reason like "no disk hardware" would close a question that is
 * actually open. The VIC-20 and the PET were two such until their traps were
 * wired, which is how an entry is meant to leave this table.
 */
const NO_DATA_FILE_TRAPS: Record<string, string> = {
  // Its SAVE trap skips the ROM's tape-output loop straight to the routine's
  // completion, so the program continues as it would have on real hardware and
  // no bytes are ever generated to capture.
  zx81: 'the SAVE trap elides the tape-output loop, so no bytes are produced',
  // Not the ZX81's case: the ZX80 has the same tape ROM but is simply never
  // handed the store, and its only tape trap is the IDE's program injection.
  zx80: 'never handed the store; its tape trap is program injection only',
  // Integer BASIC on a machine whose only mass storage is the cassette port,
  // which is not modelled; there is no file statement to serve.
  apple1: 'no file statements and no modelled cassette port',
  // The 8K BASIC image is Microsoft copyright and does not ship, so there is no
  // BASIC here to perform file I/O in the first place.
  altair8800: 'the 8K BASIC image does not ship',
  // OPEN/PUT/CLOSE reach the disk drive over SIO, which answers only the
  // boot-time status poll and decodes no other command - there is no disk to
  // write a file to.
  atari800:
    'the emulated disk drive answers status only; no command is decoded',
  atari400:
    'the emulated disk drive answers status only; no command is decoded',
};

let restoreRomLoading: () => void;

beforeAll(() => {
  restoreRomLoading = installNodeRomLoading();
});

afterAll(() => {
  restoreRomLoading();
});

/** Map-backed store that answers loads from what it was given, and records both. */
function spyStore(): {
  store: MachineFileStore;
  saved: Map<string, Uint8Array>;
  loads: string[];
} {
  const saved = new Map<string, Uint8Array>();
  const kinds = new Map<string, string | undefined>();
  const loads: string[] = [];
  const store: MachineFileStore = {
    save: (name, data, meta) => {
      // Copy: machines pass views over live emulator RAM.
      saved.set(name, data.slice());
      kinds.set(name, meta?.kind);
    },
    load: (name) => {
      loads.push(name);
      return saved.get(name)?.slice() ?? null;
    },
    list: (): MachineFileEntry[] =>
      [...saved.entries()].map(([name, data]) => ({
        name,
        size: data.length,
        updatedAt: 1,
        kind: kinds.get(name),
      })),
    delete: (name) => saved.delete(name),
  };
  return { store, saved, loads };
}

/** The store's contents as plain arrays, so two states can be compared. */
function snapshot(saved: Map<string, Uint8Array>): Record<string, number[]> {
  return Object.fromEntries([...saved].map(([name, d]) => [name, [...d]]));
}

describe('every machine that claims to capture a program files does', () => {
  for (const dialect of dialects) {
    const excused = NO_DATA_FILE_TRAPS[dialect.id];

    if (dialect.capturesDataFiles !== true) {
      it(`${dialect.id} captures no files: ${excused ?? '(unaccounted for)'}`, () => {
        // Not run. See the file comment: the file statement is precisely what
        // these machines cannot service, and on several of them it waits rather
        // than failing.
        expect(
          excused,
          `${dialect.id} does not set capturesDataFiles, so it needs an entry ` +
            'in NO_DATA_FILE_TRAPS saying why',
        ).toBeTruthy();
      });
      continue;
    }

    it(
      `${dialect.id} round-trips a program's own data file, and a later run reads it back`,
      async () => {
        const family = FILE_IO_PROBE_BY_DIALECT[dialect.id];
        expect(
          family,
          `${dialect.id} claims capturesDataFiles but fileIoProbes.ts has no ` +
            'probe family for it',
        ).toBeTruthy();
        const probe = FILE_IO_PROBES[family];
        expect(probe, `no probe named ${family}`).toBeTruthy();

        const { image, errors } = dialect.tokenize(probe.program);
        expect(
          errors,
          `${dialect.id} could not tokenize its own file-I/O probe program`,
        ).toEqual([]);

        const spy = spyStore();
        const machine = await bootMachine(dialect, { files: spy.store });
        try {
          machine.loadProgram(image);
          // The Acorn, Atom and Commodore machines queue their boot-and-inject
          // on a microtask; let it land before the first frame is counted.
          await new Promise((r) => setTimeout(r, 0));
          const ran = await runUntil(
            machine,
            () => screenText(machine).includes(FILE_IO_SENTINEL),
            probe.maxFrames,
            (frame) => {
              const key = probe.keys?.[frame];
              if (key !== undefined) machine.setKey(key, true);
              const releasing = probe.keys?.[frame - 5];
              if (releasing !== undefined) machine.setKey(releasing, false);
            },
          );
          const screen = screenText(machine);
          expect(
            ran,
            `${dialect.id} never printed ${FILE_IO_SENTINEL}; screen was:\n${screen}`,
          ).toBe(true);

          expect(
            [...spy.saved.keys()],
            `${dialect.id} ran the probe but stored no file under ` +
              `"${probe.file}"; screen was:\n${screen}`,
          ).toEqual([probe.file]);

          if (probe.bytes) {
            expect(
              [...(spy.saved.get(probe.file) ?? [])],
              `${dialect.id} stored the wrong bytes for "${probe.file}"`,
            ).toEqual(probe.bytes);
          }

          // The read-back half: the program printed something it could only
          // have got by loading its own file back out of the store.
          expect(
            screen,
            `${dialect.id} wrote its file but did not read it back; screen ` +
              `was:\n${screen}`,
          ).toContain(probe.readBack);

          // The cross-run half: a second loadProgram on the same machine, with
          // the store still holding what the first run saved - which is exactly
          // what pressing Run twice hands the machine now that a start restores
          // the files instead of discarding them.
          const restore = dialect.tokenize(probe.restore);
          expect(
            restore.errors,
            `${dialect.id} could not tokenize its own restore probe program`,
          ).toEqual([]);
          const savedBefore = snapshot(spy.saved);
          spy.loads.length = 0;
          machine.loadProgram(restore.image);
          await new Promise((r) => setTimeout(r, 0));
          const reran = await runUntil(
            machine,
            () => screenText(machine).includes(FILE_IO_RESTORE_SENTINEL),
            probe.maxFrames,
          );
          const second = screenText(machine);
          expect(
            reran,
            `${dialect.id} never printed ${FILE_IO_RESTORE_SENTINEL} on its ` +
              `second run; screen was:\n${second}`,
          ).toBe(true);
          expect(
            second,
            `${dialect.id} did not read back, on a later run, the file the ` +
              `first run saved; screen was:\n${second}`,
          ).toContain(FILE_IO_RESTORE_OK);
          expect(
            spy.loads,
            `${dialect.id} printed ${FILE_IO_RESTORE_OK} without loading ` +
              `"${probe.file}" out of the store`,
          ).toContain(probe.file);
          // Served, not rewritten: the second program only loads, so a machine
          // that quietly re-saved on the way would be reading its own writing.
          expect(
            snapshot(spy.saved),
            `${dialect.id} changed the store on a run that only loads`,
          ).toEqual(savedBefore);
        } finally {
          machine.dispose();
        }
      },
      BOOT_TIMEOUT_MS,
    );
  }

  it('accounts for every registered dialect either way', () => {
    // Guards the shape of the check itself: a rename that quietly emptied the
    // registry, or an entry left behind by a removed machine, would otherwise
    // pass the per-machine cases by doing nothing.
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of Object.keys(NO_DATA_FILE_TRAPS)) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
    const uncaptured = dialects
      .filter((d) => d.capturesDataFiles !== true)
      .map((d) => d.id);
    expect(uncaptured.sort()).toEqual(Object.keys(NO_DATA_FILE_TRAPS).sort());
    // ...and the rest capture, which is what makes the flag worth having.
    expect(dialects.length - uncaptured.length).toBeGreaterThan(1);
  });

  it('runs a probe on every machine that claims the capability', () => {
    // The probe map is a second table about the same set; keep it exact, so a
    // machine gaining the flag cannot silently have no program to run.
    const claimants = dialects
      .filter((d) => d.capturesDataFiles === true)
      .map((d) => d.id);
    expect(claimants.sort()).toEqual(
      Object.keys(FILE_IO_PROBE_BY_DIALECT).sort(),
    );
    for (const [id, family] of Object.entries(FILE_IO_PROBE_BY_DIALECT)) {
      expect(
        FILE_IO_PROBES[family],
        `${id} names probe family "${family}", which fileIoProbes.ts does not define`,
      ).toBeTruthy();
      // Both halves, so a family cannot be added with only the write program
      // and leave its machines unchecked across runs.
      expect(
        FILE_IO_PROBES[family]?.restore,
        `probe family "${family}" has no restore program, so ${id} would never ` +
          'be asked to read a file back on a later run',
      ).toBeTruthy();
    }
  });

  // The Altair is excused by name above rather than by hasRom() because its
  // BASIC image is what does not ship: with no interpreter there is no file
  // statement to serve, so an image dropped into the checkout would not change
  // the answer the way it changes the loop-speed and operator batteries.
  it('the ROM-less machine is excused for its BASIC, not its ROM', () => {
    const altair = dialects.find((d) => d.id === 'altair8800');
    expect(altair && !hasRom(altair)).toBe(true);
  });
});
