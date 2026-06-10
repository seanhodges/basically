# Adding a new BASIC dialect

The app only talks to the `Dialect` interface (`src/dialects/types.ts`);
everything machine-specific lives in one folder. To add, say, ZX Spectrum
BASIC:

1. **Create `src/dialects/spectrum/`** mirroring `src/dialects/zx81/`:
   - `keywords.ts` — the token table (`KeywordInfo[]`). This alone powers
     highlighting and autocomplete via the generic builders in `src/editor/`.
   - `charset.ts` — a `CharsetMapping` between editor text and machine codes.
   - `tokenizer.ts` / `detokenizer.ts` — text ↔ tokenized program bytes.
   - an image builder (the Spectrum equivalent of `pfile.ts` is a `.tap`/
     `.sna` builder).
   - `emulator/` — a `MachineEmulator` implementation. The Z80 core in
     `src/emulator/z80/` is machine-independent; provide your own bus
     (memory map, ULA ports, contention model as needed).
   - `aiProfile.ts` — a system prompt teaching Claude the dialect's rules.
   - `targets.ts` — `BuildTarget[]` for file exports, plus optional cassette
     audio support.
   - `index.ts` — assemble and export the `Dialect` object.
2. **Register it** in `src/dialects/registry.ts`.
3. **Drop the ROM** into `public/roms/` with an attribution note.
4. **Add tests**: tokenizer round-trip, image-builder pointer consistency,
   and a machine boot test like `zx81Machine.test.ts` (boot the ROM, inject a
   program, assert on display memory).

Nothing outside the dialect folder should need to change: the editor, lint,
status bar, AI panel, transfer dialog and emulator pane all operate on the
interface.
