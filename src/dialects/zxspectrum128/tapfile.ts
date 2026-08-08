// The 128K loads and saves the identical .TAP format as the 48K Spectrum, so
// the image builder/parser is reused verbatim.
export {
  buildTap,
  codeTap,
  codeTapBlocks,
  parseTap,
  parseTapWithReport,
  parseTapAllFiles,
  tapBlocks,
  tapImageFromBlocks,
} from '../zxspectrum/tapfile';
export type { CodeFile, TapBlock } from '../zxspectrum/tapfile';
