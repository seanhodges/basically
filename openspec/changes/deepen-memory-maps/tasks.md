## 1. Label and source audit

- [ ] 1.1 Check each of the twelve maps' labels against that machine's own
      documentation and correct any that drifted from its vocabulary. A label
      that is also a collapse `group` value must change in both places.
- [ ] 1.2 Add a `Sources:` list to every `memoryMap.ts` docblock, naming the works
      the layout and the names came from. Cite an in-repo constant, not a manual,
      for any boundary a constant already pins.
- [ ] 1.3 Check any corrected C64 label against the e2e spec that asserts a leaf
      label by title, and against the region-group names used in the memory
      management docs page.

## 2. Deepen the Sinclair maps

- [ ] 2.1 ZX81: split the system-variable block into the unsaved variables below
      `VERSN`, the saved block from `VERSN` up, the printer buffer and the
      calculator's memory area, and split the echo region into its ROM and RAM
      halves. All four boundaries come from `sysvars.ts`; the names come from the
      ZX81 manual's system-variables appendix.
- [ ] 2.2 ZX81: update the echo-region test, which currently reads the last region
      by index, to select the group and assert its extent and kind. Add a test
      pinning the four new boundaries to their `sysvars.ts` symbols.
- [ ] 2.3 ZX80: split the system-variable block into the interpreter's own
      variables, the program and display pointers, and the workspace above them -
      the last labelled as undocumented, because `zx80/sysvars.ts` names nothing
      above `DF_EA`. Split the echo region the same way as the ZX81's.
- [ ] 2.4 ZX80: update its echo-region test the same way, and pin the new
      boundaries to `sysvars.ts`.
- [ ] 2.5 Confirm neither machine gained a `screen` region and neither program
      region moved (`facts-crosscheck.test.ts` depends on both).

## 3. Deepen the CPC maps

- [ ] 3.1 CPC 464: split the firmware workspace into the restart block and the
      BASIC input area, and the high system area into BASIC's workspace, the high
      kernel jumpblock, the main firmware jumpblock and the machine stack. Cite
      the firmware manual for the names and for the boundaries no constant pins.
- [ ] 3.2 CPC 6128: mirror the 464's table exactly in `[start, end, kind]`,
      changing only labels and notes to BASIC 1.1 wording. Preserve the existing
      notes' "second" and "configuration" phrasing, which its test matches on.
- [ ] 3.3 Re-verify the pair-parity test passes, and that neither map gained a
      `rom` region.

## 4. Give the viewer its own capability

- [ ] 4.1 Move the three memory-map e2e specs from `e2e/memory-blocks/` to
      `e2e/memory-map/`, updating the `// Capability:` header comment in each.
- [ ] 4.2 Add an e2e spec that opens the map on the four newly-deep machines,
      zooms past the detail threshold and asserts a leaf label that exists only
      when zoomed in. No e2e opens the map on any of these four today.
- [ ] 4.3 Run `npx vitest run src/e2eCapabilityLayout.test.ts` to confirm the
      folder↔capability mirror still holds after the move.

## 5. Quality gates

- [ ] 5.1 `npx vitest run src/dialects/memoryMap.test.ts src/dialects/zx81
      src/dialects/zx80 src/dialects/cpc464 src/dialects/cpc6128` - the shared
      cross-dialect invariants plus each changed machine.
- [ ] 5.2 `npx vitest run docs/reference/data/facts-crosscheck.test.ts` - the
      porting facts are pinned to the screen and program region starts.
- [ ] 5.3 `npx vitest run src/components` - the band, scale and activity
      transforms over the new region lists.
- [ ] 5.4 `npm run typecheck && npm test && npm run lint && npm run format:check`.
- [ ] 5.5 `npm run e2e:chromium -- e2e/memory-map` and
      `npm run e2e:chromium -- e2e/memory-blocks` - the moved and new specs, and
      confirmation that nothing was left behind. Leave unchecked with a note if
      either run fails.
- [ ] 5.6 `npx openspec validate --specs` after archiving, to confirm the new
      capability lands cleanly in the baseline.
