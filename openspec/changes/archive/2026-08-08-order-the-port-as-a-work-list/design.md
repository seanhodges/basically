## Context

The page's section order is decided in `DialectCompare.vue`, and mirrored by
`pageSections`, whose entries are built from the same conditions the template
guards each section with — so a section is listed in the "on this page" row
exactly when it is shown. Two spec requirements bear on order today: one for the
sections ("The comparison leads with what the port requires") and one for the
rows of the language and hardware table ("…ordered by what the port turns on").
Only the first is in scope.

`docs/contributing/architecture.md` covers the docs/app split; nothing here
crosses it.

## Goals / Non-Goals

**Goals**

- One stated order, expressed in classes of work rather than in section names, so
  a finding introduced later has a place without another ordering requirement.
- Reading the page top to bottom reads the port in the order it is done.

**Non-Goals**

- New findings, new data, or any change to the pure comparison.
- Re-ordering the fact rows.

## Decisions

### Impact on the Dialect seam: none

No `src/` change at all. The findings are already computed and already narrowed;
this decides where they read.

### The five classes, and what lands in each

```
  1  Blocks the program being read     characters the target cannot represent
                                       statement layout that must be split or re-separated
                                       line numbers the target will not accept
  2  Mechanical                        commands that only change spelling (renames)
  3  Rewrites                          commands with no equivalent, by capability
                                       control codes to replace, by class
                                       commands whose usage differs
                                       the addresses the program writes to
  4  Silent                            same word, different meaning
                                       variable names that collide on the target
                                       arithmetic the target truncates
  5  Fit                               whether the program fits the target's memory
```

Three placements are worth stating outright, because all three look wrong at
first:

- **Renames before rewrites**, though a rename is a smaller finding than a lost
  capability. The order is the order of *work*, not of severity: the renames are
  a search-and-replace that shortens the program the rewrites are done against,
  and doing them first means the rewrite step meets fewer unfamiliar spellings.
- **Fit last**, though it can be the finding that sinks the port. It is a
  property of the *result*: the size the program takes on the target is only
  final once the rewrites are done, and a reader who moves it to the top is
  reading a figure about a program that no longer exists. It is reported at the
  end of the work list for the same reason a build is checked after the edits.
- **The memory layout is a rewrite, not a picture in the frame.** It is drawn
  rather than listed, which is what made it look like scene-setting, but what it
  shows is where the program's own writes land on the target and which of the
  target's regions they have to be re-aimed at. That is work, and it is the work
  the capability advice for memory and hardware sends the reader to do — so it
  closes the rewrite class rather than opening the page. A reader with no program
  open still gets the two machines side by side; they simply get it where the
  addresses are being changed.

Class 4 sits after the rewrites because a silent difference is checked against
code that has stopped changing. Class 1 leads because none of the rest can be
tested until the program can be read at all.

### Findings not yet built still have a place

The order is stated by class, so a finding introduced by another change lands in
its class without this requirement being reopened. Where a change adds a finding
whose class is not obvious, that change says which class it belongs to — the same
way a keyword row declares its capability domain rather than the ordering being
maintained centrally.

Findings that do not exist for a pair, or are absent for want of a program, do
not leave a gap: sections are already conditioned individually, and
`pageSections` already lists only what is shown.

### What does not move

The language and hardware differences and the guidance prose come before the work
list, as they do now: they are the frame the work is read inside, and the
requirement that pair-independent guidance is not interleaved with pair-specific
guidance still holds. Those two are the whole frame — everything below them is
work.

## Risks / Trade-offs

- **Readers with the current order in muscle memory.** → The "on this page" row
  is the affordance for that, and it is built from the same conditions as the
  sections, so it moves with them automatically.
- **An e2e spec asserting the old order fails.** → Intended; the assertions are
  updated with the change rather than loosened, since order is the deliverable.
- **A future finding with no obvious class.** → Named in the design of whichever
  change adds it, not resolved by a general rule here.
