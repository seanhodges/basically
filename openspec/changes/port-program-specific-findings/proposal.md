## Why

The porting guide and the AI assistant both state porting rules in general terms but
never say what the user's own program has to change. The guide tells a reader the ZX81
takes one statement per line; nothing counts the packed lines in the program they have
open, so a converted program arrives with them intact. Worse, one whole class of
difference is stated nowhere at all: which printable characters a machine cannot
represent. The ZX81 has no `!`, and the assistant discovers this only after writing
one, when tokenizing fails. And the comparison already computes a bucket of control
codes that keep their spelling but change meaning between machines — the trap that
makes ZX80 and ZX81 graphics port silently wrong — which is rendered nowhere and sent
to nobody.

## What Changes

- Each machine gains a **character-set repertoire** fact: the printable ASCII its
  character set has no glyph for. Authored per machine and pinned to the dialect's
  charset so it cannot drift.
- The program analyser additionally reports **which characters the program uses** and
  **which of its lines carry more than one statement**, so both can be narrowed to the
  program the same way commands and control codes already are.
- The comparison gains two narrowed findings — the characters this program uses that
  the target cannot represent, and how this program's statement layout must change —
  and reports the **control codes whose meaning changes** alongside those that must be
  replaced.
- The assistant's standing description of a machine gains the characters it cannot
  represent and how it spells its control codes, so it writes correct code rather than
  learning from a tokenizer error afterwards.
- The port report sent when converting a program gains the **language rules that
  differ** between the two machines, the characters to replace, the lines to split, and
  the control codes whose meaning changes. It carries none of these today.

## Non-goals

- No new porting advice is authored for other language rules (`LET`, `ELSE`, variable
  name length, numeric type). Those are already stated where they belong; this change
  makes the reporting *machinery* program-specific, and adding more prose is separate
  work.
- The program analyser stays a text scan. It does not become a tokenize round trip, so
  abbreviated keyword entry stays under-reported exactly as it is today.
- No change to how a character outside a machine's set is handled once written: it
  remains a fatal tokenizer error.
- Non-ASCII characters (block graphics, `£`, accented forms) are out of scope for the
  repertoire fact; they are already covered by the escape-code tables.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: the comparison reports the characters the target cannot
  represent and how the program's statement layout must change; control codes that
  keep their spelling but change meaning are reported as differences; the closed list
  of buckets narrowed to the open program gains the two new findings.
- `ai-assistant`: the machine's complete definition carried with every request gains
  the characters it cannot represent and how it spells its control codes.

## Impact

- `src/reference/`: `types.ts` (`PortingFacts`), `facts.ts`, `compare.ts`,
  `machineDescription.ts`, `portDescription.ts`, and the `facts-crosscheck.test.ts` /
  `portDescription.test.ts` / `compare.test.ts` guards.
- `src/app/programVocabulary.ts` and the iframe reply it posts to the docs bundle —
  additive fields only, so an older cached docs bundle keeps working.
- `src/ai/machineReference.ts`: the escape table already loaded for the port path is
  wired into the machine description too. The system prompt stays byte-stable per
  dialect, so provider prefix caching is unaffected.
- `src/dialects/types.ts` and every registered dialect: `Dialect` gains
  `statementSeparator`, the language rule the program analyser needs and the one
  `memoryWrites.statementSep` cannot express. See design decision 3.
- `docs/.vitepress/theme/components/DialectCompare.vue` and
  `docs/reference/porting-basics.md`.
- One field added to the `Dialect` seam (above); no change to `MachineEmulator`, and no
  new dependencies.
