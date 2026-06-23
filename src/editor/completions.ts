import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from '@codemirror/autocomplete';
import { pickedCompletion, snippet } from '@codemirror/autocomplete';
import { Facet } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { KeywordInfo } from '../dialects/types';
import { applyMapToPhysical, planConstructNumbering } from './lineNumbering';
import { buildConstructSnippet, type ConstructTemplate } from './constructs';

/** Auto line-numbering state the construct expansion needs at apply time. */
export interface NumberingConfig {
  /** Whether the editor auto-numbers lines (mirrors the store setting). */
  auto: boolean;
  /** Spacing between auto-assigned line numbers. */
  increment: number;
}

/**
 * Facet carrying the live auto line-numbering settings into the editor so a
 * construct completion can number the BASIC lines it expands. Provided (and
 * reconfigured) by the editor host; the default keeps standalone use sane.
 */
export const numberingConfig = Facet.define<NumberingConfig, NumberingConfig>({
  combine: (values) =>
    values.length ? values[values.length - 1]! : { auto: true, increment: 10 },
});

/**
 * Apply a construct template: expand the block, numbering each continuation
 * line, and leave the caret on the first snippet field. Falls back to inserting
 * the bare keyword when numbering can't fit the program.
 */
function makeConstructApply(tmpl: ConstructTemplate) {
  return (
    view: EditorView,
    completion: Completion,
    from: number,
    to: number,
  ): void => {
    const extra = tmpl.lines.length - 1;
    const cfg = view.state.facet(numberingConfig);

    // Single-line construct, or auto-numbering off: a plain (un-numbered) snippet.
    if (extra === 0 || !cfg.auto) {
      const template = buildConstructSnippet(tmpl.lines, null);
      snippet(template)(view, completion, from, to);
      return;
    }

    const doc = view.state.doc;
    const line = doc.lineAt(from);
    const idx = line.number - 1;
    const physical = doc.toString().split('\n');
    const plan = planConstructNumbering(physical, idx, cfg.increment, extra);
    if (!plan) {
      // No room to number the block — insert just the keyword.
      view.dispatch({
        changes: { from, to, insert: tmpl.label },
        selection: { anchor: from + tmpl.label.length },
        annotations: pickedCompletion.of(completion),
      });
      return;
    }

    let snipFrom = from;
    let snipTo = to;
    // Free room (cascade) and/or number the current line before expanding. Both
    // only touch line prefixes, so the snippet offsets shift by the inserted
    // current-line prefix; recompute them from the rewritten document.
    if (plan.cascade.size > 0 || plan.currentLineNo !== null) {
      const newPhysical = applyMapToPhysical(physical, plan.cascade);
      if (plan.currentLineNo !== null)
        newPhysical[idx] = `${plan.currentLineNo} ${newPhysical[idx]}`;
      const newText = newPhysical.join('\n');

      let lineStart = 0;
      for (let k = 0; k < idx; k++) lineStart += newPhysical[k]!.length + 1;
      const prefixLen =
        plan.currentLineNo !== null ? `${plan.currentLineNo} `.length : 0;
      const col = from - line.from;
      snipFrom = lineStart + prefixLen + col;
      snipTo = snipFrom + (to - from);

      view.dispatch({
        changes: { from: 0, to: doc.length, insert: newText },
        selection: { anchor: snipFrom, head: snipTo },
      });
    }

    const template = buildConstructSnippet(tmpl.lines, plan.continuationNos);
    snippet(template)(view, completion, snipFrom, snipTo);
  };
}

/**
 * Build an autocomplete source from a dialect's keyword table, optionally adding
 * code-construct (block) completions. A construct whose label matches a keyword
 * (e.g. "IF", "FOR") supersedes the plain keyword entry so only the block form
 * is offered for it.
 */
export function buildCompletionSource(
  keywords: KeywordInfo[],
  constructs: ConstructTemplate[] = [],
): CompletionSource {
  const constructLabels = new Set(constructs.map((c) => c.label));

  const keywordOptions: Completion[] = keywords
    .filter((k) => /^[A-Z]/.test(k.word))
    .filter((k) => !constructLabels.has(k.word))
    .map((k) => ({
      label: k.word,
      type:
        k.kind === 'command'
          ? 'keyword'
          : k.kind === 'function'
            ? 'function'
            : 'operator',
      detail: k.signature,
      info: k.doc,
      boost: k.kind === 'command' ? 1 : 0,
    }));

  const constructOptions: Completion[] = constructs.map((c) => ({
    label: c.label,
    type: c.type ?? 'keyword',
    detail: c.detail,
    // Rank the block form just above the plain command keywords.
    boost: 2,
    apply: makeConstructApply(c),
  }));

  const options = [...constructOptions, ...keywordOptions];

  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[A-Za-z][A-Za-z$]*/);
    if (!word && !context.explicit) return null;
    // Don't complete inside strings (odd number of quotes before cursor)
    const line = context.state.doc.lineAt(context.pos);
    const before = context.state.sliceDoc(line.from, context.pos);
    const quotes = (before.match(/"/g) ?? []).length;
    if (quotes % 2 === 1) return null;

    return {
      from: word ? word.from : context.pos,
      options,
      validFor: /^[A-Za-z$]*$/,
    };
  };
}
