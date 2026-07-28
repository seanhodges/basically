## 1. Shared charset probe table

- [x] 1.1 Extract the per-dialect `{decode, isEscapeForm, rawPattern, machines}` probe duplicated in `scripts/gen-escape-scaffold.mts` and `docs/reference/data/escapes/escape-crosscheck.test.ts` into `src/dialects/charsetProbes.ts`
- [x] 1.2 Rewire both consumers onto `CHARSET_PROBES`, leaving their behaviour unchanged
- [x] 1.3 Add `src/dialects/charsetProbes.test.ts` asserting the table covers exactly the ids registered in `src/dialects/registry.ts`

## 2. Sinclair grey characters become unicode

- [x] 2.1 Confirm the Symbols-for-Legacy-Computing code points for the ZX81 grey half-cells and their inverses (`0x09`, `0x0A`, `0x88`, `0x89`, `0x8A`) against the Unicode character database — not from memory
- [x] 2.2 Identify the equivalent ZX80 codes from `src/dialects/zx80/charset.ts` and confirm their code points the same way
- [x] 2.3 Add them to `GRAPHIC_UNICODE` in `src/dialects/zx81/charset.ts` and `src/dialects/zx80/charset.ts`, keeping the existing backslash escapes accepted by `toMachine`
- [x] 2.4 Extend the colocated charset tests: each new character encodes to its code, each code renders as the new character, and the old escape spelling still encodes to the same code
- [x] 2.5 Update `docs/reference/data/escapes/zx81.ts` and `zx80.ts` for the changed canonical forms, and extend `docs/reference/data/escapes/escape-crosscheck.test.ts` to cover them

## 3. Semigraphics audit

- [x] 3.1 Add `src/dialects/semigraphicsAudit.ts`: classify every byte `0x00–0xFF` of every registered dialect from its own `CharsetMapping` (ascii / bmp glyph / astral glyph / named escape / raw escape / control)
- [x] 3.2 Add `SEMIGRAPHIC_RANGES` — the machines' real graphics byte ranges, each with a primary-source citation in a comment; record an open question rather than guessing where no source is to hand
- [x] 3.3 Add `typeableCodes(dialect)`: walk the layout's key layers via `resolveEditorAction` and the graphics palette, push each insert through `charset.toMachine()`, return the reachable byte set
- [x] 3.4 Add `src/dialects/semigraphicsAudit.test.ts`: every byte classified exactly once for every registered dialect; `typeableCodes()` non-empty for each in-scope dialect
- [x] 3.5 Add `scripts/gen-semigraphics-audit.mts` and the `gen:semigraphics` npm script, rewriting the region between the document's begin/end markers
- [x] 3.6 Write `docs/contributing/semigraphics-support.md` covering all 13 dialects, marking the seven in scope, with hand-written sections for the injectivity invariant, the Commodore twin drift, the line-height limitation and the out-of-scope families
- [x] 3.7 Add `docs/contributing/semigraphics-support.test.ts` regenerating the marked region and asserting it matches, and add the sidebar entry in `docs/.vitepress/config.ts`

## 4. Bundled character-graphics font

- [x] 4.1 Generate the required code point list from the audit, then verify a candidate CC0/OFL character-graphics font covers it; add a second `unicode-range`-gated face for any remainder rather than switching primary
- [x] 4.2 Subset the font to exactly that list, excluding ASCII, and commit `basically-graphics.woff2` plus its coverage manifest under `src/assets/fonts/`
- [x] 4.3 Write `src/assets/fonts/ATTRIBUTION.md` (name, author, upstream, licence, the exact subsetting command, and that only a subset is redistributed), mirroring `public/roms/ATTRIBUTION.md`
- [x] 4.4 Measure the subset's advance width against the primary mono and record the measurement in a comment beside the descriptors
- [x] 4.5 Add the `@font-face` to `src/styles.css` with the measured `size-adjust` and the three metric overrides, and define `--font-graphics`, `--mono` and `--font-mono` (both currently referenced but undefined)
- [x] 4.6 Point `src/components/CodeMirrorHost.tsx`, `src/components/AsmEditor.tsx`, `src/components/MemoryMapPanel.module.css` and `src/components/ProcedureListDialog.module.css` at `var(--mono)`
- [x] 4.7 Add the same face to `docs/.vitepress/theme/custom.css` and add the font to the docs precache glob in `docs/.vitepress/config.ts`
- [x] 4.8 Add `src/dialects/fontCoverage.test.ts`: every non-ASCII code point any registered dialect emits is in the manifest and inside the `unicode-range` declared in `src/styles.css`

## 5. Graphics palette

- [x] 5.1 Add `GraphicEntry`, `GraphicsPalette`, `EditorModeDef.palette` and `KeyboardLayout.graphicsPalette` to `src/keyboard/layoutSchema.ts`
- [x] 5.2 Render the palette grid in `src/keyboard/VirtualKeyboard.tsx` when the active editor mode selects it, emitting the ordinary `EditorKeyAction { insert }` so the input engine and routing are untouched
- [x] 5.3 Style it in `src/keyboard/VirtualKeyboard.css`: responsive column count, character drawn large and centred, key hint small in the top-left corner, scrollable within the keyboard's height
- [x] 5.4 Give each cell an accessible name covering the character and its key
- [x] 5.5 Add `src/dialects/zx81/graphics.ts` and `src/dialects/zx80/graphics.ts`, replacing `GRAPHIC_INSERT`, and switch both layouts' GRAPHICS mode to the palette
- [x] 5.6 Normalise `src/dialects/commodore64/graphics.ts` onto `GraphicEntry` and switch the C64, VIC-20 and PET layouts to the palette, removing their graphics key layers
- [x] 5.7 Delete `src/keyboard/sinclairGlyphs.ts` and the ZX80/ZX81 glyph registries — keeping `src/keyboard/GlyphSvg.tsx` and `KeyLabel.glyph`, which the game controller uses
- [x] 5.8 Update the affected `keyboardLayout.test.ts` files: the GRAPHICS mode selects the palette, the old graphics layers are gone, and every palette entry has a key label

## 6. ZX Spectrum 48K and 128

- [x] 6.1 Derive the Spectrum's graphics-mode key assignments from the real ROM — decoded out of `K-DECODE` in `public/roms/zxspectrum.rom` and written up in `design.md`; reproduce that derivation as a comment on `graphics.ts` rather than restating the table bare
- [x] 6.2 Add `src/dialects/zxspectrum/graphics.ts`: block graphics `0x80–0x8F` with their keys, and the user-defined graphics `0x90–0xA4` with theirs
- [x] 6.3 Derive `GRAPHIC_UNICODE` in `src/dialects/zxspectrum/charset.ts` from that table instead of duplicating it
- [x] 6.4 Wire the palette into `src/dialects/zxspectrum/keyboardLayout.ts` with sections for blocks and user-defined graphics
- [x] 6.5 Filter the user-defined graphics for the 128K, where the last two codes are keyword tokens, and assert that in `src/dialects/zxspectrum128/keyboardLayout.test.ts`
- [x] 6.6 Add `src/dialects/zxspectrum/graphics.test.ts`: the block table is a bijection onto `0x80–0x8F` and each user-defined graphic encodes into its code

## 7. Round-trip guarantee

- [x] 7.1 Add `src/dialects/semigraphicsRoundTrip.test.ts`, table-driven over the seven in-scope dialects
- [x] 7.2 Assert each palette entry's character encodes to a single byte equal to its code, with the Commodore visually-identical twins carried as a named, commented allowlist
- [x] 7.3 Assert each code renders back to exactly the character the palette inserts, so a detokenized program shows what was typed
- [x] 7.4 Assert every code in the dialect's declared graphics ranges is reached by exactly one palette entry
- [x] 7.5 Assert a program containing each character tokenizes and the byte is present in the built memory image
- [x] 7.6 Assert that program survives an export/import cycle through the dialect's hardware format with its source text intact
- [x] 7.7 Add `e2e/virtual-input/graphics-palette.spec.ts`: insert a block and a user-defined graphic on the Spectrum, insert from a two-section palette on the C64, check the column count drops on a narrow viewport, and check the bundled font is loaded and applied
- [x] 7.8 Re-run `npm run gen:semigraphics` so the computed font-coverage and typeable columns reflect the finished work

## 8. Follow-up fixes from using it

- [x] 8.1 Insert a palette character on the tap that lifts on it, not on the press, so panning the grid on a touch screen scrolls without typing every cell the finger started on
- [x] 8.2 Cover that in `e2e/virtual-input/graphics-palette.spec.ts`: a drag down the palette inserts nothing, and a tap in the same place still does
- [x] 8.3 Re-derive the ZX81's graphics key assignments from the ROM keyboard tables (E and R carried each other's shape) and pin the whole table in `src/dialects/zx81/graphics.test.ts`
- [x] 8.4 Give the ZX Spectrum's user-defined graphics a single-character form - the squared capitals 🄰-🅄 - in `src/dialects/zxspectrum/graphics.ts` and its charset, keeping `\a`-`\u` accepted on the way in
- [x] 8.5 Make the Spectrum tokenizer read a whole code point outside strings, and warn about the 128K's missing T/U graphics in whichever spelling the program used
- [x] 8.6 Update the colocated charset/tokenizer/detokenizer/foreign-round-trip tests for the new canonical form, keeping a case for the older escapes
- [x] 8.7 Add the squared capitals to the `unscii-16-full` subset (`basically-graphics-extra.woff2`), its manifest, both stylesheets' `unicode-range`, and `ATTRIBUTION.md`
- [x] 8.8 Mark the docs' UDG escape rows parse-only with the character as an alias, and re-run `npm run gen:semigraphics`
- [x] 8.9 Tag the machines' own characters in the editor so they draw like the program's literals instead of falling through to the dimmed default style

## 9. Quality gates

- [x] 9.1 `npm run typecheck`
- [x] 9.2 `npm test`
- [x] 9.3 `npm run lint`
- [x] 9.4 `npm run format:check`
- [x] 9.5 `npm run docs:build`
- [x] 9.6 `npm run e2e:chromium -- e2e/virtual-input`
- [x] 9.7 `npm run e2e:chromium -- e2e/code-editor`
