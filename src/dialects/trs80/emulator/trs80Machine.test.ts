import { describe, it } from 'vitest';

// Stage 2 of docs/dialect-plans/trs80.md fills this in: boot the real
// public/roms/trs80.rom (skip cleanly if absent), inject a PRINT program, run
// frames and assert on the 0x3C00 video RAM. Mirror zx80Machine.test.ts.
describe('trs80 machine', () => {
  it.todo('boots the ROM, injects a program and renders to video RAM');
});
