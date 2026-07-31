## Context

The porting guide is a docs-site page: `docs/reference/compare.md` supplies the dialect list and the
unchanging prose, `DialectCompare.vue` renders the comparison, and the diff itself lives in the pure,
node-testable `docs/.vitepress/theme/dialectCompare.ts`. The data it compares is hand-authored per
dialect under `docs/reference/data/` and pinned to `src/` by the crosscheck tests. That split is the
constraint this change works within: the diff module imports only types from the data layer (which is
what keeps it SSG-safe and testable), so anything new it needs — orderings, guidance tables — arrives
as an argument, exactly as `domainSections` already takes its `order` and `domainGuidance`.

The change is entirely inside the docs site. It does not touch `src/`, and so has **no impact on the
`Dialect` / `MachineEmulator` seam** — the only `src/` contact the guide has at all is the
`postMessage` conversion hand-off, which is out of scope. See `docs/contributing/architecture.md` for
the app-side architecture this sits beside.

## Goals / Non-Goals

**Goals:**

- Stop notation differences between two hand-authored reference pages reaching the reader as
  behaviour changes, without suppressing real differences.
- Tell the reader what changed about a command, not just how each page writes it.
- Give control codes the treatment the commands to replace already have: grouped by what they do,
  worst-covered first, nothing hidden.
- Order the page so the sections a porter acts on come before the ones they look things up in.
- Report the one language fact the generic guidance leans on hardest and the comparison cannot
  currently answer: floating point or integer-only.

**Non-Goals:**

- Re-notating `docs/reference/data/cpc.ts` (see the proposal's non-goals).
- Any change to what the reference pages themselves report, or to `domain-guidance.ts` coverage.
- Any `src/` change, including the AI conversion hand-off.

## Decisions

### Compare usage strings by shape, not by text

`keywordChanged` currently compares `normaliseSyntax(a.syntax)` with `normaliseSyntax(b.syntax)`,
which collapses whitespace only. Add a second, coarser normalisation — the usage string's *shape* —
and compare on that: every `<placeholder>` and every lowercase identifier becomes one marker, while
punctuation, brackets, `,`/`;`/`#`, and literal uppercase keywords are kept. `ABS(<number>)` and
`ABS(n)` both become `ABS(#)` and stop being reported; `SIN <number>` vs `SIN(n)` (the Sinclair
machines take the argument unparenthesised) and `LIST [<line>][-[<line>]]` vs `LIST [<line>]` still
differ, and are still reported.

*Alternative considered: normalise the data instead*, by rewriting the CPC page onto the `<…>`
convention. It fixes the cause rather than the symptom, but it is ~189 hand-authored usage strings
churned to fix a comparison artifact, and it would not help the next page authored in a third style.
The shape comparison is the durable fix; the re-notation stays available as its own tidy-up.

*Alternative considered: keep every row and sort the real ones first.* Rejected — a list whose tail
is known noise is a list the reader learns to skip entirely.

### Classify the change rather than showing two usage strings

`KeywordChange` gains a `change` field, derived in `dialectCompare.ts` from the same two entries the
diff already holds: `kind` when the keyword changes category (a function becomes a command),
`parens` when the shapes differ only by parenthesisation, and `arguments` otherwise. The component
renders a short phrase from it above the two usages. Deriving it in the pure module rather than the
template keeps it testable and keeps the template declarative, matching how `domainSections` already
computes `support` for the component to style.

### Group control codes with the machinery that already groups commands

`EscapeEntry` carries a `category`, and each escape table declares its ordered `categories` — the
same shape `domainSections` consumes for keywords, with a per-table vocabulary instead of a shared
one. Add `escapeSections` alongside `domainSections`, grouping each side's codes in its own table's
category order and labelling groups from that table. Render as a heading, a count, and a compact run
of spellings, exactly like a capability group.

Unlike `KeywordDomain`, the category vocabularies are **not** shared: `colour`, `cursor` and
`key-graphics` are Commodore categories, while the Spectrum files its `{INK n}` under `control`.
So `escapeSections` deliberately does *not* rank a category by whether the other dialect covers it,
the way `domainSections` ranks a capability — matching ids across two page-scoped vocabularies would
report "nothing like it on the target" for codes the target plainly has. Each table's own order is
already editorially meaningful (Commodore leads with colour and cursor and ends with the raw-byte
escape), so that order is what the groups use, and the promotion of absent categories is left to the
keyword grouping, where the vocabulary really is shared.

Consequence: control codes lose their per-code description in the comparison, and gain "all of them
are shown". That is the trade the spec already made for the commands to replace, for the same reason
— the reader acts per category, and each dialect's escape-codes reference page (already linked from
the comparison) carries the per-code detail. It also removes the 97-row alphabetical dump on every
Commodore pair, whose visible first ten were keycap block graphics.

*Alternative considered: keep the rows and their descriptions, capped, but sort by category.*
Rejected — the cap is what buries the colour and cursor codes; sorting inside a ten-row window does
not fix it.

### One capability, one account: fold the additions brief into the domain sections

`domainSections` groups what the port loses by capability; `capabilityBrief` groups what it gains by
the same vocabulary. Both read the same `DomainGuidance` cell — `instead` for one, `summary` for the
other — and across the 56 ordered pairs they name the same capability 340 times against 154 + 154
one-sided mentions. So the reader is told about strings, or graphics, twice, in two sections with
unrelated content between them, and the gains section is the tallest thing on the page.

They become one builder returning, per capability: the lost entries, the authored `instead` and its
example, and the gained count/`summary`/`reachFor`. Ordering keeps the existing support tiers
(`none` → `partial` → `full`) for capabilities that lose something, with gain-only capabilities
after them — a capability you lose nothing from is news, not work.

*Alternative considered: keep two sections and cross-link them.* Rejected: a link between two places
that describe the same capability is a worse answer than one place that does.

The per-capability "Full `<target>` reference →" link goes with the merge: it repeated up to
thirteen times, and the panel has carried a reference link for both dialects since the section
reorder.

### Renames belong with the other commands that exist on both machines

A rename and a usage change share a premise — the command is on both machines, written differently —
and renames are 1–4 per pair against a section costing 5% of the page, because each row carried a
sentence of description lifted from the reference page. A reader doing a search and replace does not
need it. They become a compact run of `FROM → TO` pairs at the head of the merged section, in the
shape the parenthesis rule already uses.

### Control codes: what you lose is work, what you gain is browsing

The gains column duplicated the losses column's machinery for codes the program being ported never
used. It becomes one line — count, category count, and the link to the target's control-code
reference — leaving the grouped losses the full width. This is the treatment gains already get for
keywords, applied to codes.

### Reorder in the template, and lift the prose out of the middle

Section order is presentation: move the `<section>` blocks in `DialectCompare.vue` and move the
`<slot />` above the picker panel. The slot currently renders between the fact table and the
target guidance, which is why the unchanging prose splits the pair-specific sections. Nothing in the
diff module changes.

### Add the numeric fact as one row, authored per dialect

`PortingFacts` gains `numberHandling` (a sentence: floating point, or integer-only with its range) as
a required field, so a dialect cannot be added without answering it — the same discipline the other
structural fields follow. It renders as a fact row like the rest. `facts-crosscheck.test.ts` pins it
to the representative dialect in `src/dialects/` as it does for `freeRamBytes` and the rest.

## Risks / Trade-offs

- **Shape normalisation hides a real difference** → The markers keep bracket structure, argument
  count and literal keywords, so only placeholder *naming* collapses; the unit tests pin both
  directions (a naming-only pair that must collapse, a parenthesisation and an argument-count pair
  that must not). Measured effect: bbc→cpc 72 rows → 47, cpc→trs80 62 → 35, and pairs between
  same-notation pages are unaffected.
- **Control codes lose their descriptions in the comparison** → Accepted, consistent with the
  commands to replace; the per-code detail is one link away and that link is already on the page.
- **Reordering moves a section a returning reader knows the position of** → Mitigated by the
  linkable headings and the on-this-page row added in the same change.
- **Merging sections loses the per-capability gains link and the renames' descriptions** → Both are
  one click away on the reference pages the panel links, and neither is something a port acts on.
- **A merged capability section is longer per group** → It is shorter in total (one account instead
  of two) and each group is still a heading, a run of names and a couple of sentences; the ordering
  keeps the capabilities the target cannot reproduce first, so length accrues below the fold.
- **`numberHandling` is a required field** → It is authored for all eight dialects here, and the
  crosscheck fails loudly rather than silently defaulting if a ninth arrives without it.
