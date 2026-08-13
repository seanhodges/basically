## 1. The screenshot module, before any UI

- [ ] 1.1 New module `src/app/screenshot.ts` holding the whole path: the
      whole-number enlargement rule, the filename, the compose step and the
      download. Keep the enlargement rule and the filename as **pure functions
      with no DOM**, exported separately from the compose step, so they are
      unit-testable (jsdom has no canvas).
- [ ] 1.2 Enlargement: `max(1, round(target / width))` against a target width of
      1024, exported as a named constant rather than a literal. Applied with
      `drawImage` on a detached canvas with `imageSmoothingEnabled = false` —
      the canvas counterpart of the pane's `image-rendering: pixelated`.
- [ ] 1.3 Pixels come from `captureScreen()` in `src/app/screenCapture.ts` — do
      not add a second registry and do not thread the canvas element out of the
      pane (see design.md). Decode its PNG data URL through an `Image` and
      `decode()` before drawing.
- [ ] 1.4 Filename: the program name as the existing exports derive it
      (`programNameFromFileName`, `'PROGRAM'` for an untitled document — see
      `src/components/TransferDialog.tsx`), lowercased, plus a timestamp so a
      second screenshot is a second file. Encode as `image/png` via
      `canvas.toBlob`, not `toDataURL`, and hand off to the existing
      `downloadBlob` in `src/storage/files.ts`.
- [ ] 1.5 The entry point **resolves to a result** — saved, or not-saved with a
      reason — rather than throwing: the toolbar's `guard()` is synchronous and
      would not catch a rejected promise. "The machine has not drawn a frame" is
      a reason, not an error.
- [ ] 1.6 SPDX header (`// SPDX-License-Identifier: GPL-3.0-or-later`) on every
      new file, as the rest of the tree carries.

## 2. Tests for the module

- [ ] 2.1 New colocated `src/app/screenshot.test.ts`.
- [ ] 2.2 Enlargement, driven off `src/dialects/registry.ts`: for **every
      registered dialect's** display size (and the default when a dialect
      declares none), assert the factor is a positive integer and pin the
      resulting image width. This is the `e2e/paletteMachines.ts` +
      `src/dialects/graphicsPalette.test.ts` pattern — the per-machine matrix
      lives in a unit test and is never looped in a browser. Do not hardcode a
      machine count.
- [ ] 2.3 Filename: an untitled document, a named one, a name needing
      truncation, and zero-padding of the timestamp fields.

## 3. The icon and the two surfaces

- [ ] 3.1 A camera icon in `src/components/icons.tsx`, matching the size and
      stroke of its siblings.
- [ ] 3.2 `src/components/Toolbar.tsx`: an `icon-btn` in the existing cluster
      (mute / memory map / AI / settings / docs), wrapped in `guard`, reporting
      a not-saved result through `setError`. Title and `aria-label` both set.
- [ ] 3.3 The same action in the `⋯` mobile overflow menu — icon-only buttons
      are hidden on mobile, so a toolbar button alone leaves phones without it.
- [ ] 3.4 `src/player/PlayerApp.tsx`: a button in the top bar's actions beside
      the hardware-export one, rendered on the same `phase === 'running'` terms,
      naming the file from the share record (falling back as the IDE does).
      Style it in the player's own module CSS alongside the export button.

## 4. Keyboard shortcut

- [ ] 4.1 `src/app/shortcuts.ts`: a `run.screenshot` entry in the `Run`
      category. Mod+Alt+S was free when this was written — re-check against the
      table, and rely on `src/app/shortcuts.test.ts`, which already fails on a
      duplicate chord.
- [ ] 4.2 Dispatch it in `src/app/useGlobalShortcuts.ts`, and show the hint on
      the toolbar button the way the neighbouring buttons do.

## 5. Browser proof

- [ ] 5.1 Extend the existing journey in
      `e2e/program-execution/emulator-boot.spec.ts` — it already boots a machine
      and waits for a painted frame — with a staged assertion: invoke the
      screenshot action, `page.waitForEvent('download')`, and assert the
      suggested filename ends `.png` and the payload starts with the PNG magic
      bytes. This pays its rent by proving the canvas decode/encode and a real
      download, which no unit test can. No new cold `page.goto('/')`, no
      per-machine loop, no `waitForTimeout`.
- [ ] 5.2 In the existing `e2e/sharing-player/player.spec.ts` journey, one
      assertion that the player's button is there. It is the same handler, so it
      does not need its own download round trip.
- [ ] 5.3 Do **not** add a per-machine e2e matrix. The only per-machine fact is
      the enlargement factor, and that is task 2.2.

## 6. Documentation

- [ ] 6.1 A row in the "Running and debugging" table of
      `docs/guide/keyboard-shortcuts.md` (hand-written, not generated).
- [ ] 6.2 A short note under "Running a program" in
      `docs/guide/testing-programs.md`: what the action saves, and that the file
      is the machine's own picture — the CRT effect changes the screen but not
      the saved image. Worth saying precisely because the two differ. End-user
      prose — no source paths, no internal symbols. **Do not touch the VitePress
      sidebar.**

## 7. Quality gates

- [ ] 7.1 `npm run typecheck`
- [ ] 7.2 `npm test`
- [ ] 7.3 `npm run lint`
- [ ] 7.4 `npm run format:check` (or `npm run format` to fix)
- [ ] 7.5 `npm run docs:build` — this change edits `docs/`
- [ ] 7.6 `npm run e2e:chromium -- e2e/program-execution`
- [ ] 7.7 `npm run e2e:chromium -- e2e/sharing-player`
- [ ] 7.8 Check off 7.6 and 7.7 only when those runs pass; a failing run leaves
      the task unchecked with a note on what failed.
