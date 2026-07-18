// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Collapsed rendering for `#BIN <base64>` directive lines: each well-formed
 * directive is replaced by an inline chip ("binary line 0 · 1,192 bytes") and
 * made atomic, so the cursor treats the opaque payload as one unit - it can be
 * selected and deleted whole but never edited from the middle. A directive
 * with a malformed payload keeps its raw text so the lint error stays
 * actionable. Gated on `Dialect.supportsBinaryLines`.
 */

import { RangeSetBuilder, StateField, type Extension } from '@codemirror/state';
import type { EditorState } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view';
import {
  binaryRecordInfo,
  isBinaryDirective,
  parseBinaryDirective,
} from '../dialects/binaryDirective';

class BinaryChipWidget extends WidgetType {
  constructor(
    readonly lineNo: number,
    readonly recordBytes: number,
  ) {
    super();
  }

  override eq(other: BinaryChipWidget): boolean {
    return (
      other.lineNo === this.lineNo && other.recordBytes === this.recordBytes
    );
  }

  override toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-binaryLineChip';
    const bytes = this.recordBytes.toLocaleString('en-US');
    el.textContent = `binary line ${this.lineNo} · ${bytes} bytes`;
    el.title =
      'Machine code imported from a binary file. It runs and exports ' +
      'byte-exactly but cannot be edited as text; delete the whole line to ' +
      'remove it.';
    return el;
  }
}

/** Replace-decorations for every well-formed `#BIN` line in the document. */
export function binaryLineDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    if (!isBinaryDirective(line.text)) continue;
    const parsed = parseBinaryDirective(line.text);
    if (!parsed || 'error' in parsed) continue; // malformed: leave visible
    const { lineNo, recordBytes } = binaryRecordInfo(parsed.record);
    builder.add(
      line.from,
      line.to,
      Decoration.replace({ widget: new BinaryChipWidget(lineNo, recordBytes) }),
    );
  }
  return builder.finish();
}

const binaryLineField = StateField.define<DecorationSet>({
  create: binaryLineDecorations,
  update(deco, tr) {
    return tr.docChanged ? binaryLineDecorations(tr.state) : deco;
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

const chipTheme = EditorView.baseTheme({
  '.cm-binaryLineChip': {
    display: 'inline-block',
    padding: '0 0.5em',
    borderRadius: '0.6em',
    backgroundColor: '#ececf2',
    border: '1px solid #b8b8c8',
    color: '#555',
    fontStyle: 'italic',
    fontSize: '85%',
    lineHeight: '1.4',
    cursor: 'default',
    userSelect: 'none',
    verticalAlign: 'baseline',
  },
});

/** The collapsed `#BIN` chip extension (decorations + atomicity + theme). */
export function binaryLineExtension(): Extension {
  return [binaryLineField, chipTheme];
}
