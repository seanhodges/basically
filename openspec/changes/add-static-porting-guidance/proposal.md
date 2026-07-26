## Why

The Compare dialects page tells a reader what differs between two machines'
BASIC, then offers to explain the port only if they are inside the IDE's docs
drawer **and** have configured their own AI API key — so the readers most likely
to need porting help, those browsing the published documentation, never see the
offer at all. The explanation is also re-derived (and re-billed) on every press,
even though its input is entirely fixed documentation data.

Worse, the comparison currently misreports the most common differences of all:
because it matches keywords by exact spelling, it claims the ZX Spectrum lacks
`GOTO` (it spells it `GO TO`) and that Commodore BASIC lacks `CLEAR` (it is
`CLR`).

## What Changes

- **New:** the comparison carries its own porting guidance — a shared guide to
  what any BASIC port involves, plus per-machine notes for the machine being
  ported *to*. This is part of the page, so it needs no API key, works on the
  published documentation site, and works offline.
- **New:** the keyword comparison recognises that machines spell the same
  command differently. Equivalent spellings are reported as a rename to carry
  out (`GOTO` → `GO TO`) rather than as a command that must be replaced and an
  unrelated command newly gained.
- **New:** individual entries in the keyword comparison carry the porting advice
  for that command where the target machine has some, so the guidance sits
  against the command it concerns.
- **BREAKING:** the "Explain porting with AI" action is removed. Its answer is
  now always present on the page, for every reader, without a key.
- Unchanged: "Convert my program to \<machine\>" remains an AI action inside the
  IDE, because it works on the user's own program rather than on documentation.

## Capabilities

### New Capabilities

- `porting-guidance`: comparing two machines' BASIC and telling the user what
  moving a program between them involves — which commands to rename, replace or
  drop, what the target machine does differently, and the machine-independent
  parts of any port. Available to every reader without configuration.

### Modified Capabilities

None. The removed AI action is not described by any existing requirement; the
`ai-assistant` spec's guarantee that "every other IDE capability works without
a key" is strengthened by this change rather than altered.

## Impact

- **Docs site** — `docs/reference/compare.md` and its
  `DialectCompare` component gain the guidance sections; the comparison logic
  in the docs theme learns keyword equivalences. New porting content is
  hand-authored alongside the existing per-dialect reference data, and pinned
  by a new crosscheck test in the same style as the four that already guard
  that data.
- **IDE app** — the docs drawer drops the message handler behind the removed
  action; the convert handler stays.
- **No dependencies, no `src/dialects/` changes, no emulator changes.** No
  new runtime cost: the guidance ships as ordinary documentation data, which
  the docs offline cache already covers.

## Non-goals

- Automatic program translation. The page explains a port; it does not perform
  one. Converting a program remains the AI action.
- Exhaustive per-command coverage. Porting notes are written where they help;
  commands without one still appear in the comparison as they do today.
- Per-machine-pair essays. Guidance is authored per target machine and shared
  across every source machine, so adding a machine stays cheap.
- Covering machine variants that share a documentation page. The comparison
  continues to work at the level of documented BASIC dialects, not individual
  registered machines.
- Changing what the comparison itself computes, beyond recognising equivalent
  spellings.
