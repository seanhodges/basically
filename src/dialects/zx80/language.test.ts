import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { zx80CompletionSource } from './language';

describe('zx80 editor support', () => {
  it('autocompletes the integral functions as functions', () => {
    const state = EditorState.create({ doc: '10 PRINT R' });
    const result = zx80CompletionSource(
      new CompletionContext(state, state.doc.length, true),
    );
    const rnd = result?.options.find((o) => o.label === 'RND');
    expect(rnd).toBeDefined();
    expect(rnd!.type).toBe('function');
    // The other integral functions are offered too.
    for (const name of ['PEEK', 'ABS', 'CODE', 'CHR$', 'TL$']) {
      expect(
        result?.options.some((o) => o.label === name),
        name,
      ).toBe(true);
    }
  });
});
