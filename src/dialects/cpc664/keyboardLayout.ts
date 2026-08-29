import type { KeyboardLayout } from '../../keyboard/layoutSchema';
import { cpc464KeyboardLayout } from '../cpc464/keyboardLayout';

/**
 * The 664's virtual keyboard. Same 10x8 matrix, same legends and the same
 * layers as the 464 - the firmware key manager is common to the family, so no
 * matrix position moved and the tokens carry over untouched. What changed is
 * the plastic: the 664 dropped the 464's colour-coded caps for the grey the
 * 6128 later kept, so the rows are re-exported verbatim under a theme of its
 * own (see `.vk-theme-cpc664` in src/keyboard/VirtualKeyboard.css).
 */
export const cpc664KeyboardLayout: KeyboardLayout = {
  ...cpc464KeyboardLayout,
  id: 'cpc664',
  name: 'CPC 664',
  theme: 'vk-theme-cpc664',
};
