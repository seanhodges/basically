import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Build `public/roms/apple1.rom` from the two images an Apple I needs.
 *
 * The seam carries one image per machine, and this machine's firmware is two
 * chips' worth: the 256-byte monitor PROM that lives at $FF00, and the 4K
 * Integer BASIC image that lives at $E000. They are concatenated into one file,
 * the way the PMD 85 carries its Monitor and BASIC-G and the 128K Spectrum and
 * both CPCs carry their two banks.
 *
 * **The monitor goes first, and the order is load-bearing.** `fitRomImage` pads
 * a short image to the machine's ROM area with 0xFF, so an image carrying only
 * the monitor pads into an all-0xFF interpreter region - which the machine reads
 * as "no BASIC fitted" and boots to the monitor prompt, exactly as an Apple I
 * with no BASIC tape loaded. Address order would put the interpreter first and
 * turn that same file into a machine that cannot reset.
 *
 * Usage:
 *
 *     npm run gen:apple1rom -- <wozmon.bin> <apple1basic.bin>
 *
 * Both inputs are verified before anything is written: a wrong-sized file, or a
 * monitor whose reset vector does not point into itself, is a swapped or
 * truncated image and fails here rather than three stages later as a machine
 * that boots to nothing.
 */

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../public/roms/apple1.rom');

/** The monitor PROM: 256 bytes at $FF00, with the 6502 vectors in its tail. */
const MONITOR_BYTES = 0x0100;
/** Integer BASIC: 4096 bytes, loaded at $E000. */
const BASIC_BYTES = 0x1000;

/** Offset of the reset vector within the monitor image ($FFFC - $FF00). */
const RESET_VECTOR = 0xfc;
/** Where a genuine WozMon's reset vector points: its own entry at $FF00. */
const RESET_TARGET = 0xff00;

function read(path: string, expected: number, what: string): Uint8Array {
  const bytes = new Uint8Array(readFileSync(path));
  if (bytes.length !== expected) {
    throw new Error(
      `${what}: expected ${expected} bytes, ${path} is ${bytes.length}`,
    );
  }
  return bytes;
}

const [monitorPath, basicPath] = process.argv.slice(2);
if (!monitorPath || !basicPath) {
  throw new Error(
    'usage: npm run gen:apple1rom -- <wozmon.bin> <apple1basic.bin>',
  );
}

const monitor = read(monitorPath, MONITOR_BYTES, 'monitor PROM');
const basic = read(basicPath, BASIC_BYTES, 'Integer BASIC');

const reset = monitor[RESET_VECTOR]! | (monitor[RESET_VECTOR + 1]! << 8);
if (reset !== RESET_TARGET) {
  throw new Error(
    `monitor PROM: reset vector is $${reset.toString(16).toUpperCase()}, ` +
      `expected $FF00 - this is not the Apple I monitor, or the two inputs ` +
      `are the wrong way round`,
  );
}

const rom = new Uint8Array(MONITOR_BYTES + BASIC_BYTES);
rom.set(monitor, 0);
rom.set(basic, MONITOR_BYTES);
writeFileSync(outPath, rom);

const sha = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

console.log(`wrote ${outPath} (${rom.length} bytes)`);
console.log(`  monitor  ${MONITOR_BYTES} bytes  sha256 ${sha(monitor)}`);
console.log(`  BASIC    ${BASIC_BYTES} bytes  sha256 ${sha(basic)}`);
console.log(`  combined ${rom.length} bytes  sha256 ${sha(rom)}`);
