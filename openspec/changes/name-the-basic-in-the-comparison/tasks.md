## 1. Carry the BASIC's name as a per-machine fact

- [x] 1.1 Add `basicDialect: string` to `PortingFacts` in
      `docs/reference/data/types.ts`, documenting that it is per machine (not
      per reference page) and pinned to the dialect's own blurb.
- [x] 1.2 Name it on all eight base entries in `docs/reference/data/facts.ts`.
- [x] 1.3 Name it on the variants whose BASIC differs from the relative they
      extend — `zxspectrum128`, `bbcmaster`, `pet`, `cpc6128` — and leave
      `vic20` inheriting the C64's `Commodore BASIC V2`, which is the truth.
      Update the variants' comments, which claimed the 128K "runs the same
      BASIC" as a 48K and the 6128 is "identical on every crosschecked figure".

## 2. Pin the name so the two surfaces cannot disagree

- [x] 2.1 Add a per-machine case to
      `docs/reference/data/facts-crosscheck.test.ts` asserting the dialect's
      `blurb` contains `basicDialect`.
- [x] 2.2 Verify it bites: change one entry to a wrong version, confirm the
      failure names that machine, revert.
      — `BBC BASIC IV` → `BBC BASIC III` failed exactly
      `facts crosscheck: bbcmaster > basicDialect is the BASIC the dialect
      blurb names`, and nothing else.

## 3. Add the row and reorder the table

- [x] 3.1 Add `BASIC dialect` as the first entry of `factRows` in
      `docs/.vitepress/theme/components/DialectCompare.vue`.
- [x] 3.2 Reorder the remaining rows: what decides whether the program can work
      at all (`Numbers`, `Free program RAM`), then the language rules
      (`Variable names`, `Conditionals`, `Statements per line`,
      `LET on assignment`, `Exponent operator`, `Line numbers`), then the
      hardware (`Screen`, `Colour`, `Sound`).
- [x] 3.3 Close the table with the memory facts as one run — `Writing memory`,
      `Address notation`, `Screen base`, `Program start` — with the two
      addresses adjacent.
- [x] 3.4 State the ordering rationale over `factRows`, so the next fact added
      has somewhere to go.
- [x] 3.5 Confirm nothing else changed: the unchanged-row control, the
      changed-row highlight and the count in the summary sentence all work off
      the same rows and are untouched.

## 4. Tests over the new behaviour

- [x] 4.1 Add `e2e/porting-guidance/language-hardware-table.spec.ts` covering:
      the row leads the table and carries each machine's own version
      (BBC Micro → BBC Master); the full row order with the memory facts
      together; and a pair sharing a BASIC (VIC-20 → C64), where the row is
      absent by default and states the shared name when unchanged rows are
      shown.

## 5. Quality gates

- [x] 5.1 `npm run typecheck`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run lint`
- [x] 5.4 `npm run format:check`
- [x] 5.5 `npm run docs:build`
- [x] 5.6 `npm run e2e:chromium -- e2e/porting-guidance` — 9 passed, including
      the three new cases.
