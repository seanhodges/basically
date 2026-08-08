## Context

`src/reference/<dialect>.ts` holds 877 BASIC keyword rows across nine dialect tables.
Each row's `syntax` string is rendered verbatim in the docs' reference table and, for
shared commands, side by side in the machine comparison.

The framing that matters most only became clear on reading `cpc.ts`'s own header:

> Seeded from the dialect's keyword table by `scripts/gen-reference-scaffold.mts`, then
> hand-enriched (typed `<…>` syntax + fuller descriptions).

Its syntax strings are byte-identical to the `signature:` values in
`src/dialects/cpc464/keywords.ts` (`'AFTER delay[,timer] GOSUB line'`,
`'CHAIN "name"[,line]'`, `'CLG [ink]'`). **The CPC page is not a competing convention —
it is the unenriched scaffold.** Its 192 rows never got the pass the other eight had.
That also fixes the scope boundary: the terse style is *correct* in
`src/dialects/*/keywords.ts`, where `signature` feeds a narrow autocomplete tooltip
(`signature: 'ABS(n)'` appears on the Acorn and BBC dialects too). **That tree is not
swept.**

The remaining problem is drift inside the enriched eight: 29 distinct placeholder names
where a smaller set would do, and one collision that lives *inside* a single page —
`bbc.ts` uses `<channel>` for a file handle (`EOF#<channel>`, `PTR#<channel>`) and for
`SOUND <channel>`, which are unrelated things.

Three layers are in play:

- **Structural** (`[optional]`, `a | b`, `…` repetition, caps = literal) — broadly
  consistent. Real divergences: ellipsis inside vs outside its bracket group (commodore
  ×9, zxspectrum ×6, trs80 ×3), comma and `=` spacing, and `…` doing double duty as both
  "repeats" and "and so on" (`REM …`, `IF <number> THEN …`).
- **Vocabulary** — the 29 names, plus CPC's 70 bare ones.
- **Semantic axis** — undecided. Existing names mix type (`<number>`), lvalue-ness
  (`<numvar>`), role (`<line>`, `<addr>`) and syntactic category (`<statement>`,
  `<expr>`, `<cond>`).

`syntaxShape()` in `src/reference/compare.ts` launders layer 2 before diffing. It is
load-bearing for the `porting-guidance` requirement *"Differences in usage notation are
not reported as behaviour changes"*, so only the part that becomes unreachable is
removed.

**Seam impact: none.** `src/reference/` is reference data consumed by the docs site, the
comparison and the AI port prompt. It does not touch the `Dialect` /
`MachineEmulator` contract; no tokenizer or emulator behaviour changes, and no dialect
gains or loses a keyword. See `docs/contributing/architecture.md`.

## Goals / Non-Goals

**Goals:**

- One notation across all nine BASIC reference pages, documented for the reader.
- Finish the enrichment the CPC page never received, and add role names to the other
  eight where their type-only placeholders lose information.
- Make conformance enforceable by test, so the notation cannot drift again.
- Keep the comparison's output at least as good as it is today, and measurably better.

**Non-Goals:**

- `src/dialects/*/keywords.ts` `signature` strings. Terse is right for a tooltip.
- Comparing placeholder *types* in the diff (see proposal Non-goals).
- Escape-table and assembly-operand notation, which have their own legends. The two
  assembly pages keep their hand-written operand tables; `placeholders` stays optional
  on `ReferenceTableData` so they need no edit.
- Auditing keyword facts. Errors the sweep exposes get fixed against primary sources;
  finding them is not the objective.

## Decisions

### D1 — Roles in angle brackets, not types

Angle brackets stay the placeholder marker; the name inside may be a type-word or a
role-word.

Rejected: **pure type vocabulary**. It destroys information. BBC's row is already
`SOUND <channel>, <number>, <number>, <number>` while its own `description` reads
"the channel, amplitude (0 to -15, or an envelope number), pitch (0–255), and duration"
— the syntax cell contradicts the prose beside it. Rewriting CPC's role-named rows into
`<number>` would spread that defect.

Rejected: **type plus role** (`<number:amplitude>`). Verbose in a narrow column, and it
offers two ways to write one argument — the mechanism that produced the drift.

### D2 — Two tiers: a closed core plus a per-page extension

`src/reference/placeholders.ts` holds `CORE_PLACEHOLDERS`; each table declares its own
`placeholders: readonly Placeholder[]` (`[]` where the core suffices).

**The deciding constraint is the component.** `ReferenceTable.vue` takes
`defineProps<{ data: ReferenceTableData }>()` and nothing else — no slug, no route read.
A generated per-page legend therefore needs the page's vocabulary *on the table object*;
a slug-keyed record in `placeholders.ts` would mean threading a second prop through all
nine `.md` files. The precedent is already in the repo and is exactly this shape:
`EscapeTableData.categories: { id, label }[]`, a per-page vocabulary carried on the table
data with its label in data.

Two supporting reasons:

- Placeholders are never compared across pages — `syntaxShape` erases `<…>` → `#` before
  anything is compared — so a per-page name cannot leak into the diff. The `domains.ts`
  rationale ("the porting comparison sets one machine's domains against another's") does
  not transfer.
- It keeps the "used in full, and nothing beyond it" test meaningful. A flat global list
  would be ~55 entries with ~20 used by one page each, making the no-dead-entry check
  vacuous. A 35-entry core where every entry is used by ≥2 pages keeps it sharp.

It also resolves a tension a single list could not: BBC says *amplitude*, Locomotive says
*volume*, for the same slot. Neither page should be made to speak the other's language,
and neither word belongs in a core that demands two users. `<amplitude>` becomes a BBC
extension; `<volume>` a CPC one.

**The one risk**, and its mitigation: the comparison shows two pages' syntax side by side,
so a reader can meet `<pen>` and `<colour>` in one row with neither legend in view.
Mitigated by a test assertion rather than prose — where two pages declare the same
extension id, they must declare the same meaning (D5.9).

Shape, mirroring `domains.ts`:

```ts
export const CORE_PLACEHOLDERS = [{ id: 'number', meaning: 'a numeric expression' }, …] as const;
export type CorePlaceholder = (typeof CORE_PLACEHOLDERS)[number]['id'];
export interface Placeholder { id: string; meaning: string }
export function placeholderTokens(syntax: string): string[];
export function placeholdersUsed(entries, extension): Placeholder[];
```

`placeholderTokens` is exported rather than duplicated in the test and the component, so
the legend and the conformance check cannot disagree about what a placeholder is. It
takes structural arguments, so `placeholders.ts` never imports `types.ts` — the same
dependency direction as `domains.ts`.

`meaning` is **data**, not theme. The `domainMeta.ts` convention (ids and order are data,
labels and icons are theme) does not reach this: a placeholder's id *is* the rendered
artefact (`<number>` appears verbatim in the syntax column, so there is no label to
invent), and its meaning is a factual statement about the language — the same class as
`ReferenceEntry.description`. Decisively, the conformance test must assert no-dead-entries
from `src/`, so splitting id-here/meaning-there would put half the vocabulary where no
test can see it.

### D3 — The core, and every retirement

Core, 36 entries, canonical order (values → variables → program → screen → colour →
sound → input → storage → machine). Every one is used by at least two pages, which is
what makes D5.8 satisfiable.

| group | ids |
| --- | --- |
| values | `number` `string` `expr` `byte` `constant` |
| variables | `var` `numvar` `strvar` `letter` |
| program | `line` `statement` `comment` `name` `param` `arg` |
| screen | `x` `y` `dx` `dy` `col` `row` `mode` `action` |
| colour | `colour` |
| sound | `channel` `pitch` `duration` `envelope` |
| input | `prompt` |
| storage | `file` `filename` |
| machine | `addr` `port` |

Two entries the first draft put in the core are not there: **`volume`** looks
single-page (the CPC's; the BBC says *amplitude*, which is the whole point of tie-break
rule 3), so it is a CPC extension, and **`switch`** has no confirmed second user, so it
is not in the vocabulary at all until the sweep produces one. Starting from a core that
is certainly right beats starting from one with two known-dubious entries — D5.8 catches
the reverse mistake for free, and stage 3.6 reconciles.

The sweep then added three the data proved necessary, taking the core to 36: **`start`**
and **`length`** (`MID$`, `LEFT$`, `RIGHT$`, `INSTR`, `STRING$` need them on five pages,
and `MID$(<string>, <number>[, <number>])` was hiding a position behind a count), and
**`mask`** — first drafted as a CPC-only name until the `WAIT` rows showed the Altair and
the Commodore need it too. `switch` was never needed: the two rows that wanted it
(`CURSOR`, `SPEED INK`) read better as `<number>` with the description carrying the
0-or-1, which is tie-break rule 5 working as intended.

Retirements, each with its reason:

| retired | → | rows | why |
| --- | --- | --- | --- |
| `<expression>` | `<expr>` | 6 | pure synonym; `<expr>` wins 25:6 |
| `<int>` | `<number>` | 22 | **carries no information today** — the same `POKE` is `<int>,<int>` on the TRS-80 and `<number>, <number>` on four other pages. These BASICs round or truncate a fractional argument rather than rejecting it, so "integer" describes the value used, not what the syntax accepts. And whether a machine has fractions at all is already a first-class fact (`PortingFacts.numberHandling`, surfaced in the comparison and the primer); restating it per row says it 22 times worse |
| `<cond>` | `<number>` | 2 | no boolean type in any of these BASICs — `IF A THEN` is legal, and `<cond>` hides that. Seven pages already write `IF <number>` |
| `<item>` | `<constant>` | 2 | same concept, and the more accurate word: it tells the reader `DATA A+1` is not allowed |
| `<text>` | `<comment>` | 4 | every use is `REM` |
| `<handle>` | `<file>` | 8 | the Atom's `BPUT`/`BGET`/`PTR` take what `FIN`/`FOUT` returned — a CBM logical file and a BBC handle by another name |
| `<lf>` | `<file>` | 4 | CBM's "logical file number"; the abbreviation is opaque |
| `<channel>` (storage sense) | `<file>` | 7 | **the genuine collision, and it is inside one page**: `bbc.ts` uses `<channel>` for a file handle *and* for `SOUND <channel>`. Splitting frees `<channel>` for sound, where the CPC needs it too |
| `<id>` | commodore extension | 1 | a two-character CBM disk id — one machine's concept |
| `<name>` as an array name | `<var>` | 1 | the one current misuse; `<name>` is now reserved for FN/PROC identifiers |

Collisions resolved:

- **`<file>` / `<channel>` / `<handle>` / `<lf>`** → one word, `<file>`, for the number a
  file is open under. **CPC's `#stream` is not in this set**: a CPC stream `#0`–`#7` is a
  screen window, and CPC file channels are implicit (`OPENIN` takes a filename and no
  number). So the CPC has no `<file>` at all and `<stream>` is a CPC extension. This
  distinction is the clearest justification for D2.
- **`<name>` doing two jobs** → `<name>` is a name the *program* defines (FN/PROC);
  `<filename>` names a file. The collision is latent today and would have been created
  the moment CPC's `LOAD "name"` became a placeholder.
- **`<param>` and `<arg>` both kept** — BBC already draws the right distinction
  (`DEF PROC<name>[(<param>,…)]` at the definition, `<arg>` at the call).

Extensions, 20 entries across four pages; `altair8800`, `atom`, `bbc`, `zx80`, `zx81`
declare `[]` — except `bbc` needs `amplitude` (see D2), so four pages carry extensions
plus BBC's one.

- **cpc (14)**: `pen`, `stream`, `timer`, `period`, `volume`, `volenv`, `toneenv`,
  `noise`, `mask`, `section`, `left`, `right`, `top`, `bottom`.
- **commodore (4)**: `drive`, `device`, `secondary`, `id`.
- **trs80 (2)**: `cell` (one of the 1024 screen cells — `PRINT @ n` is neither a row nor
  a column), `record`.
- **zxspectrum (1)**: `bits` (a binary literal — `BIN <int>` today, and not a number
  expression at all).
- **bbc (1)**: `amplitude`.

One correction this forces: CPC currently uses `ink` both for `PLOT`/`DRAW`/`CLG`/`FILL`
(which take a **pen** number) and for `INK pen,colour` (whose second argument is a
hardware colour 0–26). The page's own hardware doc already says "`INK p,c` assigns colour
`c` to pen `p`". So `<pen>` for the index everywhere, core `<colour>` for the 0–26 value:
`INK <pen>, <colour>[, <colour>]`.

### D4 — Structural rules

Rule 0 comes first, mirroring how `domains.ts` leads with "what the keyword does on
*this* machine wins":

> **R0. The machine's real syntax outranks every rule below.** These rules govern how an
> argument is named and spaced, never what the machine accepts. Where a machine requires a
> quoted literal, a missing space, an extra sigil, a fixed constant or a two-word keyword,
> the row shows it and the rules yield.

| # | rule |
| --- | --- |
| R1 | Every argument is a `<…>` token from the core or this page's extension. No bare words, no quoted placeholders, no uppercase pseudo-placeholders. |
| R2 | Optional is `[…]`. Repetition is `<x>[, <x>]…` — **the ellipsis outside the bracket**. Majority (altair, trs80, bbc, cpc); and `[, <var>]…` reads as "and more of those" where `[, <var>…]` reads as one optional thing containing an ellipsis. |
| R3 | One space after a separating comma or semicolon; spaces around `=` and binary operators; none after `(` or before `)`; none introduced inside a keyword's own spelling or between a keyword and a sigil belonging to it (`PRINT#`, `?<addr>`, `FN<name>`). Compare-neutral by construction — `syntaxShape` already collapses separator spacing. |
| R4 | ` \| ` between alternative whole forms; unspaced `\|` between single-character alternatives inside a bracket group (`[;\|,]`, which is unanimous today). |
| R5 | A placeholder stands for the whole argument **including its quotes** — never `"<string>"`. A quoted literal appears only where the machine accepts no expression, and then the placeholder names the role (`<prompt>`). |
| R6 | `#` binds to its placeholder: `#<file>`, `#<stream>`, never `# <file>`. Whether it attaches to the keyword (`PRINT#<file>`) or floats after it (`OPEN #<file>`) follows the machine (R0). |
| R7 | A keyword that is only ever a **fragment** shows the smallest enclosing form that makes it legal. No majority exists today, so this is chosen on merit: a syntax cell reading `THEN` teaches nothing, and expanding it makes the fragment rows comparable. |
| R8 | A pseudo-variable shows `NAME` when read-only, `NAME \| NAME = <value>` when assignable. **Not a notation divergence** — the BBC's `TIME` is assignable and the CPC's is not, so both rows are already correct. The rule exists so nobody "normalises" the difference away. |
| R9 | The syntax cell is syntax only. No parenthesised prose; counts and limits move to `description`. |
| R10 | A concrete literal stays where the machine accepts only that literal (`FRE(0)`, `TRACE ON \| TRACE OFF`). R0 in practice. |
| R11 | `…` means repetition and nothing else. Where it currently means "and so on" (`REM …`, `IF <number> THEN …`) it becomes a real placeholder. This is what makes R2 mechanically testable. |
| R12 | An operator row shows its operands. **Free**: `operatorNames()` drops every operator row from the diff on both pages, so all 114 can be rewritten with zero compare impact. |

Worked examples, and what each buys:

```
BBC   SOUND <channel>, <number>, <number>, <number>
  →   SOUND <channel>, <amplitude>, <pitch>, <duration>     (agrees with its own description)
CPC   SOUND channel,period[,dur[,vol[,env[,ent[,noise]]]]]
  →   SOUND <channel>, <period>[, <duration>[, <volume>[, <volenv>[, <toneenv>[, <noise>]]]]]
BBC   PLOT <number>, <number>, <number>   →  PLOT <action>, <x>, <y>
CPC   PLOT x,y[,ink]                      →  PLOT <x>, <y>[, <pen>]
CPC   INPUT [#s,]["prompt";]var[,var]…    →  INPUT [#<stream>,] [<prompt>;] <var>[, <var>]…
CPC   LOAD "name"[,addr]                  →  LOAD <filename>[, <addr>]
CPC   IF cond THEN … [ELSE …]             →  IF <number> THEN <statement> [ELSE <statement>]
any   POKE <number>, <number> / POKE <int>, <int>  →  POKE <addr>, <byte>
CPC   STEP                                →  FOR <numvar> = <number> TO <number> STEP <number>
CBM   <number> < <number> | <string> < <string>    unchanged — the model operator row
```

Three identical-looking `PLOT <number>, <number>, <number>` cells become two different
statements: the Acorn machines take the action first, the CPC takes the pen last. The CPC
`IF` row becomes identical to the BBC's, so `IF` drops off their behaviour-change list,
where it sits today.

### D5 — Enforcement in `reference-data.test.ts`

Tokenise with `/<([a-z][a-z0-9]*)>/g`. Requiring a lowercase identifier is what keeps the
relational operators out: in `'<number> < <number> | <string> < <string>'` the bare `<` is
followed by a space, and `<=` / `<>` fail on their second character. **Verified against all
902 current rows: after stripping matches, every remaining `<` is exactly `<`, `< `, `<=`
or `<>` — zero unexplained occurrences.** That makes the complement assertion safe, and it
is the one that catches typos (`<Number>`, `<num var>`, `<x >`).

Per page, so failures name the page:

1. Every token is in the core ∪ this page's extension.
2. No dead extension entry.
3. No extension id shadows a core id.
4. No unexplained `<` (the complement scan).
5. No bare placeholder survives: after removing recognised placeholders, no `[a-z]`
   remains. Checked what this must tolerate: nothing — the only leftovers are sigils,
   digits, `…`, `π` and `↑`. **No allowlist.**
6. Mechanically safe structural rules only: no `# ` before `<`; no space before a comma
   and one after (exempting `]` and `…`, which covers `[;|,]` and `[, <x>]…`); `…` always
   preceded by `]`; no double space; trimmed; brackets balanced. **Not asserted**: R3's
   spaces around `=`, R5's no-quotes, R7's expansion, R4's ` | ` — each has legitimate R0
   exceptions, and a mechanical check would force suppression comments into the data,
   which is worse than a reviewer.
7. Entry hygiene: ids match `/^[a-z][a-z0-9]*$/`, meanings non-empty and lower-case
   initial (they read as "`<number>` — a numeric expression").

Global, copying the `KEYWORD_DOMAINS` test in spirit and comment style:

8. The core is used in full across the BASIC tables, and nothing beyond it.
9. Where two pages declare the same extension id, they declare the same meaning — the
   assertion that buys back D2's only risk.

### D6 — Legend split by what varies

- **Structural notation is universal** → `## Argument notation` on
  `docs/reference/index.md`, the `file-formats.md#escape-notation` pattern exactly (a
  shared explainer on the parent, linked from all nine children). Each dialect page gains
  one line near its table; `compare.md` gains the same link beside its `porting-basics`
  one, because the comparison shows two pages' usage side by side.
- **Vocabulary is per-page** → `<details>` in `ReferenceTable.vue` from
  `placeholdersUsed(props.data.entries, props.data.placeholders ?? [])`, core order then
  extension. Cannot drift; keeps `<int>`'s ghost from lingering in a hand-written legend
  after the data drops it.
- **Placement below the table**, above `.reftable-count`: a 25-row legend above a 192-row
  searchable table pushes the data below the fold, and both assembly pages put their
  operand tables after the table too.
- **One presentation consequence in the same stage**: `.reftable-syntax` is
  `white-space: nowrap`, and CPC's `SOUND` goes from 52 to ~88 characters — the longest
  cell in the tree. Make `.reftable-syntax` wrap (`pre-wrap` + `overflow-wrap: anywhere`)
  while `.reftable-name code` keeps `nowrap`. Theme-only;
  `e2e/capture-docs-screenshots.spec.ts` never visits a reference page, so there is no
  snapshot to rebaseline.

### D7 — `compare.ts`: remove only what becomes unreachable

Drop the lowercase-word → `#` replacement; keep `<…>` → `#` and the whitespace and
bracket normalisation. `normaliseSyntax`, `parenthesesOnly` and `keywordChange` unchanged.

Rewrite the `syntaxShape` doc comment: it asserts a now-false fact and a stale figure
("the Amstrad page writes `ABS(n)`… 72 behaviour changes"). The surviving reason is
different and still real — **the pages name the same slot differently where each
machine's manual does** (`<pen>` vs `<colour>`, `<amplitude>` vs `<volume>`), **and one
page may be more specific than another about the same argument** (`POKE <addr>, <byte>`
vs `POKE <number>, <number>`). Erasing the name inside `<…>` is still what keeps that out
of the diff. The "coarse-but-structural" paragraph stays — both its examples still hold.

`compare.test.ts`: two tests fail once the rule goes (`ABS(n)`, `DRAW x,y`), two more pass
but hold non-conforming fixtures (`DRAW x,y,ink`, `LIST [line]`), and the `FILL <ink>`
fixture becomes `FILL <pen>` to match the new CPC data. All five updated together so the
test file is not the last place bare placeholders live.

## Risks / Trade-offs

- **Dropping the lowercase rule before CPC is converted makes the porting guide worse.**
  Measured across all 36 page pairs: today 650 behaviour changes; rule dropped with CPC
  as-is **801** (+151, every one on a CPC pair — `cpc↔bbc` 31 → 63); mechanical rule fixes
  applied **618** (−32, `commodore↔altair` 13 → 9, losing `NEXT`, `DATA`, `READ`, `ON`,
  all pure notation). → Sequencing is load-bearing, not cosmetic: CPC first, `compare.ts`
  last. Re-run the pairwise count after the shape-changing edits and confirm it moved
  down, not up.
- **The sweep silently changes a language fact.** → `keyword-crosscheck.test.ts` pins each
  dialect's selected rows to its own keyword table, so a row cannot silently gain or lose
  a *keyword*. Beyond that: one page per commit, and take argument order and arity from
  each machine's own material, never from another page.
- **Enrichment scope creeps.** 193 non-CPC rows contain a repeated placeholder, but most
  are homogeneous lists (`READ <var>[, <var>]…`) where a repeat is correct and role naming
  would be invented. → Bound it to *heterogeneous* repeats — 78 rows, measured.
- **Role naming drifts again, one keyword at a time.** → The conformance test catches new
  ids; D5.9 catches two pages meaning different things by one id. Accepted residual: two
  pages could name the same argument differently from within the vocabulary. Invisible to
  the comparison by design, cheap to fix later.
- **A bent rule reads as a bug.** R0 means deliberate exceptions in the data (CBM's
  literal `D`/`W`/`I`, the Atom's possibly-tight `?<addr>=<byte>`). → Named in the header
  comment, with a row comment where it is non-obvious; the test asserts vocabulary
  strictly and spacing loosely.
- **A residue the change does not fix**: `DEF FN<name>` vs `DEF FN <name>` differs across
  pages and `normaliseSyntax` does not collapse that space, so machines that genuinely
  differ keep reporting `DEF` as an argument change. Documented in `compare.ts`, not
  fixed — folding keyword-spelling differences is not `parenthesesOnly`'s job.

## Migration Plan

No data migration: nothing is persisted, no URL or file format encodes a syntax string.
Rollback is a revert. Sequenced so every commit leaves the repo green and the conformance
test never lands before the data conforms:

1. `placeholders.ts` + `types.ts` field + `placeholders: []`/extension on all nine tables.
2. **`cpc.ts`** — all 192 rows, batched by domain. The bulk.
3. The other eight, in three passes: (3a) the 48 mechanical retirements, all
   shape-neutral; (3b) role enrichment, ~150 rows, shape-neutral by construction (one
   marker in, one marker out); (3c) the structural rules — the only shape-changing edits.
4. The conformance test — the stage that proves 2 and 3 landed.
5. `compare.ts` + its five fixtures.
6. Legend (theme + docs), where `npm run docs:build` joins the gate.
7. `hardware.md` prose sweep, ~18 spans across five pages.
8. `porting-basics.md`.
9. Optional: `facts.ts` `memoryWriteSyntax` ×9 — a third notation rendered right beside
   reference syntax in the comparison's facts table. `facts-crosscheck.test.ts` asserts
   only `/POKE/` and `/[?!]/`, so `POKE <addr>, <byte>` passes. The prose `substitutions`
   notes stay as sentences.

## Open Questions

- **Atom `?<addr>=<number>`** — R3 wants spaces around `=`. If the Atom's tokenizer
  requires the tight form, R0 wins and the row keeps `?<addr>=<byte>`. Verify against
  `src/dialects/atom/` in stage 3c; this is the model case for a rule yielding with a row
  comment rather than a vocabulary exception list.
- **`<switch>`** (0 off / 1 on) is in the core on the assumption two pages need it. If the
  sweep finds only one does, it moves to that page's extension.
- **Spectrum `DEF FN <name>([<param>…])`** — verify the empty-parameter form against the
  tokenizer before writing it.
- Whether the legend sits above or below the table is a layout call best made against a
  rendered page in `npm run docs:dev`; D6 picks below, on the fold argument.
