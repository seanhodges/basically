## Context

The AI path and the run-a-program path, and where they meet, are described in
`docs/contributing/architecture.md` and in the design of
`verify-generated-code-at-runtime`; this design only covers what is added on top
of that meeting point.

What exists after the two changes this one is sequenced behind:

- An apply-and-run from the panel arms a check inside `EmulatorPane`'s frame
  loop. Each frame it hands what the machine says to `classifyAiRunFrame`, a
  pure rule set, until that returns one of four outcomes — `errored`,
  `ended-ok`, `still-running`, `never-started`.
- The outcome crosses to `aiStore` as a sequence-tagged store field carrying the
  source that was run. An `errored` outcome becomes a correction the store sends
  unasked, up to a cap of two per applied block; the other three become a note
  folded into the front of the next request.
- Every registered machine can now report its screen as characters
  (`readScreenText`), and all but two can report their variables
  (`readVariables`).

So the machinery to observe a run, decide it failed, and ask for a correction is
all in place. The gap is the one the proposal names: nothing knows what the
program was *supposed* to produce, and the only participant who does is the
assistant that wrote it.

Two facts about the observation surface shape everything below.

**Variable values arrive as display strings, not values.** `MachineVariable.value`
is documented as "already formatted for display": a BBC string reads
`"HELLO"` *with* the quotes, a real is formatted for a human, and an array is a
shape plus a truncated preview (`(10) = 1, 2, 3, …`). There is no raw-value
channel, and adding one would be a seam change this proposal rules out. So
either the assistant writes expectations in that display convention, or the
comparison meets it halfway. This design does both.

**Coverage is uneven, and only in one direction.** After
`read-the-screen-as-text` every machine answers `readScreenText` — pinned by a
registry-level test, so it stays true. `readVariables` is missing on the ZX80
and the Atom. That asymmetry is the whole of "what this machine can be asked
about".

## Goals / Non-Goals

**Goals:**

- The assistant can say what its program should produce, and be told whether it
  did.
- A wrong answer is corrected on exactly the same terms as a runtime error —
  same channel, same cap, same visibility, same Stop.
- The assistant is never invited to state an expectation the chosen machine
  cannot evaluate.
- A reply with no expectations behaves byte-identically to one today.
- Honest verdicts: an expectation that could not be evaluated is reported as
  such, never quietly passed or failed.

**Non-Goals:**

- A test framework, a runner, or anything the user maintains.
- Expectations the user writes.
- Timing, performance, memory, graphics or audio assertions.
- Scripting input to drive a program to its result (see the decision below).
- Any change to the `Dialect` / `MachineEmulator` seam.

## Decisions

### Expectations are a third fenced block, not a new channel

The reply already carries its payload in fenced blocks and the extractor already
reads the fence tag to tell a whole listing from a fragment. Expectations become
a third tag, ` ```basic-expect `, sitting alongside — one more thing the
extractor recognises rather than a second transport.

That it is a *code block* matters for what must not happen: `classifyBlock` and
the apply paths key off `declared`, which only ` ```basic ` and
` ```basic-partial ` set. An expectation block declares nothing, so it can never
be applied to the editor, merged, or offered as a listing. The apply path filters
to blocks it recognises rather than taking "the last block", which is the one
place this could go wrong and is where the test goes.

Alternatives rejected:

- **Tool calling.** Three providers, three tool APIs, and — as the previous
  change found — a tool definition in the prefix breaks the Anthropic backend's
  cache breakpoint. A fence tag works identically everywhere.
- **A JSON block.** Models emit malformed JSON under length pressure and a
  parse failure would silently lose every expectation in the reply. A
  line-oriented grammar degrades one line at a time.
- **Expectations inside the BASIC as `REM` lines.** They would land in the
  editor, which the spec forbids.

### A two-form line grammar, deliberately small

Each line of the block is one expectation:

```
VAR <name> = <value>
SCREEN CONTAINS "<text>"
```

`VAR` names a variable as the user would write it (`A`, `N$`, `T%`) and gives
the value it should hold. `SCREEN CONTAINS` gives text that should appear
somewhere on the screen. A line that parses as neither is kept and reported as
**unchecked** rather than dropped, so a malformed expectation is visible to the
assistant instead of silently passing.

Rejected: a row/column-anchored screen form (`SCREEN ROW 3 CONTAINS …`). It
invites the assistant to predict exact cursor positions — which depend on the
machine's own leading-space and line-wrap conventions — and turns correct
programs into failures. Presence is the assertion that is actually about the
program.

Rejected: comparisons other than equality (`>`, `CONTAINS` on a variable). The
proposal's failure case is "computes the wrong answer"; ordering assertions
belong to the test framework this is explicitly not.

### The comparison meets the display convention halfway, and the prompt states it

A `VAR` expectation holds when the stated value and the machine's reported value
agree after normalising both:

- surrounding whitespace trimmed;
- one layer of surrounding double quotes removed from each side, so `"HELLO"`
  and `HELLO` are the same expectation;
- if both sides parse as numbers, compared numerically, so `42`, `42.0` and a
  machine that reports ` 42` all agree. Otherwise compared as text.

This is lenient in the one direction that cannot cause a false pass: it forgives
formatting, never a different value. Numeric tolerance is exact equality after
parsing — no epsilon, because an epsilon that is right for one machine's float
format is wrong for another's, and the assistant can always expect the printed
form instead.

The system prompt still states the convention (values come back formatted;
strings carry quotes; arrays report a shape and a preview, so do not expect an
element). Without it the assistant writes expectations against raw values and
the leniency above absorbs the easy half while array expectations fail
mysteriously — the prompt is what stops those being written at all.

### Screen matching normalises runs of spaces, and only within a row

`readScreenText` returns fixed-width rows padded with spaces, so `PRINT "A";"B"`
and a screen that wrapped mid-phrase differ from the assistant's naive
prediction in whitespace alone. Each row is matched after collapsing runs of
spaces to one; matching never spans a row boundary, because a fixed-width
machine breaks lines wherever its width falls and an assertion that spanned rows
would depend on that width.

Case is significant: these machines are shouty by nature and the charset work
already guarantees that a screen read and a listing agree about case.

### Expectations are evaluated by the same watcher, on a cadence

The check that already runs per frame in `EmulatorPane` is the only place that
holds the machine at the moment the run reaches its verdict, so it is where
expectations are evaluated. Two properties decide how:

**Sampling, not per-frame.** `read-the-screen-as-text` records that a Spectrum
screen read is ~6k memory reads and that the reader answers a question rather
than serving as a polling primitive — a per-frame evaluation is exactly the
misuse that timed a test out during that change. Expectations are therefore
evaluated every *N* frames while the check is armed, and once more at the
verdict.

**Passes latch, failures do not.** Most bundled samples are game loops that
never return to READY, and their outcome is `still-running`. A screen
expectation that held on frame 20 is a fact about the program even though the
program is still going, so the first time an expectation holds it is recorded as
passed and not re-evaluated. A failure, by contrast, is only conclusive once the
program has stopped:

| Outcome at the verdict | An expectation that never held is… |
| --- | --- |
| `ended-ok` | **failed** — the program finished without producing it |
| `still-running` | **unchecked** — it may simply not have got there |
| `never-started` | **unchecked** — nothing ran |
| `errored` | not evaluated; the error is the failure and already travels |

This is also the answer to the interactive-program question the proposal left
open. A program blocked on `INPUT` is `still-running` (or, on the Commodore
machines, indistinguishable from finished — a pre-existing limit recorded in the
previous change), so its unmet expectations report as unchecked rather than
sending the assistant to fix a program that was merely waiting. **Checks do not
script keypresses.** Driving a program to its result is a runner, which is a
stated non-goal, and a scripted key sequence is a second thing the assistant
would have to get right before its actual answer could be judged.

An expectation naming a variable on a machine with no `readVariables` is
`unchecked` too — and the prompt should have stopped it being written.

### Results ride the existing outcome field, and a failure is an ordinary correction

`runOutcome` grows one sibling field carrying the per-expectation results; no
second channel, and the existing `seq` still discards a stale run's results. The
`AiRunOutcome` union is untouched: an expectation failure is not a fifth kind of
outcome, it is a judgement layered over `ended-ok`.

In `aiStore`'s subscription the branch is: if the outcome is `errored`, today's
behaviour; else if any expectation failed, build a correction the same way
`buildRunFix` does and spend the same automatic attempt from the same
`MAX_AUTO_FIX_ATTEMPTS` budget, with the same edited-since and busy guards and
the same fallback to the `pendingFix` banner; else the run note as today, now
mentioning that the stated expectations held.

One budget, deliberately. A program that errors twice and then produces the
wrong answer has already had the assistant's two free attempts, and a separate
allowance per failure kind would let one applied block spend four.

### What the machine can be asked about is derived, and pinned by a test

The prompt must not invite an expectation the machine cannot evaluate. The
capability is a property of the live machine (`typeof machine.readVariables ===
'function'`), but the system prompt is built from the `Dialect` alone and must
stay byte-stable per dialect for prefix caching — instantiating a machine to
build a prompt is not on.

So the statement is a small derived table keyed by dialect id, and a colocated
test constructs every registered machine and asserts the table matches what it
actually implements. That is the same shape as the registry-level guard added by
`read-the-screen-as-text`, and it is what stops the table becoming the second,
untested account of the machines that `ground-generation-in-the-reference`
exists to kill.

Alternative rejected: declaring the capability as a `Dialect` field. It would be
hand-maintained prose about the machine sitting next to the machine, drifting
the moment someone adds `readVariables` — the derived table plus crosscheck has
the same reach and cannot drift.

### Seam impact: none

Nothing is added to `Dialect` or `MachineEmulator`, and no member changes shape
or meaning. This change is a pure consumer of `readScreenText` and
`readVariables`, both already there and both already optional. The two machines
that cannot report variables need no edit and lose no function.

## Risks / Trade-offs

- **A wrong expectation burns a correction attempt on a correct program.** The
  assistant states both the program and the test, so it can be wrong about the
  test. → Bounded by the same two-attempt cap as a runtime error, and the
  latch/unchecked rules above are tuned so the ambiguous cases report as
  unchecked rather than failed. The user sees the same banner they see today
  once the cap is spent.

- **Expectations make the reply longer, and the model may spend length on them
  instead of on the program.** → They are optional and the prompt asks for them
  only where they are cheap to state; a reply that omits them is unchanged.

- **Screen matching is a substring test, so a program that prints the expected
  text for the wrong reason passes.** → True, and accepted: the alternative is
  position-anchored matching, which fails correct programs (see above). The
  check is a floor on correctness, not a proof of it.

- **Sampling can miss a value that appears and is overwritten between samples.**
  A program that prints its answer and immediately clears the screen may never
  be sampled while it is up. → It reports as unchecked, not failed, on a
  `still-running` verdict; and on `ended-ok` the final evaluation sees the end
  state, which is what "once the program has run" means.

- **The Commodore report is a screen scan for a line containing `ERROR`**
  (recorded in the previous change). A program whose *expected* output contains
  that word now interacts with this: it would be reported as `errored` before
  its expectations were ever judged. → Pre-existing, unchanged, and the cap
  bounds it.

## Open Questions

None. The interactive-program question the proposal deferred is settled above:
unmet expectations on a program that is still running report as unchecked, and
checks do not script input.
