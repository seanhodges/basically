import { describe, it } from 'vitest';

/**
 * Test stubs for the PET dialect - filled in stage by stage per
 * docs/contributing/dialect-plans/pet.md.
 */
describe('pet dialect', () => {
  // Stage 1 - language core
  it.todo('tokenizes the BASIC 4.0 disk keywords to $CC-$DA');
  it.todo('assembles linked-line pointers from $0401');
  it.todo('round-trips tokenize -> detokenize, including DLOAD"X",D0 lines');
  it.todo('round-trips all 256 PETSCII codes through the charset');
  it.todo('warns when importing a .prg with a non-$0401 load address');

  // Stage 2 - emulator core
  it.todo('boots the BASIC 4.0 ROMs to READY. and runs an injected program');

  // Stage 3 - wire-up
  it.todo('validates the keyboard layout and key matrix (physical+virtual)');
  it.todo('tokenizes every bundled sample cleanly');

  // Stage 4 - transfer & tape I/O
  it.todo('round-trips cassette encode -> decode at $0401');
});
