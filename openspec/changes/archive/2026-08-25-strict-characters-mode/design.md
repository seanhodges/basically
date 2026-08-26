## Context

The base change (`declare-letter-case-per-machine`) declares each machine's
letter-case facts and adds a detection that answers one question for an open
program: which characters would this machine store as something else? It reports
the answer as a count in the status bar and changes nothing else.

This change adds the setting that turns that same answer into a refusal, and the
input behaviour that follows from it. It is deliberately small: the hard parts —
what counts as a converted character, why notation is exempt, how a Commodore
set switch is honoured — are settled and implemented there.

The seam and the layering are as described in
`docs/contributing/architecture.md`.

**Seam impact: none.** Nothing is added to `Dialect` or `MachineEmulator`. The
setting is a user preference threaded as a parameter, and the keyboard change
happens at the render seam, not in layout data.

## Goals / Non-Goals

**Goals:**

- A reader can opt into being held to what the target machine can store.
- The count the status bar shows and the errors the editor raises come from one
  detection, so they cannot disagree.
- On a machine with no lower case the editor stops producing what it would only
  have to refuse.
- Nothing becomes unreachable on any keyboard.

**Non-Goals:**

- Changing the default, or anything at all while the setting is off.
- A severity on `TokenizeError`. Strict findings block, deliberately.
- Re-deriving the detection, the notation exemption, or the set-switch
  allowance.
- Encoding upper case correctly after a Commodore set switch.

## Decisions

### Escalate the base change's detection; do not re-derive it

The alternative was to make strict mode "stop folding" and let each dialect's
charset raise its existing *"this machine has no such character"* error. That is
tempting — the message, the position and the per-dialect wording all already
exist — but it would answer a subtly different question from the one the status
bar answers, through a different code path, on sixteen dialects. The two would
drift, and the IDE would once again report two answers about one program. That
is the precise failure the base change exists to end.

So strict mode consumes the detection as a diagnostic source: same walk, same
notation rule, same set-switch allowance, one place to be wrong. The base change
keeps that detection a pure function of dialect and source for this reason.

Consequence: the detection must carry positions, not just a count. That is worth
stating as a requirement on the base change's implementation rather than
discovering it here.

### Strict findings are ordinary errors, and they block

Errors gate the Run action and share links (export gates on fatal errors only,
so a strict finding will not stop it). A setting whose whole purpose is to
refuse should refuse; making it produce a diagnostic that does not block would
require giving `TokenizeError` a severity and revisiting four gates, which is
explicitly out of scope and is recorded as an open question on the base change.

The honest consequence, written into the proposal as breaking: with the setting
on, a program that builds today can stop building, and stop running and sharing
with it.

### Forcing upper case needs the one hook that also catches paste

The editor has three input seams and they do not converge: the typed-input
handler never sees a paste, and the on-screen keyboard emits no key events at
all. The existing per-machine input rule — the one expanding a short keyword
spelling on `.` — solves this by implementing itself at each of three seams, and
its own comment records why it had to.

Rather than a fourth copy of that, this uses a transaction filter: the only hook
every write path passes through, including both paste routes. There is none in
the codebase today, so this introduces the pattern. It is held in a compartment
so the setting can change without rebuilding the editor, following the existing
input-mode compartment, because the editor is otherwise rebuilt only when the
dialect changes.

It must leave alone what the reader did not type as letters — the graphics
palette's inserts, and the inside of notation — which is the same distinction
the detection's unit walk already makes.

*Alternative considered:* uppercasing in the charset instead, so the bytes come
out right regardless. Rejected — the bytes already come out right; folding
happens at encode time today. This is an authoring change, whose entire value is
that the source shows what the machine will hold.

### Hiding the shift key: at the render seam, keyed on what a key *is*

Two traps decide this, and both are quiet:

- **A key drawn like a shift is not necessarily the shift.** At least one
  machine's control key — the only way to interrupt a running program there — is
  styled as a shift while being a different modifier. The rule keys off the
  modifier a key *is*, never off how it is drawn.
- **The symbol page toggle rides the shift flank.** On machines with a second
  symbol page, that page's toggle is welded onto whichever bottom-row key is a
  modifier. Hiding it outright makes characters unreachable from the on-screen
  keyboard on two machines — and no test would notice, because the symbol test
  presses the machine's keys directly and never asks whether a user could reach
  them.

So the keycap is hidden only outside the symbol mode. Inside it the key presses
nothing on the machine by construction, serving purely as the page toggle.

Hiding happens where rows are handed to the renderer, substituting a spacer of
the same width rather than removing the key from layout data. The layout keeps
its column arithmetic, and the layers keep their indices — which are positional
and load-bearing, so a removed layer would silently mis-assign every later
legend. Every existing geometry and per-dialect layout test stays meaningful.

### The reachability test the codebase does not have

Nothing today asserts that a user can *reach* the symbols a machine offers. The
symbol test presses `emits` on a booted machine; the geometry test asserts
symbols do not appear outside the symbol mode. Both would stay green while a
character became untypeable. This change adds the missing assertion, for every
machine with a further symbol page, under the setting.

## Risks / Trade-offs

- **Strict mode will refuse programs that run correctly today** — imported
  listings, anything the assistant writes in lower case, and possibly bundled
  samples. → It is off by default and refusing is its purpose. Sweep the bundled
  samples and the per-dialect assistant guidance under the setting before
  shipping, and fix or excuse each by name.
- **Hiding a key can make a character unreachable with every test still green.**
  → The mitigation is the reachability test above; it is the reason that task
  exists rather than being folded into the hiding task.
- **A transaction filter is a new pattern here, and it sees every transaction.**
  → Gate it on user input, keep it in a compartment, and test all four write
  paths. A filter that is wrong is wrong on every keystroke, so its test is not
  optional.
- **Forcing case and refusing case are redundant on the same machine** — with the
  editor forcing upper case, the error should rarely fire from typing. → That is
  intended: the error remains for text that arrived another way (a paste while
  the setting was off, an imported program, an assistant response), and the two
  together mean the reader neither types nor keeps what the machine cannot hold.
- **The setting is global, not per-machine**, so it follows a reader who switches
  to a machine with lower case. → On such a machine it does nothing, which is the
  correct behaviour and needs no scoping.

## Migration Plan

Ships off; the entire surface is dormant until a reader turns it on. No stored
format, project or share link changes.

Depends on `declare-letter-case-per-machine` landing first, for the letter-case
declaration and the detection. If that change is cut down, the one part this
needs is its detection and the positions it carries — not the input parity work,
and not the Commodore glyph bank.

Rollback is the setting itself: turning it off restores current behaviour
exactly.

## Open Questions

- Whether the setting should be remembered per machine rather than globally, if
  readers turn out to want it on for a ZX81 and off for a BBC. Global is the
  cheaper starting point and matches every other editor setting.
- What the sample sweep finds. If a bundled sample for an uppercase-only machine
  is refused, the question is whether to fix the sample or to accept that strict
  mode disagrees with a shipped listing — worth knowing before the setting is
  advertised.
