## Context

`docs/contributing/architecture.md` describes the two callers and the band they
already share. The shape worth restating here is only the asymmetry: the command
line's operations are pure functions returning data, with formatting kept
separate and the process-aware code confined to one shim; the assistant's tools
have the same split, rendering prose for a model instead of columns for a
terminal. Two layers of the same shape, over one seam, with no list holding them
to each other.

The pieces that are shared got there one at a time, each pushed down to sit
beside what it was about — the driver beside the machine, the script grammar
beside the driver, the key names beside the keyboard. That method works and is
why driving means the same thing to both callers today. It has one thing it
cannot do: a guarantee that the two callers offer the same capabilities has
nowhere to live, because it is a fact about the set rather than about any member
of it.

**No impact on the `Dialect` / `MachineEmulator` seam.** Nothing here adds,
removes or changes a seam member. The operation layer sits above it, and the
machine session composes members that already exist — reading the screen,
pressing keys, turning profiling on, draining it, reading memory figures and
reading variables. A machine that does not implement an optional member is
reported as unable to answer, exactly as it is today.

## Goals / Non-Goals

**Goals:**

- One declaration per operation, from which every caller's surface is derived
  rather than written beside it.
- Capability parity between the callers, enforced by a test rather than by
  review, failing in both directions and on a stale exemption.
- Close the gaps each caller has been missing, as wiring rather than as features
  written a second time.
- Leave room for a third caller without a second reshaping.

**Non-Goals:**

- Reconciling the two assertion vocabularies (see Open Questions).
- Changing the command line's grammar, streams or exit codes.
- Freeing the assistant's store from the browser.
- Any change to the machine seam.

## Decisions

### One declaration, three derived surfaces

An operation declares its name, a one-sentence summary, an input schema, what it
needs in order to run, how the command line reaches it, and a function from
input and context to a serialisable outcome. The command line's operations and
the assistant's tool definitions are both rendered from it.

*Why this and not two lists kept in step by review:* that is what exists now,
and it is how `WAIT END` came to be parsed but never advertised. The input
schema is the same artefact a tool definition already carries, so one
declaration is not a new abstraction so much as the recognition that the two
surfaces were describing the same thing twice.

*Alternative considered — generate the command line from the schema.* Rejected.
The command line's grammar is a stated guarantee, with positional files, short
options and a convention for reading from a pipe. A generated one would lose
that. Argument parsing therefore stays hand-written and produces the operation's
input; the schema validates rather than generates.

### Parity is over capabilities, not over invocation shape

Each operation declares how the command line reaches it: as an operation of its
own, as an option on another, or as a verb inside a schedule.

*Why:* a command line invocation holds no machine between runs, so looking at a
screen or asking for a measurement cannot be an operation of its own there — it
is something asked of a run. The assistant, holding a live machine across
several round trips, calls the same things one at a time. Demanding the same
invocation shape of both would either invent stateful commands the command line
cannot honour, or deny the assistant the granularity that makes driving work.
Declaring the route is what lets the test demand that a route exists without
demanding that it be an operation.

### Exemptions are declared, reasoned, and checked in both directions

An operation deliberately absent from a surface is listed in one table with the
reason it is absent. The test fails when an operation is missing without an
entry, and equally when an entry names an operation that is in fact present on
both.

*Why this shape:* it is the one the per-machine capability tables already use,
where a set of machine identifiers is crosschecked against what those machines
actually implement, and where implementing the missing member fails the test
until the identifier comes out of the set. The property that makes it work is
the second direction: without it a table of exemptions becomes a list of things
nobody rechecked, which is the failure mode it exists to prevent.

*Alternative considered — a flag on the operation itself.* Rejected: a boolean
records that something is absent but not why, and gives nothing to fail against
when the absence stops being true.

### A provider that cannot be given tools is not an exemption

Tool support is a property of the chosen provider, and where a provider has
none, the assistant has no tools at all. That is a gate on the whole surface and
must be read as one, or it silently satisfies every parity check by making every
operation equally absent.

### Availability is decided when a call arrives, never by omission

The tool definitions must be identical bytes across a conversation or the cached
prefix behind them is lost. So the set offered never varies with what is
currently possible: an operation needing a machine is offered on every turn and
answers that it was not given one when it is called without it. This is how
driving already works, and generalising it is what lets one list serve a caller
whose circumstances change mid-conversation.

The cost is that adding an operation changes the block, and every conversation
pays one cache miss after that release. Accepted: the property the cache depends
on is stability within a conversation, and that is kept and pinned by a test
that compares the rendered block across turns.

### Grammar parity, where a schema cannot see

The drive script arrives as a single string, so its schema says nothing about
the vocabulary inside it — which is exactly where the known skew lives. The
action kinds therefore become a declared list, and the test asserts each is
accepted by the parser and named in both callers' descriptions.

*Alternative considered — make the script a structured array in the schema, so
the vocabulary is in the schema and parity is structural.* Rejected on two
counts. A schedule is text the user writes on a command line, and an array is
not; and a script that expresses "wait for the prompt, answer it, let it run" in
one call is what keeps driving inside its round-trip bound, where a structured
form invites one action per call.

### Outcomes are serialisable; renderers are not shared

An outcome carries only what survives being written as JSON, which is what makes
a third caller possible rather than merely imaginable, and what keeps the
command line's machine-readable output honest. Bytes travel encoded.

Rendering stays per caller and is not an asymmetry: a built program writes files
on the command line and is reported to the assistant as its target and its size,
because handing a model a program's bytes helps nobody. Same operation, two
renderings.

### `src/ops/` as the home, free of the process and of the browser

The layer imports neither the filesystem nor the DOM nor the store, so both
callers can reach it. The boundary is held by the same lint mechanism that
already keeps the reference tables out of the initial download, rather than by
convention.

*Alternative considered — grow the command line's own folder into the shared
layer.* Its operations are already node-free and it would be less code to move.
Rejected because the folder would then be named for one of its two callers, and
because the node-only edge lives there too, so the boundary would run through a
folder instead of around one.

## Risks / Trade-offs

**The shared layer drags the filesystem into the browser bundle** → The lint
boundary refuses the import, and a size check on the built bundle is the proof
rather than the intention.

**The exemption table becomes a backlog** → Every entry states a reason, and the
stale-entry direction of the test removes an entry the moment its exemption
stops being true. An entry is a decision; the table is read in review as one.

**Extracting the measurement accumulator disturbs the run loop** → It comes out
as a pure fold with no behaviour of its own, and the existing measurement tests
cover its output. The pane keeps calling it every frame, in the same place, with
the same cadence constants.

**The machine-readable output becomes a contract others depend on** → It already
is one by guarantee; deriving it from a declaration makes the shapes easier to
change deliberately and harder to change accidentally, which is the direction
that helps.

**The command line's folder becomes shims** → Accepted. What remains there is
genuinely the command line's: argument grammar, help text, the process shim, and
locating ROMs on disk.

**A parity failure blocks work that is otherwise fine** → That is the point, and
the exemption table is the release valve. The failure mode to watch is a
contributor reaching for an exemption rather than five minutes of wiring; the
reason field is what makes that visible in review.

## Migration Plan

Three steps, each green on its own and each leaving both callers working.

1. **The layer and the test, with no behaviour change.** The operations that are
   already pure move in; the command line calls them through shims; the parity
   test lands with an exemption table that records today's asymmetries honestly.
   It is at its largest here, and that is the point: it makes the gap a number.
2. **The machine session.** One interface over a running machine, an
   implementation for each caller, and the measurement accumulator extracted so
   a headless run can produce one. This empties the measurement rows from the
   table.
3. **The machine operations and the assistant's gaps.** The assistant's tool set
   derives from the list; the remaining operations are declared; the known
   vocabulary skews close.

Rolling back is per step: the shims keep the command line's behaviour identical
through the first, and the assistant's tool set is unchanged until the third.

## Open Questions

- **The two assertion vocabularies.** Whether they become one, and if so which
  form survives — the assistant's forms include one settled by the assistant
  looking at a picture, which no command line can evaluate, and the two are
  checked at different moments against different readings. Out of scope here,
  but it has to be answered before `test-a-program-from-the-command-line` is
  applied, or that change lands the second vocabulary and the table inherits an
  asymmetry nobody chose.
- **Whether listing the registered machines belongs on the assistant's surface.**
  A conversation is pinned to one machine, so it may be useful only when the
  subject is porting. Cheap either way; decide when it is wired.
- **How much of a build the assistant should be told.** Target and size are
  clearly useful and bytes clearly are not; whether anything between them is
  worth carrying is open.
