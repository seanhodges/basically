## Context

The block linter checks placements against static legal ranges declared per
machine, and the porting guide's fit report compares program size against a
static free-RAM figure. Both are boot-state truths. The regions this change
models are dual-use: hardware claims them only when the program exercises an
optional feature, and the program's own text says whether it does.

`docs/contributing/architecture.md` covers both sides of the boundary this
change spans: dialect declarations feed the app's linter directly, while the
reference data under `src/reference/` is restated by hand and crosschecked,
because the docs site cannot import dialect code.

## Goals / Non-Goals

**Goals**

- Model "free unless the program uses X" with conditions the program's text
  proves, and nothing weaker.
- Let the block linter accept what the real machine accepts, saying what the
  placement leans on.
- Surface the memory in the porting fit report only when fit pressure makes it
  the program's business.

**Non-Goals**

- Conditions requiring runtime knowledge (RAMTOP moves, ROM banking,
  user-defined graphics in use).
- Mode-aware free-RAM figures in the editor's status bar or the fact rows —
  the headline figures stay boot-state.
- Any change to where programs load or how screens are emulated.

## Decisions

### Impact on the Dialect seam: two optional fields on the blocks contract

The memory-blocks support contract gains optional conditionally-free ranges
(range, condition, note) and the machine's mode command (keyword and boot
mode). Machines that declare neither behave byte-for-byte as today. No
emulator, tokenizer, or other `Dialect` member changes.

### The condition language has two forms, both decidable

A region is free when *the program uses none of some keywords*, or when *every
screen mode the program selects sits within a set*. The second is the one the
first machines need — `CLEAR 0` clears the text screen and must not forfeit
the Atom's region, so the condition is argument-sensitive, not keyword-
sensitive. The vocabulary therefore reports the mode values selected with the
machine's mode command where the argument is a constant, plus a flag for any
non-constant selection.

Evaluation is deliberately strict:

```
  no mode statements        → boot mode decides
  all constants, all in set → met
  any constant outside set  → unmet
  any computed argument     → unmet (unknowable ≠ free)
  any program write inside the region → unmet
```

The last rule costs nothing — the write sites are already collected — and
closes the loophole of a program that never names a graphics mode but pokes
the video RAM directly.

### First regions: the two the text can prove

- **Atom**: the video RAM above the text screen, free while every mode the
  program selects is the text mode. The fitted video RAM runs six kilobytes;
  text mode uses the first kilobyte's screen, so the region starts above that
  page and runs to the top of video RAM — the exact bounds come from the
  machine's own address constants, asserted in the colocated test.
- **BBC Micro and Master**: the band between the bitmap screens' lowest floor
  and the teletext screen, free while every mode selected is the teletext
  mode (also the boot mode). This is precisely the band the linter's blanket
  warning covers today, and that warning's own rationale — the static linter
  cannot know the mode — is the sentence this change deletes: now it can.

The Spectrum, VIC-20 and C64 candidates fail the decidability bar and are
declined, not deferred by accident. The design rule is worth stating once: a
condition is authored only if the vocabulary can evaluate it.

### The linter reports what a placement leans on

A block inside a conditionally free region lints three ways:

- condition met → a **warning**, naming the condition ("free while the program
  stays in text mode"), so a program that later grows a graphics mode has a
  visible thread to pull rather than a silent time bomb;
- condition unmet or undecidable → today's **error**, extended to name the
  condition, so the reader learns what would make the placement legal;
- no vocabulary available → the error, unchanged — absence of knowledge is
  not permission.

The run gate already computes the program's vocabulary for sizing; it hands
the same object to the linter, so nothing is scanned twice.

### Reference data is restated and pinned, and the fit gate is worded once

The regions are restated in the porting facts (start, end, bytes, condition,
note) and the crosscheck requires byte-for-byte agreement with the dialect
declarations — the same discipline the free-RAM figure already follows.

The comparison reports the region only when the fit report already calls the
program close to the limit or over it, and the condition is met. This is how
the finding squares with the settled rule that the comparison never advertises
what the target adds: under pressure, the memory is not an advertisement but
part of the answer to "does it fit" — and the fit requirement is worded to
admit *target-side measures whose facts are pinned to the machine* generally,
so the sibling abbreviations proposal (spellings that shrink stored source)
rides the same gate without another spec round. An unmet condition reports
nothing: "rewrite the program and this memory appears" is exactly the
advertisement the rule forbids.

The finding ends with the posed decision — move data and machine code there,
or shorten the program — under the convention the number-model change
introduces.

## Risks / Trade-offs

- **A program could meet the condition today and select a graphics mode
  tomorrow.** → That is what the met-condition *warning* is for; the linter
  re-evaluates every run, and the moment the mode appears the placement
  becomes the error it always would have been.
- **The boot-mode rule bakes in "no mode statement means the boot mode".** →
  A loader that changes mode before running the program is out of model — the
  same caveat the BBC linter already documents for its boot-state PAGE.
- **Two sources of truth for the regions.** → Accepted deliberately (the docs
  site cannot import dialect code), made safe by the byte-for-byte crosscheck,
  and precedented by the free-RAM figure.
- **Warning fatigue from the met-condition notice.** → One line per block,
  only for blocks actually placed in such a region — placements the linter
  refused entirely until now.

## Open Questions

- Whether the memory-map UI should eventually draw conditionally free regions
  as their own kind. Left out: the maps draw boot state, and a fourth severity
  of shading needs its own design conversation.
