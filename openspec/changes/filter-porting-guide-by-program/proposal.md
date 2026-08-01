## Why

The porting guide reports every difference between two machines — on a
dissimilar pair that is dozens of commands across thirteen capability domains
plus a whole escape-code table. A reader with a program open in the IDE needs a
small fraction of it: the commands and control codes their own listing uses.
Everything else is text to read past before the work starts.

The guide already renders inside the IDE and already exchanges messages with it,
but it knows nothing about the program. Its own copy assumes otherwise — the
control over what the target adds reads "…that the program has not used" while
having no idea what the program used.

## What Changes

- The comparison learns the distinct keywords and control codes of the program
  currently open in the IDE, and narrows the differences it reports to those:
  the commands to rewrite, the commands to rename, the commands whose usage
  differs, the same-word-different-meaning warnings, and the control codes to
  replace.
- What the target adds, the language and hardware fact table, and the prose
  guidance are **not** narrowed. The first is already about what the program did
  not use; the other two describe rules that apply to any program.
- The narrowing states how much of the program it recognised and how many
  differences it is holding back, and a control reports them — phrased as a
  "show", like every other control on the page.
- The program is read **as the language being ported from**, not as the machine
  the IDE currently has selected. Changing the source machine re-reads the
  program in that language rather than abandoning the narrowing.
- A program with errors that stop it being read at all counts as no program, and
  the full comparison returns. Findings that do not stop it being read — advice
  about what a real machine would refuse at the keyboard, or about variables —
  leave the narrowing alone, so ordinary half-finished editing does not keep
  discarding it.
- Opening the guide from inside the IDE selects the machine the program is
  written for as the machine being ported *from*, unless the link names one.
- **Keeping a program on a machine that will not run it offers the guide**, for
  exactly that port. That is the moment a port begins, and the guide has no entry
  point in the IDE today.
- How it is offered follows how much room there is. Where the documentation
  would take the whole screen it is *not* opened — burying the program the user
  just chose to port would be perverse — and a brief, dismissable indication
  points at how to open it; opening the documentation afterwards by any means
  lands on that comparison. Where it takes only part of the screen it opens
  straight away, with no indication.
- A comparison belongs to the program it was offered for. Loading a different
  program forgets it, and closes the documentation if that comparison is what is
  on screen — documentation showing anything else is left where the user put it.
  Editing the program, including applying an assistant's rewrite of it, is the
  same program and changes nothing.
- The guide always says where it stands: narrowed, or not narrowed and what would
  narrow it. A standalone visit therefore gains one line inviting the reader to
  open their program in the IDE; nothing else about it changes.

## Non-goals

- Narrowing the language & hardware fact table, or the "before you start" prose
  bullets. Free RAM, variable naming and number handling apply to a program
  whatever keywords it uses.
- Narrowing what the target adds. That is already governed by its own control
  and is, by definition, about what the program did not use.
- Changing the AI conversion hand-off, or feeding the program's vocabulary to
  the assistant.
- Reporting *where* in the program a keyword is used, or linking a difference
  back to a line. The guide narrows what it reports; it does not become a
  navigator.
- Byte-exact analysis of abbreviated or crunched entry beyond what the editor's
  own keyword matching already resolves.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: adds requirements for narrowing the reported differences
  to the open program's vocabulary, for reading the program as the language
  being ported from, for treating an unreadable program as no program, for
  always saying whether the comparison is narrowed and what would narrow it, for
  offering the comparison when a program is kept on a new machine, for offering
  rather than imposing it where the documentation would cover the whole screen,
  for tying a comparison to the program it was offered for, and for opening on
  the machine the program is written for. Extends the existing
  "controls are phrased as showing" requirement to name the narrowed view among
  the things a comparison opens on.

## Impact

- **New**: an app-side analyser deriving a program's distinct keywords and
  escape bytes; a pure filter over the already-computed difference buckets on
  the docs side.
- **Modified**: the IDE↔docs message contract (two new messages); the
  comparison component's computeds, controls, notice and summary sentence; the
  target-switch confirmation's "keep my code" branch, which now offers the
  comparison; the store gains a docs topic scoped to one program, dropped
  wherever the "a different program became active" counter is already bumped;
  the docs drawer gains a transient indicator, the first in the app; the
  `Dialect` seam gains one descriptive flag naming which dialects' tokenizers
  match keywords greedily across spaces; the shared charset-probe table gains a
  per-unit parse already present in every family.
- **Tests**: colocated unit tests for the analyser and the filter, the
  message-contract test, and an end-to-end scenario under
  `e2e/porting-guidance/`. The existing keyword and escape cross-checks come to
  guard the wire contract as well as the docs tables.
- **No new dependencies.**
