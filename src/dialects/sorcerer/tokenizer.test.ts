import { describe, it } from 'vitest';

describe('sorcerer tokenizer', () => {
  it.todo('round-trips a program through tokenize and detokenize');
  it.todo('crunches: FORI=1TO5 tokenizes as FOR I=1 TO 5');
  it.todo('stores REM and DATA text verbatim');
  it.todo('reports errors rather than throwing');
});
