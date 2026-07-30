## Why

The porting guide tells a reader which commands they lose, but not what to do
about losing them. The only actionable advice on the page is the 28
`substitutions` notes spread across all eight target dialects — the ZX81 has two,
the CPC has two. Porting CPC → ZX81 the guide reports 131 lost commands and
offers advice on two of them.

Per-command advice cannot close that gap: across the 56 dialect pairs there are
thousands of lost-command instances, and nobody can write or maintain a note for
each. Per-capability advice can. Eight targets × thirteen capabilities is about a
hundred cells, each one small, and every cell composes with any source dialect.

The other half of the page has the opposite problem. "Newly available" lists up
to 147 target commands in a flat alphabetical run capped at 10 — a worse copy of
the target's own reference page, which already lists every keyword searchably.
Its only unique information is one bit per command ("new to you"), and it spends
a whole section delivering it.

The preceding change `add-keyword-capability-domains` gives every keyword a
capability domain. This change is what that axis was for.

## What Changes

- **Advice for every capability a port can lose.** A new authored table keyed by
  (target dialect, capability) saying what to do when the program being ported
  needs something the target has no command for, plus a short worked example of
  how that job is done on the target machine where its support is absent or
  partial.
- **Advice renders against its capability group**, not repeated per command — one
  or two sentences and at most a few lines of example per group.
- **Groups order by how badly the target is placed.** Capabilities the target
  lacks entirely come before those it supports partially, before those it has
  under other names. This replaces the placeholder ordering from the preceding
  change.
- **"Newly available" stops being a list.** It becomes at most thirteen lines —
  one per capability, each with a count, a one-sentence summary of what the
  machine offers there, and a few named commands linking into the target's own
  reference page.

## Non-goals

- **Before/after examples.** Advice is anchored to the target machine, not to the
  ordered pair: 56 pairs × 13 capabilities is 728 cells that could never be kept
  true. An example shows the target's own idiom; the source side is already on
  the page, named in the same group.
- **Generating advice or examples at runtime.** Everything is static authored
  data compiled into the page, so the guidance keeps working with no assistant
  configured, no API key and no network.
- **Feeding the advice to the AI assistant.** The convert-program hand-off keeps
  its current free-text request; wiring structured porting data into the prompt
  is separate work.
- **Replacing the existing per-command `substitutions`.** Those 28 notes stay and
  keep rendering against their own command, now beneath their group's advice.
- **Changing which commands land in which bucket.** The diff is untouched.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: adds a requirement that every capability a port can lose
  carries advice for the machine being ported to, with a worked example where
  that machine's support is absent or partial; changes the reporting of what the
  target adds from a list of commands to a per-capability summary with a route
  into the target's full reference; and extends the brevity requirement so that
  guidance grows with the number of capability areas affected rather than with
  the number of commands.

## Impact

**Depends on** `add-keyword-capability-domains`, which supplies the capability
axis and the grouped rendering this change fills in. It cannot be implemented
before that one lands.

**New files**

- `docs/reference/data/domain-guidance.ts` — the (target, capability) advice
  table, roughly a hundred cells.
- `docs/reference/data/domain-guidance-crosscheck.test.ts` — completeness,
  honesty and length invariants, modelled on the existing
  `porting-crosscheck.test.ts`.

**Modified**

- `docs/.vitepress/theme/dialectCompare.ts` — `composeGuidance` gains the advice
  table as an optional input; `domainSections` gains support-based ordering; new
  `capabilityBrief` for the additions summary. All pure, all taking their data as
  arguments.
- `docs/.vitepress/theme/components/DialectCompare.vue` — per-group advice and
  example rendering; "Newly available" replaced by the brief; the
  `newlyAvailableList` truncation state deleted.
- `docs/reference/data/porting-crosscheck.test.ts` — one bridge assertion that
  every `substitutions` keyword carries a capability, so per-command and
  per-capability advice cannot disagree about which group a command belongs to.

**Not affected**

No `src/` changes and no impact on the Dialect/MachineEmulator seam — this is
confined to the docs site. No new dependencies. The escape-code difference lists,
the facts table, the rename and false-friend sections and the AI convert
hand-off are all unchanged.

**Risk**

Roughly a hundred authored prose cells and around forty worked examples are the
bulk of this change, and prose can drift from the tables it describes. Mitigated
by pinning every cell to the real diff: the crosscheck derives which cells are
mandatory from the actual comparison rather than from a hand-maintained list, and
fails on a cell that describes a capability nothing can lose.
