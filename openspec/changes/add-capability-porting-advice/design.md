## Context

`add-keyword-capability-domains` gives every BASIC keyword row a capability
domain from a shared vocabulary, groups the "keywords to replace" list by it, and
names each group's commands as a compact comma-separated run rather than a
detailed row each. It deliberately ships no prose: groups are ordered by whether
the target has any command in that capability, and carry no advice.

This change supplies the advice that grouping was for, and applies the same
compactness rule to the other side of the page.

Current state of the two things it touches:

- The only actionable advice is `PortingFacts.substitutions` in
  `docs/reference/data/facts.ts` — 28 notes across eight targets, keyed by a
  single keyword the target lacks.
- "Newly available" is a flat alphabetical list of 3–147 target commands, capped
  at 10 by `useTruncatedList`.

Architecture background is in `docs/contributing/architecture.md`.

**Dialect/MachineEmulator seam: no impact.** Confined to `docs/`; no file under
`src/` changes, and the crosscheck pinning reference rows to real dialect keyword
tables is untouched.

## Goals / Non-Goals

**Goals:**

- Every capability a port can lose carries advice for the target machine, with a
  worked example where that machine's support is absent or partial.
- Advice is authored once per (target, capability) and shown once per group.
- Reading load grows with capabilities affected, not with commands lost.
- "Newly available" becomes at most thirteen lines with a route into the target's
  own reference page.
- Completeness is derived from the real diff, never from a hand-maintained list.

**Non-Goals:**

- Before/after examples, pair-specific advice, runtime generation, feeding the
  advice to the AI assistant, or removing the existing 28 `substitutions`.
- Any change to `diffKeywords` or to which commands land in which bucket.

## Decisions

### Keyed by (target, capability) — not by pair

Eight targets × thirteen capabilities is at most 104 cells. Fifty-six ordered
pairs × thirteen capabilities would be 728, and no one could keep them true.
Target-anchored advice composes with every source: "the ZX81 has no pixel
graphics, rescale to the 64×44 block grid" is equally correct arriving from a
CPC, a BBC or a Spectrum.

The cost is that a worked example shows the target's own idiom rather than a
before/after diff. That is acceptable because the source side is already on the
page — the lost commands are named in the same group — and it is recorded as an
explicit non-goal so it is not re-litigated in review.

### `summary` and `instead` do different jobs, and never appear together

The natural temptation is to give each cell both "what this machine offers here"
and "what to do instead", and print both. That doubles the reading load for no
gain, because the two sides of the page want different things:

| Rendered where | Field used | Why |
| --- | --- | --- |
| A lost-capability group | `instead` (+ `example`) | The reader has commands that will not work. They need the action. |
| The additions brief | `summary` (+ `reachFor`) | The reader has lost nothing. They want to know what the machine can now do. |

So a cell carries both fields but each is rendered in exactly one place. A group
shows one or two sentences plus at most a few example lines; a brief line shows
one sentence plus a few command names.

```ts
interface DomainGuidance {
  to: string;                    // target page slug
  domain: KeywordDomain;
  support: 'full' | 'partial' | 'none';
  summary: string;               // rendered in the additions brief only
  instead?: string;              // rendered in a lost group only
  example?: { caption: string; code: string[] };
  reachFor?: string[];           // ≤4 real rows on the target page, in this domain
}
```

### Completeness is computed from the real diff

Which cells are mandatory is derived, not listed:

- `instead` is required for `(to, domain)` iff some source dialect loses a
  command of that domain into that target — computed by running the real
  `diffKeywords` across all seven other sources. Using the real function means
  the rule inherits the operator exclusion and the rename mapping for free, so a
  rename group added later cannot silently leave a cell mandatory-but-dead.
- `summary` is required iff the target has at least one command in that domain,
  or the loss rule above holds.
- The mirror matters as much: a cell for a capability that is neither present on
  the target nor losable into it is a **failure**, not a harmless extra. Without
  that, the table rots into prose describing situations that cannot arise.

Expect roughly 100 of the 104 cells to be mandatory (with the CPC's 191 commands
and the BBC's 121 as possible sources, nearly every capability is losable into
nearly every target), and 35–45 mandatory examples, concentrated on `zx80`,
`zx81`, `atom`, `trs80` and `commodore`.

*Alternative considered:* a hand-maintained list of required cells. Rejected —
it is exactly the thing that goes stale when a keyword's domain is corrected.

### Honesty invariants, not just presence invariants

A cell can be complete and still lie. Three checks prevent the common ways:

- `support: 'none'` requires the target to have **zero** commands in that domain;
  `'full'` requires at least one. A cell claiming a machine has no sound while
  its own page lists `SOUND` fails.
- Every `reachFor` name must be a real row on that target's page **and** carry
  that domain — the same "prose cannot outlive the table" guarantee the existing
  crosschecks give.
- `example` is required exactly when `support !== 'full'` and `instead` is
  present, so the machines that need a worked example most cannot quietly ship
  without one.

### Budgets tighter than the existing prose

`porting-crosscheck.test.ts` already enforces a mechanical reading budget
(`MAX_NOTES = 6`, `MAX_NOTE_CHARS = 220`, `MAX_SUBSTITUTION_CHARS = 160`). This
table is read inline against a group the reader is already scanning, so it is
capped harder: `MAX_SUMMARY_CHARS = 160` (one sentence), `MAX_INSTEAD_CHARS = 200`,
`MAX_EXAMPLE_LINES = 5`, `MAX_EXAMPLE_LINE_CHARS = 40`, `MAX_CAPTION_CHARS = 60`,
`MAX_REACH_FOR = 4`. The point of the change is a guide that is shorter and
clearer, so the budget is the design, not a formality.

### Its own file, and its own crosscheck

Not `facts.ts` — that file is half-crosschecked against `src/dialects/` and
adding a thirteen-cell prose matrix per dialect would make it unauditable. Not
`porting.ts` — that holds cross-dialect pair and spelling data, not
target-anchored prose. `domain-guidance.ts` also carries the only BASIC code
samples in the docs data layer, which is reason enough for a dedicated crosscheck
file.

### The additions brief replaces a list, and needs no truncation

At most thirteen lines for any pair, against up to 147 rows today, so the
`newlyAvailableList` truncation state is deleted rather than adapted. `examples`
prefers the authored `reachFor` names filtered to those the source actually
lacks — so a command the reader already has is never offered as new — falling
back to the first names in the bucket. Lines order by size of the gain, so the
biggest new capability reads first.

The counting guarantee is preserved trivially: each line states its own gain and
the section states the full total, with nothing hidden.

### Purity is preserved

`capabilityBrief` and the extended `domainSections` take the guidance array and
the domain order **as arguments**, exactly as `composeGuidance` already takes
`pairNotes` and `falseFriends`. Only types are imported from the data layer, so
`dialectCompare.ts` stays node-testable and SSG-safe. `composeGuidance` gains an
**optional** input and one output field, so its existing tests compile unchanged.

## Risks / Trade-offs

- **~100 prose cells and ~40 examples is the bulk of the work, and prose drifts.**
  → Every cell is pinned to the real diff and the real reference rows by the
  crosscheck; the "no dead cells" and `support`-honesty checks fail on drift
  rather than letting it accumulate. Author in two passes (all `summary` +
  `instead` first, then examples) so the completeness tests go green early.

- **Examples are BASIC source in a data file, unexecuted.** → Cap them at five
  short lines so they stay illustrative rather than programs, and keep them to
  idioms already demonstrated by the dialect's bundled samples where possible.
  Running them is out of scope; the length cap is what keeps the claim modest.

- **"Newly available" loses per-command descriptions.** → Accepted and intended.
  That information is on the target's own reference page, which is searchable and
  deep-linkable, and the brief links into it per capability. The old section
  duplicated that page badly to deliver one bit per command.

- **Support ordering could reshuffle groups a reader has learned.** → It only
  refines the ordering the preceding change already established (target-has-none
  first), and both derive from the same data, so a group never moves far.

## Migration Plan

Additive docs-site change; no persisted state, no API, nothing to migrate, and
rollback is a revert. Two stages:

1. **The guidance table and per-group advice** — authored data, `composeGuidance`
   wiring, support-based ordering, and rendering. Ships the advice.
2. **The additions brief** — depends only on stage 1's `summary` and `reachFor`.

Both stages pass `npm run typecheck && npm test && npm run lint &&
npm run format:check`, plus `npm run docs:build` and
`npm run e2e:chromium -- e2e/porting-guidance`.

## Open Questions

- Whether `reachFor` is worth carrying for capabilities the target supports
  fully, where the brief may be enough on its own.
- Whether the worked example belongs above or below the comma run of lost
  commands. Best judged on the rendered `cpc → zx80` page rather than decided up
  front.
