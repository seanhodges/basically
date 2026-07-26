## 1. Language delta — Locomotive BASIC 1.1 (plan Stage A)

- [x] 1.1 `src/dialects/cpc6128/keywords.ts` — replace the empty placeholder with `export const cpc6128Keywords = locoKeywords('basic11')`
- [x] 1.2 Bind the tokenizer to `'basic11'` — done inline from `index.ts` (the bbcmaster precedent), so no wrapper file was added
- [x] 1.3 Bind detokenization/import to `'basic11'`; `importCpcImage`, `buildCassetteSamples` and the build-target factory gained the same optional `variant` parameter the tokenizer already had
- [x] 1.4 `src/dialects/cpc6128/language.ts` — language support and completion source over `cpc6128Keywords`; the cpc464 charset is imported unchanged, so no re-export file was needed
- [x] 1.5 `src/editor/constructs.ts` — add the `cpc6128` entry reusing the CPC construct array
- [x] 1.6 Tests (`src/dialects/cpc6128/cpc6128.test.ts`): the eleven 1.1 keywords tokenize on cpc6128 and are rejected with a clear error on cpc464; shared BASIC 1.0 source produces byte-identical program bytes on both; round-trip through detokenize

## 2. Machine variant — 128K banking and the BASIC 1.1 ROM (plan Stage B)

- [x] 2.1 Add `public/roms/cpc/cpc6128.rom` (32K combined: OS 2.x lower CRC32 `0219bb74` + Locomotive BASIC 1.1 upper CRC32 `ca6af63d`), from the same upstream as the shipped `cpc464.rom`
- [x] 2.2 Extend the Amstrad CPC block in `public/roms/ATTRIBUTION.md` to cover the new image, with its CRCs and the existing licensing basis
- [x] 2.3 `src/emulator/cpc/memory.ts` — allocate the expansion 64K on the `'6128'` model and implement `setRamConfig` for the eight PAL configurations (16K windows, banks 0–7); config 0 keeps the existing direct RAM path; `'464'` stays inert
- [x] 2.4 Keep `readScreen` / `readWord` on the base 64K (the real 6128's video and the introspection readers never see the banked window)
- [x] 2.5 `src/dialects/cpc6128/index.ts` — `createEmulator` returns `new CpcMachine({ rom, model: '6128' })`; set `romUrl` to the new image
- [x] 2.6 Tests (`src/emulator/cpc/memory.test.ts`): each configuration maps the documented banks; a write through a banked window is invisible from config 0 and readable again on return; the 464 is unaffected
- [x] 2.7 Tests (`src/emulator/cpc/cpc6128Boot.test.ts`): the 6128 boots to the BASIC 1.1 banner, runs an injected program, and banks RAM end-to-end through a real `OUT &7F00,&C4` from the firmware's own interpreter

## 3. Wire-up and registration (plan Stage C)

- [x] 3.1 `src/dialects/cpc6128/keyboardLayout.ts` — re-export the cpc464 rows under `theme: 'vk-theme-cpc6128'`
- [x] 3.2 `src/keyboard/VirtualKeyboard.css` — grey 6128 cap styling for the new theme
- [x] 3.3 `src/dialects/cpc6128/samples.ts` — re-export the cpc464 samples
- [x] 3.4 `src/dialects/cpc6128/aiProfile.ts` — real Locomotive BASIC 1.1 profile (the 464 profile plus the eleven additions; tape I/O needs `|TAPE`)
- [x] 3.5 `src/dialects/cpc6128/index.ts` — assemble the full `Dialect`: no throwing stubs left, `docsReference: 'cpc'`, `addressNotation: 'hex'`, transfer/audio/joystick/debug parity with the 464
- [x] 3.6 Measure `PRINT FRE(0)` on the booted emulator and set `programRamBytes` from it (not the AMSDOS figure)
- [x] 3.7 Register `cpc6128` in `src/dialects/registry.ts` directly after `cpc464` **and** add `{ verb: 'fill', dialectId: 'cpc6128' }` to `SHARE_VERBS` in `src/player/routes.ts` in the same commit (bijection is test-enforced)
- [x] 3.8 `src/dialects/registry.test.ts` — add the `cpc6128` entry to `expectedNotation`
- [x] 3.9 `src/components/machineArtIds.ts` + `machineArt.tsx` — added a `cpc6128` portrait (the 464 case with the 3" disc drive in place of the cassette deck) so the picker does not fall back to the generic art; `machineArt.test.ts` updated
- [x] 3.10 Tests: samples tokenize under 1.1; keyboard layout validation; `controllerLayouts.test.ts` passes with cpc6128 now registered

## 4. Memory map, introspection, transfer and docs (plan Stage D)

- [x] 4.1 `src/dialects/cpc464/sysvars.ts` — filled in the `'basic11'` branch, every address measured against the running 6128 ROM. The offsets from 1.0 are **not uniform** (&1D for the pointer block, &1A for `errCode`, &22 for `errLine`, &19 for `curLinePtr`), and the same probes reproduce the 464's known addresses exactly. `LocoSysVars` gained `progEnd`, and `loadProgram` now takes its injection pointers from the model's table — a 6128 given the 464's addresses never sees the injected program
- [x] 4.2 `src/dialects/cpc6128/memoryMap.ts` — implement the map: 64K address space, BASIC 1.1 workspace labels, banked second 64K described in region notes
- [x] 4.3 Memory blocks — HIMEM reads the same `&AB7F` on both machines, so `cpc464MemoryBlocks` is reused directly and no per-dialect file was needed
- [x] 4.4 Wire `readVariables()` / `readReport()` / `readMemoryStats()` / `currentLine()` for the 6128 through the variant-keyed readers
- [x] 4.5 Transfer parity — reuse the cpc464 build targets and cassette audio, with 6128 `|TAPE`-aware load/save instructions
- [x] 4.6 Verify every 1.1-only keyword in `docs/reference/data/cpc.ts` carries its tag and the keyword crosscheck still passes; add the 6128 to `docs/reference/cpc/hardware.md`
- [x] 4.7 Update `docs/contributing/dialect-roadmap.md` (CPC 6128 row → shipped) and tick Stages A–D in `docs/contributing/dialect-plans/cpc6128.md`, recording the single-ROM deviation and the AMSDOS follow-up
- [x] 4.8 Tests: memory-map invariants, BASIC 1.1 sysvar reads, live-variable parity with the 464 on shared source

## 5. Quality gates

- [x] 5.1 `npm run typecheck`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run lint`
- [x] 5.4 `npm run format:check`
- [x] 5.5 `npm run docs:build` (docs changed)
- [x] 5.6 `npm run e2e` (app-visible change: a new registered machine) — chromium green after adding `cpc6128` to the guard list in `e2e/plan/section03-emulator.spec.ts`. Three chromium failures remain (`debug session survives an orientation change`, `the machine picker groups machines by manufacturer`, `never auto-shows the keyboard`); all three reproduce on the base commit and are untouched by this change. Firefox/WebKit/Edge cannot run here — only Chromium is installed in this environment.
