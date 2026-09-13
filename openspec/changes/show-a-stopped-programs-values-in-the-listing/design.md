## Context

Three things are already true, and together they decide almost all of this.

The server that answers about a listing holds no machine. It is started as its
own conversation, is given the program's text and nothing else, and never
constructs a session or loads an emulator. The conversation that holds a machine
is a different one, started separately, and the editor holds both.

A stopped program's values are readable through that other conversation, as a
whole-machine report of what every variable holds, taken without spending the
machine's frames. It answers while a program is stopped and while one is being
played, and a machine that cannot report says so rather than failing.

And the protocol's way of showing a value in a listing does not ask for values.
It asks where to show something and what to look it up as, and the editor
resolves each one against the stopped session it already has. That is the whole
reason this is possible without either conversation learning about the other.

See `docs/contributing/architecture.md` for the split between the server's
protocol wiring and its answers, and for how the editor helpers are shared with
the browser IDE.

## Dialect / MachineEmulator seam

**No impact.** No new member, and no new obligation on any machine. The server's
part is read from the program's text and the bound dialect's naming rules. The
values come from a machine through the reading that already exists.

What the seam does decide is who can take part, and it decides it with two
answers that are already separate: whether a machine can be stepped, and whether
it can report what its variables hold. Neither implies the other, and this change
adds no third capability — it consumes both.

## Goals / Non-Goals

**Goals.** Let a value be shown beside the name it belongs to, on the machines
that can be stopped and can say what they hold. Make the name reported the one
the machine will actually answer to. Say clearly when a machine cannot take part.

**Non-Goals.** Reading variables (settled elsewhere), serving values from the
language server, evaluating expressions, writing values back. Each is in the
proposal.

## Decisions

### The server reports positions and names; it never reports a value

Of the ways the protocol allows a value to be shown, one has the server supply
the text itself, one has the editor look a name up in the stopped session, and
one has the machine evaluate an expression.

The first is impossible here without giving the language conversation a route to
somebody's running machine — a second way to reach a machine that already has
one, per editor window, with the machine's own rule of one to a conversation to
reconcile. The third is impossible because these machines evaluate no
expressions; a stopped program here answers what its variables hold, not what an
arbitrary expression comes to.

So the choice is made by what exists rather than by preference: the server says
where each variable is written and what to look it up as, and the editor resolves
it against the session it is already stopped on.

This has a property worth stating, because it is the reason the arrangement is
sound rather than merely possible: **the language conversation learns nothing
about the machine, and the machine conversation learns nothing about the
listing.** Each stays what it is.

### The name reported is the one the machine holds, not the one written

A machine that keeps only the first characters of a name cannot report the name
in the listing — it does not have it. It holds two characters, and two characters
is what it answers with. A lookup under the written spelling would find nothing,
on every such machine, and would find nothing *silently*: an empty answer is
indistinguishable from a program that has not reached that variable yet.

So the name reported is the one the machine will answer to, which the server
already computes as the identity a name has on the bound machine — the reading
that also decides which spellings are one variable. The written spelling stays
where it is, in the listing.

This is the single decision most likely to be got wrong by someone reading only
the protocol, because the protocol calls the field a variable name and the
listing plainly contains one. It is worth a test per machine family rather than a
test per machine.

### Whether case matters follows the machine

Most of these ROMs fold case and report what they hold in upper case; a few tell
`a` from `A` and hold both. The report says which, per document, from the bound
machine's rules — it is not a constant, and it is not the editor's guess.

### An array is reported as the machine names it

A machine reports an array as a single entry under the array's name, with a
shape and a preview of its contents rather than an element-by-element list. A
listing writes an array element with an index. The name reported for a use of an
array is therefore the array's, not the element's, and what the user sees beside
it is what the machine says about the array.

Showing an individual element's value would require asking the machine a question
it does not answer. That is the expression evaluation this change is not doing.

### A machine that cannot take part says so

Two ways to be unable: a machine that cannot be stepped never stops on a line, so
the question never arises. A machine that can be stopped but cannot report what
it holds is the case that matters, because there the program *is* stopped, the
listing *is* in front of the user, and nothing appears.

That is already how it is answered elsewhere — a caller reading the variables of
a machine that cannot report them is told that this machine cannot report them,
rather than being refused — and this follows it rather than inventing a second
wording.

### Where the boundary sits in the specs

Reading what a machine holds belongs to playing a machine, not to stopping one:
the debugging capability covers stopping, stepping, continuing and saying where a
program is, and says nothing about variables. This change adds a requirement to
the language server and leaves that boundary where it is. It consumes both
answers; it moves neither.

## Risks

- **The lookup name is the whole change.** Get it wrong and the feature is
  silently empty on nine of the registered machines while appearing to work on
  the rest. It is checked per machine family, on a real reading, not by
  inspection.
- **An editor asking for this on every stop, on a long listing**, asks about the
  part it is showing rather than the whole program. The server's answer is built
  from a reading it performs anyway.
- **A value shown beside a name is read at the moment it is taken**, of a machine
  that may be moving. That is already specified for reading a played machine's
  variables and is not a fault; a stopped program does not have the problem at
  all.
