// The 128K / +2 / +3 keyboard matrix is identical to the 48K Spectrum's, so the
// virtual keyboard reuses the 48K layout (key tokens match the reused
// SpectrumKeyboard).
//
// The on-screen game controller, however, diverges: the 128K uses the classic
// QAOP + Space software control scheme (Q=up, A=down, O=left, P=right) that
// Spectrum games expect, rather than the 48K layout's Sinclair-joystick
// 5/6/7/8 default. The layout is derived from the 48K one, overriding only the
// controller mapping.
import type { KeyboardLayout } from '../../keyboard/layoutSchema';
import { spectrumKeyboardLayout } from '../zxspectrum/keyboardLayout';
import {
  SPECTRUM_BLOCK_GRAPHICS,
  SPECTRUM_UDG_GRAPHICS,
} from '../zxspectrum/graphics';

/**
 * Last user-defined graphic the 128K keeps. The 48K's `\t` and `\u` (0xA3 and
 * 0xA4) are the 128-only SPECTRUM and PLAY keyword tokens here (see
 * ./keywords), so those two keys type a keyword rather than a graphic and the
 * palette must not offer them.
 */
const UDG_LAST_128 = 0xa2;

export const spectrum128KeyboardLayout: KeyboardLayout = {
  ...spectrumKeyboardLayout,
  graphicsPalette: {
    sections: [
      { title: 'Block graphics', entries: SPECTRUM_BLOCK_GRAPHICS },
      {
        title: 'User-defined graphics',
        entries: SPECTRUM_UDG_GRAPHICS.filter((g) => g.code <= UDG_LAST_128),
      },
    ],
  },
  controller: {
    bindings: {
      up: 'KeyQ',
      down: 'KeyA',
      left: 'KeyO',
      right: 'KeyP',
      fire1: 'Space',
      fire2: 'Enter',
    },
  },
};
