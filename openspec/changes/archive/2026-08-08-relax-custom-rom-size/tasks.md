## 1. Fit any image to the machine's ROM area

- [x] 1.1 Add `fitRomImage(bytes, expected)` to `src/app/romImage.ts`: return the
      buffer unchanged at the right length, pad a shorter one with `0xFF` (an
      unprogrammed EPROM, so a short image behaves as it would in hardware), and
      take the leading bytes of a longer one. Say in the doc comment why the fit
      lives here rather than in the machines — every machine's length guard stays.
- [x] 1.2 Add `src/app/romImage.test.ts` covering all three cases, including that
      the padding is `0xFF` and that the supplied bytes stay at the base of the
      area.
- [x] 1.3 `src/components/EmulatorPane.tsx`: fit a supplied image before handing
      it to `createEmulator`. Leave the bundled-ROM fetch's size check alone — a
      mismatch there is a failed fetch, not a user's choice.
- [x] 1.4 Assert the fit across the seam in `src/dialects/romImage.test.ts`: for
      every dialect declaring `romBytes`, a machine built on a fitted short image
      and on a fitted long one constructs and runs without throwing. This is what
      catches a machine whose constructor rejects what the fit produces.

## 2. Stop refusing, and stop discarding

- [x] 2.1 `src/storage/customRom.ts`: drop `loadCustomRom`'s `expectedBytes`
      parameter and the mismatch discard; have `saveCustomRom` verify its
      read-back against the length it wrote. Update the module and function doc
      comments that explain the old contract.
- [x] 2.2 `src/components/customRomUpload.ts`: `romUploadError` keeps only the
      "this machine loads its own ROM set" refusal. Size is no longer a reason.
- [x] 2.3 `src/app/machineAvailability.ts`: a machine with a supplied image is
      offerable whatever that image's size, since any image can now boot it.
      Update the doc comment that explains the old size test.
- [x] 2.4 Update `src/storage/customRom.test.ts`, `src/app/machineAvailability.test.ts`
      and `src/components/customRomUpload.test.ts` to the new behaviour — an
      odd-sized stored image is kept and its machine is offered.

## 3. Report the fit instead of stating a requirement

- [x] 3.1 `src/components/customRomUpload.ts`: `romInUseLabel` names the file's
      own size and, when it differs, that it was padded or trimmed to the
      machine's. Drop the "upload your own N-byte image" phrasing from the
      no-bundled-ROM case.
- [x] 3.2 `src/components/SettingsForm.tsx`: replace "The image must be exactly N
      bytes" with what the IDE does with an image of another size.
- [x] 3.3 `src/components/EmulatorPane.tsx`: drop the byte count from the
      "supply your own image" messages in `describeMachineError`, and from the
      comment in `src/dialects/altair8800/index.ts` that quotes it.
- [x] 3.4 Cover the new readout wording in `src/components/customRomUpload.test.ts`.

## 4. Documentation

- [x] 4.1 `docs/guide/getting-started.md`: replace the "must be **exactly** the
      size that machine's ROM is" bullet with the padding/trimming behaviour,
      keeping the two-bank note as a diagnostic rather than a rule.
- [x] 4.2 `public/roms/ATTRIBUTION.md`: correct both places that tell a rights
      holder a replacement "must be exactly the same size". The claim these
      sections make to rights holders — that the bundled copies can be removed
      without disabling the feature — must stay true.

## 5. Quality gates

- [x] 5.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 5.2 `npm run docs:build` (docs/ changes in group 4)
- [x] 5.3 `npm run e2e:chromium -- e2e/persistence`, after updating
      `e2e/persistence/custom-rom.spec.ts`: the wrong-sized file is now installed
      and reported as fitted rather than refused.
