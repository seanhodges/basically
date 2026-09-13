## Context

Every operation that needs a held machine declares what becomes of it while that
machine is being played, and `src/ops/play.test.ts` fails any that does not, so
the decision was made deliberately for `variables` and is being remade here
rather than filled in. The line it is declared against is the one
`machine-play` draws: a request that acts on the machine or measures it is
refused, one that only reads it is answered.

`variables` reads BASIC's own variable area out of the machine's memory and
returns name, kind and a display value. It runs no frames, writes nothing, and
is structurally the same operation as reading the screen, which is answered. It
was nevertheless filed with profiling and timing, on the reasoning that an answer
about a moving machine describes a moment already past.

That reasoning does not separate it from the screen. The spec already answers it,
for the reads it does allow: a read has caught a machine that is moving, two
reads may differ, and that is not a fault. Filing `variables` with the
measurements is what is being corrected.

The `Dialect` / `MachineEmulator` seam is **not touched**. `readVariables` is
already optional on `MachineEmulator`, already implemented by the machines that
can do it, and already pinned per dialect by the registry-driven test beside
`machineObservability.ts`. Which machines can answer is unchanged; only when the
question may be put changes.

## Goals / Non-Goals

**Goals:**

- Reading a played machine's variables is answered, on the same terms as reading
  its screen.
- A caller refused a measurement is told the variables are among what it can
  still read.
- Profiling and timing stay refused, for a reason the code states rather than
  inherits.

**Non-Goals:**

- Writing a variable, on any machine in any state.
- Changing which machines can report variables at all.
- Relaxing anything else refused while a machine is played.
- A new operation, or a new option on an existing one.

## Decisions

### `variables` declares `answer`, and the comment says why it is a read

**Decision.** `variablesOp.played` becomes `'answer'`. The comment above it says
that variables are read out of the machine's memory without spending a frame,
the way the screen is, and that the caller has caught a moment — rather than
restating the refusal it replaces.

**Why.** The declaration is the whole mechanism: `runOperation` consults it, and
nothing else in the operation needs to change. Putting the reasoning in the
comment is what stops the next reader from re-filing it with the measurements,
which is how it came to be there.

**Alternatives considered.** *A second operation that is explicitly a snapshot of
a moving machine* — two operations answering one question, and a caller would
have to know which state the machine was in to pick, which is exactly what it
asked the operation to find out. *An option on `variables` acknowledging the
motion* — the acknowledgement is already the spec's, for every read, and an
option nobody can sensibly decline is not a choice.

### Profiling and timing keep the refusal, and say what makes them different

**Decision.** `profileOp` and `timeOp` stay `'refuse'`. The distinction stated in
the spec — a measurement accounts for a run in frames, and whoever is playing is
spending frames the caller never asked for — is what the refusal now rests on.

**Why.** Their figures are not merely stale, they are wrong: a run's share of
time, and a run's duration, are denominated in frames that a person's keystrokes
and the play clock have been adding to. A variable's value has no denominator.

### What a refusal says names the variables

**Decision.** `beingPlayed()` already names reading the screen as what is still
answered; it names the variables too.

**Why.** The refusal is the only place a caller finds out where the line falls.
Moving `variables` across it without moving the sentence would leave the toolchain
telling callers that less is available than is.

## Risks / Trade-offs

- **A read catching the interpreter mid-write.** BASIC's variable area is a
  linked structure the interpreter rewrites in place, and between frames the CPU
  is at an instruction boundary but not necessarily between variable-table
  operations. → The walks are already bounded and defensive — a guard on the
  number of variables and the end-of-area pointer as a hard stop — so the worst
  case is a transient odd value, which is what the spec's "two reads may differ"
  already covers. The IDE has read a freely running machine several times a
  second on every dialect that implements it, which is the same read.
- **A caller polling a played machine adds work to the machine's thread.** →
  Reading spends no frames, and it lands between clock ticks the way the screen
  reads that already happen do. A caller polling unreasonably hard slows its own
  answers before it slows the machine.
- **A surface that shows variables now implies they update.** A caller that reads
  once and renders forever will show a stale table with no indication. → The
  operation's contract is unchanged: it answers what is held when it is asked.
  Anything continuous is the caller's to arrange, and the spec says the answer is
  a moment.

## Migration Plan

None. No caller is required to change, and no answer a caller already receives
changes shape. A request that was refused begins to be answered; nothing that was
answered begins to be refused.
