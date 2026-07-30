## 1. Vocabulary and type

- [ ] 1.1 Create `docs/reference/data/domains.ts` exporting `KEYWORD_DOMAINS` as
      a `const` array of the 13 domains in render order, and the derived
      `KeywordDomain` union type
- [ ] 1.2 Write the three tie-break rules into the `domains.ts` header comment:
      what the keyword does on *this* machine wins over what the word usually
      means; reading a hardware value is `memory-hardware` while changing the
      screen is `text-screen`/`graphics`/`colour`; multi-word variants take
      their head keyword's domain
- [ ] 1.3 Add optional `domain?: KeywordDomain` to `ReferenceEntry` in
      `docs/reference/data/types.ts`, with a comment explaining it is optional
      only because the interface is shared with the assembly references
- [ ] 1.4 Add `BasicReferenceEntry` and `BasicReferenceTableData` to `types.ts`,
      narrowing `domain` to required

## 2. Categorise the eight BASIC reference tables

One commit per file. Change the file's type annotation to
`BasicReferenceTableData` and add a `domain` to every row in the same commit, so
`npm run typecheck` stays meaningful at each step. Operator rows are categorised
too (a PRINT separator is `text-screen`, a bitwise operator is `numeric`, an
indirection operator is `memory-hardware`).

- [ ] 2.1 `docs/reference/data/zx80.ts` (47 rows)
- [ ] 2.2 `docs/reference/data/zx81.ts` (65 rows)
- [ ] 2.3 `docs/reference/data/atom.ts` (73 rows)
- [ ] 2.4 `docs/reference/data/commodore.ts` (92 rows)
- [ ] 2.5 `docs/reference/data/zxspectrum.ts` (93 rows)
- [ ] 2.6 `docs/reference/data/bbc.ts` (121 rows)
- [ ] 2.7 `docs/reference/data/trs80.ts` (123 rows)
- [ ] 2.8 `docs/reference/data/cpc.ts` (191 rows)

## 3. Data invariants

- [ ] 3.1 Extend "every entry is structurally complete" in
      `docs/reference/data/reference-data.test.ts` to assert each entry's
      `domain` is in `KEYWORD_DOMAINS`, naming the offending keyword in the
      assertion message
- [ ] 3.2 Add a suite-level test that the union of domains used across all eight
      BASIC tables equals `KEYWORD_DOMAINS`, so a dead or drifted domain fails
- [ ] 3.3 Add the mirror assertion to `docs/reference/data/asm-reference.test.ts`:
      assembly entries carry no `domain`

## 4. Grouping logic

- [ ] 4.1 Add `DomainBucket` and `groupByDomain(entries, order)` to
      `docs/.vitepress/theme/dialectCompare.ts` — supplied order honoured, empty
      domains omitted, within-bucket name order preserved, undomained rows in a
      trailing bucket
- [ ] 4.2 Add `DomainSection` and `domainSections(mustReplace, to, order)`,
      ordering groups so domains the target has no entry in come before those it
      does, then by canonical vocabulary order
- [ ] 4.3 Confirm `diffKeywords`, `composeGuidance`, `falseFriendsBetween`,
      `diffEscapes`, `renameMap` and `operatorNames` are unchanged, and that
      `dialectCompare.ts` still imports only types from the data layer
- [ ] 4.4 Add `groupByDomain` tests to
      `docs/.vitepress/theme/dialectCompare.test.ts`: honours supplied order
      rather than alphabetical, omits empty domains, preserves within-bucket
      order, trailing bucket for an undomained entry, empty input yields `[]`
- [ ] 4.5 Add `domainSections` tests: a domain absent from the target sorts above
      one present in it, ties fall back to vocabulary order, and a group with no
      match still renders its entries
- [ ] 4.6 Confirm every pre-existing test in `dialectCompare.test.ts` still
      passes unmodified

## 5. Grouped rendering

- [ ] 5.1 Create `docs/.vitepress/theme/domainMeta.ts` with `DOMAIN_ORDER` and
      `DOMAIN_META` (label + icon paths per domain), mirroring the existing
      `kindMeta.ts` split
- [ ] 5.2 Add `useTruncatedGroups(pairKey, limit)` to
      `docs/.vitepress/theme/components/DialectCompare.vue` — one expanded-set
      keyed by domain, cleared on the same `pairKey` watch as `useTruncatedList`
- [ ] 5.3 Render "Keywords to replace" as one section per domain: icon, label,
      full group count, then the entries, keeping the existing per-entry
      rendering (kind icon, code, tag, description, and the `substitutions` note)
      exactly as-is
- [ ] 5.4 Replace `mustReplaceList` with the per-group helper; leave
      `falseFriendsList`, `renamedList`, `behaviourChangedList`,
      `newlyAvailableList` and the two escape lists on `useTruncatedList` with
      `TRUNCATE_LIMIT = 10`
- [ ] 5.5 Update the summary line to report the number of capability areas
      alongside the existing full keyword counts
- [ ] 5.6 Verify against the rendered page that group counts and the section
      count reflect every entry, and that revealing one group leaves the others
      capped
- [ ] 5.7 Settle the per-group truncation limit by looking at the `cpc → zx80`
      extreme (working assumption: 6)

## 6. Reference-page domain filter

- [ ] 6.1 Add a `domain` field to `docs/.vitepress/theme/deepLinkParams.ts`,
      treating an empty `?domain=` as absent per the existing contract
- [ ] 6.2 Add a domain argument to `filterEntries` in
      `docs/.vitepress/theme/referenceTable.ts`, AND-combined with the existing
      query and kind filters
- [ ] 6.3 Add a `presentDomains` chip row to
      `docs/.vitepress/theme/components/ReferenceTable.vue`, rendered only when
      some entry carries a domain, so the two assembly pages hide it
      automatically; follow `EscapeTable.vue`'s `?cat=` chips
- [ ] 6.4 Add tests to `referenceTable.test.ts` (domain filter alone and combined
      with kind and query) and `deepLinkParams.test.ts` (`?domain=` parsed, empty
      value absent)
- [ ] 6.5 Confirm both assembly reference pages render with no domain chip row

## 7. Quality gates

- [ ] 7.1 `npm run typecheck`
- [ ] 7.2 `npm test`
- [ ] 7.3 `npm run lint`
- [ ] 7.4 `npm run format:check` (or `npm run format` to fix)
- [ ] 7.5 `npm run docs:build`
- [ ] 7.6 `npm run e2e:chromium -- e2e/porting-guidance`
- [ ] 7.7 `npx openspec validate --changes`
- [ ] 7.8 Manual check via `npm run docs:dev` at `/docs/reference/compare`:
      `cpc → zx80` (147 lost, grouped, capabilities the ZX80 lacks first),
      `zx81 → cpc` (the motivating case — the fold must now show lost
      capabilities, not `AFTER ASC AUTO BIN$`), and `zx81 → zxspectrum` (near
      pair; groups stay short and `GOTO` → `GO TO` still renders as a rename)
