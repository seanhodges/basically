import { describe, it } from 'vitest';

// Stage 2 of docs/dialect-plans/zxspectrum128.md fills this in: boot the real
// public/roms/zxspectrum128.rom (skip cleanly if absent), drive the 128K menu to
// "128 BASIC", inject and run a PRINT program, and assert on the active screen
// bank. A second test exercises a PLAY / paging program. Mirror
// ../../zxspectrum/emulator/spectrumMachine.test.ts.
describe('zxspectrum128 machine', () => {
  it.todo('boots the 128 ROM, enters 128 BASIC and renders a program');
  it.todo('pages RAM/ROM via port 0x7FFD and absorbs AY writes for PLAY');
});
