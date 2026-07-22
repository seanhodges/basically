import { describe, it } from 'vitest';

// Stages A–D of docs/contributing/dialect-plans/cpc6128.md fill these in.
describe('cpc6128 dialect', () => {
  it.todo('tokenizes the eleven BASIC 1.1-only keywords');
  it.todo(
    'round-trips programs identically to cpc464 for shared BASIC 1.0 source',
  );
  it.todo('boots to BASIC 1.1 and runs an injected program (CpcMachine 6128)');
  it.todo('banks RAM through a &7Fxx configuration and restores config 0');
});
