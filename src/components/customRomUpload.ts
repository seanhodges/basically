/**
 * Validation and wording for the custom-ROM control, kept out of the component
 * so the messages are under test - the settings form has no render test, and
 * these strings are the whole user-facing contract of the feature.
 */
import type { Dialect } from '../dialects/types';

/**
 * Why a picked file was refused, or null when it is acceptable.
 *
 * The message names **both** sizes deliberately. On the two-bank machines - the
 * 128K Spectrum and both CPCs, whose images are two 16K halves concatenated -
 * the likeliest mistake by far is supplying one half, and only seeing both
 * numbers tells the user that is what happened. "Wrong size" would not.
 */
export function romUploadError(
  dialect: Dialect,
  bytes: Uint8Array,
): string | null {
  const expected = dialect.romBytes;
  if (expected === undefined) {
    return `The ${dialect.name} emulator loads its own ROM set, so it can't be replaced.`;
  }
  if (bytes.length === expected) return null;
  return `That file is ${bytes.length.toLocaleString()} bytes. The ${dialect.name} ROM must be exactly ${expected.toLocaleString()} bytes.`;
}

/** The line naming which image the machine is currently running. */
export function romInUseLabel(
  dialect: Dialect,
  custom: { name: string; size: number } | null,
): string {
  if (custom) {
    return `Using your own ROM: ${custom.name} (${custom.size.toLocaleString()} bytes).`;
  }
  const size = dialect.romBytes;
  return size === undefined
    ? `Using the bundled ${dialect.name} ROM.`
    : `Using the bundled ${dialect.name} ROM (${size.toLocaleString()} bytes).`;
}
