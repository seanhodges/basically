import { describe, it } from 'vitest';

/**
 * Test stubs for the VIC-20 dialect - filled in stage by stage per
 * docs/contributing/dialect-plans/vic20.md.
 */
describe('vic20 dialect', () => {
  // Stage 1 - language core
  it.todo('keyword table is byte-identical to the C64 BASIC V2 table');
  it.todo('assembles linked-line pointers from $1001');
  it.todo('round-trips tokenize -> detokenize');
  it.todo('round-trips all 256 PETSCII codes through the charset');
  it.todo(
    'warns when importing a .prg with a $0801/$1201/$0401 load address (C64 / RAM-expansion files)',
  );

  // Stage 2 - emulator core
  it.todo('boots BASIC + KERNAL to READY. and runs an injected program');

  // Stage 3 - wire-up
  it.todo('validates the keyboard layout and key matrix (physical+virtual)');
  it.todo('tokenizes every bundled sample cleanly within 3583 bytes');

  // Stage 4 - transfer & tape I/O
  it.todo('round-trips cassette encode -> decode at $1001');
});
