## Why

Half the machines let a program spell its keywords short — `P.` for `PRINT` on
the Acorns, `?` for `PRINT` on the Microsoft-family machines, `pO` for `POKE`
on the Commodores — and archive listings use those spellings everywhere,
because on the real machines they were how programs were typed. The product
half-knows this and the porting guide knows none of it:

- **The Commodore machines reject their own notation.** Shifted-letter
  abbreviations are how Commodore magazines printed programs, and the
  tokenizer does not accept them — a documented gap in the Commodore
  reference. The Acorn dot abbreviations, by contrast, are already modelled
  faithfully.
- **The porting guide never bridges spelling to keyword.** A BBC program
  written as `P.` and `G.` is converted with findings about `PRINT` and
  `GOTO`, and nothing tells the assistant — which is handed the original text
  — that the two are the same thing, or that the target accepts no such
  spelling. Worse, `?` at the start of a statement *means* something on the
  Atom — byte indirection — so an unexpanded `?` does not fail on arrival
  there; it changes meaning silently, and no warning exists.
- **The guide under-reports what the program uses.** A Commodore program that
  prints only with `?` reaches the comparison with `PRINT` missing from its
  vocabulary, so every finding about printing is silently absent.
- **Abbreviations are also a tool.** On a machine that stores program text
  verbatim rather than tokenizing it — the Atom — every `P.` is genuinely
  smaller and faster to scan than `PRINT`. The Atom is also the tightest
  machine in the product; a port that nearly fits can be abbreviated into
  fitting, and the guide never says so.

## What Changes

- **The Commodore tokenizer accepts shifted-letter abbreviations** (`pO` →
  `POKE`), resolved as the machine's own reserved-word scan resolves them,
  on all three Commodore machines. Listing back expands them, as the real
  machines' LIST does. Full spellings keep tokenizing case-blind exactly as
  today, so no existing program changes meaning unless it used the
  abbreviation notation itself.
- **Every machine's abbreviated entry becomes an authored porting fact**: the
  entry style (dot, shifted-letter, or none) and the symbol spellings the
  machine's tokenizer accepts as keywords (`?`, the comment apostrophe),
  pinned behaviourally against each dialect's own tokenizer.
- **The program's abbreviated spellings are resolved and reported.** The
  vocabulary resolves each abbreviated or symbol spelling to the keyword the
  source machine reads it as — so the keyword findings stop under-reporting —
  and the comparison reports the spellings the target does not accept as
  expansions to make, among the mechanical work. A symbol the target gives a
  different meaning is warned about in the same finding.
- **Abbreviation joins the fit measures.** Where the target keeps
  abbreviations in the stored program — where they genuinely shrink it — and
  the fit report has the program close to the limit or over it, the
  comparison reports how the target's own short spellings make room, under
  the same gate as conditionally free memory.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: one requirement added — *Abbreviated spellings are
  resolved and reported*.
- `dialect-toolchain`: one requirement added — *Commodore shifted-letter
  abbreviations tokenize to the keyword*.

## Non-goals

- **Sinclair single-keypress entry.** On those machines a keyword is a
  keystroke, not a spelling; there is nothing in program text to resolve or
  expand, so their entry style is "none" and the keyboard behaviour stays
  where it is modelled today.
- **Emitting abbreviations in conversions.** The assistant is never taught to
  write `?` or `P.` as a matter of course — converted programs use canonical
  spellings. The fit-gated finding poses abbreviation as a measure for a
  pressed program; it does not change the default.
- **The Commodore lower-case display bank.** The reference's caveat covers two
  gaps; this change closes the tokenizer one and the display-bank half stays.
- **Expanding abbreviations in the user's own source.** The editor keeps what
  the user typed; resolution is for reading, listing and porting, not
  rewriting.

## Impact

Affected code:

- `src/dialects/commodore64/tokenizer.ts` + `tokenizer.test.ts` — the
  shifted-letter match, shared through the existing variant seam so the PET
  and VIC-20 take it with their own keyword tables; detokenizer tests pin the
  expand-on-list round trip.
- `docs/reference/commodore/escapes.md` — the caveat narrows to the display
  bank.
- `src/reference/types.ts`, `src/reference/facts.ts`,
  `src/reference/facts-crosscheck.test.ts` — the abbreviated-entry fact per
  machine, pinned by feeding each machine's own tokenizer (or, for the Atom,
  its lint) an abbreviated program.
- `src/app/programVocabulary.ts` + its test — abbreviated and symbol spellings
  resolved against the source machine's tables; resolved keywords join the
  keyword list.
- `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts` — the wider payload.
- `src/reference/compare.ts`, `portDescription.ts` + tests — the
  expansion finding among the mechanical work, the different-meaning warning,
  and the fit-gated spellings measure.
- `docs/.vitepress/theme/components/DialectCompare.vue` — the narrowed
  finding, and an abbreviated-entry fact row.
- `src/ai/portReport.ts` — the findings join the hand-over.
- `e2e/porting-guidance/` — one browser assertion, extending an existing
  journey.

One risk to review with open eyes: a mixed-case name like `pO` in existing
Commodore source is reinterpreted as `POKE` — the same trade the real machine
makes, called out in the tokenizer's tests.

Reuses the posed-decision convention from the number-model proposal and the
fit-pressure gate worded by the conditional-memory proposal; independent of
both in code.

No dependency changes, no storage or share-format changes. The per-machine
reference the assistant's system prompt carries is unchanged unless a
machine's authored prose needed the fact anyway — the abbreviated-entry fact
feeds the comparison, not the machine reference.
