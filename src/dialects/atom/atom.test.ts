import { describe, it } from 'vitest';

/**
 * Acorn Atom machine integration tests. STUB — Stage 2 fills these in: boot the
 * real `public/roms/atom/` ROM set, inject a PRINT program, run frames, and
 * assert on the MC6847 display / screen memory. Mirror
 * `../../emulator/bbc/bbcMachine.test.ts` and `../bbcmicro/bbcmicro.test.ts`.
 */
describe('atom machine', () => {
  it.todo('boots the Atom ROM and renders a PRINTed program');
  it.todo('auto-RUNs an injected program via the AtomPPIA key matrix');
});
