## Why

The assistant is told about the machine it is writing for in a few pages of
hand-written prose. That prose paraphrases, by hand, facts the project already
holds in structured and tested form — and it paraphrases them lossily. Where a
machine has sixty-five commands, the prose names about twenty in a sentence.
Whatever it omits, the assistant supplies from memory, and for the more obscure
machines its memory is mostly of a more famous relative.

Worse, the two descriptions have drifted apart by construction: the structured
language-rule facts were themselves written from this prose, so the project now
maintains two accounts of every machine and tests only one of them.

The result is the failure the assistant makes most: code using a command this
machine does not have, spelled the way a different machine spells it.

> Sequenced after the verification changes, which make the effect of this one
> measurable rather than assumed.

## What Changes

**This change begins by moving the reference data within reach.** That data, and
the comparison logic built on it, currently live in the documentation project and
the application cannot import them. Nothing about them is documentation-specific:
the comparison logic describes itself as framework-free, and the tables are plain
data. They move to a location both projects can import — the direction the
dependency already runs, since parts of the documentation site already import
from the application and never the reverse — and the documentation site is
rewired to the new home with byte-identical output.

That move is a pure refactor and carries no requirement of its own, which is why
it is a task group here rather than a change of its own: it is motivated entirely
by what follows it, and reviewing the two together is what makes the move's
purpose legible.

- Each request SHALL carry the machine's real command set — every command,
  function and operator the machine actually accepts, with its usage and its
  behaviour — rather than a prose summary of some of them.
- It SHALL carry the machine's language rules and hardware figures from the same
  tested source as the porting guidance, so the assistant and the guide cannot
  disagree about what a machine does.
- Where a machine lacks a common capability, the assistant SHALL be told what to
  do instead, including the worked examples already written for exactly that
  purpose — advice written about the target machine, and correct whatever the
  user is coming from.
- The hand-written prose SHALL be reduced to what the structured data cannot
  carry: the machine's quirks, its performance advice, and how to lay out a
  reply. The command lists and the rules now stated from data are removed from
  it, so there is one account of each machine rather than two.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: the existing "The assistant knows the machine and the program"
  requirement strengthens — what a request carries about the machine becomes the
  machine's real, tested language definition rather than a description of it,
  and is the same for every machine rather than varying with how much prose
  someone wrote.

## Impact

- Roughly twelve thousand lines of reference data and comparison logic change
  location, unchanged apart from import paths, together with the cross-check
  tests that pin them against the real dialects. The documentation site's
  TypeScript project widens to resolve the new home; the comparison page, the
  reference pages and the two scaffold-generation scripts are rewired. Producing
  identical documentation output is the test of whether the move succeeded.
- The application must not pay for data it is not using: it reaches this material
  through a deferred import at the point of use, following the pattern already
  used to load AI provider backends on demand. Nothing outside the assistant
  needs it.
- Every request's machine description is composed from the shared reference data
  rather than read from a per-machine string. It is composed from fixed data, so
  it stays identical between requests for the same machine — which is what the
  conversation caching depends on.
- This is expected to **improve** caching rather than cost anything: the current
  description is small enough that on most machines it falls under the provider's
  minimum cacheable size and is silently re-sent in full every turn. A fuller
  description crosses that threshold, after which it is re-read at a fraction of
  its cost.
- All thirteen per-machine prose descriptions are edited down.
- Whether this helps is **measured, not asserted**: with runtime verification in
  place, a program that fails to run is an observable signal, so the effect of
  thinning each machine's prose can be checked rather than hoped for.
- No dialect, emulator or machine-boundary changes.

## Non-goals

- **Removing the per-machine prose.** It carries real knowledge no table holds,
  and is thinned rather than deleted.
- **Rewriting or correcting the reference data while moving it.** It moves and is
  consumed as it stands; any inaccuracy found on the way is a separate change.
- **Changing what the documentation site shows.** Identical output is the test
  that the move was clean.
- **Reconciling the two per-command descriptions the move exposes.** Each command
  is described twice — tersely for editor autocomplete, richly for the reference
  pages — and the two are pinned to each other only by name. This change uses the
  fuller one; merging them is later work.
- **Changing the reply format**, the apply actions, or anything about how
  generated code lands in the editor.
- **Porting.** Guidance for moving a program between machines is
  `hand-the-port-report-to-the-assistant`.
