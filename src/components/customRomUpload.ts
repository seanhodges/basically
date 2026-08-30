/**
 * Validation and wording for the custom-ROM control, kept out of the component
 * so the messages are under test - the settings form has no render test, and
 * these strings are the whole user-facing contract of the feature.
 */
import type { Dialect } from '../dialects/types';

/**
 * Why a picked file was refused, or null when it is acceptable.
 *
 * Size is not a reason: an image of any length is installed and fitted to the
 * machine's ROM area when it runs (`app/romImage.fitRomImage`). What is left is
 * the one machine kind that would ignore the image altogether, which the
 * settings form already keeps the upload control away from - this is the guard
 * behind that, not a message the UI normally reaches.
 */
export function romUploadError(dialect: Dialect): string | null {
  if (dialect.romBytes === undefined) {
    return `The ${dialect.name} emulator loads its own ROM set, so it can't be replaced.`;
  }
  return null;
}

/**
 * The line naming which image the machine is currently running.
 *
 * A supplied image that does not fill the machine's ROM area says so, naming
 * both its own size and the area's. That is the diagnostic the old wrong-size
 * refusal used to carry, and it is worth as much after the install as before:
 * on the two-bank machines - the 128K Spectrum and both CPCs, whose images are
 * two 16K halves concatenated - the likeliest thing to supply by mistake is one
 * half, and only seeing both numbers tells the user that is what happened.
 */
export function romInUseLabel(
  dialect: Dialect,
  custom: { name: string; size: number } | null,
): string {
  const size = dialect.romBytes;
  if (custom) {
    const own = `${custom.size.toLocaleString()} bytes`;
    if (size === undefined || custom.size === size) {
      return `Using your own ROM: ${custom.name} (${own}).`;
    }
    const fit =
      custom.size < size
        ? `padded to ${size.toLocaleString()}`
        : `trimmed to ${size.toLocaleString()}`;
    return `Using your own ROM: ${custom.name} (${own}, ${fit}).`;
  }
  return size === undefined
    ? `Using the bundled ${dialect.name} ROM.`
    : `Using the bundled ${dialect.name} ROM (${size.toLocaleString()} bytes).`;
}
