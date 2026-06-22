// The 128K uses the identical ZX Spectrum character set, so the 48K mapping is
// reused verbatim. Re-exported (rather than imported directly in index.ts) so
// the dialect folder reads as self-contained. See docs/dialect-plans/zxspectrum128.md.
export { spectrumCharset as spectrum128Charset } from '../zxspectrum/charset';
