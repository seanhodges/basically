import { describe, expect, it } from 'vitest';
import {
  CORE_PLACEHOLDERS,
  placeholdersUsed,
} from '../../../src/reference/placeholders';

// The legend each reference page shows is generated from its own rows, so it can
// never explain a placeholder the page does not use nor fall behind the data. These
// pin the two halves of that: what gets listed, and the order it is listed in.
describe('the generated argument legend', () => {
  const entry = (syntax: string) => ({ syntax });

  it('lists only the placeholders the rows actually use', () => {
    const legend = placeholdersUsed(
      [entry('POKE <addr>, <byte>'), entry('GOTO <line>')],
      [],
    );
    // Vocabulary order, not row order: a value, then the program, then the machine.
    expect(legend.map((p) => p.id)).toEqual(['byte', 'line', 'addr']);
  });

  it('puts the shared vocabulary in its canonical order, then the page own', () => {
    const legend = placeholdersUsed(
      [entry('PLOT <x>, <y>[, <pen>]'), entry('MODE <mode>')],
      [{ id: 'pen', meaning: 'a pen number in the current palette' }],
    );
    // `x`, `y` and `mode` come in vocabulary order regardless of the row order, and
    // the page's own name comes last so a reader meets the shared words first.
    expect(legend.map((p) => p.id)).toEqual(['x', 'y', 'mode', 'pen']);
  });

  it('carries the meaning each placeholder is glossed with', () => {
    const [only] = placeholdersUsed([entry('GOTO <line>')], []);
    expect(only).toEqual(CORE_PLACEHOLDERS.find((p) => p.id === 'line'));
  });

  it('is empty for a keyword that takes no arguments', () => {
    expect(placeholdersUsed([entry('CLS'), entry('NEW')], [])).toEqual([]);
  });

  it('ignores a page own placeholder the rows never use', () => {
    const legend = placeholdersUsed(
      [entry('CLS')],
      [{ id: 'stream', meaning: 'a screen window' }],
    );
    expect(legend).toEqual([]);
  });

  it('does not mistake a relational operator for a placeholder', () => {
    const legend = placeholdersUsed(
      [entry('<number> < <number> | <string> < <string>')],
      [],
    );
    expect(legend.map((p) => p.id)).toEqual(['number', 'string']);
  });
});
