## Context

The GE-235's backend is an interpreter, not a CPU emulation — see
`docs/contributing/architecture.md` for where interpreter dialects sit relative
to the core-wrapping ones. It is ~1,500 lines of source across ten modules under
`src/dialects/ge235/interpreter/`, with ~1,100 lines of colocated tests.

Its coupling to the GE-235 is narrower than its size suggests. Nine of the ten
modules are machine-neutral runtime; the machine enters through exactly four
imports, in three files. Everything else the interpreter needs it already takes
from `src/dialects/types.ts`, which `src/emulator/` may read freely.

The constraint that shapes every decision below is not technical. This dialect's
worth is that its numbers are *sourced* — `MAX_GOSUB_DEPTH = 162`,
`MAX_DATA_CONSTANTS = 128`, `MAX_LINES = 240` each cite a span of `BA-1`'s
"primary memory allocation" table, and `memoryMap.test.ts` checks the drawn map
against the running interpreter to keep them honest. A refactor that turns those
into a config object with a one-line comment has completed the mechanical task
and destroyed the artefact.

## Goals / Non-Goals

**Goals:**

- One Dartmouth interpreter that more than one machine can drive, with the
  machine's facts supplied rather than imported.
- Provenance preserved: every sourced figure keeps its citation, at the site
  that declares it.
- Behavioural identity for the GE-235, provable without editing a test.
- The GE-235 describing itself by the version of BASIC it runs, not the family.

**Non-Goals:**

- The GE-635, or any V4 language feature. This change builds the seam only; see
  the proposal's Non-goals.
- A general BASIC engine. The TRS-80 keeps its own interpreter.
- Any behaviour change, including improvements. "The existing tests pass
  unchanged" is the safety argument, and it only works if nothing else moved.

## Decisions

### The core lives at `src/emulator/dartmouth/`

`src/emulator/` is where the project already puts machine cores that dialects
share. The alternative — leaving it under `ge235/interpreter/` and having a
future `ge635` import it — makes one dialect depend on another dialect's
internals, which inverts the layering the architecture doc describes and would
make the GE-235 undeletable.

Rejected also: a `src/emulator/ge235/` named for the first machine. The core is
the *language's* runtime, and the second machine to use it is not a GE-235
variant.

### The profile is a plain readonly object, passed to the constructor

`new Interpreter(GE235_PROFILE)`, where the profile is an object satisfying a
`DartmouthProfile` interface exported by the core.

Considered and rejected:

- **Subclassing** (`class Ge235Interpreter extends Interpreter`) — puts machine
  facts in overridden methods, where they are harder to read as a set and easy
  to partially override.
- **Generics / type parameters** — buys nothing; every field is a value, not a
  type.
- **Module-level configuration** (a `configure()` call) — global mutable state,
  and two machines cannot then exist in one process, which the registry-driven
  test batteries do routinely.

### Each machine's profile lives in its own dialect folder

`src/dialects/ge235/profile.ts`, not `src/emulator/dartmouth/profiles/ge235.ts`.

The dialect owns the *facts*; the core owns the *machinery*. This is the same
split the rest of the tree uses, and it means the core has no import edge back
into `src/dialects/<name>/` — only into `src/dialects/types.ts`.

It also puts each citation where a reader of that machine will look for it.

### Provenance: the interface says what, the value says why that number

The two doc comments do different jobs and both are required.

On `DartmouthProfile` in the core, each field is documented
machine-independently: what the limit governs, what units it is in, what breaks
if it is wrong. On the GE-235's profile value, each figure keeps the citation it
has today, verbatim — the span of `BA-1` it was derived from, and the
arithmetic. Nothing is compressed to "see the memory map".

The review test for this decision: read `src/dialects/ge235/profile.ts` alone
and you should be able to check every number against a 1965 listing. If you
cannot, the extraction lost something and the comment must come back.

### The charset crosses the seam as one object, not six functions

`src/dialects/ge235/charset.ts` exports a `CharsetMapping` plus the loose
`CR`, `EOM`, `SPACE`, `plainChar` and `parseChar`. The core needs all of them —
`program.ts` for record framing, `terminal.ts` for rendering.

The profile carries a single `charset` member bundling the `CharsetMapping`, the
three control codes, and the two per-code helpers. Passing five loose functions
through the constructor would work and reads far worse; and the bundle is the
unit a second machine replaces wholesale, since the GE-635's codes are ASCII
rather than 6-bit BCD.

### The statement switch stays a switch

`execStatement`'s `switch` already ends in `default: throw ILLEGAL_INSTRUCTION`,
and a word only reaches it if the profile's keyword table lexed it as a keyword.
So the statement set is *already* gated by data, and no dispatch table is needed.

Rejected: moving dispatch into the profile now, in anticipation of V4's
statements. That is speculative generality — the change adds no statement, so
the abstraction would have exactly one implementation and no test exercising the
seam. The right time to reshape dispatch is when a second statement set exists
to shape it against.

### The metadata correction rides along rather than shipping separately

It is three fields in three files. Splitting it into its own change would mean
two changes touching `ge235/index.ts` back to back, and the naming problem is
caused by the same fact that motivates the extraction — a second Dartmouth
machine. It stays here.

## Impact on the Dialect / MachineEmulator seam

**None.** This is the load-bearing claim.

`Dialect` and `MachineEmulator` in `src/dialects/types.ts` are not edited. The
GE-235 keeps `createEmulator()` returning a `Ge235InterpreterMachine`, which
keeps implementing `MachineEmulator` with the same members and the same
semantics — `frameHz`, `displayWidth`/`displayHeight`, `reset`, `loadProgram`,
`runFrame`, `renderTo`, the key handlers, `isProgramRunning`, `readScreenText`,
`readReport`, `dispose`, and the `interpreter` accessor its tests use. Only its
implementation moves behind it.

No other dialect can observe this change.

## Risks / Trade-offs

**The profile becomes a config bag and the citations rot.** → The strongest
mitigation is the one already in the tree: `memoryMap.test.ts` checks three of
the figures against the running interpreter, so a number that drifts from its
map fails. For the rest, the review test above, plus keeping the citations
verbatim rather than rewritten during the move.

**A silent behaviour change hides behind a large diff.** → The whole of
`src/dialects/ge235/**/*.test.ts` must pass with **no test edited**. If a test
needs changing to go green, the extraction did something it should not have, and
the fix is the source, not the test. Import-path updates in test files are the
one permitted edit, and they should be mechanical.

**The move loses git history for ten files.** → Use `git mv` so the rename is
recorded; keep the move and the parameterisation in separate commits so the
first is a pure rename that `--follow` can track.

**`git mv` plus edits in one step makes review impossible.** → Two commits:
move, then parameterise. The first should change no line but import paths.

**Scope creep into V4.** → The GE-235's profile declares exactly what the GE-235
had. Any field that exists only because the GE-635 will want it is out of scope
for this change.

## Open Questions

- **Where `FRAME_HZ` belongs.** It is currently a core constant, documented as
  "a pacing convention rather than a video rate" — the figure the statement
  budget was derived against. It is arguably a property of the interpreter's own
  budget rather than of the machine. Decide during implementation; if it stays
  in the core, say so in a comment rather than leaving it looking like an
  oversight.
- **Whether `MAX_LINE_NUMBER` is a language fact or a machine fact.** It comes
  from `tokenizer.ts` today, which is dialect-side, so it moves to the profile
  by default. If the 1968 manual turns out to state the same bound, a later
  change may lift it into the core — not this one.
