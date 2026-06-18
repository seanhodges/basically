# Adding a virtual keyboard for a new target machine

The virtual keyboard is entirely data-driven. The `VirtualKeyboard` component
and `inputEngine` contain no machine-specific logic; all you do is produce a
`KeyboardLayout` object and wire it into your emulator's `setKey()`. Adding a
keyboard for a new machine never requires touching keyboard code.

## The standard template

Every keyboard uses one common, screen-optimised template — a uniform
**40-column grid, ten keys per row** (`gridColumns: 40`, each key `spanX: 4`)
with five bands:

- **Top strip** — mode tabs (`editorModes`) when the machine has extra typing
  layers, the machine's `functionKeys` when it does not, or both behind an icon
  toggle. On wide screens the strip relocates into the left gutter beside the
  centred keyboard.
- **Number row** — the ten digits.
- **QWERTY + home rows** — the letters; Enter is the home row's tenth key.
- **ZXCV row** — the remaining letters and punctuation, centred when short.
- **Common bottom row** — a centred space bar, a quote and backspace key on the
  right, and the shift / machine modifiers either side.

Reuse `src/keyboard/templateRows.ts` (`GRID_COLUMNS`, `KEY_SPAN`, the
`NUMBER_ROW_TOKENS`/`QWERTY_ROW_TOKENS`/… token orders, `centerRow`, and the
`bottomRow` factory) so your layout supplies only its legends and modifiers and
inherits the template's proportions. Prefer icons/abbreviations (`⇧ ⌫ ↵ "`) over
wide text; do **not** add arrow keys (the editor handles cursor placement by
touch). Deviate from the template only where the machine genuinely requires it
(see the BBC's SYM mode and the C64's SHIFT-layer symbols for examples of
trading authenticity for a clean, thumb-sized grid).

## Overview

Three things are needed:

1. **`keyboardLayout.ts`** in your dialect folder — a `KeyboardLayout` value
   describing every key, its legends, its layers, and any modifier behaviour.
2. **`setKey(token, down)`** in your emulator — translate the opaque token
   strings emitted by your keys into your machine's physical matrix.
3. **`keyboardLayout`** field on your `Dialect` export — exposes the layout to
   the IDE.

## 1. The `KeyboardLayout` object

Import the types from `src/keyboard/layoutSchema.ts`.

```ts
import type { KeyboardLayout } from '../../keyboard/layoutSchema';

export const myMachineKeyboardLayout: KeyboardLayout = {
  id: 'mymachine', // unique id
  name: 'My Machine', // shown in the UI
  theme: 'vk-theme-mymachine', // CSS class on the keyboard root
  gridColumns: 40, // standard template grid: ten spanX:4 keys per row
  layers: [
    /* ... */
  ],
  modifiers: [
    /* ... */
  ],
  rows: [
    /* ... */
  ],
  glyphs: {},
  // editorModes? — top-strip mode tabs (omit if the base layer + modifiers
  //   cover everything).
  // functionKeys? — top-strip machine keys (e.g. f1/f3/f5/f7); shown behind a
  //   toggle when editorModes are also present.
  options: { minHoldFrames: 3 },
};
```

### Layers

A layer is one set of legends (one per key). Every key's `labels` array is
index-aligned with `layers`.

```ts
layers: [
  // Base layer — always visible at centre of the keycap.
  {
    id: 'main',
    position: 'center',     // 'center' | 'tl' | 'tr' | 'bl' | 'br' | 'below'
    activeWhen: [],         // [] = base (always shown)
    editorInsertStyle: 'char', // 'char' inserts label text verbatim; 'word' adds a trailing space
  },
  // Shifted layer — top-right corner, active when the 'shift' modifier is held.
  {
    id: 'shift',
    name: 'SHIFT',          // optional; shown in the compact-mode legend selector
    position: 'tr',
    activeWhen: ['shift'],  // modifier ids that make this layer active
    editorInsertStyle: 'char',
  },
],
```

Layers whose `activeWhen` is `[]` are always rendered. Layers driven by a
modifier (e.g. `['shift']`) are highlighted when that modifier is engaged.

### Modifiers

```ts
modifiers: [
  {
    id: 'shift',
    emits: ['Shift'],   // tokens held while engaged; [] = UI-only (no matrix press)
    sticky: true,       // tap once: held for the next non-modifier key press
    lockable: true,     // double-tap: locked until tapped again
  },
],
```

Modifier tap cycles: **off → held → (sticky) → (locked) → off**.

### Rows and keys

`rows` is a 2-D array: outer = rows (top to bottom), inner = keys per row. Each
key has a `spanX` that consumes that many grid columns from the row total.

```ts
rows: [
  [
    {
      id: 'KeyA',          // referenced nowhere externally; keep it unique
      spanX: 4,            // width in grid units
      emits: ['KeyA'],     // token(s) sent to setKey() on press (and their reverse on release)
      labels: [
        { text: 'A' },     // index 0 = layers[0] (main)
        { text: '*' },     // index 1 = layers[1] (shift)
      ],
    },
    // A modifier key — note modifier: 'shift' instead of a label on that layer.
    {
      id: 'Shift',
      spanX: 6,
      emits: ['Shift'],
      modifier: 'shift',   // this key IS the named modifier
      style: 'shift',      // optional CSS class suffix (e.g. vk-style-shift)
      labels: [{ text: 'SHIFT' }, null],
    },
    // A chord key: emits two tokens simultaneously (no real-keyboard equivalent).
    {
      id: 'x-clear',
      spanX: 8,
      emits: ['Shift', 'KeyA'],
      style: 'extra',
      labels: [{ text: 'CLEAR' }, null],
    },
  ],
  // ... more rows
],
```

**`null` in `labels`** means no legend on that layer for this key.

#### Overriding editor behaviour

By default the editor action is derived from the label text + the layer's
`editorInsertStyle`. Override per-label with the `editor` field:

```ts
{ text: 'NEW LINE', editor: { action: 'newline' } }   // cursor / edit action
{ text: 'RUBOUT',  editor: { action: 'backspace' } }
{ text: '←',       editor: { action: 'left' } }
{ text: 'SCROLL',  editor: null }          // machine-only — no editor effect
{ text: 'PRINT',   editor: { insert: 'PRINT ' } }  // insert different text than shown
```

Available actions: `'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down'`.

### Glyphs (optional)

Glyphs are SVG path data stored as constrained objects (never raw `innerHTML`):

```ts
glyphs: {
  arrowUp: {
    viewBox: '0 0 16 16',
    paths: [{ d: 'M8 2L14 10H2Z' }],  // fill: currentColor by default
  },
},
```

Reference a glyph in a label with `glyph: 'arrowUp'` instead of `text`.

### Editor modes (optional)

If your machine has multiple typing layers (like the ZX81's K/F/G cursor, or a
SYM layer for punctuation overflow), expose them as top-strip mode tabs. Each
tab pins a layer's legends and editor inserts.

```ts
editorModes: [
  { id: 'text',    name: 'TEXT',    layer: 'main' },
  { id: 'keyword', name: 'KEYWORD', layer: 'keyword' },
],
```

Omit `editorModes` entirely if the base layer + modifiers cover everything.

### Function keys (optional)

Machine function keys (e.g. the C64's f1/f3/f5/f7, the BBC's f0–f9) live in the
top strip as ordinary keys — they `emit` matrix tokens and have no editor
action:

```ts
functionKeys: [
  { id: 'F1', spanX: 4, emits: ['F1'], style: 'fn', labels: [{ text: 'f1', editor: null }] },
  // …
],
```

When a layout has **only** `functionKeys` the strip shows them; with **only**
`editorModes` it shows the mode tabs; with **both** it shows a leading icon
toggle that flips the strip between the two.

### Sizing

The template keeps keys evenly proportioned and large enough to thumb-type:
keys hold a minimum touch size (`--vk-key-min`) and, above that, a consistent
width:height ratio (`--vk-aspect`). On wide screens the keyboard centres and its
key width is height-derived so keys never stretch. You don't size anything in
the layout — just keep to `spanX: 4` for ordinary keys.

## 2. Wiring `setKey()` in the emulator

The input engine calls `setKey(token, down)` for every key press and release.
The token strings come directly from `KeyDef.emits` in your layout — they are
opaque to the framework. Pick whatever strings map naturally to your matrix (DOM
key-code style strings work well).

Typical pattern — a keyboard class that owns the matrix:

```ts
// my-machine/emulator/keyboard.ts
const ROWS: string[][] = [
  // Address line A8:   bit0    bit1    bit2    bit3    bit4
  ['Shift', 'KeyZ', 'KeyX', 'KeyC', 'KeyV'],
  // Address line A9:
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG'],
  // ... etc.
];

const keyPosition = new Map<string, { row: number; bit: number }>();
ROWS.forEach((row, r) =>
  row.forEach((code, b) => keyPosition.set(code, { row: r, bit: b })),
);

export class MyMachineKeyboard {
  private readonly matrix = new Uint8Array(ROWS.length);
  private readonly virtualDown = new Set<string>();
  private readonly physicalDown = new Set<string>();

  setKey(token: string, down: boolean): void {
    if (!keyPosition.has(token)) return;
    if (down) this.virtualDown.add(token);
    else this.virtualDown.delete(token);
    this.applyKey(token);
  }

  handleKey(e: KeyboardEvent, down: boolean): boolean {
    const code =
      e.code === 'ShiftLeft' || e.code === 'ShiftRight' ? 'Shift' : e.code;
    if (!keyPosition.has(code)) return false;
    if (down) this.physicalDown.add(code);
    else this.physicalDown.delete(code);
    this.applyKey(code);
    return true;
  }

  releaseAll(): void {
    this.physicalDown.clear();
    this.virtualDown.clear();
    this.matrix.fill(0);
  }

  private applyKey(code: string): void {
    const pos = keyPosition.get(code);
    if (!pos) return;
    const held = this.physicalDown.has(code) || this.virtualDown.has(code);
    if (held) this.matrix[pos.row]! |= 1 << pos.bit;
    else this.matrix[pos.row]! &= ~(1 << pos.bit);
  }

  // Your machine reads this in its port-read handler.
  readMatrix(row: number): number {
    return this.matrix[row] ?? 0;
  }
}
```

> **Why separate `physicalDown` and `virtualDown`?** A physical keyup must not
> release a key the virtual keyboard still holds, and vice versa. Union both
> sets when writing to the matrix.

In your emulator class:

```ts
// my-machine/emulator/myMachine.ts
export class MyMachineEmulator implements MachineEmulator {
  private readonly keyboard = new MyMachineKeyboard();

  setKey(token: string, down: boolean): void {
    this.keyboard.setKey(token, down);
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    return this.keyboard.handleKey(e, down);
  }

  releaseAllKeys(): void {
    this.keyboard.releaseAll();
  }
  // ... rest of MachineEmulator
}
```

## 3. Exposing the layout from the dialect

```ts
// my-machine/index.ts
import { myMachineKeyboardLayout } from './keyboardLayout';

export const myMachine: Dialect = {
  // ...
  keyboardLayout: myMachineKeyboardLayout,
  createEmulator(opts) {
    return new MyMachineEmulator(opts);
  },
};
```

Register in `src/dialects/registry.ts`.

## 4. Theming (optional)

Add a CSS block in `src/styles.css` targeting your theme class:

```css
.virtual-keyboard.vk-theme-mymachine {
  --vk-bg: #c8c8c8;
  --vk-key-bg: #4a4a4a;
  --vk-key-color: #ffffff;
  /* font-family, border-radius, etc. */
}
```

The class name must match the `theme` field in your `KeyboardLayout`.

## 5. Testing

Add a `keyboardLayout.test.ts` next to your layout file:

```ts
import { describe, it, expect } from 'vitest';
import { myMachineKeyboardLayout as layout } from './keyboardLayout';

describe('myMachineKeyboardLayout', () => {
  it('every key has a label tuple aligned with layers', () => {
    const layerCount = layout.layers.length;
    for (const row of layout.rows) {
      for (const key of row) {
        expect(key.labels).toHaveLength(layerCount);
      }
    }
  });

  it('every modifier referenced by a key exists in layout.modifiers', () => {
    const ids = new Set(layout.modifiers.map((m) => m.id));
    for (const row of layout.rows) {
      for (const key of row) {
        if (key.modifier) expect(ids).toContain(key.modifier);
      }
    }
  });

  it('every glyph referenced in labels is registered', () => {
    for (const row of layout.rows) {
      for (const key of row) {
        for (const label of key.labels) {
          if (label?.glyph) expect(layout.glyphs).toHaveProperty(label.glyph);
        }
      }
    }
  });
});
```

Also add a matrix test for your keyboard class covering `setKey`/`readMatrix`
and the physical+virtual key union behaviour (see
`src/dialects/zx81/emulator/keyboard.test.ts` for the ZX81 example).

## Key files to reference

| File                                      | What it shows                                 |
| ----------------------------------------- | --------------------------------------------- |
| `src/keyboard/layoutSchema.ts`            | All type definitions                          |
| `src/keyboard/templateRows.ts`            | Shared grid constants, token orders, helpers  |
| `src/dialects/zx81/keyboardLayout.ts`     | Full 5-layer, 4-mode template example         |
| `src/dialects/bbcmicro/keyboardLayout.ts` | Modes + function keys (toggle) + SYM overflow |
| `src/dialects/zx81/emulator/keyboard.ts`  | 8×5 matrix + dual press-source pattern        |
| `src/keyboard/inputEngine.ts`             | Frame-count hold, modifier state machine      |
| `src/keyboard/VirtualKeyboard.tsx`        | React component (no changes needed)           |
