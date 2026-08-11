## Context

Two findings name lines of the reader's own program. Both read the program
through the same scan over its code lines, which carries an editor index and a
BASIC line number side by side, and both recorded the index.

The choice was made deliberately once, to match `TokenizeError.line` and the
`- editor line N:` list the assistant receives with a correction request — one
coordinate system, so nobody has to convert. The reasoning does not hold where
it was applied: the port hand-over carries no lint errors at all, and the guide
has no editor to point an index at. What both audiences do have is the listing,
and a listing is numbered by the program.

See `docs/contributing/architecture.md` for the vocabulary → comparison seam.

## Goals / Non-Goals

**Goals**

- Every line the comparison names can be found in the listing beside it.
- One rule, stated where the next finding that names a line will read it.

**Non-Goals**

- Changing which lines the scans find, or the projected line counts.
- Touching how tokenizer errors are reported, which are the editor's own.

## Decisions

### 1. The BASIC line number replaces the editor index, rather than joining it

Carrying both — "line 30 (editor line 3)" — was the alternative. It is
rejected: the second number answers a question nobody asked, and the reader is
looking at a listing, not at a line ruler. One number that is right beats two
that must be told apart.

### 2. An unnumbered line is not named at all

The scans skip a code line carrying no number of its own. Nothing can be said
about it that helps: it cannot be looked up in a listing, and there is no
honest way to name it in the same list as numbered lines without mixing two
coordinate systems in one sentence — the fault being fixed.

It is also unreachable. Every registered machine's tokenizer rejects a line
with no number, fatally, so such a program reads as unreadable and the
comparison declines to narrow on it. The guard is for the scan's own
coherence rather than for a case a user can produce.

This also keeps the empty-loop walk honest: skipping the whole line stops a
`FOR` on an unnumbered line from being paired with a `NEXT` further down and
reported under some other line's number.

### 3. The rule is stated once, for the guide, not per finding

The delta adds one requirement rather than amending each finding that happens
to name a line. Two findings name lines today; the rule is about how the
comparison talks to a reader about their own program, and a third finding
should inherit it rather than re-decide it.

## Risks / Trade-offs

- **The numbers in the guide change** for existing programs. That is the fix:
  the previous numbers were wrong for any program not numbered 1, 2, 3.
- **A reader who had learned to read them as editor lines** gets no migration
  note. The finding is read beside the listing, where the new number matches
  what is printed and the old one no longer does.

## Migration Plan

None. No stored data carries these numbers; they are computed per request.

## Open Questions

None.
