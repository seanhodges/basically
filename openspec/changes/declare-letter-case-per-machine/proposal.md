## Why

"Does this machine have lower case?" is not one question. It is three
independent ROM facts — whether the character generator can draw lower case,
whether the ROM's keyword scan accepts a lower-case spelling, and whether the
ROM tells `A` from `a` in a variable name — and the registered machines cover
every combination of them. Nothing declares any of the three, so five layers
each re-derive letter case independently and disagree with one another.

The disagreements are user-visible today. A Commodore screen showing `hello`
reads back as blanks. A BBC program is highlighted as calling `PRINT` and
flagged in the same breath for not calling it. The PMD 85's variable checks
report a collision between two names the machine keeps apart, while the usages
bar on the same program says they are two variables. A BBC program that uses
both `a` and `A` ports to a folding machine with no collision reported. And the
BBC's own bundled `breakout` sample calls `PROCblk`, which cannot be typed on
the BBC's on-screen keyboard.

## What Changes

- **New leaf table of the letter-case facts**, one entry per registered machine,
  stating the three ROM facts plus what the dialect's charset does with a
  lower-case letter — the fourth fact, which is what makes the other three
  usable (on machines whose charset folds, a lower-case keyword really does run,
  whatever the ROM's scan does).
- **Every layer that folds case to guess now reads the declared fact**: the
  highlighter, the document variable scanner, the abbreviation reader, the
  variable lint, the variable usages view, the program vocabulary, and the
  porting collision report. Two of these currently disagree with each other on
  the same program; after this they cannot.
- **The Atom's lower-case-keyword warning generalises** to every machine whose
  charset preserves lower case and whose ROM refuses it — the BBC Micro, the
  BBC Master and the PMD 85. Non-fatal, as the Atom's is: it never blocks
  building, running or exporting.
- **Commodore screens report the letters they are showing.** The text-set
  letters are decoded directly instead of being routed through the graphics-set
  table, where they have no character and fall through to a space.
- **The TRS-80 commits to the Model I it is declared as.** Its screen read
  folds to upper case exactly as its display does, through one shared helper,
  so a screen read and the screen agree.
- **BREAKING (keyboard layouts):** machines with lower-case hardware gain a way
  to type it — a shift-layer case pair on the BBC pair and the CPC pair, and a
  case-lock keycap where the machine has one. A keycap shows the case it will
  type. Machines with no lower case gain neither.

## Non-goals

- **Direct typing into a running machine.** Browser key events already reach
  each machine's key matrix with shift state honoured and case preserved where
  the machine has it; that layer is the most accurate one in the app and is not
  touched.
- **A TRS-80 Model III (or a lower-case-modded Model I) dialect.** The stock
  Model I has no lower case, and a variant belongs in a sibling dialect later,
  the way the BBC Master and the CPC 6128 do — not as a retcon of this one.
- **Modelling the Commodore lower-case display bank beyond the screen read.**
  The set switch is already derived from real chip state on all three machines;
  this change fixes the decode that consumes it and does not extend the model.
- **Changing what any tokenizer stores.** Byte streams stay as they are, so
  every round trip, cassette export and native binary is unaffected. Where a
  dialect's tokenizer accepts a spelling its ROM would refuse, it keeps doing
  so and reports it.
- **Auto-correcting the user's case.** Nothing uppercases typed text.

## Capabilities

### New Capabilities

None. Letter case is a property of behaviour the existing capabilities already
own, not a new capability of its own.

### Modified Capabilities

- `dialect-toolchain`: new requirement that every registered machine declares
  its letter-case facts; new requirement that a lower-case keyword is reported
  where it will not run; the charset round-trip requirement gains the folding
  rule it is currently silent about.
- `code-editor`: highlighting, completion and abbreviation reading treat a
  lower-case word as a keyword only where the machine would; where it would not,
  it is a variable name throughout — coloured, completed, outlined and renamed
  as one. The variable-usages case rule is extended to bind the editor's
  variable *checks*, so the lint and the usages view cannot disagree.
- `virtual-input`: new requirement that both letter cases are reachable on every
  machine whose character generator can draw them, by the route the machine
  itself uses, with the keycap showing the case it types.
- `porting-guidance`: a difference in letter case counts as a difference in name
  where the source machine distinguishes it, so two names a case-sensitive
  source keeps apart are reported as colliding on a folding target.
- `program-execution`: the existing guarantee that screen text is "the
  characters the program put on the screen" gains a scenario pinning letter
  case, which the Commodore and TRS-80 readers currently violate.

## Impact

- **New:** `src/dialects/letterCase.ts` (the declared facts and the predicates
  derived from them), `src/editor/variableIdentity.ts` (one name-identity rule,
  extracted from the one correct implementation), `src/editor/keywordCase.ts`
  (one diagnostic message for three machines).
- **Editor:** `basicLanguage.ts`, `variables.ts`, `variableLexis.ts` (stops
  authoring `caseSensitive`, becomes the derivation boundary), `variableLint.ts`,
  `variableUsages.ts`.
- **Dialects:** `keywordSpellings.ts`, `glyphSources.ts`, the Atom, BBC Micro
  and PMD 85 tokenizers (diagnostic only — no change to the bytes they emit),
  the TRS-80 charset comment, display and interpreter screen read.
- **Emulator:** `src/emulator/cbmScreenText.ts`.
- **Reference and porting:** `src/reference/types.ts`, `facts.ts`, `compare.ts`,
  `src/app/programVocabulary.ts`.
- **Keyboard:** `layoutSchema.ts`, `inputEngine.ts`, `editorActions.ts`,
  `legendKit.ts`, `VirtualKeyboard.tsx`, and the BBC, Master, CPC 464, CPC 6128,
  Spectrum, C64, PET and VIC-20 layouts.
- **Docs:** `docs/reference/file-formats.md` and `docs/guide/writing-basic.md`
  each carry a claim about case that is false for several machines;
  `docs/reference/bbc.md` says nothing about case on the one machine family
  where it decides variable identity.
- **No dependency, licence or ROM changes.** No stored byte stream changes, so
  no export, cassette or share-link format is affected.
