## Why

The comparison names the reader's own lines in two places — the statement
layout that must be restructured, and the loops that only pass time — and it
named them by their **editor line index** rather than by the BASIC line number
the program carries.

The two coincide only for a program written from line 1 in steps of one with
no blank lines. For every other program the guide sent the reader to the wrong
line of their own listing, and did so plausibly: a program numbered 10, 20, 30
has a line 3 and a line 30, so "line 3" looks like an answer rather than like a
mistake. Reported from the guide: `30 PRINT:PRINT`, the third line in the
editor, was named as line 3 — which points at `10 PRINT "A"`.

Nothing in the specs said which numbering to use, which is why the two
findings could pick the one a listing does not show. Both were already
described in the reader's terms — "what a reader searches their listing for" —
while carrying the number a listing never prints.

## What Changes

- The lines the comparison names are the program's **own line numbers**, as its
  listing prints them, wherever the comparison names a line of the reader's
  program: the statement-layout finding and the loops-that-only-pass-time
  finding today.
- The labels drop "Editor", in the guide and in the findings handed to the
  assistant, since the numbers are no longer editor indices.
- A line carrying no number of its own is not named. It cannot be looked up in
  a listing, and every machine here refuses a program containing one, so the
  comparison never narrows on such a program.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: one requirement added — *The program's lines are named as
  its listing numbers them* — governing every finding that names a line of the
  reader's program, so the next such finding cannot pick the other numbering.

## Non-goals

- **Changing which lines are found.** Only how they are named; the scans and
  the projected line counts are untouched.
- **The assistant's lint errors.** Tokenizer errors are reported against the
  editor's own lines because that is where the editor marks them, and a
  correction request carries no comparison findings to disagree with.
- **A line-number-to-editor-line mapping in the UI.** The listing is on screen
  beside the guide; naming the line the listing shows is the whole fix.

## Impact

Affected code:

- `src/app/programVocabulary.ts` — the multi-statement and empty-loop scans
  record the BASIC line number, and skip a line carrying none.
- `src/reference/compare.ts` — the field documentation on both sides of the
  wire.
- `src/reference/portDescription.ts` and
  `docs/.vitepress/theme/components/DialectCompare.vue` — the labels.
- Colocated tests, including a regression pinning the reported case.

No dependency, storage, share-format, tokenizer or emulator changes, and no
change to the `Dialect` / `MachineEmulator` seam.
