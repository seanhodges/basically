// The 128K / +2 / +3 keyboard matrix is identical to the 48K Spectrum's, so the
// virtual keyboard reuses the 48K layout (key tokens match the reused
// SpectrumKeyboard). Stage 3 of docs/dialect-plans/zxspectrum128.md may clone it
// under a 'zxspectrum128' id/theme if a distinct +2/+3 look is wanted.
export { spectrumKeyboardLayout as spectrum128KeyboardLayout } from '../zxspectrum/keyboardLayout';
