/**
 * Every machine's declared program-RAM budget, checked against what the booted
 * machine itself says it has free.
 *
 * `Dialect.programRamBytes` is the number the status bar's byte counter and the
 * porting guide's "Free program RAM" row are both drawn against, and it is
 * hand-written per dialect. Hand-written round numbers are exactly the kind
 * that go unchallenged: the Atom carried an 8K figure for a machine with 5K of
 * BASIC RAM, and the two Acorns carried 28K/30K where PAGE-to-HIMEM is 24.75K
 * and 27.5K. Nothing caught them, because nothing compared the figure to the
 * machine.
 *
 * This does. It walks the registry, boots each machine on its real ROM, and
 * reads `readMemoryStats().free` at the Ready prompt - the ROM's own arithmetic
 * over its own pointers, the same reading the status bar switches to the moment
 * a program runs. A dialect added with a guessed budget fails here.
 *
 * The reading is not required to match to the byte, in either direction, and
 * both allowances are one-way on purpose:
 *
 *  - The reading counts the injected empty program's end marker as used, so the
 *    declared figure legitimately sits a couple of bytes ABOVE it. That is what
 *    {@link EMPTY_PROGRAM_BYTES} covers, and it is deliberately tiny: a budget
 *    that overshoots by more than that is promising RAM the machine does not
 *    have, which is the failure mode that matters most.
 *  - A budget may sit BELOW the reading where the machine spends RAM the
 *    cold-start pointers have not spent yet - most of all the Sinclair display
 *    file, which lives inside the program area and grows as the screen fills.
 *    Those machines are named in {@link SHORTFALL_ALLOWANCE_BYTES} with the
 *    reason; everything else gets {@link DEFAULT_SHORTFALL_BYTES}.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects } from './registry';
import { bootMachine, installNodeRomLoading, runUntil } from './bootHarness';
import type { Dialect, MachineEmulator } from './types';

/**
 * Machines whose cold-start reading cannot be taken, and why. Asserted as an
 * exact set rather than skipped silently - a machine that stops answering
 * should fail here and have the reason written down, not quietly drop out of
 * the check.
 */
const UNMEASURABLE: Record<string, string> = {
  // The default backend is the ROM-free statement interpreter, which has no
  // BASIC workspace pointers to read; its 15572 is Level II's own PRINT MEM on
  // a 16K Model I.
  trs80: 'the interpreter backend has no ROM pointers to read',
  // This machine has no Ready prompt to read at. Left alone it boots to WozMon
  // and stops, exactly as the real one does, and Integer BASIC's pointers do
  // not exist until somebody types E000R at it - which is what `loadProgram`
  // does, and what the harness deliberately does not. Its 2048 is pinned
  // instead against the pointers the cold start lays down, in
  // src/emulator/apple1/apple1Machine.test.ts.
  apple1: 'the machine boots to its monitor, with no interpreter running',
  // The II's case exactly, and for the same reason: with no autostart ROM it
  // comes up in the monitor at `*`, and Integer BASIC's LOMEM/HIMEM pair does
  // not exist until `loadProgram` cold-starts it. Its 47104 is pinned instead
  // against the pointers that cold start lays down, in
  // src/emulator/apple2/apple2Machine.test.ts.
  apple2: 'the machine boots to its monitor, with no interpreter running',
  // The Altair's counterpart of the Apple I's case. 8K BASIC stops at
  // `MEMORY SIZE?` and waits for three answers before it lays TXTTAB down, and
  // answering them is `loadProgram`'s job rather than the harness's, so a
  // plain boot leaves the workspace holding whatever the tape was loaded with.
  // Its 42628 is pinned instead against the machine's own "BYTES FREE" banner,
  // in src/dialects/altair8800/emulator/altairMachine.test.ts.
  altair8800:
    'the cold-start dialogue is unanswered, so BASIC has no workspace',
};

/** How far above the reading a budget may sit: the empty program's end marker. */
const EMPTY_PROGRAM_BYTES = 8;

/** How far below the reading a budget may sit with no machine-specific reason. */
const DEFAULT_SHORTFALL_BYTES = 32;

/**
 * Machines whose budget is deliberately more conservative than the cold-start
 * reading, with how much slack that buys.
 */
const SHORTFALL_ALLOWANCE_BYTES: Record<string, number> = {
  // The ZX80 and ZX81 keep the display file inside the program area, collapsed
  // at the Ready prompt and up to ~793 bytes once the screen fills. The budget
  // is a screenful more conservative than the pointers, which is the honest
  // figure for a program that prints anything.
  zx81: 1024,
  zx80: 1024,
  // The Spectrums' screen is outside the program area, so this is plain
  // rounding down to a flat 40.5K rather than an allowance for anything.
  zxspectrum: 256,
  zxspectrum128: 256,
  // BASIC-G spends two disjoint pools and reports both, so the reading counts
  // the 3,840-byte string region as free on top of the program area. No
  // program text can go there, so the budget is deliberately the program area
  // alone - PROGRAM_BASE to the stack top - and sits a whole pool below it.
  pmd85: 4096,
};

let restoreRomLoading: () => void;

beforeAll(() => {
  restoreRomLoading = installNodeRomLoading();
});

afterAll(() => {
  restoreRomLoading();
});

/**
 * Free bytes at the Ready prompt, or null if the machine never reports any.
 *
 * Two stages on purpose: the pointers become plausible partway through the
 * ROM's own initialisation, so reading at the first non-null would catch a
 * machine still setting itself up. Running well past that and reading again
 * takes the settled figure.
 */
async function coldStartFree(machine: MachineEmulator): Promise<number | null> {
  const read = () => machine.readMemoryStats?.() ?? null;
  const booted = await runUntil(machine, () => (read()?.free ?? 0) > 0);
  if (!booted) return null;
  for (let frame = 0; frame < 100; frame++) machine.runFrame();
  return read()?.free ?? null;
}

async function freeFor(dialect: Dialect): Promise<number | null> {
  const machine = await bootMachine(dialect);
  try {
    return await coldStartFree(machine);
  } finally {
    machine.dispose();
  }
}

describe('program RAM budget vs the booted machine', () => {
  for (const dialect of dialects) {
    const unmeasurable = UNMEASURABLE[dialect.id];

    if (unmeasurable) {
      it(`${dialect.id} reports no cold-start figure: ${unmeasurable}`, async () => {
        expect(await freeFor(dialect)).toBeNull();
      }, 120000);
      continue;
    }

    it(`${dialect.id} declares what its ROM says is free`, async () => {
      const free = await freeFor(dialect);
      expect(
        free,
        `${dialect.id} should report a cold-start figure, or be listed in UNMEASURABLE with a reason`,
      ).not.toBeNull();

      const declared = dialect.programRamBytes;
      const shortfall =
        SHORTFALL_ALLOWANCE_BYTES[dialect.id] ?? DEFAULT_SHORTFALL_BYTES;
      expect(
        declared,
        `${dialect.id} budget ${declared} promises more than the ${free} bytes its ROM reports free`,
      ).toBeLessThanOrEqual(free! + EMPTY_PROGRAM_BYTES);
      expect(
        declared,
        `${dialect.id} budget ${declared} is more than ${shortfall} bytes below the ${free} its ROM reports free`,
      ).toBeGreaterThanOrEqual(free! - shortfall);
    }, 120000);
  }
});
