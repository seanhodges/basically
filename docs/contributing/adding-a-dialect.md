# Adding a new BASIC dialect

A **target system** is one microcomputer's worth of support: a BASIC **dialect**
(tokenizer, charset, keywords), an **emulator** (CPU bus + display + I/O), a
**virtual keyboard**, transfer/tape I/O, an AI profile and samples - roughly 20
files.

## Using the Claude skill

**We recommend using the `adding-a-target-system` skill.** It audits the complete
dialects to derive the current "feature complete" baseline, writes a
dependency-ordered, multi-stage plan to
`docs/contributing/dialect-plans/<id>.md`, and creates a compiling stub folder
under `src/dialects/<id>/`.

The skill **plans and scaffolds only** - it does not
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
   - `keywords.ts` - the token table (`KeywordInfo[]`). This alone powers
     highlighting and autocomplete via the generic builders in `src/editor/`.
   - `language.ts` - wires the keyword table (and any lexical quirks) into the
     CodeMirror language. Pass the dialect's block templates from
     `src/editor/constructs.ts` (`constructsByDialect[<id>]`) as the second
     argument to `buildCompletionSource` so conditionals, loops and
     subroutines/procedures auto-complete as whole numbered blocks (IntelliJ
     "live template" style) rather than as a bare keyword.
   - `charset.ts` - a `CharsetMapping` between editor text and machine codes.
     Give each of the machine's block graphics its exact unicode character where
     one exists - Block Elements first, then Symbols for Legacy Computing - and
     fall back to a `{0xNN}` escape only where the mapping's injectivity or
     unicode itself leaves no character to use. Declare which bytes the machine
     treats as graphics in `SEMIGRAPHIC_CODES`
     (`src/dialects/semigraphicsAudit.ts`), cited to a primary source; see
     [Semigraphics support](./semigraphics-support) for what each machine
     currently manages and why.
   - `graphics.ts` - the machine's block graphics as a `GraphicEntry[]`, read by
     both the keyboard's palette and the charset so the two cannot drift. Derive
     which key types each character from the ROM rather than from a picture of
     the keyboard; on a machine that printed no graphics on its keycaps at all,
     leave `key` unset and the palette labels the cell with the character code
     its BASIC takes instead.
   - `addresses.ts` - the machine's fixed hardware addresses, declared **once**
     for the whole dialect: the program base, the screen base, whatever else the
     map, the linter and the emulator all need. Where the machine already has a
     `sysvars.ts`, put them there instead of adding a second module. Everything
     else imports from it rather than repeating a literal, so a layout fact has
     one definition to change. Cite the manual or ROM the value came from.
   - `tokenizer.ts` / `detokenizer.ts` - text ↔ tokenized program bytes.
   - an image builder (the Spectrum equivalent of `pfile.ts` is a `.tap`/
     `.sna` builder).
   - `emulator/` - a `MachineEmulator` implementation. The Z80 core in
     `src/emulator/z80/` is machine-independent; provide your own bus
     (memory map, ULA ports, contention model as needed).
   - `keyboardLayout.ts` - the data-driven `KeyboardLayout` for the on-screen
     keyboard (see [Adding the virtual keyboard](#adding-the-virtual-keyboard)).
   - `aiProfile.ts` - a system prompt teaching Claude the dialect's rules.
   - `targets.ts` - `BuildTarget[]` for file exports, plus optional cassette
     audio support (`audio.buildSamples`).
   - `index.ts` - assemble and export the `Dialect` object, including the four
     fields the machine picker shows: `name`, `manufacturer`, `year` and
     `blurb`. The blurb is two short sentences - one distinguishing fact about
     the machine, then the BASIC it runs - aiming for 60 characters and never
     over 72, since the picker clamps each row to two lines and a longer blurb
     is cut off on a phone. Hardware specifics belong on the reference pages
     instead. See `.claude/skills/adding-a-target-system/SKILL.md` § Picker
     identity.

   Import is the mirror of export and is just as dialect-agnostic - the app's
   Import dialog drives it entirely from the interface. Two optional fields turn
   it on: `binaryImports` lists the file formats `detokenize()` can read back
   (e.g. `.P` / `.O` / `.TAP` / `.bbc`), and `audio.decodeSamples` recovers a
   program from recorded cassette audio (the inverse of `audio.buildSamples`).
   Both are optional: a dialect can ship export before import. See the
   `docs/reference/file-formats.md` overview and each machine's format page
   (`docs/reference/<dialect>/formats.md` § Cassette audio) for the per-machine
   codecs, plus the shared `src/dialects/sinclairTape.ts` decoder.

   **Charset/import feature-completeness.** New language layers should be
   built _total_ from the start, matching the bar every shipped dialect meets:
   - every machine byte 0x00–0xFF gets a text form `toMachine` maps back to
     the same byte - glyph, named escape, or a dialect-styled raw escape
     (Spectrum `{0xNN}`, C64 `{$xx}`) - never a lossy `?`/space fallback;
   - `detokenize` interprets tokens/markers only _outside_ strings, REM and
     DATA; inside them, bytes round-trip exactly;
   - loss the importer can detect (unmappable bytes, truncation, trailing
     machine code) is reported via the optional `detokenizeWithReport`, which
     the import UI prefers over bare `detokenize`;
   - heuristic statement lint that real hardware would store sets
     `fatal: false` on its `TokenizeError`s, and the dialect's `tokenize`
     gates its image on `hasFatalErrors(errors)` - not `errors.length` - so
     imported-but-odd programs still run;
   - `src/dialects/roundTrip.test.ts` must pass: every sample's image decodes
     to text that re-tokenizes byte-exactly. Add foreign-image fixtures
     (control codes, tokens-in-strings, top-bit bytes) with
     `roundTripHarness.ts` as the importer learns to preserve or report them.

2. **Register it** in `src/dialects/registry.ts`, and in the same change add a
   share verb for it to `SHARE_VERBS` in `src/player/routes.ts` — a real
   keyword of the machine's own BASIC, unique in the table. A test asserts the
   verb table stays in bijection with the registry, so registering without a
   verb fails `npm test`.
3. **Drop the ROM** into `public/roms/` with an attribution block in
   `public/roms/ATTRIBUTION.md`.
4. **Add tests**: tokenizer round-trip, image-builder pointer consistency,
   and a machine boot test like `zx81Machine.test.ts` (boot the ROM, inject a
   program, assert on display memory).

The app's runtime layers need no changes: the editor, status bar, AI panel,
transfer dialog and emulator pane all operate on the interface. The remaining
per-dialect touch points are small tables: `constructsByDialect` in
`src/editor/constructs.ts` (block autocomplete templates, read by your
`language.ts`), a lint wrapper in `src/editor/variableLint.ts`, and an
optional `vk-theme-<id>` block in `src/keyboard/VirtualKeyboard.css`.
Dialects whose display is not the classic 256×192 set
`displaySize` on the `Dialect` object; the emulator pane sizes its canvas
from it.

### Adding a virtual keyboard

The virtual keyboard is entirely data-driven. The `VirtualKeyboard` component
and `inputEngine` contain no machine-specific logic; all you do is produce a
`KeyboardLayout` object and wire it into your emulator's `setKey()`. Adding a
keyboard for a new machine never requires touching keyboard code.

That includes the **graphics palette**: a machine with block graphics offers
them as a grid of characters rather than as keycap legends, because there are
usually more of them than the keyboard can show at a readable size. Set
`graphicsPalette` on the layout and add an `editorModes` entry with
`palette: 'graphics'`; the cells insert text exactly as a key does, so nothing
downstream treats them differently. Keep the entries in a `graphics.ts` the
charset also reads, so the palette and the mapping cannot drift, and list the
dialect id in `e2e/paletteMachines.ts` so the palette specs cover it.

#### The standard template

Every keyboard uses one common, screen-optimised template - a uniform
**40-column grid, ten keys per row** (`gridColumns: 40`, each key `spanX: 4`)
with five bands:

- **Top strip** - mode tabs (`editorModes`) when the machine has extra typing
  layers, the machine's `functionKeys` when it does not, or both behind an icon
  toggle. The function keys are always one row, and they take their width from
  the same 40-column grid as the rows below, so a strip key is exactly a keycap:
  a board's worth fits across, and a machine with more scrolls the rest into
  reach rather than shrinking or wrapping them. On wide screens the strip
  relocates into the left gutter beside the centred keyboard.
- **Number row** - the ten digits.
- **QWERTY + home rows** - the letters; Enter is the home row's tenth key.
- **ZXCV row** - the remaining letters and punctuation, centred when short.
- **Common bottom row** - a centred space bar, a quote and backspace key on the
  right, and the shift / machine modifiers either side.

Reuse `src/keyboard/templateRows.ts` (`GRID_COLUMNS`, `KEY_SPAN`, the
`NUMBER_ROW_TOKENS`/`QWERTY_ROW_TOKENS`/… token orders, `centerRow`, and the
`bottomRow` factory) so your layout supplies only its legends and modifiers and
inherits the template's proportions. Prefer icons/abbreviations (`⇧ ⌫ ↵ "`) over
wide text; do **not** add arrow keycaps to the rows - the cursor keys belong in
CURSOR mode (below). Deviate from the template only where the machine genuinely
requires it
(see the BBC's SYM mode and the C64's SHIFT-layer symbols for examples of
trading authenticity for a clean, thumb-sized grid).

Three things are needed:

1. **`keyboardLayout.ts`** in your dialect folder - a `KeyboardLayout` value
   describing every key, its legends, its layers, and any modifier behaviour.
2. **`setKey(token, down)`** in your emulator - translate the opaque token
   strings emitted by your keys into your machine's physical matrix.
3. **`keyboardLayout`** field on your `Dialect` export - exposes the layout to
   the IDE.

#### Overriding editor behaviour

By default the editor action is derived from the label text + the layer's
`editorInsertStyle`. Override per-label with the `editor` field:

```ts
{ text: 'NEW LINE', editor: { action: 'newline' } }   // cursor / edit action
{ text: 'RUBOUT',  editor: { action: 'backspace' } }
{ text: '←',       editor: { action: 'left' } }
{ text: 'SCROLL',  editor: null }          // machine-only - no editor effect
{ text: 'PRINT',   editor: { insert: 'PRINT ' } }  // insert different text than shown
```

Available actions:
`'backspace' | 'delete' | 'newline' | 'left' | 'right' | 'up' | 'down'`.
Use `'delete'` only for a machine whose key deletes at the cursor rather than
behind it, and label that key as the machine labels it - the PMD 85's `DEL`
key, not a borrowed `⌫`.

#### Cursor keys

There is no room on the template for an arrow cluster, so a machine's cursor
keys are a `cursor` layer pinned by a `CURSOR` editor mode, overlaying
`↑ ← ↓ →` on keys the rows already have. Put the overlay where the machine
prints its arrows: on the Sinclairs that is the 5/6/7/8 keycaps, whose SHIFT
legends _are_ the cursor keys; a machine with an arrow cluster of its own has
nowhere printed to put them, so those go on W/A/S/D. A cursor legend carries
**both** halves of what it does:

```ts
{ text: '↑', editor: { action: 'up' }, emits: ['ArrowUp'] }
```

`KeyLabel.emits` replaces the key's own `emits` while that layer is the active
one, so the keycap types its own character normally and presses the machine's
real cursor key under CURSOR mode. Without it the key would press `KeyW` on the
matrix while showing an arrow.

Give the legend the tokens the machine's own arrow keys reach, including the
combination where a machine produces its cursor keys by holding shift - the
Spectrum's are `['CapsShift', 'Digit7']`, not an invented `ArrowUp`. Where the
keycap already prints that arrow as a shift legend, give that legend the
matching `editor: { action }` too, so the shifted chord moves the caret as well.
Offer only the keys the machine has: the PMD 85 has three and no down key, so
its S keycap carries no arrow, and the Altair has none at all and declares no
CURSOR mode. `src/keyboard/layoutGeometry.test.ts` enforces this - a new dialect
either wires its cursor keys up or is listed there as a machine that has none.

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
top strip as ordinary keys - they `emit` matrix tokens and have no editor
action:

```ts
functionKeys: [
  { id: 'F1', spanX: 4, emits: ['F1'], style: 'fn', labels: [{ text: 'f1', editor: null }] },
  // …
],
```

`spanX: 4` is a rule here rather than an example: the strip renders on the key
rows' grid, so any other width draws a function key wider or narrower than a
keycap. So is `editor: null` - without it a label falls back to inserting its
own text, and a key marked `f1` types `f1` into the program.

When a layout has **only** `functionKeys` the strip shows them; with **only**
`editorModes` it shows the mode tabs; with **both** it shows a leading icon
toggle that flips the strip between the two.

#### Sizing

The template keeps keys evenly proportioned and large enough to thumb-type:
keys hold a minimum touch size (`--vk-key-min`) and, above that, a consistent
width:height ratio (`--vk-aspect`). On wide screens the keyboard centres and its
key width is height-derived so keys never stretch. You don't size anything in
the layout - just keep to `spanX: 4` for ordinary keys, function keys included.

The top strip is one row whatever the machine, and it divides its width by the
key rows' own grid, so the count a machine happens to have never changes how
wide its keys are drawn: fewer than a board's worth are centred over the keys,
and more than that scroll. **Ten is the number to design for.** Nothing stops
you putting more on the strip - the PMD 85's thirteen do exactly that, because
nothing a host keyboard sends can reach them - but the eleventh key onwards
starts off-screen and has to be hunted for, so put the keys a program reaches
for first and leave the rest to the host keyboard where the machine allows it.
A strip carrying the mode-tab toggle as well gives up the toggle's share of the
width, so its keys come out slightly under a keycap.

#### 2. Wiring `setKey()` in the emulator

The input engine calls `setKey(token, down)` for every key press and release.
The token strings come directly from `KeyDef.emits` in your layout - they are
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
  in at PAGE - the same image used for `.bbc` import/export. Its output is
  regression-tested byte-for-byte against jsbeeb's ROM tokeniser
  (`tokenizer.test.ts`), which is how the keyword flags were pinned down.
