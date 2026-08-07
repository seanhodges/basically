// The 128K uses the identical ZX Spectrum character set, so the 48K mapping is
// reused verbatim. Re-exported (rather than imported directly in index.ts) so
// the dialect folder reads as self-contained.
export { spectrumCharset as spectrum128Charset } from '../zxspectrum/charset';
