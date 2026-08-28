## Context

Two collections sit side by side in the editor's tab strip, and the code that
draws them is the only place they meet.

A document's blocks are app state: named, at a fixed address, autosaved, saved,
shared, exported, checked before a run and written into machine memory. A saved
data file is not state at all - it is a projection over the machine's file store,
recomputed from the store's own listing and memoized on a snapshot of it, so the
bytes live in exactly one place and the tab is a view onto them. That projection
is deliberately one-way and read-only: a file is program output, the machine
owns it, and the next run clears it.

Nothing crosses. The bytes a program computed and saved cannot become part of the
program without a round trip through the user's downloads folder.

Both surfaces are app-layer. See `docs/contributing/architecture.md` for how the
store, the tab strip and the block editors fit together.

**Dialect / MachineEmulator seam: not touched.** Nothing here is asked of a
dialect that it does not already answer - `memoryBlocks.defaultAddress` for the
suggested address, `unwrapStoredFile` for the bytes (already applied by the
projection), the charset for the byte view. No dialect file changes, and no new
member on either interface.

## Goals / Non-Goals

**Goals:**

- One action turns a saved file into an ordinary block, with the bytes the user
  was shown and no trip through the filesystem.
- The block arrives with its settings open, because the address it starts at is a
  suggestion rather than a decision.
- A block of bytes can be created directly, rather than created as code and
  converted.
- The two kinds are named the same way wherever the user chooses between them.

**Non-Goals:**

- A block becoming a data file (see the proposal's non-goals: a data file is
  session-scoped, so the conversion would destroy the block at the next run).
- Any settings dialog for a data file itself.
- Changing how files are captured, unwrapped, projected or discarded.
- Reworking the product's wider "machine code" wording; this change renames only
  where the user picks a kind.

## Decisions

### The copy is a store action, not component code

`addBlockFromDataFile(name)` sits beside `addBlock` in the store and resolves the
file through the same projection the tab strip renders. The alternative - having
the tab bar pass the bytes it already holds - would work, but it makes the
component the authority on what a file's bytes are, and there are two candidate
answers (the raw stored image, and the payload with the machine's container
stripped). Resolving inside the action means the block is built from the bytes
the user was looking at, by construction, and keeps the component to dispatching
an intent, which is the convention the rest of the store follows.

The action makes the block, selects its tab and opens its settings in a single
update, so the tab and the dialog arrive together rather than in two renders.

### Copy, not move

The file stays in the machine's file store. Moving it would delete something the
running program can still load - a program that saves a file and reads it back
later would break because the user looked at the file and decided to keep it.
The cost is that the bytes exist twice until the next run clears the file, which
is the right trade: one of the two copies is about to be discarded anyway.

### The new block starts at the machine's suggested address

Same default `addBlock` uses. It is not necessarily free - two blocks can start
at the same address, exactly as two `addBlock` calls can today - and the existing
block lint reports that before a run. Guessing a free address instead (packing
after the last block, say) would be a new placement heuristic that the lint
already has better information for, and it would still need reviewing by the
user. Opening the settings dialog on the new block is the answer to both: the
address is presented as the first thing to correct.

Cancelling that dialog leaves the block. The copy was made by the menu item, not
by the dialog; the dialog only adjusts it, and an unwanted copy is deleted the
way any block is.

### A program's file name is not a block name

Block names are an identifier alphabet (letter first, then letters, digits and
underscores, unique per document). A program's file name is whatever the
machine's character set allows - spaces, punctuation, graphics characters. A
pure helper derives one from the other next to the settings dialog's other pure
edit logic: strip what the alphabet does not allow, ensure a leading letter, fall
back to a fixed stem when nothing usable is left, then take the first free name
the way `addBlock` takes the first free `block<n>`.

The existing download-name helper is not reused: it targets filenames, whose
alphabet includes `.`, `_` and `-`, and it can return a name a block may not
have.

### `addBlock` takes the kind, defaulted

`addBlock(kind = 'code')` rather than a second action. The two paths differ only
in what seeds the block - an assembled return stub and its source, or a single
zero byte - and everything else (naming, listing-backed insertion, activation,
`dirty`) is shared. The default keeps every existing call site, including the
store's tests, unchanged.

A binary block starts at one zero byte rather than none: the byte editor then
has a row to open on and the block has a length the lint can judge, and the
editor's own overwrite-and-extend rules take it from there.

### Listing-backed dialects

On ZX80/ZX81 a block is a `#BIN` record inside the BASIC listing and its address
is where that line sits. Creating one as bytes works there - the record is
inserted as now and the kind recorded in the same per-listing-block metadata the
settings dialog writes when it switches a listing block's kind.

Copying a data file into a block does not apply: those dialects wire no file
store, so they never show a data tab. The action and the menu item are guarded on
a fixed-address block being possible at all, which is a guard against a case that
cannot arise rather than a behaviour anyone will meet.

## Risks / Trade-offs

- **A copy lands on top of another block** → the placement is reported by the
  existing pre-run block lint, and the settings dialog is already open on the new
  block with its address to hand. No run can proceed on a conflict.
- **The bytes exist twice** (file and block) until the next run clears the file →
  accepted, and short-lived by construction; the alternative breaks a program
  that reloads its own file.
- **A file name that yields no usable block name** (all graphics characters, say)
  → falls back to a fixed stem plus the first free suffix, so the copy always
  succeeds and the user renames in the dialog that just opened.
- **Renaming the kinds leaves the rest of the product saying "machine code"** →
  deliberate and scoped: the two places the user picks a kind now agree with each
  other, and the wider copy pass is separate work. The stored kind names are
  untouched, so nothing that reads or writes a document is affected.
- **The e2e journeys drive the + menu by its item name** → the shared helper and
  the two specs that use it move with the rename in the same change.
