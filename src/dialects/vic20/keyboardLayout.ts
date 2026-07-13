import type { KeyboardLayout } from '../../keyboard/layoutSchema';
import { c64KeyboardLayout } from '../commodore64/keyboardLayout';

/**
 * The Commodore VIC-20 keyboard.
 *
 * The VIC-20 and C64 keyboards are the same key set with the same C=/SHIFT block
 * graphics printed on the key fronts, and the emulator reuses the C64 matrix
 * token vocabulary verbatim (see `../../emulator/vic20/keyboard.ts`). So rather
 * than re-derive an identical layout, this starts from {@link c64KeyboardLayout}
 * and only re-identifies and re-themes it — the same one-place-sibling-import
 * pattern the VIC-20 keyword/charset modules use. Every token the C64 layout
 * emits resolves through `vic20TokenToPositions`, so each key reaches
 * `Vic20Machine.setKey`.
 */
export const vic20KeyboardLayout: KeyboardLayout = {
  ...c64KeyboardLayout,
  id: 'vic20',
  name: 'Commodore VIC-20',
  theme: 'vk-theme-vic20',
};
