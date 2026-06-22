// The 128K ULA display is byte-for-byte the 48K's (256×192, same bitmap +
// attribute layout), so width/height and the renderer are reused from the 48K
// machine. The only addition is the shadow screen in RAM bank 7, selected by
// bit 3 of port 0x7FFD; Stage 2 of docs/dialect-plans/zxspectrum128.md points
// renderDisplay at whichever screen bank is currently displayed.
export {
  renderDisplay,
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
} from '../../zxspectrum/emulator/display';
