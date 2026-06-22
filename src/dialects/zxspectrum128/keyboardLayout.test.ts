import { describe, it } from 'vitest';

// Stage 3 of docs/dialect-plans/zxspectrum128.md fills these in. The layout is
// reused from the 48K Spectrum, so these guard that the reuse stays valid (and
// any 128/+2 re-theme keeps the matrix tokens).
describe('zxspectrum128 keyboard layout', () => {
  it.todo('validates against the KeyboardLayout schema');
  it.todo('covers the physical + virtual key union with matrix tokens');
});
