## Context

`escapeSections` groups the control codes a port must replace by the source
page's own categories, in the order that page declares them. It deliberately does
*not* rank a category by whether the target covers it, and its comment says why:
category ids are page-scoped — `colour` and `cursor` are Commodore categories,
while the Spectrum files `{INK n}` under `control` — so matching ids across pages
would report "nothing like it on the target" for codes the target plainly has.

That reasoning is sound and this change does not disturb it. What it adds is the
missing addressability: a shared vocabulary of *classes* that the page-scoped
categories map onto, so guidance can be authored per (target, class) exactly as
`domain-guidance.ts` is authored per (target, capability).

`docs/contributing/architecture.md` covers the `src/reference/` purity rule that
keeps `compare.ts` node-testable and SSG-safe; the guidance table is passed in as
an argument, like `domainGuidance` and `pairNotes` already are.

## Goals / Non-Goals

**Goals**

- Say, per group, whether the target can express that class of code at all.
- Author the advice once per class, not once per code.
- Keep every page's own categories and their order.

**Non-Goals**

- Sorting groups by verdict, per the proposal's non-goals.
- Inferring the verdict by matching category ids across pages.
- Any change to which codes are reported or how they are narrowed.

## Decisions

### Impact on the Dialect seam: none

This is entirely within the reference data and the pure comparison. No dialect,
charset or emulator is touched.

### The class lives on the category, not on the row

Each page's `categories` entries gain a class from a shared vocabulary. The
alternative — a class per `EscapeEntry` — would be more precise for the grab-bag
categories (the CPC files 32 codes under `control`) and costs roughly 250 hand
authored classifications across nine pages, against roughly 40 for the
categories. Precision buys little here because the guidance is prose per class:
one sentence about what a CPC's control codes become on a Spectrum is what the
reader gets either way.

The mapping is close to the identity for most pages, which is the point — the
classes that matter are the ones where two pages call one thing by two names:

```
  page          category        class
  commodore     key-graphics ─┐
  zx81 / zx80   graphics      ├─▶ block-graphics
  atom          graphics      │
  trs80         graphics     ─┘

  commodore     colour       ─┐
  bbc           text-colour   ├─▶ colour
  bbc           graphics-colour ┘

  zxspectrum    udg          ───▶ user-defined-graphics
  every page    raw          ───▶ raw-byte
```

### Guidance keyed by (target page, class), like the capability guidance

`DomainGuidance` is keyed `(to, domain)` and never by pair, because a
target-anchored note is equally correct arriving from any source. The same holds
here: "the Spectrum has no key-graphics characters; redraw them as UDGs or block
graphics" is true whichever Commodore machine you left. So the new table is
`(to, class) → { support, instead?, example? }` with the same three support
levels the capability guidance uses.

Keyed by page slug rather than machine id, as `domain-guidance.ts` is: machines
sharing a page share a charset, and the one place they do not
(`EscapeEntry.onlyOn` for the Spectrum's 48K-only UDG rows) is about which rows
exist, not about what the class becomes.

### Completeness enforced from the real diff, not from a list

`domain-guidance-crosscheck.test.ts` walks every ordered pair, takes the real
diff, and requires a cell for every capability some source can lose into that
target — and rejects a cell no pair can reach. The escape guidance gets the same
treatment, over `diffEscapes` + `escapeSections`. This is what keeps the table
honest as pages change: a category added to a page with no cell for its class
fails, and a cell for a class nothing loses is deleted rather than left to rot.

### `escapeSections` takes the guidance as an argument

The signature grows a `class` on each section and an optional guidance cell,
resolved by the caller in the same way `capabilitySections` resolves its
`domainGuidance` by `toSlug`. Nothing is imported into `compare.ts` that is not
already there — the module stays pure and the docs build stays safe.

Order is untouched: the sections still come back in the source page's declared
category order. The verdict is rendered against each group rather than used to
sort it, so a reader scanning for "what can I not do at all" reads the badges,
and a reader working through the codes reads them in the order the source page's
author intended.

### Scale of the authoring, honestly

Nine pages as targets, roughly fourteen classes, sparse — comparable to the
existing capability guidance table, and gated by the same completeness check. The
crosscheck tells the author exactly which cells are missing, so the work is
enumerable rather than open-ended.

## Risks / Trade-offs

- **A grab-bag category gets a coarse verdict.** The CPC's 32 `control` codes
  span several jobs and get one class. → Accepted: the guidance is prose per
  class, and a per-row classification is a much larger change for a marginally
  sharper sentence. The class vocabulary is a closed list, so a page that
  genuinely needs to split a category can split the category.
- **The table could drift from the pages.** → The completeness crosscheck is
  derived from the real diff, which is the mechanism that keeps the capability
  guidance from drifting today.
- **More prose on an already long section.** → One line per group, not per code;
  the section shrinks in effect, because a reader can skip the classes the target
  covers.
