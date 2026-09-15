## Context

Two motions, one observation: the readings both need are already performed, and
both are thrown away at the last moment.

Jump references are scanned by one positional walk that skips strings, comments
and binary directives, anchors its keyword match per position, and follows the
comma continuation of a list of targets. Renumbering drives that walk to rewrite
the text and keeps no offsets; jump-to-definition drives the same ground as a
point query, computes the digit span under the cursor, and returns only the
number it found. The walk's own documentation says why they share it: so that
"what counts as a reference" is answered in one place rather than by two things
agreeing on inspection.

Variable uses are likewise already found on the machine's terms — case folded or
not, truncated to what the ROM keeps or not, scalars kept apart from arrays,
procedure-local names kept out of a global's uses — and handed back as document
ranges for reporting. Nothing changes them.

See `docs/contributing/architecture.md` for how `src/lsp/` splits protocol
wiring from the answers, and how both sit on the editor helpers the browser IDE
shares.

## Dialect / MachineEmulator seam

**No impact.** Neither motion starts a machine or reads a ROM. What varies by
machine — which spellings are one variable, which words are keywords, whether
case is significant, how much of a name is kept — is read from the bound
dialect's declared keywords and naming rules, which is where the rest of the
server's answers already come from.

## Goals / Non-Goals

**Goals.** Make the jump scan answerable by position without duplicating what
counts as a jump. Let a variable be renamed on exactly the terms its uses are
already reported on. Refuse a rename the machine would not survive, saying why in
the machine's own words.

**Non-Goals.** Renumbering, renaming line numbers or procedures, serving a call
hierarchy, or widening the set of jump forms. Each is named in the proposal.

## Decisions

### One walk, asked three ways

The scan becomes a visitor over a program's jump references, yielding for each
the keyword that introduced it, the span of the digits, and the line named. The
two existing callers are rebuilt on it: rewriting for renumbering consumes the
spans it already computed and discarded, and the point query becomes a search for
the span containing a position.

This is the ordering the change depends on. Adding a third scan beside the other
two would put "what counts as a jump" in three places, and the third would be the
one that disagrees — the tree already carries a second, narrower set of jump
patterns used for the program outline, which recognises fewer forms than the
renumberer does. That second set is collapsed onto the visitor here, so the
answer is single.

The rebuild is behaviour-preserving and the existing tests for renumbering and
for jump-to-definition are what say so. No spec delta covers it.

### What reaches a line is answered as uses, not as a hierarchy

The protocol has two ways to say "what reaches this": reporting the places as
uses of the thing under the cursor, or serving a hierarchy the editor walks.

Uses first, because the question being fixed is an asymmetry rather than a
missing feature: the same position already answers "where is this defined", and
"what else names this" declining is the defect. Answering it as uses puts the two
directions on the same footing at the same character, and needs no new capability
negotiated with the editor. A hierarchy is a different shape of answer — it is
walked, it has direction, it has to say what a caller of a caller is — and it
deserves deciding on its own once the index exists.

### A rename is proposed, read back, and refused in the machine's own words

A rename is built from the variable's uses, applied to a copy of the program, and
the copy is read for problems exactly as the program itself is read. If the
reading finds a problem the original did not have, the rename is declined and the
machine's own message is the reason given.

This is chosen over writing fresh checks for each hazard. The machine-specific
readings already exist and are already the ones the user is shown while typing:
that a name collapses onto another name the ROM cannot tell apart, and that a
name has a reserved word inside it. Writing second versions of those checks for
rename would mean a rename could be allowed that the program then reports as a
problem, or refused for something the program is happy with. Reading the result
back cannot drift from what the user is told, because it *is* what the user is
told.

Two hazards are not covered by that reading and are checked directly:

- **A new name the machine reads as a keyword.** This produces no problem report
  at all — the name simply stops being a variable, and the machine runs the line
  wrongly without erroring. It has to be tested against the bound machine's
  keywords before the rename is offered, including on machines that match a
  keyword anywhere in a run of characters rather than only at a word boundary,
  and on machines that tell a keyword's case apart from a name's.
- **A name a procedure declares local.** Renaming a program-wide variable to a
  name some procedure keeps private would leave two variables where the user
  meant one, and nothing about the result is ill-formed enough to report.

### Names the machine cannot tell apart are renamed together

Where a machine keeps only the first characters of a name, the uses reported for
a variable already include the other spellings the ROM stores as the same
variable. A rename changes all of them, because they are one variable and leaving
some behind would produce a program where the same storage is written under two
names.

The user is told this is what happened rather than left to notice. The listing is
being brought into line with what the machine was always doing, and that is worth
saying once, at the moment it is done.

### The type marker travels with the name

A name's trailing type marker is part of what the machines store and part of what
separates one variable from another — a name and the same name with a marker are
never the same variable, however much of the name the ROM keeps. A rename
preserves the marker each use carries rather than writing a bare new name over
it, because dropping it moves the variable to a different table and changes what
the program does.

### A use the machine reads as part of a longer run is not renamed

On the machines that ignore spaces, a name written next to a keyword is stored as
the name and the keyword both, and a use found in that position covers only the
part of the run the machine reads as the name. Writing a longer name over that
part would glue it to what follows and change where the machine splits the run.

Such a rename is declined rather than attempted. The alternative — rewriting the
whole run with a separator inserted — changes characters the user did not ask to
change and would have to be right about what the rest of the run means.

## Risks

- **The rebuilt scan is the risk in this change.** Renumbering rewrites a user's
  program, and a regression there is worse than either motion being absent. The
  rebuild lands as its own step, under the existing tests, before either new
  answer is served.
- **A rename that reads the whole program back is not free**, and it happens once
  per rename rather than per keystroke. Reading a program for problems is what
  the server already does on every edit, so the cost is a known one.
