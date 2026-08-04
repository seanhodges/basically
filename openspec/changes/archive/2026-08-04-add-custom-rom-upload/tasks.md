## 1. Declare which machines run the image they are given

- [x] 1.1 Add `romBytes?: number` to `Dialect` in `src/dialects/types.ts`, after
      `romUrl`. The doc comment must say why it is **not** implied by `romUrl` —
      six registered dialects declare a URL and ignore `opts.rom` — or a later
      editor will collapse the two.
- [x] 1.2 Export the `ROM_BYTES` constant already defined in
      `src/dialects/zxspectrum128/emulator/memory128.ts`.
- [x] 1.3 Declare `romBytes` in `src/dialects/{zx80,zx81,zxspectrum,zxspectrum128}/index.ts`
      from each machine's own `ROM_BYTES`, and in
      `src/dialects/{cpc464,cpc6128}/index.ts` from `CPC_ROM_SIZE`. Import the
      constants; do not retype the numbers.
- [x] 1.4 Add a wrong-length guard to `CpcMemory` in `src/emulator/cpc/memory.ts`,
      matching the Sinclair machines'. It is the only machine in scope that
      currently accepts a short image and leaves half its ROM zeroed. Update the
      `cpcMachine.ts` comment that promises an absent image constructs cleanly.
      — the guard admits a *zero-length* image as well as the full 32K, which keeps
      that documented "no firmware to run" state true (several CPC suites fall back
      to it when the un-redistributable image is absent), so the comment needed no
      change. The hazard it was written for - a short but non-empty image loading in
      part - is refused.
- [x] 1.5 Add the wrong-length case to `src/emulator/cpc/memory.test.ts`.

## 2. Pin the declaration to reality

- [x] 2.1 Add `src/dialects/romImage.test.ts`: for every dialect declaring
      `romBytes`, assert it equals the byte length of the committed file at its
      `romUrl`. Skip with a message when the file is absent — a checkout with a
      ROM removed must stay green, since that is now a supported state.
- [x] 2.2 In the same file, assert every registered dialect declaring `romBytes`
      also declares `romUrl`, with a message saying to relax this the day a
      registered machine ships without its image.
- [x] 2.3 In the same file, assert the *behaviour* in both directions: for each
      dialect **with** `romBytes`, a machine built on a zero-filled image of that
      size must reach a different screen from one built on the real image; for
      each dialect **without** it, the two must be identical. Write the failure
      message on the second so it names the fix — declare `romBytes` — because
      that assertion is what catches someone wiring `opts.rom` into a machine
      that currently ignores it.
- [x] 2.4 Extend `src/dialects/registry.test.ts` with the expected set of dialect
      ids declaring `romBytes`, in the idiom of its existing `expectedNotation`
      table, so a new machine has to state which kind it is.

## 3. Store the image

- [x] 3.1 Add `src/storage/customRom.ts`: one `mbide.customRom.<dialectId>` entry
      per machine holding name, size, install time and base64 bytes, using the
      existing base64 helpers so the tests need no DOM.
- [x] 3.2 `saveCustomRom` must not swallow failures: attempt the write, **read the
      key back and compare the decoded length**, and return a reason on failure.
      This is the one place in `src/storage/` that deliberately does not follow the
      best-effort convention — say so in the module comment.
- [x] 3.3 `loadCustomRom` takes the expected size and drops a stored image that no
      longer matches it, so a future change to a machine's ROM size cannot feed an
      incompatible image to a constructor that would throw.
- [x] 3.4 Keep the readers defensive (corrupt JSON or base64 reads as "no image"),
      matching the rest of `src/storage/`.
- [x] 3.5 Add `src/storage/customRom.test.ts`: round-trip; stale-size entry
      dropped; corrupt JSON and corrupt base64 both read as absent; a `setItem`
      that throws returns a quota failure; a `setItem` that silently drops the
      value is caught by the read-back.
- [x] 3.6 Have `src/storage/safeStorage.ts` report whether it substituted its
      in-memory stand-in, so the UI can warn that an image will not outlast the
      session. This is the only silent-loss path the read-back cannot see.

## 4. Run on the supplied image

- [x] 4.1 In `ensureMachine` (`src/components/EmulatorPane.tsx`), prefer an
      installed image when the dialect declares `romBytes`, falling back to the
      bundled fetch. Read storage directly, not through a store selector — that is
      what makes the player inherit the override with no extra hydration, and what
      keeps the URL-keyed fetch cache free of custom bytes.
- [x] 4.2 Fix the fetch cache to evict a rejected fetch instead of memoizing it for
      the life of the page. Without this, one offline failure leaves "restore
      bundled ROM" permanently broken.
- [x] 4.3 Replace the bare fetch failure with a message naming the required size
      and pointing at Settings, and add a distinct note when a run fails while a
      supplied image is in force.

## 5. Rebuild when the image changes

- [x] 5.1 Add installed-image metadata (not bytes) and a change counter to
      `src/app/store.ts`, with actions that persist first and report a storage
      failure to the caller without touching state.
- [x] 5.2 Subscribe the counter in `EmulatorPane` and add it to the existing
      dialect-switch teardown effect, which already does exactly the right work.
      Update that effect's comment to name both triggers.

## 6. The setting

- [x] 6.1 Add `src/components/customRomUpload.ts` with the pure validation and
      message-building, and `customRomUpload.test.ts` beside it — the repo has no
      component-render tests, so this is how the wording stays under test.
- [x] 6.2 Add a **Machine ROM** group to the Emulator tab of
      `src/components/SettingsForm.tsx`, scoped to the active machine: the image in
      force, an upload control, and a restore control disabled when the bundled
      image is already in use. Reuse the existing binary-file picker helper.
- [x] 6.3 For a machine without `romBytes`, show that it loads its own ROM set and
      offer no control.
- [x] 6.4 Add the error style beside the existing saved-confirmation style in
      `SettingsForm.module.css`.

## 7. e2e

- [x] 7.1 Add `e2e/persistence/custom-rom.spec.ts` using the existing
      fallback-file-picker helper and a file-chooser event, as the cassette-import
      spec does. On the ZX81: bundled readout → a wrong-sized file refused naming
      both sizes → a zero-filled image of the right size installs, and the canvas
      stays unpainted (a zero-filled Z80 ROM is all NOPs and never sets the display
      up — this is the assertion that proves the supplied bytes reach the CPU) →
      reload and the image is still in force → restore, and the canvas paints again.
      — the zero-image assertion landed stronger than planned: the machine's own boot
      check fails on it, so the run stops with the message naming the installed image
      rather than running to a blank screen. The spec asserts that instead, which also
      covers the program-execution delta's "a run fails while a supplied ROM is in
      force" scenario. Restore-then-run still asserts the canvas paints.
- [x] 7.2 In the same spec, switch to a machine that loads its own ROM set and
      assert the explanatory note with no upload control. This is the assertion
      that would fail if the declared ROM URL were ever used as the predicate.

## 8. Docs and attribution

- [x] 8.1 Extend the offline bullet in `docs/guide/getting-started.md` (it also has
      a typo, "whuch") and add a short section on supplying your own image:
      where the control is, that the size must match exactly, that it stays in the
      browser, and that restoring the bundled image is the way back. Describe the
      eligible machines behaviourally rather than listing them. **Do not touch the
      docs sidebar.**
- [x] 8.2 Correct `public/roms/ATTRIBUTION.md`. After this change the runtime-image
      claim is true in the Sinclair and Amstrad sections and stays. It is false in
      the Commodore 64, PET and VIC-20 sections — those machines load their own ROM
      sets — so replace those three trailing clauses with the plain
      removal-request wording the Acorn section already uses.

## 9. Quality gates

- [x] 9.1 `npm run typecheck`
- [x] 9.2 `npm test`
- [x] 9.3 `npm run lint`
- [x] 9.4 `npm run format:check`
- [x] 9.5 `npm run docs:build` (docs changed)
- [x] 9.6 `npm run e2e:chromium -- e2e/persistence`
- [x] 9.7 `npm run e2e:chromium -- e2e/program-execution` (the ROM-absent message
      path touches the run failure text)
- [x] 9.8 `npx openspec validate --specs`
