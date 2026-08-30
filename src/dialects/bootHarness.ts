import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { configureNodeRomPath } from '../emulator/bbc/bbcMachine';
import type { Dialect, MachineEmulator, MachineFileStore } from './types';

/**
 * Booting a registered machine under node, for the tests that check a dialect
 * against the machine it actually runs rather than against another table.
 *
 * Three of those tests grew the same bringup independently - point jsbeeb's ROM
 * loader at the package root, stub `fetch` at the committed images, boot,
 * runFrame until something is true, read the screen - and a fourth would have
 * made four. The pieces are here so a new check of this kind starts from the
 * machine rather than from the plumbing.
 *
 * Not a test file itself, so it takes no dependency on vitest: the ROM bringup
 * returns its own undo rather than leaning on `vi.unstubAllGlobals`, which would
 * also drop stubs the caller set for its own reasons.
 */

const PUBLIC = path.resolve(__dirname, '../../public');

/**
 * Make the machines that fetch their own ROMs work under node, and return the
 * undo.
 *
 * Two loaders are involved and neither takes the image the seam hands it: the
 * jsbeeb-backed machines (both Acorns and the Atom) resolve their own ROM list
 * through jsbeeb's loader, and the Commodore trio and the CPCs fetch theirs from
 * the deployed `roms/` path. Both are pointed at the committed images, so
 * construction is quiet.
 */
export function installNodeRomLoading(): () => void {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));

  const previous = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    const rel = String(url).slice(String(url).indexOf('roms/'));
    const data = readFileSync(path.join(PUBLIC, rel));
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    };
  }) as unknown as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = previous;
  };
}

/** The path under public/ behind a dialect's `romUrl`. */
export function romPath(romUrl: string): string {
  return path.join(PUBLIC, romUrl.slice(romUrl.indexOf('roms/')));
}

/**
 * The committed ROM behind a dialect's `romUrl`, or an empty image.
 *
 * An absent file is not a failure: images with no redistribution grant are meant
 * to be removable (see public/roms/ATTRIBUTION.md). Every machine here
 * constructs without its ROM.
 */
export function romFor(romUrl: string | undefined): Uint8Array {
  if (!romUrl) return new Uint8Array(0);
  const file = romPath(romUrl);
  return existsSync(file)
    ? new Uint8Array(readFileSync(file))
    : new Uint8Array(0);
}

/** Whether this dialect's bundled ROM is present in this checkout. */
export function hasRom(dialect: Dialect): boolean {
  return dialect.romUrl !== undefined && existsSync(romPath(dialect.romUrl));
}

/**
 * Construct a machine on its committed ROM and wait for any asynchronous load.
 *
 * The caller disposes; every helper here leaves that to the test so a failed
 * assertion still reports against a live machine.
 */
export async function bootMachine(
  dialect: Dialect,
  opts: {
    rom?: Uint8Array;
    ramKb?: 16 | 32 | 64;
    /**
     * Virtual filesystem for the machine's data file I/O. Omitted by every
     * caller but the file-I/O battery, so the rest of these tests keep
     * exercising the no-store branch a machine sees in a bare boot.
     */
    files?: MachineFileStore;
  } = {},
): Promise<MachineEmulator> {
  const machine = dialect.createEmulator({
    rom: opts.rom ?? romFor(dialect.romUrl),
    ramKb: opts.ramKb ?? 16,
    files: opts.files,
  });
  const ready = (machine as { whenReady?: () => Promise<void> }).whenReady;
  if (typeof ready === 'function') await ready.call(machine);
  return machine;
}

/** A machine's screen as text, or an empty string if it cannot answer. */
export function screenText(machine: MachineEmulator): string {
  return machine.readScreenText?.()?.lines.join('\n') ?? '';
}

/** Run a fixed number of frames, yielding as {@link runUntil} does. */
export async function runFrames(
  machine: MachineEmulator,
  frames: number,
): Promise<void> {
  await runUntil(machine, () => false, frames);
}

/**
 * Run frames until `done` holds, and report whether it ever did.
 *
 * Yields the macrotask periodically: the ROM loads the jsbeeb and Commodore
 * machines start in their constructors settle on timers, and a tight synchronous
 * frame loop never lets them land.
 *
 * `onFrame` runs after each frame, before `done` is asked. It is for a machine
 * that will not reach the state being waited on unaided: the Spectrums' SAVE
 * stops at "Start tape, then press any key" and sits there until a key arrives,
 * so a check that runs one has to press it from inside the loop.
 */
export async function runUntil(
  machine: MachineEmulator,
  done: () => boolean,
  maxFrames = 1200,
  onFrame?: (frame: number) => void,
): Promise<boolean> {
  for (let frame = 0; frame < maxFrames; frame++) {
    machine.runFrame();
    onFrame?.(frame);
    if (done()) return true;
    if (frame % 20 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return false;
}
