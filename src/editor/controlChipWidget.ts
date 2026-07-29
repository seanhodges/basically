// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Inline rendering for display-control escapes: each `{GRAPHICS WHITE}` and the
 * like inside a string literal is replaced by a chip picturing what the code
 * does, and made atomic, so the cursor treats it as one unit - selectable and
 * deletable whole, never editable from the middle. Gated on
 * `Dialect.displayControls`.
 *
 * The document is untouched. What the tokenizer, the exporters and the AI path
 * see is the escape text the user typed; only the drawing is different, which
 * is what lets a chip be wrong about nothing.
 *
 * Only string literals are decorated. The tokenizer also honours escapes after
 * `REM`/`DATA` and in `*`-command lines, but recognising those means repeating
 * its keyword scan here, and a wrong answer would draw a chip over text that is
 * not an escape. A string needs only quote parity, is where the graphics
 * palette inserts, and is where a MODE 7 line is written; an escape elsewhere
 * simply stays spelled out.
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
  CHIP_BOX,
  CHIP_EDGE,
  chipShapes,
  type ChipShape,
  type ControlChip,
} from '../dialects/controlChip';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgNode(
  name: string,
  attrs: Record<string, string | number>,
): SVGElement {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, String(value));
  return node;
}

/** One shape of the chip, drawn in `ink`. Mirrors `ControlChipSvg.tsx`. */
function shapeNode(shape: ChipShape, ink: string): SVGElement {
  switch (shape.kind) {
    case 'rect':
      return svgNode('rect', {
        x: shape.x,
        y: shape.y,
        width: shape.w,
        height: shape.h,
        ...(shape.rx === undefined ? {} : { rx: shape.rx }),
        fill: ink,
      });
    case 'circle':
      return svgNode('circle', {
        cx: shape.cx,
        cy: shape.cy,
        r: shape.r,
        fill: ink,
      });
    case 'path':
      return svgNode('path', { d: shape.d, fill: ink });
    case 'dashedRect':
      return svgNode('rect', {
        x: shape.x,
        y: shape.y,
        width: shape.w,
        height: shape.h,
        fill: 'none',
        stroke: ink,
        'stroke-width': 1.4,
        'stroke-dasharray': '2 1.6',
      });
    case 'text': {
      const node = svgNode('text', {
        x: CHIP_BOX / 2,
        y: CHIP_BOX / 2,
        fill: ink,
        'font-size': shape.size,
        'font-weight': 700,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
      });
      node.textContent = shape.text;
      return node;
    }
  }
}

class ControlChipWidget extends WidgetType {
  constructor(
    readonly chip: ControlChip,
    readonly escape: string,
    readonly code: number,
  ) {
    super();
  }

  override eq(other: ControlChipWidget): boolean {
    return other.escape === this.escape;
  }

  override toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-controlChip';
    el.title = `${this.chip.title} — ${this.escape}, CHR$(${this.code})`;
    el.setAttribute('aria-label', this.chip.title);
    const { fill, ink, shapes } = chipShapes(this.chip);
    const svg = svgNode('svg', {
      viewBox: `0 0 ${CHIP_BOX} ${CHIP_BOX}`,
      focusable: 'false',
      'aria-hidden': 'true',
    });
    svg.append(
      svgNode('rect', {
        x: 0.6,
        y: 0.6,
        width: CHIP_BOX - 1.2,
        height: CHIP_BOX - 1.2,
        rx: 3,
        fill,
        stroke: CHIP_EDGE,
        'stroke-width': 1.2,
      }),
      ...shapes.map((shape) => shapeNode(shape, ink)),
    );
    el.append(svg);
    return el;
  }
}

/**
 * The character code an escape stands for, by asking the charset - so the chip
 * cannot claim a code the dialect does not agree with. Undefined if the escape
 * does not encode to exactly one byte, in which case it is left as text.
 */
function escapeCode(
  toMachine: (text: string) => Uint8Array,
  escape: string,
): number | undefined {
  try {
    const bytes = toMachine(escape);
    return bytes.length === 1 ? bytes[0] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Replace-decorations for every known control escape inside a string literal.
 * Escapes are matched longest-first so a name that is a prefix of another
 * cannot win, and the scan skips a `{` that starts no known escape, which is
 * what leaves a literal brace (0x7B) alone.
 */
export function controlChipDecorations(
  state: EditorState,
  controls: Record<string, ControlChip>,
  toMachine: (text: string) => Uint8Array,
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const escapes = Object.keys(controls).sort((a, b) => b.length - a.length);
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const text = line.text;
    let inString = false;
    for (let at = 0; at < text.length; ) {
      const ch = text[at]!;
      if (ch === '"') {
        inString = !inString;
        at++;
        continue;
      }
      if (!inString || ch !== '{') {
        at++;
        continue;
      }
      const escape = escapes.find((e) => text.startsWith(e, at));
      const code =
        escape === undefined ? undefined : escapeCode(toMachine, escape);
      if (escape === undefined || code === undefined) {
        at++;
        continue;
      }
      builder.add(
        line.from + at,
        line.from + at + escape.length,
        Decoration.replace({
          widget: new ControlChipWidget(controls[escape]!, escape, code),
        }),
      );
      at += escape.length;
    }
  }
  return builder.finish();
}

const chipTheme = EditorView.baseTheme({
  // Sized in em and baseline-aligned so a chip never changes the height of its
  // line or the alignment of the line number beside it.
  '.cm-controlChip': {
    display: 'inline-block',
    width: '1em',
    height: '1em',
    lineHeight: '1',
    verticalAlign: 'text-bottom',
    cursor: 'default',
    userSelect: 'none',
  },
  '.cm-controlChip svg': { display: 'block', width: '1em', height: '1em' },
});

/** The inline control-chip extension (decorations + atomicity + theme). */
export function controlChipExtension(
  controls: Record<string, ControlChip>,
  toMachine: (text: string) => Uint8Array,
): Extension {
  const field = StateField.define<DecorationSet>({
    create: (state) => controlChipDecorations(state, controls, toMachine),
    update(deco, tr) {
      return tr.docChanged
        ? controlChipDecorations(tr.state, controls, toMachine)
        : deco;
    },
    provide: (f) => [
      EditorView.decorations.from(f),
      EditorView.atomicRanges.of((view) => view.state.field(f)),
    ],
  });
  return [field, chipTheme];
}
