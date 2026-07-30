Depends on `add-keyword-capability-domains`. Do not start until that change has
landed — the capability axis and the grouped rendering this fills in come from it.

## 1. The guidance data model

- [x] 1.1 Create `docs/reference/data/domain-guidance.ts` with the
      `DomainGuidance` and example interfaces: `to`, `domain`, `support`,
      `summary`, `instead?`, `example?`, `reachFor?`
- [x] 1.2 Document in the file header that cells are keyed by (target, capability)
      and never by pair, that `summary` renders only in the additions brief and
      `instead` only in a lost group, and that completeness is enforced from the
      real diff rather than a hand-maintained list
- [x] 1.3 Export the empty `domainGuidance` array so the crosscheck can be
      written before the cells exist

## 2. Crosscheck invariants

Write these before authoring the cells, so authoring is guided by failures.
Model on `docs/reference/data/porting-crosscheck.test.ts`.

- [x] 2.1 Create `docs/reference/data/domain-guidance-crosscheck.test.ts`
      asserting structural validity: every `to` is a real page slug, every
      `domain` is in the vocabulary, no duplicate `(to, domain)`
- [x] 2.2 Loss completeness — for each target, compute the union of `mustReplace`
      domains across all seven other sources using the real `diffKeywords` with
      the real `keywordEquivalences`, and require a cell with a non-empty
      `instead` for each
- [x] 2.3 Gain completeness — every domain the target has at least one command in
      requires a cell with a non-empty `summary`
- [x] 2.4 No dead cells — fail on a cell whose domain is neither present on the
      target nor losable into it, and on an `instead` where nothing is losable
- [x] 2.5 Example rule — `example` present exactly when `support !== 'full'` and
      `instead` is present
- [x] 2.6 `reachFor` pinning — each name is a real row on that target's page and
      carries that domain
- [x] 2.7 `support` honesty — `'none'` requires zero target commands in that
      domain, `'full'` requires at least one
- [x] 2.8 Budgets — `MAX_SUMMARY_CHARS = 160`, `MAX_INSTEAD_CHARS = 200`,
      `MAX_EXAMPLE_LINES = 5`, `MAX_EXAMPLE_LINE_CHARS = 40`,
      `MAX_CAPTION_CHARS = 60`, `MAX_REACH_FOR = 4`
- [x] 2.9 Add the bridge assertion to `porting-crosscheck.test.ts`: every
      `substitutions` keyword that exists on some page carries a capability

## 3. Author the advice

Two passes, so completeness goes green before the examples exist. Derive every
claim from the dialect's real capabilities, never from memory.

- [x] 3.1 Pass one, `summary` + `support` for every mandatory cell (tests 2.3,
      2.7 green)
- [x] 3.2 Pass one, `instead` for every mandatory cell (tests 2.2, 2.4 green)
- [x] 3.3 Pass two, worked examples for `support: 'none'` cells
- [x] 3.4 Pass two, worked examples for `support: 'partial'` cells (test 2.5
      green)
- [x] 3.5 Add `reachFor` names where they help, and delete any cell the no-dead-
      cells check rejects

## 4. Diff and guidance logic

- [x] 4.1 Add an optional `domainGuidance` input and a `domains` output map to
      `composeGuidance` in `docs/.vitepress/theme/dialectCompare.ts`, keeping it
      pure — the table is passed in, not imported
- [x] 4.2 Extend `domainSections` to order groups `none` → `partial` → `full`,
      falling back to canonical vocabulary order, replacing the placeholder
      ordering from the preceding change
- [x] 4.3 Add `CapabilityBrief` and `capabilityBrief(newlyAvailable, to, guidance,
      order)` — per-domain count, `reachFor` names filtered to those the source
      lacks with a fallback to the bucket's first names, ordered by size of gain
- [x] 4.4 Confirm `diffKeywords`, `falseFriendsBetween`, `diffEscapes`,
      `renameMap` and `operatorNames` are unchanged, and `dialectCompare.ts`
      still imports only types from the data layer
- [x] 4.5 Add `dialectCompare.test.ts` cases for `composeGuidance`: the `domains`
      map is target-scoped, and empty when `domainGuidance` is omitted
- [x] 4.6 Add `domainSections` ordering tests: `none` above `partial` above
      `full`, ties by vocabulary order, a group with no cell still renders its
      commands
- [x] 4.7 Add `capabilityBrief` tests: per-domain counts, `reachFor` preferred
      over first-N, a `reachFor` name the source already has is dropped, ordered
      by gain, empty input yields `[]`
- [x] 4.8 Confirm every pre-existing test in `dialectCompare.test.ts` still
      passes unmodified

## 5. Rendering

- [x] 5.1 Render each lost-capability group's `instead` once for the group, above
      or below the comma run of command names — never repeated per command
- [x] 5.2 Render the group's worked example as a captioned code block where one
      exists
- [x] 5.3 Confirm `summary` is not rendered in lost groups and `instead` is not
      rendered in the brief, so neither side reads twice
- [x] 5.4 Replace the "Newly available" list with the capability brief: one line
      per capability with its gain count, `summary`, a few named commands and a
      link into the target's reference page
- [x] 5.5 Delete the `newlyAvailableList` truncation state; leave the other lists
      on `useTruncatedList` unchanged
- [x] 5.6 Update the summary line so the additions are reported as capability
      areas rather than a command count

## 6. Quality gates

- [x] 6.1 `npm run typecheck`
- [x] 6.2 `npm test`
- [x] 6.3 `npm run lint`
- [x] 6.4 `npm run format:check` (or `npm run format` to fix)
- [x] 6.5 `npm run docs:build`
- [x] 6.6 `npm run e2e:chromium -- e2e/porting-guidance`
- [x] 6.7 `npx openspec validate --changes`
- [x] 6.8 Manual check via `npm run docs:dev` at `/docs/reference/compare`:
      `cpc → zx80` (every group leads with what the ZX80 cannot do and carries a
      worked example), `zx80 → cpc` (147 gained must read as at most thirteen
      brief lines, not a list), and `zx81 → zxspectrum` (near pair — advice must
      stay short where little is lost)
- [x] 6.9 Confirm the whole page for a distant pair is still readable in a few
      minutes, which is the requirement this change is measured against
