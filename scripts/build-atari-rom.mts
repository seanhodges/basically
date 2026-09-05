import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Build `public/roms/atari/atari.rom` from the two images an Atari 400/800 needs.
 *
 * The seam carries one image per machine, and this machine's firmware is two
 * chips' worth: the 10K operating system that lives at $D800, and the 8K Atari
 * BASIC cartridge that lives at $A000. They are concatenated into one file, the
 * way the Apple I carries its monitor and interpreter and the PMD 85 carries
 * its Monitor and BASIC-G.
 *
 * **The OS goes first, and the order is load-bearing.** `fitRomImage` pads a
 * short image to the machine's ROM area with 0xFF, so an image carrying only
 * the OS pads the cartridge window to all-0xFF - and $BFFC then reads non-zero,
 * which the OS takes as "no cartridge fitted" and boots to the Memo Pad,
 * exactly as an 800 with an empty slot. Address order would put BASIC first and
 * turn that same file into a machine that cannot reset.
 *
 * Usage:
 *
 *     npm run gen:atarirom -- <altirraos_800.bin> <altirra_basic.bin>
 *
 * Both inputs are verified before anything is written: a wrong-sized file, an
 * OS whose reset vector does not point into the OS ROM, or a cartridge image
 * that does not claim to be fitted, is a swapped or truncated image and fails
 * here rather than several stages later as a machine that boots to nothing.
 */

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../public/roms/atari/atari.rom');

/** The operating system: 10240 bytes at $D800, with the 6502 vectors in its tail. */
const OS_BYTES = 0x2800;
/** Where the OS ROM is mapped. */
const OS_BASE = 0xd800;
/** Atari BASIC: 8192 bytes, in the cartridge window at $A000. */
const BASIC_BYTES = 0x2000;
/** Where the cartridge window starts. */
const CART_BASE = 0xa000;

/** Offset of the reset vector within the OS image ($FFFC - $D800). */
const RESET_VECTOR = OS_BYTES - 4;

/**
 * Offset within the cartridge image of $BFFC, the byte the OS tests to decide
 * whether a cartridge is fitted. Zero means fitted; anything else means the
 * slot is empty.
 */
const CART_PRESENT = 0xbffc - CART_BASE;

function read(path: string, expected: number, what: string): Uint8Array {
  const bytes = new Uint8Array(readFileSync(path));
  if (bytes.length !== expected) {
    throw new Error(
      `${what}: expected ${expected} bytes, ${path} is ${bytes.length}`,
    );
  }
  return bytes;
}

const [osPath, basicPath] = process.argv.slice(2);
if (!osPath || !basicPath) {
  throw new Error(
    'usage: npm run gen:atarirom -- <altirraos_800.bin> <altirra_basic.bin>',
  );
}

const os = read(osPath, OS_BYTES, 'operating system');
const basic = read(basicPath, BASIC_BYTES, 'BASIC cartridge');

const reset = os[RESET_VECTOR]! | (os[RESET_VECTOR + 1]! << 8);
if (reset < OS_BASE) {
  throw new Error(
    `operating system: reset vector is $${reset.toString(16).toUpperCase()}, ` +
      `which is not in the OS ROM at $D800-$FFFF - this is not an Atari OS ` +
      `image, or the two inputs are the wrong way round`,
  );
}

if (basic[CART_PRESENT] !== 0) {
  throw new Error(
    `BASIC cartridge: $BFFC is $${basic[CART_PRESENT]!.toString(16).toUpperCase()}, ` +
      `not $00 - a cartridge image says it is fitted by zeroing that byte, so ` +
      `this is not a cartridge, or the two inputs are the wrong way round`,
  );
}

const rom = new Uint8Array(OS_BYTES + BASIC_BYTES);
rom.set(os, 0);
rom.set(basic, OS_BYTES);
writeFileSync(outPath, rom);

const sha = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

console.log(`wrote ${outPath} (${rom.length} bytes)`);
console.log(`  OS       ${OS_BYTES} bytes  sha256 ${sha(os)}`);
console.log(`  BASIC    ${BASIC_BYTES} bytes  sha256 ${sha(basic)}`);
console.log(`  combined ${rom.length} bytes  sha256 ${sha(rom)}`);
