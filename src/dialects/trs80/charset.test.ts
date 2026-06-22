import { describe, it } from 'vitest';

// Stage 1 of docs/dialect-plans/trs80.md fills these in.
describe('trs80 charset', () => {
  it.todo('maps ASCII 0x20–0x7F to itself and folds lowercase to upper case');
  it.todo('renders the 0x80–0xBF block-graphics cells to Unicode forms');
  it.todo('round-trips toMachine → toUnicode');
});
