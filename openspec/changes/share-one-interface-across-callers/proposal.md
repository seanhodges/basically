## Why

Two callers drive this toolchain: the command line, increasingly used by agents
rather than people, and the assistant inside the IDE. They reach the same
machines through two separate command layers, and only the bottom band is
actually shared — the driver, the drive script, the key vocabulary and the
`Dialect` seam. Above that, what each caller can do has been decided one feature
at a time, by whoever needed it, and nothing holds the two together.

The result is not a tidy-up job but a capability gap in both directions. The
assistant cannot lint on demand, build a program, or ask what the machine it is
writing for actually is; the command line cannot profile a run, time it, or read
a variable back. Neither absence was decided — each is simply where the last
change stopped.

Worse, the two are already drifting inside the things they do share. `WAIT END`
is accepted by the drive parser and never mentioned to the assistant. Semicolons
separate actions on the command line and nowhere else, so a schedule a model
writes is refused for punctuation the other caller allows. And a second
assertion vocabulary is queued behind `test-a-program-from-the-command-line`,
which will teach the command line `EXPECT` while the assistant keeps
`SCREEN CONTAINS` — one machine, two ways to say the same thing.

Every one of those passed review. That is the actual problem: there is no list
to hold the two surfaces to, so drift is invisible until someone goes looking.

## What Changes

- **One declaration per operation**, in a new `src/ops/`. It carries the
  operation's name, its one-sentence summary, its input schema, what it needs to
  run, and how the command line reaches it. The command line's subcommands and
  the assistant's tool definitions are both derived from it rather than written
  beside each other.
- **Capability parity becomes a guarantee.** Every operation is reachable from
  both callers. An operation that is deliberately absent from one is declared as
  such, with the reason, in one table — and an undeclared absence fails a test.
  The table is also checked in the other direction: wiring an operation up forces
  its exemption out, so it cannot decay into a list of things nobody rechecked.
- **The assistant gains** the operations it has been missing — checking a program
  without running it, building it, and asking what the machine is.
- **The command line gains** the measurements the assistant has had to itself:
  where a run's time and memory went, how long it took, and what a variable
  holds.
- **A machine session becomes one interface** over a running machine — pressing
  keys, looking, capturing the display, and reporting measurements — with one
  implementation for the browser and one for a headless run, so an operation is
  written once and works for either caller.
- **The known skews close.** The drive vocabulary is stated once and advertised
  identically to both callers, punctuation included.

## Non-goals

- **Unifying the two assertion vocabularies.** The assistant's expectations and
  the command line's proposed `EXPECT` lines overlap, but they are evaluated at
  different moments against different readings, and one of the assistant's forms
  is settled by the assistant looking at a picture rather than by any machine.
  Reconciling them is its own problem and its own change; this one puts the list
  in place that makes the overlap visible.
- **A second run path for the assistant.** Its program is run by the IDE on the
  user's own machine as part of checking an answer. Running is therefore expected
  to be the first declared exemption, not the first shared operation.
- **The assistant outside the browser.** Its store reaches the IDE's state, the
  user's stored settings and the live machine as module singletons. Freeing it is
  a larger change that this one does not need and does not begin.
- **Reconciling how a run's outcome is reported** between the two callers. They
  describe a finished run in different terms because they observe it at different
  moments; that only becomes worth settling once the assistant runs headlessly.
- **Serving a third caller.** The declaration is shaped so one could be added
  without a second reshaping, and nothing here adds one.
- **Changing the command line's grammar.** Its operations, options, streams and
  exit codes are inherited, not revisited; argument parsing stays hand-written
  because a schema-generated command line would lose the ergonomics the existing
  guarantees describe.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `headless-cli`: gains the guarantee that every operation the assistant can
  perform is reachable from the command line, that an asymmetry between the two
  is declared rather than accidental, and the measurements of a run that were
  previously reachable only from inside the IDE.
- `ai-assistant`: gains the guarantee that what it can do is the same set the
  command line offers, derived from one declaration rather than maintained
  beside it, together with the operations it has been missing — and that where a
  provider cannot be given tools at all, that is a property of the provider
  rather than an operation quietly going missing.

## Impact

**Both callers, and neither's behaviour where it already worked.** The command
line's existing operations are already pure functions returning data with their
formatting kept separate, which is the shape an operation needs; moving them is
mechanical and their output does not change. The assistant's four tools already
split the same way. What changes is where the list lives and who is held to it.

**The emulator pane.** It is the only thing that folds a frame's measurements
into a run's profile today, so a headless caller cannot ask for one. That
folding has to come out into a module of its own before the command line can
report a measurement. The derivations over those measurements are already pure
and are not affected.

**The assistant's cached prefix.** Its tool definitions must stay byte-identical
across a conversation or the cache behind them is lost. Deriving them from a
shared list means adding an operation changes that block, which costs every
conversation one cache miss after a release. That is accepted: the property the
cache depends on is stability within a conversation, which is kept and pinned.
What must not happen is gating an operation by leaving it out of the list, so
availability is decided when a call arrives rather than by what was offered.

**`test-a-program-from-the-command-line`, which is in flight and unimplemented.**
It teaches the command line an assertion vocabulary the assistant does not
share. Applying it before the vocabularies are reconciled lands a parity
violation on the day the guarantee arrives, so the two changes need sequencing:
either the assertion question is settled first, or that change's vocabulary
enters the exemption table as a declared, dated asymmetry rather than an
accidental one.

**No new dependency.** Everything here is a rearrangement of code already in the
tree, and there is no licence to check.
