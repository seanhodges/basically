## 1. The flag

- [ ] 1.1 Add `capturesDataFiles?: boolean` to `Dialect` in
      `src/dialects/types.ts`, documented as what the machine does with the
      `files` store `createEmulator` hands it — captures a running program's data
      files, by whatever mechanism — and cross-referencing the `files` option so
      the two read together.
- [ ] 1.2 Declare it on the seven dialects whose machines route the store:
      `zxspectrum`, `zxspectrum128`, `bbcmicro`, `bbcmaster`, `atom`,
      `commodore64`, `trs80`. Leave every other dialect's `index.ts` untouched.
- [ ] 1.3 `npm run typecheck` green; no behaviour change yet.

## 2. The boot harness carries a store

- [ ] 2.1 Add an optional `files` to `bootMachine`'s opts in
      `src/dialects/bootHarness.ts` and pass it to `createEmulator`. Additive —
      every existing caller keeps exercising the no-store branch unchanged.
- [ ] 2.2 `npm test` green, confirming the fourteen boot-harness test files are
      unaffected.

## 3. Probe programs

- [ ] 3.1 New `src/dialects/fileIoProbes.ts` in the shape of
      `src/dialects/operatorProbes.ts`: probes keyed by language family, each a
      BASIC program that writes a named file, reads it back, prints what it read
      and then a sentinel. File-level doc comment saying where the programs came
      from and why the round trip (not just the write) is the probe.
- [ ] 3.2 Five family entries covering the seven claimants, each lifted from the
      machine test that already runs it on the real ROM: Sinclair `SAVE … DATA`
      (`zxspectrum/emulator/spectrumMachine.test.ts`), BBC
      `OPENOUT`/`BPUT#`/`OPENIN`/`BGET#` (`emulator/bbc/bbcMachine.test.ts`),
      Atom `FOUT`/`BPUT`/`FIN`/`BGET` (`emulator/atom/atomMachine.test.ts`), CBM
      BASIC V2 on device 8 (`emulator/c64/c64Machine.test.ts`), TRS-80 Level II
      (`dialects/trs80/interpreter/seqfiles.test.ts`).
- [ ] 3.3 Each probe declares the file name and the payload bytes it expects to
      have been stored, so the test asserts against the probe's own statement
      rather than a literal repeated per machine.

## 4. The registry-driven battery

- [ ] 4.1 New `src/dialects/fileIo.test.ts`, `src/dialects/memoryActivity.test.ts`
      shape: file-level doc comment stating the obligation and why it is checked
      against the machine rather than another table, `installNodeRomLoading()` in
      `beforeAll`, one `it()` per registered dialect, `try/finally` disposing the
      machine, every `expect` carrying `${dialect.id}`.
- [ ] 4.2 A spy `MachineFileStore` for the test: records `save` calls, serves
      `load` from what it recorded, implements `list`/`delete` per the interface.
- [ ] 4.3 Claimant case: boot with the spy store, `dialect.tokenize` the probe
      (asserting it tokenizes cleanly first, per `operatorBattery.test.ts`),
      `loadProgram`, `runUntil` the screen shows the sentinel, then assert the
      store received the probe's expected bytes under its expected name **and**
      that the screen shows the program read them back. Screen text in the
      failure message.
- [ ] 4.4 `NO_DATA_FILE_TRAPS: Record<string, string>` for the non-claimants, each
      with its reason. The four accept-and-drop machines (`cpc464`, `cpc6128`,
      `pet`, `vic20`) name the drop itself, not a hardware excuse; `pmd85` names
      that it records the bytes and is never offered the store; `zx81` names the
      SAVE trap eliding the tape-output loop, distinct from `zx80` never being
      offered the store; `apple1` and `altair8800` their own.
- [ ] 4.5 The non-claimant case asserts the declaration and the reason only, with
      a comment explaining why it does not run the machine — the file statement
      is what the machine cannot service, and it hangs rather than errors.
- [ ] 4.6 Shape guard, per `debugCapability.test.ts`: every key of
      `NO_DATA_FILE_TRAPS` is a registered dialect, and the ids of every dialect
      without the flag sort-equal the table's keys.
- [ ] 4.7 Prove the battery bites before trusting it: temporarily set the flag on
      `pet` and confirm the claimant case fails; temporarily remove it from
      `commodore64` and confirm the shape guard fails. Revert both.
- [ ] 4.8 Give the file a per-case timeout from the house budget for boot-heavy
      registry loops rather than leaning on the 30s global default, and record the
      measured wall time in the file comment.

## 5. The empty state

- [ ] 5.1 In `src/components/VfsInspectorDialog.tsx`, read the active dialect's
      flag with a narrow selector (`useIdeStore((s) => s.dialect)`).
- [ ] 5.2 Where the machine does not capture files, replace the empty-state copy
      ("No files. Files appear here when the running program saves data.") with a
      statement that this machine does not capture the files a program saves.
      Where it does, the existing empty-state copy stands unchanged.
- [ ] 5.3 Colocated test: the dialog shows the incapable copy for a
      non-capturing dialect and the ordinary empty copy for a capturing one with
      no files.

## 6. Quality gates

- [ ] 6.1 `npx vitest run src/dialects/fileIo.test.ts` passes; note the wall time.
- [ ] 6.2 `npm run typecheck && npm test && npm run lint && npm run format:check`
      all green.
- [ ] 6.3 `npx openspec validate --specs` green.
- [ ] 6.4 `npm run e2e:chromium -- e2e/persistence` passes — the dialog's empty
      state is app-visible. Leave unchecked with a note on what failed if it does
      not pass.
