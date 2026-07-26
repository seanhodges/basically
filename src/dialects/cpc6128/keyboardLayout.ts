import type { KeyboardLayout } from '../../keyboard/layoutSchema';
import { cpc464KeyboardLayout } from '../cpc464/keyboardLayout';

/**
 * The 6128's virtual keyboard. Same 10x8 matrix, same legends and the same
 * layers as the 464 - the machines differ only in the colour of the plastic:
 * the 6128's function-key block is grey where the 464's is blue. So the rows
 * are re-exported verbatim under a theme of its own (see
 * `.vk-theme-cpc6128` in src/keyboard/VirtualKeyboard.css).
 */
export const cpc6128KeyboardLayout: KeyboardLayout = {
  ...cpc464KeyboardLayout,
  id: 'cpc6128',
  name: 'CPC 6128',
  theme: 'vk-theme-cpc6128',
};
