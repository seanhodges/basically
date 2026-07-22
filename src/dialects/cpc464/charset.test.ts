import { describe, it } from 'vitest';

// Stage 1 of docs/contributing/dialect-plans/cpc464.md fills these in.
describe('cpc464 charset', () => {
  it.todo('maps 32–126 near-ASCII both ways');
  it.todo('covers the full 256-glyph set (unicode forms or escapes)');
  it.todo('throws CharsetError with the index for unmappable input');
});
