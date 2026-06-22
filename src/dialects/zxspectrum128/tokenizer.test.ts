import { describe, it } from 'vitest';

// Stage 1 of docs/dialect-plans/zxspectrum128.md fills these in.
describe('zxspectrum128 tokenizer', () => {
  it.todo('tokenizes the 128-only PLAY (0xA4) and SPECTRUM (0xA3) keywords');
  it.todo('round-trips tokenize → detokenize for a 128 program');
  it.todo('emits identical bytes to the 48K tokenizer for 48K-compatible code');
  it.todo('reports an error for a descending or out-of-range line number');
});
