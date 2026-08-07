## Context

The porting guide is a VitePress page that the IDE also hosts in an iframe. The
docs half of it may never reach the dialect registry or an emulator core — the
constraint is stated in `docs/contributing/architecture.md` and enforced
executably by `src/components/machinePickerBoundary.test.ts` — so
`src/reference/` computes findings from reference data alone, and anything that
needs a real tokenizer is computed in the app and passed across the iframe
boundary as plain data. `ProgramVocabulary` is the existing instance of that
pattern: the app scans the open program, posts what it found, and the guide
narrows its findings to it.

A fit check needs a tokenizer for a machine that is not the one the IDE has
selected, so it belongs on the app side of that seam, with the result handed to
a pure comparison exactly as the vocabulary already is.

## Goals / Non-Goals

**Goals**

- Report the one failure mode a zero-difference port can still hit.
- Measure the program with the target's own tokenizer, because tokenized size
  is not portable between machines.
- One definition of the 80%/95% budget thresholds, shared with the status bar.
- Degrade silently where there is no program, as the other narrowed findings do.

**Non-Goals**

- Runtime memory (variables, arrays, string space) — see the proposal.
- Any change to what a machine reports as its free program RAM.
- Any new analysis of the program's text: this is the existing tokenizer run
  once more against a different machine.

## Decisions

### Impact on the Dialect seam: none

No new field, no new method. The size is `Dialect.tokenize(source).byteSize`,
which every dialect returns already and which `useProgramStats` calls for the
status bar's own byte counter. What is new is *which* dialect is asked.

### The target's tokenizer, run in the app, sized once per chosen target

The alternative — reusing the source machine's byte count — is wrong by up to a
quarter on the pairs that matter. Measured, on one six-line program:

```
  ZX80                                        50 bytes
  BBC / C64 / PET / VIC-20 / TRS-80 / Altair  71 bytes
  ZX81 / Spectrum / Spectrum 128              80 bytes
  Atom                                        82 bytes
  CPC 464 / CPC 6128                          88 bytes
```

The Sinclair machines' 80 is the five-byte binary form stored after every
numeric literal; the CPC's 88 is its own literal encoding. A port from a
Microsoft-derived machine to a CPC therefore grows by ~24% before a single
keyword is rewritten, and a fit check reading the source's figure would miss it.

### The target travels with the vocabulary request

The guide already asks the app what the open program uses, naming the machine
being ported **from** (`basically:program-vocabulary-request`), and re-asks
whenever that machine changes. The request gains the machine being ported
**to**, and the reply carries the size that target's tokenizer produced together
with the id it answers for, so a reply that arrives after the reader has moved
on is ignored the same way a stale source reply already is.

Considered and rejected: replying with a size for *every* registered machine, so
switching target costs no round trip. It is affordable (a tokenizer pass is
linear in the program text) but it does work no reader asked for on every
keystroke of a debounced push, and it makes the payload grow with the registry.
The round trip is already there; this rides it.

```
  IDE (app side)                        docs iframe (pure)
  ─────────────────────────────         ──────────────────────────────
  vocabularyReply(source, from, to)
    from.tokenize(source)  ─────────▶   keywords / escapes / characters …
    to.tokenize(source)    ─────────▶   { toId, bytes, clean }
                                             │
                                             ▼
                                        programFit(targetFacts, size)
                                          → fits | tight | over, + lower bound
```

### Errors from the target's tokenizer are expected, and make the figure a lower bound

Tokenizing a program for a machine it was not written for is the normal case
here: the target may have no keyword for `SOUND`, no glyph for `!`, no way to
express a line the source allows. Those are already reported by the guide's
other findings, and refusing to report a size because of them would withhold the
one finding a reader with a 40KB program on a 3,583-byte target most needs.

So the size is taken from whatever tokenized, and where the target's tokenizer
reported anything the figure is stated as a lower bound — the real program can
only be larger once the reported differences are dealt with. This mirrors how
the guide already treats an incomplete vocabulary: state what is known, say what
is being held back, never pretend to completeness.

`tokenize` collects errors rather than throwing, per the project's
errors-not-throws convention, so this needs no defensive wrapping.

### The thresholds live once, in `src/reference/ramBudget.ts`

`ramSeverity` (≥80% warn, ≥95% crit) currently lives in
`src/app/useProgramStats.ts`, which imports React and the store and so cannot be
read from `src/reference/`. The pure part — the percentage and the two
thresholds — moves to a new `src/reference/ramBudget.ts` that imports nothing;
`useProgramStats.ts` reads it, keeping its own exported surface, and the guide's
fit calculation reads the same module.

Direction matters: `src/app/` → `src/reference/` is an existing dependency
(`src/ai/portReport.ts` already reads reference data), while
`src/reference/` → `src/app/` would invert the layering and put a module the
docs bundle pulls in under a folder full of React. A colocated test pins that
the status bar and the guide classify the same percentage identically, so the
two cannot drift back apart.

### The finding is per machine, and only where there is a program

`PortingFacts.freeRamBytes` is per machine already — the VIC-20 carries its own
3,583 rather than the C64's 38,911, which is exactly the trap `facts.ts`'s
header comment records. The fit finding reads the selected target's facts, never
its page's.

Where `noticeState` reports anything other than `narrowed` — read outside the
IDE, nothing open, unreadable, or still reading — there is no program to size
and the finding is absent, exactly as the statement-layout finding is. Turning
on "show every difference" does not conjure one: a fit report about no program
would be a report about nothing.

### What the reader is told

Three states, from the shared thresholds:

| Size against the target's free RAM | Reported as                          |
| ---------------------------------- | ------------------------------------ |
| under 80%                          | fits, with both figures              |
| 80–94%                             | close to the limit, with both figures |
| 95% and over                       | will not fit / no room left, with both figures |

Both figures always, because the reader's next question after "it does not fit"
is "by how much".

## Risks / Trade-offs

- **A lower bound reads as a firm figure.** → The report says which it is, in
  the same sentence as the number, and the existing held-back notice already
  trains the reader that this page states its own limits.
- **The target's tokenizer could be slow on a large program.** → It is the same
  pass the status bar already runs per machine per keystroke, on the same
  debounce, and it runs once per reply rather than once per target.
- **A machine whose ROM reports free RAM differently from `programRamBytes`.**
  → Out of scope and unchanged: `freeRamBytes` is pinned to `programRamBytes` by
  `facts-crosscheck.test.ts`, and the status bar quotes the same budget when the
  emulator is not running.
- **Two numbers on the page could be read as one.** → The status bar reports the
  program on the machine it is written for; the guide reports it on the machine
  it is going to. Each names its machine.

## Migration Plan

None needed. The request and reply are same-origin `postMessage` payloads
between two halves of one build; a guide asking an older app for a target size
simply receives no fit and reports none, which is the same behaviour as having
no program.
