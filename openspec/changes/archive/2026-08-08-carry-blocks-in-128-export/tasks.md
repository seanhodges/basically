## 1. Confirm the shared loader works for the 128

- [x] 1.1 Check whether the generated auto-loader source
      (`loaderSource` in `src/dialects/zxspectrum/loader.ts`: `CLEAR`, one
      `LOAD "" CODE` per block, a final `LOAD ""`) tokenizes to identical bytes
      under the 128's `tokenizeProgram` as under the 48K's. A throwaway
      assertion is enough; do not commit it.
- [x] 1.2 If the bytes differ, give `loaderTapBlocks` a tokenizer parameter
      defaulting to the 48K's, and pass the 128's from the 128 side. Do **not**
      write a second loader generator — two generators of the same BASIC drift.
      If the bytes match (the expected result), leave `loader.ts` untouched and
      note that in the commit message.

## 2. Carry blocks in the 128's tape layout

- [x] 2.1 In `src/dialects/zxspectrum128/targets.ts`, give the tape layout the
      block and loader arms the 48K's `exportTapBlockList` has
      (`src/dialects/zxspectrum/targets.ts`): with no blocks, today's single
      load-only program; with blocks, one `codeTapBlocks` CODE file per block in
      **address order**; with `loader`, `loaderTapBlocks` first, CODE files next,
      and the main program last with its auto-start header so the loader's final
      `LOAD ""` chains into it. Keep driving the program bytes from the **128's
      own** `tokenizeProgram`, as the module already does.
- [x] 2.2 Have both the `.TAP` and cassette `.wav` builders consume that one
      layout function, as the 48K's do, so the two formats cannot diverge.
      `buildTapImage` and `buildCassetteSamples` take the blocks and loader
      arguments through.
- [x] 2.3 Set `supportsBlocks: true` on the 128's `tap-file` and `wav` targets,
      and pass `blocks`/`loader` from their `build` options.
- [x] 2.4 Update the module's header comment: it currently explains only why the
      128 keeps its own copy of the tape glue. It should now also say that the
      block and loader layout deliberately mirrors the 48K's, and that
      `blockExportRoundTrip.test.ts` is what holds them in step.

## 3. Pin the round trip

- [x] 3.1 Add a `zxspectrum128` case to
      `src/dialects/blockExportRoundTrip.test.ts` beside the six already there,
      via `exportImportRoundTrip` from `exportRoundTripHarness.ts`. The 128's
      Kaleidoscope sample already bundles the 48K's `$8000` block, so cover both
      loader-off and loader-on exactly as the 48K case does: BASIC re-tokenizes
      byte-exact, the block returns with its name, address and bytes intact, and
      the loader-off tape auto-starts nothing.
- [x] 3.2 Assert the 128's loader-on tape is the **same shape** as the 48K's for
      the same document — same file count and same order — since both machines
      are writing the same format. This is the assertion that catches the two
      layouts drifting.
- [x] 3.3 Fix that file's header comment, which still says "ZX Spectrum today;
      others join here as their Stage-6 export ships". Five other dialects have
      since joined and the referenced plan no longer exists.
- [x] 3.4 Check whether `e2e/memory-blocks/` needs anything. It should not: the
      Transfer dialog's loader checkbox and block-drop notice are existing
      behaviour already covered, and this change only changes which machine
      triggers which branch. Record the conclusion rather than adding a spec —
      per CLAUDE.md, a per-machine matrix fact belongs in the registry-driven
      unit test, not in a browser spec.

## 4. Documentation

- [x] 4.1 `docs/reference/zxspectrum/formats.md` — the 128 currently appears only
      as "reuses this encoder byte-for-byte". Name it where the `.TAP` is
      described as carrying machine code, so a 128 user reading their own
      machine's page learns their tape carries blocks.
- [x] 4.2 `docs/reference/file-formats.md` — the "Machine code & data blocks"
      section lists which formats carry blocks in both directions. It says "ZX
      Spectrum `.TAP`", which now covers both machines; make sure that reads
      unambiguously rather than as the 48K alone.
- [x] 4.3 Check `docs/guide/machine-code.md` needs no change — it speaks of
      machines generically and should not need a 128 mention. Leave it alone if
      so; do not add machine lists to the guide.

## 5. Quality gates

- [x] 5.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 5.2 `npm run docs:build` (docs/ changed in group 4).
- [x] 5.3 `npm run e2e:chromium -- e2e/memory-blocks` and
      `npm run e2e:chromium -- e2e/hardware-transfer` — the two capabilities this
      touches. Only check this off when both runs pass; a failure leaves it
      unchecked with a note on what failed. (10/10 and 5/5 pass. The cassette
      `.wav` import spec failed once under a two-worker run and passed on rerun
      alone and in the folder — flaky decode timing, unrelated to this change.)
- [ ] 5.4 Manual, and the only check that can catch a wrong tape **order**: load
      a loader-on 128 export in an external emulator (Fuse), `LOAD ""`, and
      confirm the Kaleidoscope draws. The round-trip test cannot see this — a
      mis-ordered tape still imports back perfectly.
