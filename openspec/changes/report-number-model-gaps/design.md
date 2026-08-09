## Context

The number facts are already structured and pinned: every machine states
whether it holds fractions, and an integer-only machine quotes its range,
prose↔structured agreement enforced by the facts crosscheck. The truncation
finding narrows those facts to the program (does it divide, does it carry a
fraction). This change asks the same facts two more questions and — where the
answer depends on intent the text cannot supply — poses the question instead of
guessing.

`docs/contributing/architecture.md` covers the seam: `src/reference/` stays
pure, program text is read on the app side and arrives as plain data in
`ProgramVocabulary`.

## Goals / Non-Goals

**Goals**

- Report the number failures that tokenize cleanly: range overflow between
  integer machines, markers the target drops, markers the target accepts and
  then rejects at run time.
- Establish the posed-decision convention: one `Decide:` line inside the
  finding that owns it, settled downstream by the reader or the assistant.
- Every new fact authored beside its prose and pinned by a crosscheck.

**Non-Goals**

- Overflow semantics (wrap / error / promote) — no honest pin exists short of
  an emulator probe.
- Expression evaluation of any kind.
- A standalone "decisions" section — a decision belongs to the class of work
  its finding is in, per the work-order requirement.

## Decisions

### Impact on the Dialect seam: none

No new `Dialect` field or method. Both findings are pure functions over
`PortingFacts` and `ProgramVocabulary`; the one vocabulary addition is read by
the existing app-side scan.

### Range narrowing fires on the pair; literals sharpen it

Where both machines are integer-only and the target's range is strictly
narrower, the finding is present whenever a program is at hand — arithmetic can
overflow without a large literal, so absence of literals must not read as
safety. The definite half is the literal census: distinct whole-number values
in the program's text beyond the target's range, named in the finding. The
posed decision covers the indefinite half.

The census is bounded at the smallest magnitude any registered integer-only
machine cannot hold (32768 today, the ZX80's ceiling), so the vocabulary
carries only values that could ever matter. The crosscheck fails if a machine
with a narrower range ever registers, which is the moment the bound needs
rethinking — drift caught rather than silently wrong.

### The fractions alternative is a fact; essential-vs-incidental is a decision

Number handling gains an optional field naming a separate number system the
machine offers reals through where its main path is integer-only — the Atom's
floating-point ROM `%A`–`%Z` variables. When the truncation finding fires
against such a target it appends:

```
- Decide: if this program's fractions are essential, keep them in the
  floating-point ROM's %A–%Z variables; if they are incidental, rescale to
  whole numbers — work in tenths or hundredths.
```

The truncation arithmetic itself is unchanged: the settled position (a ported
expression lands on the integers; the FP variables are a separate set) stands,
and the Atom's number prose already names the ROM, so the byte-stable machine
reference the assistant's system prompt carries does not change.

### Marker loss reads the vocabulary it already has

The program's variable names arrive with their type markers; the source's
marker set says which suffixes *are* markers there, the target's says which
survive. A marker used and lost is reported with a fixed meaning (`%` integer,
`!` single precision, `#` double precision — uniform across the machines that
have them; `$` exists everywhere and never fires) and the names carrying it.

Where losing the marker is worse than a spelling change, the target's facts
carry an authored trap note, keyed by marker: the Altair accepts `X%` and fails
with `?SN ERROR` when the line runs. The crosscheck requires a trap's marker to
be absent from that machine's own marker set, and the Altair note is pinned
behaviourally by a console-run expectation. Double-to-single precision loss is
the same finding with different wording — one mechanism, not two.

### Placement in the work order

Both new sections are silent failures — the program tokenizes and computes
differently — so they join class four: marker loss beside the variable
collisions it extends, range overflow beside the truncation finding. The
`Decide:` lines live inside those sections; nothing new is appended to the end
of the report.

### The assistant settles the decisions

Handing over a posed decision only helps if the assistant does not silently
pick a side. The hand-over instruction gains one rule: settle each `Decide:`
line from what the program itself does, and where the text cannot settle it,
say which reading was chosen. That is the whole of the "sense of what the
program is supposed to do" machinery — the report never claims to know intent;
it makes the question explicit and auditable.

## Risks / Trade-offs

- **A range finding with no literals could read as noise on a program whose
  values all fit.** → It is one section stating both ranges and a check to
  make; the alternative is silence about the one difference this pair most
  needs stated.
- **Fixed marker meanings could misdescribe an exotic dialect.** → The meanings
  are only consulted for markers the source's own rule declares, and every
  registered machine that declares them agrees; a future dialect that differs
  moves the meaning into the facts, and the crosscheck stands ready.
- **`Decide:` lines could accumulate into clutter as sibling changes adopt
  them.** → Each rides an existing finding and appears only when that finding
  fires; a report with no decisions to pose shows no such line.

## Open Questions

- Whether overflow behaviour is worth an emulator-probe crosscheck (`PRINT
  32767+1` per integer machine) in a later change — the finding's "cannot hold"
  wording is chosen so it stays true either way.
