## Context

The porting guide compares two BASIC dialects by diffing their reference tables
by keyword name. The diff logic (`docs/.vitepress/theme/dialectCompare.ts`) is
deliberately pure and SSG-safe: it imports docs data types only, never `src/`.
The rendering component consumes it and caps every list at 10 entries.

The problem this change addresses is measured, not hypothetical. Across the 56
ordered dialect pairs, "keywords to replace" ranges from 4 to 147 entries and
"newly available" from 3 to 147; the median pair is roughly 40 and 40. Because
both lists are alphabetical and capped at 10, what a reader sees first is
uncorrelated with what matters.

Current data shape: `ReferenceEntry` is `{ name, kind, syntax, description,
tag? }`. `kind` is `command | function | operator` for the eight BASIC pages and
`instruction | directive` for the two per-CPU assembly pages, which share the
same interface and the same `ReferenceTableData` container.

The escape-code tables already solved an adjacent problem: `EscapeTableData`
carries `categories: {id,label}[]`, `EscapeEntry.category` references one, and
`EscapeTable.vue` renders filter chips with a `?cat=` deep link. That pattern is
the model here, with one deliberate difference (see Decisions).

Architecture background is in `docs/contributing/architecture.md`.

**Dialect/MachineEmulator seam: no impact.** This change is confined to the docs
site (`docs/`). No file under `src/` is modified, no dialect or emulator is
touched, and the existing crosscheck that pins reference rows to the real
dialect keyword tables keeps working unchanged.

## Goals / Non-Goals

**Goals:**

- Give every BASIC keyword row a capability domain, from a vocabulary shared
  across all eight dialects, enforced at compile time.
- Group the "keywords to replace" list by that domain and order groups so the
  capabilities the target lacks entirely come first.
- Preserve every existing counting and truncation guarantee, at both list and
  group level.
- Leave `diffKeywords` — and therefore the operator exclusion, the rename
  mapping, and every existing test of them — untouched.
- Let readers filter a reference page by domain.

**Non-Goals:**

- Per-capability porting advice and worked examples, and replacing "Newly
  available" with a capability brief. Both depend on this axis and land in
  `add-capability-porting-advice`.
- Categorising the assembly reference tables.
- Folding multi-word keyword variants (`ON BREAK` ×4, `SPEED` ×4).
- Any change to `src/`, to the docs sidebar, or to the set of pages.

## Decisions

### A shared closed vocabulary, not per-table categories

The escape tables declare their categories per table. That works there because
an escape table is only ever rendered on its own page. The porting comparison
sets one machine's domains against another's, so `graphics` must denote the same
capability on all eight pages; a per-table vocabulary would make the comparison
meaningless. The vocabulary therefore lives once, in
`docs/reference/data/domains.ts`, as a `const` array (the source of both the
union type and the canonical render order).

Thirteen domains: `control-flow`, `data`, `numeric`, `strings`, `text-screen`,
`graphics`, `colour`, `sound`, `input`, `storage`, `memory-hardware`,
`program-editing`, `error-handling`.

*Alternatives considered.* A `timing` domain was rejected and folded into
`control-flow` — `AFTER` and `EVERY` are "run this subroutine later", and five
rows do not earn a group. Merging `colour` into `graphics` was rejected: "this
machine has no colour at all" is a distinct porting job and is already its own
row in the facts table, so merging would recreate exactly the undifferentiated
bucket this change exists to remove. A `syntax` or `punctuation` escape-hatch
domain was rejected because it turned out to be unnecessary — see below.

### Operators get domains too

All 101 `kind: 'operator'` rows are categorised. Inspection showed operator rows
are already semantically described rather than syntactically: a ZX80 `;` is a
PRINT separator (`text-screen`), an Atom `:` is bitwise exclusive-OR
(`numeric`), an Atom `?` is byte indirection (`memory-hardware`). Every one has
a real home, so the "every BASIC row has a domain" rule needs no exemption
clause — which keeps both the type and the reference-page filter coherent.

Operators still never appear in the diff: `diffKeywords` excludes them before
bucketing, and that is unchanged.

### Optional on the shared type, required by a narrowed one

`ReferenceEntry` is shared with the assembly tables, so `domain` cannot simply be
required. But a bare optional field would leave an 805-row authoring job checked
only by a test — and a missed row would then be a silently undomained entry.

Resolved by narrowing rather than by splitting the type:

```ts
interface ReferenceEntry { …; domain?: KeywordDomain }
interface BasicReferenceEntry extends ReferenceEntry { domain: KeywordDomain }
interface BasicReferenceTableData extends ReferenceTableData { entries: BasicReferenceEntry[] }
```

Each of the eight BASIC data files changes its one annotation to
`BasicReferenceTableData`; the two assembly files keep `ReferenceTableData`.
Because the narrowed type is assignable to the wide one, every consumer —
`ReferenceTable.vue`, `compare.md`, `dialectCompare.ts`,
`keyword-crosscheck.test.ts`, `porting-crosscheck.test.ts` — compiles unchanged.
A missing domain now fails `npm run typecheck`, which is the strongest available
guard on the largest risk in the change.

*Alternative considered:* a separate `BasicReferenceEntry` type not extending
`ReferenceEntry`. Rejected — it would force every shared consumer to be
generic or duplicated.

### Grouping layers on top of the diff, and stays pure

`diffKeywords` keeps its signature, bucket shape and name ordering, so its
existing tests pass verbatim. Two new pure functions sit above it:

- `groupByDomain(entries, order)` → buckets in the supplied order, empty domains
  omitted, within-bucket name order preserved, any undomained row in a trailing
  bucket rather than silently dropped.
- `domainSections(mustReplace, to, order)` → the render-ready groups.

Both take the domain order **as an argument** rather than importing it, exactly
as `composeGuidance` already takes `pairNotes` and `falseFriends`. That keeps
`dialectCompare.ts` importing nothing but types from the data layer, preserving
its node-testable, SSG-safe property.

Group ordering in this change is the canonical vocabulary order. The
"capabilities the target lacks entirely first" ordering the spec requires is
derived from whether the target has any entry in that domain at all — data this
change already has. The follow-up change refines the tiering with authored
`support` values without changing the contract.

### Per-group truncation needs a new helper

`useTruncatedList` is a setup-time factory over one fixed list, instantiated
seven times in `DialectCompare.vue`. The number of groups varies per pair, so it
cannot be reused as-is. `useTruncatedGroups(pairKey, limit)` keeps a single
expanded-set keyed by domain and clears it on the same `pairKey` watch, giving
each group the same reset contract. The five other lists keep `useTruncatedList`
and `TRUNCATE_LIMIT = 10` untouched; groups use a smaller limit since there are
now several of them on screen.

Headings show `entries.length` for the group and the untouched
`keywordDiff.mustReplace.length` for the section, so the counting guarantee
holds at both levels.

### The reference-page filter ships last

`?domain=` mirrors the escape pages' `?cat=` line for line: one field in
`deepLinkParams.ts`, one argument on `filterEntries`, one chip row in
`ReferenceTable.vue` computed like the existing `presentKinds`. Rendering it only
when some entry carries a domain means the two assembly pages hide it
automatically, with no special-casing.

It is sequenced last because it is the only piece touching all ten reference
pages, so its blast radius stays isolated from the porting-guide work. It has no
spec delta: no capability spec covers reference-page filtering (the one
reference-documentation requirement, in `dialect-toolchain`, concerns version
tags on keywords).

## Risks / Trade-offs

- **805 hand-assigned domains, and no test can prove `SPEED INK` is `colour`
  rather than `text-screen`.** → Write the three tie-break rules into the header
  of `domains.ts` (what the keyword does *on this machine* wins over what the
  word usually means; reading hardware → `memory-hardware`, changing the screen →
  `text-screen`/`graphics`/`colour`; multi-word variants take their head
  keyword's domain). Commit one dialect file at a time so each is reviewable.
  Add a test asserting the union of domains used across the eight tables equals
  the vocabulary, which catches both a dead domain and a drifted one.

- **The compile-time guard only bites once a file is re-annotated.** → Do the
  annotation change and that file's row edits in the same commit, so
  `npm run typecheck` is meaningful at every commit rather than only at the end.

- **A second chip row could make the reference-page header control-heavy** (it
  already has a search box, kind chips and a legend). → Render domains as a
  distinct, smaller second row, and keep `?domain=` orthogonal to `?kind=`
  (AND-combined in `filterEntries`) so neither resets the other.

- **Grouping changes what a reader sees first, and some pairs have a group with
  one entry.** → Accepted. A one-entry `sound` group that says the target has no
  sound is more useful than that keyword buried at position 94 of an alphabetical
  list. Empty domains are omitted entirely, so no group is ever noise.

- **Multi-word variants still inflate group counts.** → Accepted and named as a
  non-goal. Grouping already places them adjacent, which contains the visual
  noise; folding them would renegotiate the counting guarantee this change is
  strengthening. Recorded as a possible follow-up.

## Migration Plan

Pure additive docs-site change with no persisted state, no API and no
dependency on user data, so there is nothing to migrate and rollback is a
revert. The three stages are independently shippable:

1. **Vocabulary, type narrowing and categorisation** — data only, no user-visible
   change. Eight commits, one per dialect file.
2. **Grouped rendering** — the user-visible fix for the ordering defect.
3. **`?domain=` filter** — independent of stage 2; may land any time after 1.

Each stage passes `npm run typecheck && npm test && npm run lint &&
npm run format:check`, plus `npm run docs:build` and
`npm run e2e:chromium -- e2e/porting-guidance`.

## Open Questions

- The exact per-group truncation limit (6 is the working assumption against the
  existing 10 for flat lists). Best settled by looking at the rendered page for
  the `cpc → zx80` extreme rather than decided up front.
- Whether the trailing "undomained" bucket should render at all once the type
  makes it unreachable for BASIC pages. Keeping it costs little and is a safety
  net; it can be dropped if it proves dead.
