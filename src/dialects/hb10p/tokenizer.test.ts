import { describe, it } from 'vitest';

describe('hb10p tokenizer', () => {
  it.todo('emits link words that point at the following line');
  it.todo('encodes each numeric constant with its own type prefix');
  it.todo('encodes the two-byte function tokens behind their 0xFF prefix');
  it.todo('round-trips every sample through tokenize and detokenize');
  it.todo('reports errors rather than throwing on a malformed line');
});
