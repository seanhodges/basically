import { describe, it } from 'vitest';

// Stage 1 of docs/dialect-plans/trs80.md fills these in: tokenizer round-trip,
// the linked-line layout from 0x42E8 (u16 link + u16 LE line number + body +
// 0x00, ending 0x0000), and Level II quirks (':' multi-statement, '?'=PRINT,
// "'"=REM, quotes/REM/DATA suspend tokenizing).
describe('trs80 tokenizer', () => {
  it.todo('tokenizes a line into the linked-line layout from 0x42E8');
  it.todo('round-trips tokenize → detokenize');
  it.todo('reports an error for a missing or descending line number');
  it.todo(
    'keeps the longest keyword match and suspends inside strings/REM/DATA',
  );
});
