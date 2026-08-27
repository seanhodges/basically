## Why

A running program can already save data to tape or disk, and six machines trap
it: the Spectrums at `SA-BYTES`, the BBCs and the Atom at their filing-system
vectors, the C64 at the KERNAL jump table, the TRS-80 at interpreter statement
level. Every one of them writes into the same virtual filesystem the IDE hands
each machine at construction.

What happens to that data afterwards is the problem. It is reachable only
through a modal — File ▸ Emulator files — as a hex dump, and the store is
emptied on every emulator start **and stop**. So the moment a user stops the
machine to look at what their program wrote, it is already gone. The one way to
keep a file is to notice it during the run, open the dialog while the program is
still going, and download it before pressing Stop.

That is backwards. The data a program produces is the point of running it: a
high-score table, a level the user designed in their own editor, a log of what a
loop computed. It should be visible where the rest of the program is visible,
and it should still be there when the program ends.

There is also a naming collision this change has to settle first. A memory block
may today be `kind: 'code'` or `kind: 'data'`, where "data" means *bytes at a
fixed address that are not code* — a sprite table, a character set. Introducing
files as a second kind of "data" would leave the word meaning two different
things in the same tab strip. So the kinds are re-cut before the feature lands
on top of them.

## What Changes

- The block kinds become **`code` / `memory` / `data`**, each naming where its
  bytes live:
  - `code` — machine code at a fixed address, edited as assembly. Unchanged.
  - `memory` — a block of memory at a fixed address. This is today's `data`
    kind, renamed.
  - `data` — a data/text file a program saved to tape or disk. **No address.**
- **BREAKING (internal format, invisible to users):** a `kind: 'data'` block in
  an existing autosave, project bundle or share link means a block of memory,
  and is read back as `kind: 'memory'`. Nothing a user has saved changes
  meaning, and no project needs re-saving. The stored format only ever holds
  `code` and `memory`, because a data block is never written to it.
- **Files a running program saves appear as editor tabs, live**, beside the
  BASIC tab and the memory blocks, as they are written.
- **A data block outlives the run that wrote it.** Stopping the emulator no
  longer destroys it, so a user can stop the machine and read what their program
  produced. It is purged when the program restarts, when the machine is reset,
  when the target machine changes, and whenever a different program becomes
  active.
- **A data block is shown, not edited.** Its bytes are displayed in the byte
  view — the address gutter reading as offsets, since there is no address —
  read-only.
- **A data block can be downloaded**, from the same tab menu that already offers
  a memory block's `.bin`: as raw bytes (`.bin`), or as text decoded through the
  machine's own character set (`.txt`), which is what a TRS-80 or BBC `PRINT#`
  file actually is.
- **The bytes shown are the file, not its wrapper.** Where a machine stores a
  file inside its own container — the Spectrums keep a whole two-block `.TAP`,
  a 17-byte header plus the data — the header is unwrapped away, so a user opens
  their high-score table on their own numbers rather than on tape framing.
- **Data blocks are not part of the document.** They are never autosaved, never
  written into a project bundle, never exported, and never carried by a share
  link. Running a program therefore leaves the document clean: no unsaved-changes
  warning, no autosave churn, no drift in what a share link would contain.
- The tab strip shows a **bounded number** of data blocks; beyond that they stay
  reachable through the existing Emulator files surface, so a program writing
  many files cannot take over the strip.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `persistence`: *Programs can save and load their own files* is modified. The
  files stay session-scoped and are still never persisted with the document, but
  the session no longer ends when the run does: they outlive the run that wrote
  them, are shown as editor tabs as they are written, can be downloaded
  individually as bytes or as text, and are purged on restart, reset, machine
  change or document replacement. It also gains the guarantee that a stored
  `'data'` block reopens as `'memory'`.
- `code-editor`: one requirement added — *Saved data files appear as tabs* —
  covering the tab's live arrival, its read-only byte view, the two downloads,
  and the bound on how many the strip shows. It sits beside *Disposable scratch
  buffers*, the existing requirement for a tab that is neither the program nor
  part of the document.
- `memory-blocks`: modified narrowly. The kind vocabulary becomes
  `code`/`memory`/`data`, and the requirements that speak of blocks at
  addresses — *Blocks are part of the document*, *Runs are gated on block
  validity*, *Blocks load with the program*, *Blocks are editable as bytes* —
  are stated to cover `code` and `memory` only. No behaviour of an addressed
  block changes; the last of those is reworded for the rename alone, since the
  block it calls a data block is now a memory block.

`hardware-transfer` is **not** affected, and it matters that it is not. Its
requirement that a user be warned when an export format cannot carry the
document's blocks would extend to files if files were document state; because
they are not, no export path has to reason about them.

## Non-goals

- **Feeding a data block back into a run.** Marking a file to be served to the
  next run, so a program's `LOAD` finds what a previous run saved, is a separate
  proposal. This change is one-directional: out of the machine, into the editor.
- **Editing a data block.** This follows from the non-goal above rather than
  being an independent decision. A data block is not persisted and does not
  reach the machine, so an edit to one would have nowhere to go — it would
  vanish on the next run having affected nothing. Editability belongs with the
  change that gives those bytes a destination, and the byte view is read-only
  until then.
- **The `wrap` direction of the container seam.** Only unwrapping is needed to
  show a file. Rebuilding a machine's container around edited bytes — which for
  the Spectrums means recomputing the header's length and parity — is the
  return trip's problem.
- **Whole-program `SAVE`.** Every machine that traps file I/O deliberately
  passes program saves through to real tape, so program `SAVE`/`LOAD` behaves as
  the hardware does. That boundary is unchanged here, and moving it is a much
  larger project.
- **Machines that do not trap file I/O.** Four machines accept a file store and
  silently drop it, and one captures tape bytes it never exposes. Wiring them up
  — and adding the registry conformance test that would have caught them — is
  worth doing and is not this change.
- **Promoting a data block into a memory block**, or the reverse. The kinds
  exist to keep a file and an address apart.
- **Structured views over a file's contents.** No table, sprite or record view.
  Bytes and characters, as the byte view already shows them.

## Impact

Affected code:

- `src/dialects/types.ts` — the kind union splits into `CodeBlock` /
  `MemoryBlock` / `DataBlock`; the persisted union takes the name `Block`, and
  `MemoryBlock` keeps its name for exactly the thing it now denotes. A new
  optional `Dialect` member declares how a machine's stored file unwraps to its
  payload; absent means the stored bytes are the payload, which is true of every
  machine but the Spectrums.
- `src/components/EmulatorPane.tsx` — the stop path stops emptying the
  filesystem. Every other clear point is unchanged.
- `src/app/store.ts` — a data tab joins the active-tab union, keyed by the
  file's name.
- New pure projection module turning the filesystem's entries into data blocks,
  memoized the way the listing-block projection already is.
- `src/components/EditorTabBar.tsx` — data tabs, their glyph, and the `.bin` /
  `.txt` entries in the tab menu beside the existing downloads.
- `src/components/Workspace.tsx` and `ByteEditor.tsx` — the byte view gains a
  read-only mode and an offset gutter, and accepts a data block as well as a
  block.
- `src/storage/projectFile.ts`, `src/storage/settings.ts`,
  `src/share/shareClient.ts` — the legacy `'data'` → `'memory'` mapping on read.
- `src/components/BlockSettingsDialog.tsx` — the kind choice covers `code` and
  `memory`; a data block has no settings, since it has no address and its name
  belongs to the program.
- `src/components/VfsInspectorDialog.tsx` — becomes the overflow surface for the
  tab strip rather than a second, divergent list of the same files.

Prior art to reuse rather than reinvent:

- The virtual filesystem itself, its synchronous store and its change
  notification — the feature is a view over what is already there, not a second
  copy of it.
- The listing-block projection, for how this codebase already memoizes a derived
  block list off other state.
- The byte view shipped by `edit-block-bytes`, including its character column
  through the machine's own charset, which is also what the `.txt` download
  decodes with.
- The Spectrum tape-file reader, for splitting a stored two-block image into its
  header and its data.
- The existing download helper, which every other download in the IDE goes
  through.

No dependency changes.
