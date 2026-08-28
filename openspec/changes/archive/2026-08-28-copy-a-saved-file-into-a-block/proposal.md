## Why

A program that computes something worth keeping - a lookup table, a level map, a
character set - can write it to tape or disk, and the IDE shows the file as a
tab. Then the next Run throws it away. The file is program output, deliberately
outside the document; the only way to pin what it holds into the program is to
download a `.bin`, create a block, and load the file back into it. Three steps
and a trip through the filesystem, for bytes the IDE already has in hand.

The gap runs the other way too, in a smaller way: every new block starts life as
machine code. A user who wants a table of bytes creates an assembly block with a
`RET` in it and then changes its kind in the settings dialog, because the menu
offers no other way in.

## What Changes

- A saved data file's tab menu gains **Copy to a binary block**: it makes a
  document block holding a copy of that file's bytes, at the machine's suggested
  address and named after the file, shows the new block's tab, and opens the
  block settings dialog on it so the name, load address, entry and comment can
  be set straight away.
- The file is **unaffected** - still readable by the running program, still
  discarded when a run discards it. The block is a copy, and from then on it is
  an ordinary block: autosaved, saved, shared, checked before a run, loaded into
  memory with the program.
- The **+ menu's single "New machine code block" splits into "New assembly
  block" and "New binary block"**, so a block of bytes can be made directly
  instead of made as code and converted.
- **A block the IDE puts on the machine's tape stops appearing as a data tab.**
  Running a Spectrum program mounts each of the document's blocks as a loadable
  CODE file, so a program's own `LOAD "name" CODE` finds it - and, until now,
  every one of them came back as a tab claiming the program had saved it. The
  same went for tape files carried in from an import. Copying a file into a
  block makes this impossible to miss (the block is named after a file, so the
  next run shows two tabs of that name), but the fault is older than this
  change and is fixed here rather than left next to it.
- The block settings dialog **renames the two kinds it offers** to **Assembly**
  (machine code) and **Binary** (a block of memory), matching those menu items.
  Wording only: what is stored, and everything that reads it, is unchanged.

## Non-goals

- **No conversion the other way.** A block cannot become a data file. A data
  file is session-only, so a block turned into one would be destroyed by the
  next Run - the change would silently lose work.
- **No settings dialog for data files**, and no Data entry in a block's kind
  select. A file has no address, no name of the document's choosing, and nothing
  an edit could change; the one action it needs is the copy.
- **Data files stay out of the document**: not autosaved, not written into a
  saved project, not carried by a share link or an export, and still discarded
  when a run, a reset, a machine change or a different program discards them.
- **No change to how files are captured or unwrapped**, and none to the byte
  editor, the assembler, or any dialect.
- **The rewording stops at the settings dialog and the + menu.** The tab
  tooltip, the delete dialog and the documentation keep saying "machine code";
  bringing the rest of the product's wording into line is a separate pass.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-editor`: the same requirement also gains the rule that only what the
  program wrote is shown, so the files the IDE mounts for it to load are not
  reflected back as tabs.
- `memory-blocks`: two added requirements - a saved data file can be copied into
  a block of memory, and a new block can be created as either kind rather than
  only as machine code.
- `code-editor`: "Saved data files appear as tabs" gains the copy action in the
  menu that tab offers.

`persistence` is deliberately untouched: captured files remain non-document
state, and the copy that becomes a block is a block.

## Impact

- `src/app/store.ts` - a new `addBlockFromDataFile` action, and `addBlock` takes
  the kind to create.
- `src/dialects/types.ts` - a file store entry says whether the program wrote
  it; `src/storage/vfs/vfsStore.ts` carries that through;
  `src/app/dataBlocks.ts` projects only what the program wrote;
  `src/dialects/zxspectrum/emulator/tapeDeck.ts` marks what it mounts.
- `src/app/blockEdit.ts` - deriving a legal block name from a program's file
  name.
- `src/components/EditorTabBar.tsx` - the data tab's copy item and the split +
  menu; `src/components/BlockSettingsDialog.tsx` - the renamed kind labels.
- Tests: `src/app/blockEdit.test.ts`, `src/app/store.test.ts`, and the existing
  e2e journeys in `e2e/persistence/saved-data-tabs.spec.ts` and
  `e2e/memory-blocks/`, plus `e2e/helpers.ts` for the renamed menu item.
- No new dependencies, and no change to the Dialect / MachineEmulator seam.
