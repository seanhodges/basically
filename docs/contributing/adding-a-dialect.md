# Adding a new BASIC dialect

A **target system** is one microcomputer's worth of support: a BASIC **dialect**
(tokenizer, charset, keywords), an **emulator** (CPU bus + display + I/O), a
**virtual keyboard**, transfer/tape I/O, an AI profile and samples — roughly 20
files.

## Using the Claude skill

**We recommend using the `adding-a-target-system` skill.** It audits the complete
dialects to derive the current "feature complete" baseline, writes a
dependency-ordered, multi-stage plan to
`docs/contributing/dialect-plans/<id>.md`, and creates a compiling stub folder
under `src/dialects/<id>/`.

The skill **plans and scaffolds only** — it does not
implement the stages or register the dialect; you run each stage on demand (see
`docs/contributing/dialect-plans/README.md`). This page is the **per-component
reference** those stages draw on: the dialect file layout, then the virtual
keyboard, then wrapping a third-party emulator.

## Doing it by hand / without Claude

This outlines the basic steps for creating a new dialect. It's not exhaustive but
serves as a guide for getting basic support working. It's also worth reading `.claude/skills/adding-a-target-system/SKILL.md` as the steps are kept up to date there.

The app only talks to the `Dialect` interface (`src/dialects/types.ts`);
everything machine-specific lives in one folder. To add, say, ZX Spectrum
BASIC:

1. **Create `src/dialects/spectrum/`** mirroring `src/dialects/zx81/`:
   - `keywords.ts` — the token table (`KeywordInfo[]`). This alone powers
     highlighting and autocomplete via the generic builders in `src/editor/`.
   - `language.ts` — wires the keyword table (and any lexical quirks) into the
     CodeMirror language. Pass the dialect's block templates from
     `src/editor/constructs.ts` (`constructsByDialect[<id>]`) as the second
     argument to `buildCompletionSource` so conditionals, loops and
     subroutines/procedures auto-complete as whole numbered blocks (IntelliJ
     "live template" style) rather than as a bare keyword.
   - `charset.ts` — a `CharsetMapping` between editor text and machine codes.
   - `tokenizer.ts` / `detokenizer.ts` — text ↔ tokenized program bytes.
   - an image builder (the Spectrum equivalent of `pfile.ts` is a `.tap`/
     `.sna` builder).
   - `emulator/` — a `MachineEmulator` implementation. The Z80 core in
     `src/emulator/z80/` is machine-independent; provide your own bus
     (memory map, ULA ports, contention model as needed).
   - `keyboardLayout.ts` — the data-driven `KeyboardLayout` for the on-screen
     keyboard (see [Adding the virtual keyboard](#adding-the-virtual-keyboard)).
   - `aiProfile.ts` — a system prompt teaching Claude the dialect's rules.
   - `targets.ts` — `BuildTarget[]` for file exports, plus optional cassette
     audio support (`audio.buildSamples`).
   - `index.ts` — assemble and export the `Dialect` object.

   Import is the mirror of export and is just as dialect-agnostic — the app's
   Import dialog drives it entirely from the interface. Two optional fields turn
   it on: `binaryImports` lists the file formats `detokenize()` can read back
   (e.g. `.P` / `.O` / `.TAP` / `.bbc`), and `audio.decodeSamples` recovers a
   program from recorded cassette audio (the inverse of `audio.buildSamples`).
   Both are optional: a dialect can ship export before import. See
   `docs/reference/file-formats.md` § Cassette audio for the per-machine codecs and the
   shared `src/dialects/sinclairTape.ts` decoder.

2. **Register it** in `src/dialects/registry.ts`.
3. **Drop the ROM** into `public/roms/` with an attribution note.
4. **Add tests**: tokenizer round-trip, image-builder pointer consistency,
   and a machine boot test like `zx81Machine.test.ts` (boot the ROM, inject a
   program, assert on display memory).

Nothing outside the dialect folder should need to change: the editor, lint,
status bar, AI panel, transfer dialog and emulator pane all operate on the
interface. Dialects whose display is not the classic 256×192 set
`displaySize` on the `Dialect` object; the emulator pane sizes its canvas
from it.

### Adding a virtual keyboard

The virtual keyboard is entirely data-driven. The `VirtualKeyboard` component
and `inputEngine` contain no machine-specific logic; all you do is produce a
`KeyboardLayout` object and wire it into your emulator's `setKey()`. Adding a
keyboard for a new machine never requires touching keyboard code.

#### The standard template

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

Three things are needed:

1. **`keyboardLayout.ts`** in your dialect folder — a `KeyboardLayout` value
   describing every key, its legends, its layers, and any modifier behaviour.
2. **`setKey(token, down)`** in your emulator — translate the opaque token
   strings emitted by your keys into your machine's physical matrix.
3. **`keyboardLayout`** field on your `Dialect` export — exposes the layout to
   the IDE.

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

#### Glyphs, editor modes, function keys (optional)

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

#### Sizing

The template keeps keys evenly proportioned and large enough to thumb-type:
keys hold a minimum touch size (`--vk-key-min`) and, above that, a consistent
width:height ratio (`--vk-aspect`). On wide screens the keyboard centres and its
key width is height-derived so keys never stretch. You don't size anything in
the layout — just keep to `spanX: 4` for ordinary keys.

#### 2. Wiring `setKey()` in the emulator

The input engine calls `setKey(token, down)` for every key press and release.
The token strings come directly from `KeyDef.emits` in your layout — they are
opaque to the framework. Pick whatever strings map naturally to your matrix (DOM
key-code style strings work well).

> **Why separate `physicalDown` and `virtualDown`?** A physical keyup must not
> release a key the virtual keyboard still holds, and vice versa. Union both
> sets when writing to the matrix.

### 3. Exposing the layout from the dialect

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

Also add a matrix test for your keyboard class covering `setKey`/`readMatrix`
and the physical+virtual key union behaviour (see
`src/dialects/zx81/emulator/keyboard.test.ts` for the ZX81 example).

## Wrapping an existing emulator

A dialect's `MachineEmulator` does not have to be built from an in-tree CPU
core: the BBC Micro target for example (`src/dialects/bbcmicro/`) wraps the
[jsbeeb](https://github.com/mattgodbolt/jsbeeb) npm package behind an adapter
in `src/emulator/bbc/`. That pattern looks like:

- an adapter class implementing `MachineEmulator`, confining all contact
  with the third-party API to one folder, plus a hand-written `.d.ts` for
  the surface used (jsbeeb ships no types);
- ROM assets copied into `public/roms/` in the layout the package's loader
  expects, with attribution;
- a native tokenizer is still preferred over delegating to the emulated ROM:
  the BBC dialect tokenizes in TypeScript (`src/dialects/bbcmicro/tokenizer.ts`)
  to the genuine BASIC II byte layout, so the emulator just pokes the `image`
  in at PAGE — the same image used for `.bbc` import/export. Its output is
  regression-tested byte-for-byte against jsbeeb's ROM tokeniser
  (`tokenizer.test.ts`), which is how the keyword flags were pinned down.
