import { describe, it } from 'vitest';

// Stage 1 of docs/contributing/dialect-plans/cpc464.md fills these in.
describe('cpc464 tokenizer', () => {
  it.todo('round-trips a simple program through tokenize/detokenize');
  it.todo(
    'encodes each numeric-constant form (&0E–&18, &19, &1A, &1B, &1C, &1E, &1F)',
  );
  it.todo(
    'emits line records as [u16 LE length][u16 LE line no][tokens][0x00] + 0x0000 end',
  );
  it.todo('rejects BASIC 1.1-only keywords with a clear TokenizeError');
  it.todo('collects errors instead of throwing');
});
