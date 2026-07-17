// The 128K loads and saves the identical .TAP format as the 48K Spectrum, so
// the image builder/parser is reused verbatim. See docs/dialect-plans/zxspectrum128.md.
export {
  buildTap,
  parseTap,
  parseTapWithReport,
  parseTapAllFiles,
  tapBlocks,
} from '../zxspectrum/tapfile';
export type { CodeFile } from '../zxspectrum/tapfile';
