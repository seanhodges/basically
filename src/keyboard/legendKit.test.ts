import { describe, expect, it } from 'vitest';
import { act, cursorKey, ins, key, lbl, withLegend, word } from './legendKit';
import { KEY_SPAN } from './templateRows';

/**
 * The builders' semantics, pinned here rather than in twelve dialect layout
 * tests. What the machines then say with them - which legend sits on which key
 * - stays each dialect's own `keyboardLayout.test.ts`.
 */
describe('legend builders', () => {
  it('shapes a bare string as a plain label with no editor override', () => {
    expect(lbl('A')).toEqual({ text: 'A' });
  });

  it('leaves a blank layer blank', () => {
    expect(lbl(null)).toBeNull();
  });

  it('gives a keyword the trailing space that separates it from its argument', () => {
    expect(lbl(word('PRINT'))).toEqual({
      text: 'PRINT',
      editor: { insert: 'PRINT ' },
    });
  });

  it('binds an editing action without inserting text', () => {
    expect(lbl(act('⌫', 'backspace'))).toEqual({
      text: '⌫',
      editor: { action: 'backspace' },
    });
  });

  it('inserts text that differs from the legend shown', () => {
    expect(lbl(ins('␣', ' '))).toEqual({ text: '␣', editor: { insert: ' ' } });
  });

  it('carries a null editor through as an explicit no-op', () => {
    expect(lbl({ text: 'LF', editor: null })).toEqual({
      text: 'LF',
      editor: null,
    });
  });

  it('omits emits entirely on a legend that presses its key's own cell', () => {
    expect(lbl(word('PRINT'))).not.toHaveProperty('emits');
  });

  it('presses its own cell for a cursor legend, from one token or a pair', () => {
    expect(lbl(cursorKey('←', 'left', 'ArrowLeft'))).toEqual({
      text: '←',
      editor: { action: 'left' },
      emits: ['ArrowLeft'],
    });
    // The Sinclairs have no arrow keys: their cursor is SHIFT over 5/6/7/8.
    expect(lbl(cursorKey('←', 'left', ['Shift', 'Digit5']))).toEqual({
      text: '←',
      editor: { action: 'left' },
      emits: ['Shift', 'Digit5'],
    });
  });
});

describe('key', () => {
  it('emits its own token at the standard keycap width', () => {
    expect(key('KeyA', ['A', null, null])).toEqual({
      id: 'KeyA',
      spanX: KEY_SPAN,
      emits: ['KeyA'],
      labels: [{ text: 'A' }, null, null],
    });
  });

  it('keeps one label per layer, at three layers and at five', () => {
    expect(key('KeyA', ['A', 'a', null]).labels).toHaveLength(3);
    expect(
      key('Digit1', ['1', '!', word('NEW'), 'PI', null]).labels,
    ).toHaveLength(5);
  });

  it('takes matrix tokens and a width that differ from the defaults', () => {
    const enter = key('Enter', [act('↵', 'newline')], {
      emits: ['Return'],
      spanX: 6,
    });
    expect(enter).toMatchObject({ id: 'Enter', emits: ['Return'], spanX: 6 });
  });
});

describe('withLegend', () => {
  it('replaces the named layer and leaves the rest of the key alone', () => {
    const base = key('KeyW', ['W', null, null]);
    const withArrow = withLegend(base, 2, cursorKey('↑', 'up', 'CursorUp'));
    expect(withArrow.labels).toEqual([
      { text: 'W' },
      null,
      { text: '↑', editor: { action: 'up' }, emits: ['CursorUp'] },
    ]);
    expect(base.labels[2]).toBeNull();
  });

  it('blanks the layers a key skips over', () => {
    const arrowed = withLegend(
      key('KeyW', ['W']),
      3,
      cursorKey('↑', 'up', 'CursorUp'),
    );
    expect(arrowed.labels).toHaveLength(4);
    expect(arrowed.labels.slice(1, 3)).toEqual([null, null]);
  });
});
