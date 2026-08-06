## Context

`src/reference/<dialect>.ts` holds 877 BASIC keyword rows across nine dialect tables.
Each row's `syntax` string is rendered verbatim in the docs' reference table and, for
shared commands, side by side in the machine comparison. The tables were authored
independently and drifted into two notations:

| | pages | placeholders |
| --- | --- | --- |
| angle-bracket | altair8800, atom, bbc, commodore, trs80, zx80, zx81, zxspectrum (684 rows) | 29 distinct names, `<number>`×526 down to `<id>`×1 |
| bare lowercase | cpc (192 rows) | 78 distinct role names — `n`, `x`, `y`, `ink`, `pen`, `stream`, `timer`… |

Three layers are in play, and only one is badly broken:

- **Structural** (`[optional]`, `a | b`, `…` repetition, caps = literal) — broadly
  consistent already. Three real divergences: ellipsis placement (`[, <x>]…` vs
  `[, <x>…]`), spacing (`FOR <v> = <n>` vs `FOR <v>=<n>`), and whether string arguments
  appear quoted (`LOAD "name"` vs `LOAD <string>`).
- **Vocabulary** — broken, as above.
- **Semantic axis** — undecided. The existing names mix type (`<number>`), lvalue-ness
  (`<numvar>`), role (`<line>`, `<addr>`, `ink`) and syntactic category (`<statement>`,
  `<expr>`, `<cond>`). `IF <number> THEN` and `IF cond THEN` are the same language fact
  on two different axes.

`syntaxShape()` in `src/reference/compare.ts` already launders layer 2 before diffing,
and its doc comment records why: raw-text comparison reported 72 editorial "behaviour
changes" between the BBC and the Amstrad. The laundering is load-bearing for the
`porting-guidance` requirement *"Differences in usage notation are not reported as
behaviour changes"*, so it cannot simply be deleted — only the part of it that becomes
unreachable.

**Seam impact: none.** `src/reference/` is reference data consumed by the docs site, the
comparison and the AI port prompt. It does not touch the `Dialect` /
`MachineEmulator` contract, no tokenizer or emulator behaviour changes, and no dialect
gains or loses a keyword. See `docs/contributing/architecture.md` for where
`src/reference/` sits relative to `src/dialects/`.

## Goals / Non-Goals

**Goals:**

- One notation across all nine BASIC reference pages, documented for the reader.
- Preserve the information CPC's role names carry today, and extend it to the other
  eight pages where their type-only placeholders lose it.
- Make conformance enforceable by test, so the notation cannot drift again.
- Keep the comparison's output to the reader byte-identical.

**Non-Goals:**

- Comparing placeholder *types* in the diff (see proposal Non-goals).
- Escape-table and assembly-operand notation, which have their own conventions and
  their own legends.
- Auditing keyword facts. Factual errors the sweep happens to expose get fixed against
  primary sources; finding them is not the objective.

## Decisions

### D1 — Roles in angle brackets, not types

Angle brackets stay the placeholder marker; the *name inside* may be a type-word or a
role-word, drawn from one closed glossary.

Rejected: **pure type vocabulary** (`<number>`, `<string>`, `<var>`, …, roles pushed
into `description`). It is the smallest vocabulary and the easiest to lint, but it
destroys information. BBC's row is already
`SOUND <channel>, <number>, <number>, <number>` and no reader can recover
amplitude/pitch/duration from it, while `docs/reference/bbc/hardware.md` spells that
order out in prose two pages away. Rewriting CPC's 192 role-named rows into
`<number>, <number>, <number>` would spread that defect, not fix it.

Rejected: **type plus role** (`<number:amplitude>`). Most information, but verbose in a
narrow table column, and it offers two ways to write the same argument — the exact
mechanism that produced today's drift.

Why brackets rather than CPC's bare names: brackets make "placeholder vs literal"
mechanically decidable, which is what both `syntaxShape()` and the conformance test
need, and they survive the literal-`<` operator rows unambiguously.

### D2 — One global glossary, not a core plus per-page tier

`src/reference/placeholders.ts`, mirroring `src/reference/domains.ts`: a `const … as
const` array of `{ name, meaning }`, a derived union type, and a header comment
carrying the tie-break rules for classifying a borderline argument.

A two-tier design (shared core plus per-page extensions, as `EscapeTableData.categories`
does) was available and is *more* defensible here than for `KEYWORD_DOMAINS`: domains
must be global because the comparison sets one machine's domains against another's,
whereas placeholders are never compared across pages. It was rejected on size — at ~45
names one set is smaller than the no-shadowing rule and per-page plumbing it would
replace. `ReferenceTable.vue` filters the legend to the names a page actually uses,
which delivers the per-page benefit without per-page data. Revisit past ~60 names.

Proposed set, in canonical render order:

| group | entries |
| --- | --- |
| values | `<number>` `<string>` `<int>` `<expr>` `<cond>` `<constant>` |
| variables | `<var>` `<numvar>` `<strvar>` `<letter>` |
| program | `<line>` `<statement>` `<comment>` `<name>` `<param>` `<arg>` |
| loops & ranges | `<start>` `<limit>` `<step>` `<first>` `<last>` |
| machine & files | `<addr>` `<byte>` `<channel>` `<device>` `<filename>` |
| screen & geometry | `<x>` `<y>` `<dx>` `<dy>` `<row>` `<column>` `<mode>` `<colour>` |
| machine-specific roles | `<pen>` `<ink>` `<stream>` `<amplitude>` `<pitch>` `<duration>` `<period>` `<volume>` `<envelope>` `<timer>` `<noise>` |

The set above is a starting point, not a frozen list: implementation will add names the
sweep proves are needed and drop any the conformance test finds unused. The tie-break
rules, not the list, are the durable part.

### D3 — Collision resolutions (recorded as tie-break rules)

- `<file>` / `<handle>` / `<lf>` all name an open-file handle → **`<channel>`**. CPC's
  `#stream` is a *screen window*, a genuinely different concept → **`<stream>`**, kept
  distinct. Getting this wrong would merge two unrelated ideas under one name.
- `<name>` does two jobs today — an FN/PROC identifier and a filename. Split into
  **`<name>`** (identifier) and **`<filename>`** (a string naming a file).
- `<expression>` → `<expr>`. **`<cond>` kept**: `IF <cond> THEN` names the role
  honestly on machines with no boolean type, where `IF <number> THEN` reads as a
  category error.
- **`<int>` kept**, but only where the argument is a plain whole number with no role.
  Note how far role names subsume its current use: seven pages disagree between
  `POKE <int>, <int>` and `POKE <number>, <number>` for the same statement, and
  `POKE <addr>, <byte>` is better than either.
- `<text>` → `<comment>` in `REM`, `<string>` elsewhere. `<item>` → `<constant>` in
  `DATA`, `<expr>` in `PRINT`. **`<param>` and `<arg>` both kept** — definition site vs
  call site is a real distinction the BBC page already draws.

### D4 — Structural rules

1. `<…>` marks a placeholder; everything outside is literal, keywords in caps.
2. `[…]` is optional; nest only where the nesting is real. `[<start>[, <step>]]` means
   step requires start; `[<start>][, <step>]` means it does not. Today's data blurs
   this (BBC `AUTO [<line>[, <number>]]` vs CPC `AUTO [start][,step]` for machines whose
   `AUTO` differs), so the sweep must decide each case on the machine's behaviour.
3. `a | b` alternation, spaces around `|`.
4. `…` (U+2026, never `...`) marks repetition and sits **outside** the group that
   repeats: `<var>[, <var>]…`. Majority style; Commodore's `[, <var>…]` moves.
5. One space after a comma; spaces around `=` and `TO`; no space inside parentheses.
6. String arguments are placeholders, not quoted literals: `LOAD <filename>`.
7. `#` binds to its channel with no space (`#<channel>`); the gap between keyword and
   `#` follows the machine's real syntax (`PRINT#` is one token on CBM; `PRINT #` is not).
8. **Fragment keywords** (`THEN`, `ELSE`, `STEP`, `TO`, `LINE`) show the enclosing
   construct with the fragment in place. Majority style, and it is what a reader who
   searched for `STEP` needs — CPC's bare `STEP` tells them nothing.
9. Assignable pseudo-variables show both forms: `TIME | TIME = <number>`.
10. No prose inside a syntax string. `ENT n,…(up to 5 sections)` becomes
    `ENT <envelope>, <section>[, <section>]…` with the limit moved to `description`;
    `ON n GOSUB/GOTO line,…` becomes two `|` alternatives.
11. **Machine truth outranks notation.** Where a machine really requires no space, or a
    literal where others take an expression, the real syntax wins and the rule bends.
    Do **not** "correct" Commodore's `D<number>`, `[, W]` or `I<id>` — those are literal
    CBM DOS syntax, correctly cased. This rule is why the conformance test checks
    vocabulary strictly and spacing loosely.

Worked examples:

```
BBC    SOUND <channel>, <number>, <number>, <number>
   →   SOUND <channel>, <amplitude>, <pitch>, <duration>
CPC    SOUND channel,period[,dur[,vol[,env[,ent[,noise]]]]]
   →   SOUND <channel>, <period>[, <duration>[, <volume>[, <envelope>[, <timer>[, <noise>]]]]]
BBC    PLOT <number>, <number>, <number>       →  PLOT <mode>, <x>, <y>
CPC    PLOT x,y[,ink]                          →  PLOT <x>, <y>[, <ink>]
CPC    INPUT [#s,]["prompt";]var[,var]…        →  INPUT [#<stream>, ][<string>; ]<var>[, <var>]…
CPC    LOAD "name"[,addr]                      →  LOAD <filename>[, <addr>]
CPC    DEF FNname[(args)]=expr                 →  DEF FN<name>[(<param>[, <param>]…)] = <expr>
any    POKE <number>, <number> / POKE <int>, <int>   →  POKE <addr>, <byte>
CBM    LIST [<line>][-[<line>]]                →  LIST [<first>][-[<last>]]
CPC    IF cond THEN … [ELSE …]                 →  IF <cond> THEN <statement> [ELSE <statement>]
CBM    <number> < <number> | <string> < <string>    unchanged — literal `<` operator row
```

### D5 — Enforcement in `reference-data.test.ts`

Extend the existing file rather than adding one, following its
`KEYWORD_DOMAINS` precedent ("used in full across the BASIC tables, and nothing beyond
it"):

- **Tokenise safely.** Match `<` + `[a-z][a-z0-9$-]*` + `>` only. A lone `<` followed by
  a space never matches, so the literal-`<`, `<=` and `<>` operator rows are skipped
  without special-casing. This is the one place a naive regex would corrupt the check.
- Every token is in the glossary; no glossary entry is unused.
- No bare lowercase placeholder survives: after removing `<…>` groups and quoted
  literals, no lowercase word remains.
- Cheap structural checks only: no `...`, balanced brackets, no `…` immediately inside a
  group opened with `[,`. Spacing is deliberately *not* asserted, per D4 rule 11.

### D6 — Legend split by what varies

- **Structural notation is universal** → a static section on `docs/reference/index.md`,
  linked from each dialect page's existing `**In this reference:**` line. Mirrors how
  all nine `escapes.md` pages link `file-formats.md#escape-notation`, and closes the gap
  the two assembly pages already cover for themselves
  (`z80-assembly.md` `## Operand notation`, `6502-assembly.md` `## Addressing modes`).
- **Vocabulary is per-page** → generated in `ReferenceTable.vue` as a collapsible
  disclosure above the table, listing only the placeholders that page's rows use, with
  their meanings. Generated, so it cannot drift from the data.
- The `meaning` strings live in `placeholders.ts` as **data**, not in theme. Under the
  `domainMeta.ts` convention ids and order are data while labels and icons are theme —
  but a placeholder's meaning is a language fact of the same kind as the `domains.ts`
  tie-break rules, not presentation. Only ordering and styling go in theme.

### D7 — `compare.ts`: remove only what becomes unreachable

Drop `syntaxShape()`'s lowercase-word → `#` replacement; keep `<…>` → `#` and the
whitespace and bracket-spacing normalisation. Rewrite the doc comment, which currently
states the CPC divergence as a live fact and cites the 72-change figure.

Three `compare.test.ts` fixtures are built on bare-placeholder inputs (`ABS(n)`,
`DRAW x,y`, `DRAW x,y,ink`) and get re-pointed at glossary-name variation
(`ABS(<expr>)`, `DRAW <x>, <y>`, `DRAW <x>, <y>, <ink>`). They then assert the
stronger invariant — naming inside `<…>` is not a difference, arity is — which is
exactly the two scenarios under the `porting-guidance` requirement *"Differences in
usage notation are not reported as behaviour changes"*.

## Risks / Trade-offs

- **The sweep silently changes a language fact.** Rewriting 192 CPC rows and enriching
  78 others is a large hand edit over data whose accuracy is the product. →
  `keyword-crosscheck.test.ts` already pins each dialect's selected rows to its own
  keyword table, so a row that gains or loses an argument *name* cannot silently gain or
  lose a *keyword*. Beyond that: change one page per commit, keep the diff reviewable,
  and take argument order and arity from each machine's own reference material, never
  from the other pages.
- **Role naming drifts again, one keyword at a time.** A closed glossary constrains the
  vocabulary but not which name a given argument gets. → The conformance test catches
  new names; the tie-break rules in the header comment are what a reviewer points at.
  Accepted residual risk: two pages could name the same argument differently from within
  the glossary. That is invisible to the comparison by design, and cheap to fix later.
- **Enrichment scope creeps.** 193 non-CPC rows contain a repeated placeholder, but most
  are homogeneous lists (`READ <var>[, <var>]…`) where a repeat is correct and role
  naming would be wrong. → Bound it: enrich only *heterogeneous* repeats, where the
  repeated placeholders denote different things (address vs byte, x vs y, channel vs
  pitch). That is 78 rows, measured, not 193.
- **The legend disclosure adds noise to nine pages.** → Collapsed by default, and it
  lists only the placeholders that page uses, so short pages get short legends.
- **A bent rule reads as a bug.** D4 rule 11 means the data will contain deliberate
  exceptions (CBM's `D<number>`). → The exceptions are named in the header comment, and
  the test asserts vocabulary strictly while leaving spacing alone.

## Migration Plan

No data migration: nothing is persisted, no URL or file format encodes a syntax string.
Rollback is a revert.

Sequenced so the repo stays green at every step, and so the conformance test never
lands before the data conforms:

1. `placeholders.ts` — no consumers, lands green alone.
2. The eight angle-bracket tables: synonym folding (57 rows), structural rules, role
   enrichment on the 78 heterogeneous-repeat rows.
3. `cpc.ts` — all 192 rows bracketed, roles mapped into the glossary, prose lifted out.
4. The conformance test.
5. `compare.ts` plus its three re-pointed fixtures.
6. Legend: theme component and docs pages.
7. Hardware-prose sweep (~17 code spans across five pages).
8. The `porting-basics.md` theme.

## Open Questions

- Does any dialect need a placeholder for a **range** distinct from `<first>`/`<last>`?
  CPC writes `DELETE start-end` and `DEFINT letter-letter`; the second is a letter range,
  not a line range, so `<letter>-<letter>` may read better than reusing `<first>`.
  Decide during step 2, where both forms are in front of you.
- `<mode>` currently has to cover two different things: a screen mode (`MODE <mode>`) and
  an action selector (BBC `PLOT <mode>, <x>, <y>`, Atom `PLOT <mode>, <x>, <y>`). If the
  sweep finds these read badly under one name, split into `<mode>` and `<action>`.
- Whether the generated legend belongs above the table or behind the existing filter
  chips is a layout call best made against a rendered page in `npm run docs:dev`.
