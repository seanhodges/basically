import { describe, it } from 'vitest';

// Stage 1 of docs/contributing/dialect-plans/cpc464.md fills these in.
describe('cpc464 AMSDOS .bas container', () => {
  it.todo('round-trips a tokenized program through build/parse');
  it.todo('validates the 128-byte header checksum');
  it.todo(
    'accepts a headerless (raw tokenized) image with a warning-free parse',
  );
});
