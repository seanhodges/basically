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
- The narrowing states how many differences it is holding back, and a control
  reports them — phrased as a "show", like every other control on the page.
- Opening the guide from inside the IDE selects the machine the program is
  written for as the machine being ported *from*, unless the link names one.
  Changing that selection away from the program's machine turns the narrowing
  off, because the vocabulary no longer describes the language being compared.
- The guide gains an entry point in the IDE. It has none today, so a narrowing
  that only exists in the IDE would be unreachable.
- A standalone visit to the docs site is unchanged in every respect.

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
  to the open program's vocabulary, for stating what the narrowing holds back,
  for tying the narrowing to the machine the program is written for, and for
  opening on that machine. Extends the existing "controls are phrased as
  showing" requirement to name the narrowed view among the things a comparison
  opens on.

## Impact

- **New**: an app-side analyser deriving a program's distinct keywords and
  escape bytes; a pure filter over the already-computed difference buckets on
  the docs side.
- **Modified**: the IDE↔docs message contract (two new messages); the
  comparison component's computeds, controls and summary sentence; the
  `Dialect` seam gains one descriptive flag naming which dialects' tokenizers
  match keywords greedily across spaces; the shared charset-probe table gains a
  per-unit parse already present in every family.
- **Tests**: colocated unit tests for the analyser and the filter, the
  message-contract test, and an end-to-end scenario under
  `e2e/porting-guidance/`. The existing keyword and escape cross-checks come to
  guard the wire contract as well as the docs tables.
- **No new dependencies.**
