## Context

`docs/contributing/architecture.md` describes the `Dialect` seam and the paths
that turn a listing into bytes; this document says where the declaration is read
and why it is read in exactly one place.

The precedent is `src/dialects/binaryDirective.ts`: a leaf module that recognises
`#BIN` at the start of a physical line, carries its payload, and imports nothing
but a type. It is deliberately dialect-agnostic — "what counts as a valid record
is the dialect tokenizer's business; this module only carries the bytes". A
machine declaration is the same shape carrying a different fact, and this change
follows it closely enough that the two should read as siblings.

The difference that matters: `#BIN` is gated by `Dialect.supportsBinaryLines` and
is understood by two tokenizers. A machine declaration is universal, and there
are twenty-one tokenizers. That difference is what decides the design below.

## Goals / Non-Goals

**Goals:**

- A listing can state which machine it is for, in one line, named the way
  machines are named everywhere else.
- Every path that turns text into bytes honours it identically, because they all
  go through one reader.
- It costs no bytes and no RAM budget on any registered machine.
- A wrong declaration is a reported problem at a position, not a silent
  misreading.

**Non-Goals:**

- **Teaching the tokenizers about it.** Twenty-one implementations of one rule is
  twenty-one chances to get it wrong, and the ones that got it wrong would fail
  silently by tokenizing a declaration into a program.
- **A general metadata header.** The moment it carries two facts it needs a
  grammar, and a listing stops being a listing.

## Decisions

### Impact on the Dialect / MachineEmulator seam

None. No member is added, widened or reinterpreted, and no tokenizer changes.
The declaration is read and removed *above* the seam, so `Dialect.tokenize` and
`Dialect.lint` receive what they receive today: a listing with no declaration in
it. That is the whole reason for putting it above the seam rather than in
`types.ts`.

### The declaration is read once, above the seam

A physical line matching the directive is recognised, validated, and removed
before the source reaches `Dialect.tokenize` or `Dialect.lint`. Every caller —
running, exporting, sharing, checking, the byte count behind the RAM budget, the
assistant's own tokenizing, the language server — goes through the same helper.

`refer-to-blocks-by-name` reaches this conclusion independently for `@name`
substitution and states the risk exactly: "A missed substitution point is
invisible until it matters. If export substitutes and share does not, a program
runs for its author and fails for a recipient." The same sentence is true here
with "declares" for "substitutes". The two changes want one point, not two:
whichever lands first builds it, and the second adds its pass to it.

*Alternative rejected: let each tokenizer skip the line.* It is how `#BIN` works,
and it works there because two dialects opt in and the rest are guaranteed never
to see one. A universal directive has no such guarantee, and a tokenizer that
forgot would turn a declaration into a syntax error or, worse, into bytes.

### Removing a line shifts the ones after it

The tokenizer reports problems against the source it was given, which is the
source with the declaration removed — so every line after the declaration is
reported one line early unless the mapping is carried back. The reader returns
the stripped source together with what is needed to map a reported position back
onto what the user typed, and the helper applies it before anyone sees a problem.

This is the same obligation `refer-to-blocks-by-name` takes on for columns within
a substituted line, one axis over; if that change has landed, this extends its
mapping rather than adding a second one.

### The declaration wins over ambient configuration and loses to an explicit instruction

| Told by | Beats the declaration? |
| --- | --- |
| An option on this one invocation (`-m`) | Yes |
| A workspace or editor setting | No |
| The IDE's active target | Not applicable — see below |
| Inference from the listing | No |

The distinction is deliberate and worth stating because it looks inconsistent at
a glance. Ambient configuration describes a *place* — a workspace, a project —
and the file is more specific than the place it sits in. An option given on one
invocation describes an *intention* for that invocation, and is more specific
than anything written in the file: a caller asking to check a ZX81 program
against a Spectrum is asking a real question, and refusing it would be obtuse.

### In the IDE the target and the declaration are one fact

The IDE has an active target already, and a document that also declares one has
two answers to the same question. Rather than pick a winner, the two are kept
identical: opening a document that declares a machine switches the target to it,
and switching the target rewrites the declaration if the document has one.
Switching is already the point where the user is asked what happens to their
code, so this rides on a conversation that exists rather than adding one.

A document with no declaration keeps none — this change never writes a
declaration into a program that had none, because doing so would put a diff in
front of every user who opened an old file.

### Syntax

`#MACHINE <machine>` at the start of a physical line, leading whitespace allowed,
the keyword matched case-insensitively, the machine named as `findMachine`
already accepts it (id, case-insensitive id, or display name). One per listing.

Deliberately the `#BIN` shape: same sigil, same position, same
whitespace-tolerance, so the two read as one family rather than two conventions.
`REM`-based alternatives were considered and rejected — a `REM` is a real BASIC
line that costs real bytes on the machine, which is precisely what a declaration
must not do.

Problems it can have, each reported at its line and column: a machine that is not
registered, a missing machine name, and a second declaration. A second
declaration is an error rather than a last-wins rule because two disagreeing
declarations mean the author is confused about which is in force, and picking one
silently is how that confusion survives.

## Risks / Trade-offs

**A path that forgets to read the declaration behaves differently from the rest**
→ the whole design is one helper and no per-tokenizer knowledge, and the test is
registry-driven across every machine and every bundled sample rather than written
against one path.

**Position mapping is the kind of bug nobody reports** — a problem underlined one
line off looks like a slightly wrong linter, not a broken feature → asserted
directly: a program with a declaration and a known bad line reports that problem
at the line the user sees it on, on every registered machine.

**The declaration is a new thing in a file format other tools may read** → it is
one line beginning with `#`, which no dialect's BASIC can begin a line with, and
a machine never sees it. A tool that does not understand it sees a line it can
ignore, which is what `#BIN` already asks of the same tools.

**Two in-flight changes want the same above-the-seam point** → stated in both
proposals rather than left to be discovered. The risk is only that both build one;
the mitigation is that whichever is applied second reads the other's design
first, which the tasks say to do.
