// The 128K / +2 / +3 keyboard matrix is identical to the 48K Spectrum's, so the
// virtual keyboard reuses the 48K layout (key tokens match the reused
// SpectrumKeyboard). Stage 3 of docs/dialect-plans/zxspectrum128.md may clone it
// under a 'zxspectrum128' id/theme if a distinct +2/+3 look is wanted.
//
// The on-screen game controller, however, diverges: the 128K uses the classic
// QAOP + Space software control scheme (Q=up, A=down, O=left, P=right) that
// Spectrum games expect, rather than the 48K layout's Sinclair-joystick
// 5/6/7/8 default. We derive the layout from the 48K one and override only the
// controller mapping.
import type { KeyboardLayout } from '../../keyboard/layoutSchema';
import { spectrumKeyboardLayout } from '../zxspectrum/keyboardLayout';

export const spectrum128KeyboardLayout: KeyboardLayout = {
  ...spectrumKeyboardLayout,
  controller: {
    fireButtons: 2,
    dpadMode: '4-way',
    bindings: {
      up: 'KeyQ',
      down: 'KeyA',
      left: 'KeyO',
      right: 'KeyP',
      fire1: 'Space',
      fire2: 'KeyM',
    },
  },
};
