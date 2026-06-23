import { describe, it, expect } from 'vitest';
import { EditorState, Transaction } from '@codemirror/state';
import { CompletionContext, type Completion } from '@codemirror/autocomplete';
import {
  buildCompletionSource,
  numberingConfig,
  fullCompletion,
  type NumberingConfig,
} from './completions';
import type { ConstructTemplate } from './constructs';
import type { KeywordInfo } from '../dialects/types';

const keywords: KeywordInfo[] = [
  { word: 'FOR', token: 1, kind: 'command' },
  { word: 'PRINT', token: 2, kind: 'command' },
];
const constructs: ConstructTemplate[] = [
  { label: 'IF', lines: ['IF ${1:condition} THEN ${0}'] },
  {
    label: 'FOR',
    lines: ['FOR ${1:I}=${2:1} TO ${3:10}', '${0}', 'NEXT ${1:I}'],
  },
];

/**
 * A minimal stand-in for an EditorView that applies dispatched transactions to
 * an in-memory state — enough to drive a completion's `apply` headlessly (the
 * snippet machinery only touches state, not the DOM).
 */
function makeView(
  doc: string,
  cfg: NumberingConfig = { auto: true, increment: 10 },
) {
  let state = EditorState.create({
    doc,
    extensions: [numberingConfig.of(cfg)],
  });
  return {
    get state() {
      return state;
    },
    dispatch(spec: unknown) {
      const tr =
        spec instanceof Transaction ? spec : state.update(spec as never);
      state = tr.state;
    },
  };
}

/** Find a construct option and run its apply over [from, to) on `view`. */
function accept(
  view: ReturnType<typeof makeView>,
  label: string,
  from: number,
  to: number,
) {
  const source = buildCompletionSource(keywords, constructs);
  const result = source(new CompletionContext(view.state, to, true));
  const opt = result!.options.find((o) => o.label === label) as Completion & {
    apply: (v: unknown, c: Completion, f: number, t: number) => void;
  };
  opt.apply(view, opt, from, to);
}

describe('construct completion expansion', () => {
  it('expands FOR into a numbered loop block with the caret on the variable', () => {
    const view = makeView('10 FOR');
    accept(view, 'FOR', 3, 6);
    expect(view.state.doc.toString()).toBe('10 FOR I=1 TO 10\n20 \n30 NEXT I');
    // First snippet field is the loop variable in the FOR header.
    const sel = view.state.selection.main;
    expect(view.state.sliceDoc(sel.from, sel.to)).toBe('I');
    expect(sel.from).toBe('10 FOR '.length);
  });

  it('bootstraps a line number when the current line has none', () => {
    const view = makeView('FOR');
    accept(view, 'FOR', 0, 3);
    expect(view.state.doc.toString()).toBe('10 FOR I=1 TO 10\n20 \n30 NEXT I');
  });

  it('cascades following lines when the gap is too tight', () => {
    const view = makeView('10 FOR\n11 PRINT');
    accept(view, 'FOR', 3, 6);
    expect(view.state.doc.toString()).toBe(
      '10 FOR I=1 TO 10\n11 \n12 NEXT I\n13 PRINT',
    );
  });

  it('expands IF inline with the caret on the condition', () => {
    const view = makeView('10 IF');
    accept(view, 'IF', 3, 5);
    expect(view.state.doc.toString()).toBe('10 IF condition THEN ');
    const sel = view.state.selection.main;
    expect(view.state.sliceDoc(sel.from, sel.to)).toBe('condition');
  });

  it('expands without line numbers when auto-numbering is off', () => {
    const view = makeView('FOR', { auto: false, increment: 10 });
    accept(view, 'FOR', 0, 3);
    expect(view.state.doc.toString()).toBe('FOR I=1 TO 10\n\nNEXT I');
  });
});

describe('fullCompletion toggle', () => {
  function optionsFor(full: boolean) {
    const source = buildCompletionSource(keywords, constructs);
    const state = EditorState.create({
      doc: '10 F',
      extensions: [fullCompletion.of(full)],
    });
    return source(new CompletionContext(state, 4, true))!.options;
  }

  it('offers block constructs (with apply) when enabled', () => {
    const forOpt = optionsFor(true).find((o) => o.label === 'FOR');
    expect(typeof forOpt!.apply).toBe('function');
    expect(optionsFor(true).some((o) => o.label === 'IF')).toBe(true);
  });

  it('falls back to bare keyword options when disabled', () => {
    const opts = optionsFor(false);
    const forOpt = opts.find((o) => o.label === 'FOR');
    // FOR is back to a plain (apply-less) keyword and IF (construct-only) is gone.
    expect(forOpt!.apply).toBeUndefined();
    expect(opts.some((o) => o.label === 'IF')).toBe(false);
  });
});
