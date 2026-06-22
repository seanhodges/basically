import { describe, it } from 'vitest';

/**
 * Atom BASIC tokenizer tests. STUB — Stage 1 fills these in: tokenizer
 * round-trip (tokenize → detokenize is identity), charset mapping, and
 * image-builder pointer consistency. Mirror `../bbcmicro/tokenizer.test.ts`.
 */
describe('atom tokenizer', () => {
  it.todo('round-trips a program through tokenize → detokenize');
  it.todo('reports line/column for malformed lines without throwing');
});
