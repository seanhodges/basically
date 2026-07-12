# Charset & tokenizer feature-completeness plan

> Staged remediation for the gaps catalogued in
> [`charset-tokenizer-audit.md`](charset-tokenizer-audit.md). Each stage is a
> medium, single-session task. Stage 1 is the foundation every other stage
> reports through; Stages 2–8 are per-machine and independent of each other
> (run in any order — the order below is by user impact); Stage 9 closes the
> loop on docs and discoverability. Tick the checklist and update the status
> legend as stages land.

**Definition of feature complete** (the target every stage drives toward):

1. **Total charset** — every byte 0x00–0xFF has a text form `toMachine` maps
   back to the same byte. Unmappable bytes get a _dialect-styled raw escape_
   (Spectrum-style `{0xNN}`, C64-style `{$xx}`, Sinclair `\{NN}`), never
   `?`/space/silence.
2. **Context-aware detokenize** — tokens/markers are only interpreted outside
   strings, REM and DATA; inside, bytes round-trip exactly.
3. **ROM-faithful stored forms** — `tokenize` emits what the real ROM stores;
   hidden payloads (Sinclair floats) survive import.
4. **Loud containers** — binary/tape parsers detect truncation, trailing
   machine code, foreign load addresses and bad checksums, and report them.
5. **Import never yields text that won't re-tokenize.**

## Status legend

✅ shipped · 🔨 in progress · ⬜ planned · ⛔ blocked

| Stage | Title                                               | Status |
| ----- | --------------------------------------------------- | ------ |
| 1     | Import-fidelity contract + shared round-trip tests  | ✅     |
| 2     | Sinclair (ZX81/ZX80): total charset                 | ✅     |
| 3     | ZX81/ZX80: numeric payloads & tokenizer leniency    | ✅     |
| 4     | Spectrum 48/128: code-context bytes & containers    | ⬜     |
| 5     | BBC: context-aware import, escapes, Master BASIC IV | ✅     |
| 6     | C64: petcat interop, containers, readability        | 🔨     |
| 7     | TRS-80: ROM-faithful forms, escapes, runtime        | ✅     |
| 8     | Atom: total charset, lint vs buildability, FP ROM   | ✅     |
| 9     | Docs, samples, AI profiles                          | ⬜     |

---

## Stage 1 — Import-fidelity contract + shared round-trip tests ✅

Cross-cutting infrastructure (audit findings C1, C3, C5). No per-dialect
charset changes yet; this stage makes losses _visible_ and gives every later
stage its acceptance test.

- [x] Extend the `Dialect` seam with an import report: the optional
      `detokenizeWithReport(image): { source, warnings }`
      (`src/dialects/types.ts`), preferred by the import paths and falling
      back to bare `detokenize`. Dialects grow it in Stages 2–8 as their
      importers learn to detect loss (unmappable bytes, truncation, trailing
      non-BASIC data, foreign load addresses, checksum failures).
- [x] Surface warnings in the Import dialog and drag-drop status notice:
      `src/app/importProgram.ts` is the shared import step (binary files,
      drag-drop, cassette decode) — it merges the dialect's own report with a
      dialect-agnostic check (empty output, or output that no longer
      tokenizes, means the file held content the text form loses) and the
      status line becomes "Imported x, but: …" instead of unconditional
      success. Wired into `ImportDialog.tsx` and `fileCommands.ts`.
- [x] Split "editor lint" from "cannot build an image":
      `TokenizeError.fatal?: boolean` (absent/true = framing, blocks the
      image; false = statement-shape heuristic, squiggle only) and
      `hasFatalErrors()` in `types.ts`; every image-gating dialect now gates
      on it instead of `errors.length`. The Atom's statement-shape lint
      (`atom/tokenizer.ts` `flag()`) is marked non-fatal, so imported
      `*CAT`/FP lines run again; audit of the other dialects found their
      statement checks intertwined with token emission, so downgrades are
      deferred to their own stages (C64 line-number rules → Stage 6).
      `TransferDialog` still refuses to export with _any_ error — revisit
      per-dialect. Tests: `atom/tokenizer.test.ts`.
- [x] Shared **import-direction round-trip harness**:
      `src/dialects/roundTripHarness.ts` (`importRoundTrip`,
      `isAcceptableImport` — byte-exact or warned) plus the registry-driven
      `src/dialects/roundTrip.test.ts` pinning every dialect's samples as a
      byte-exact baseline (35 cases). Stages 2–8 add foreign-image fixtures
      through the same helpers.
- [x] "Definition of feature complete" documented in
      `docs/contributing/adding-a-dialect.md` (charset/import
      feature-completeness checklist for new dialects).

**Depends on:** nothing.
**Verify:** `npm run typecheck` + `npm test`; import a truncated file in the
app and see a warning notice.

## Stage 2 — Sinclair (ZX81/ZX80): total charset ✅

Make the shared Sinclair charset total (audit ZX81/ZX80 findings F1–F3, F5,
F10). Highest-impact fix in the repo: currently 128/256 byte values per
machine collapse to `?`.

- [x] Add a raw-byte escape to `sinclairCharset.ts` (`\{NN}`,
      zxtext2p-style): `codeToText` emits it for every code with no
      printable/keyword form (replaced the `'?'` fallback); `parseChar`
      accepts `\{NN}` everywhere.
- [x] Detokenizers stop routing string/REM bytes through lossy paths: keyword
      tokens and control codes inside strings become raw escapes (via the now
      total `toUnicode`); the ZX81/ZX80 REM body is byte-exact — embedded
      NEWLINE emits `\{76}`, and trailing REM spaces emit `\{00}` so the
      tokenizer's per-line trim can't eat them.
- [x] Accept `'\n'` in `toMachine` as the newline code for API symmetry; the
      newline (0x76) renders as `\{76}` inside a body (the app splits lines on
      it). The quote-image stays the readable `""`; malformed unterminated
      strings surface through the import report rather than emitting `"""`.
- [x] Wire both dialects' non-standard-byte counts and structural (truncation)
      problems into the Stage 1 report via `detokenizeWithReport`
      (`sinclairImportReport.ts`, `detokenizer.ts` `structuralWarnings`).
- [x] Round-trip fixtures: a `.P` with a machine-code REM line (embedded 0x76,
      trailing spaces), tokens inside a string, control bytes and a fake-float
      protection number; the equivalent `.O`. All round-trip byte-exactly
      (`zx81/foreignRoundTrip.test.ts`, `zx80/foreignRoundTrip.test.ts`).

**Depends on:** Stage 1 (report + harness).
**Verify:** `npm test` (charset totality + detokenizer + new round-trip
fixtures).

## Stage 3 — ZX81/ZX80: numeric payloads & tokenizer leniency ✅

The remaining Sinclair items (findings F4, F6, F8, F9, F11, F12).

- [x] Preserve the ZX81 `0x7E` float payload: on detokenize, compare the
      stored 5-byte float against re-encoding the printed digits; when they
      differ (or digits are absent) emit an override notation (`20\{=9999}`,
      or `\{=$HHHHHHHHHH}` raw bytes for a non-canonical float) that the
      tokenizer honours (`zxfloat.ts`, `detokenizer.ts`, `tokenizer.ts`).
      `encodeZxFloat` is pinned against a corpus of ROM byte vectors
      (`zxfloat.test.ts`).
- [x] Accept `GO TO` / `GO SUB` spellings in the ZX80 tokenizer (the 4K ROM
      keyword table lists the spaced forms); both collapse to the GOTO/GOSUB
      token (`zx80/tokenizer.ts`).
- [x] ZX81 tape names: scan the whole leading run for the bit-7 terminator on
      decode (no 10-byte cap); `encodeName` accepts the full charset (skipping
      only characters with no ZX81 form) (`cassetteDecoder.ts`,
      `cassetteEncoder.ts`).
- [x] ZX80 integer literals > 32767: stored as typed with a non-fatal warning
      instead of erroring, so such programs stay buildable
      (`zx80/tokenizer.ts`).
- [x] Decide + document: out-of-order pasted lines keep the error (not
      silently sorted — a paste mistake is more likely than intent to
      reorder); the ZX80 quote-image (0x81) is documented as an app convention
      unverified against the ROM (`zx80/charset.ts`, `zx81/tokenizer.ts`).

**Depends on:** Stage 2.
**Verify:** `npm test`; a protection-style `.P` (digits ≠ float) imports and
re-exports byte-identically (`zx81/foreignRoundTrip.test.ts`).

## Stage 4 — Spectrum 48/128: code-context bytes & containers ⬜

The Spectrum charset is already total; close the code-context and container
gaps (findings 1–8 of the Spectrum audit).

- [ ] Preserve bytes outside strings/REM: detokenizer emits `{0xNN}` /
      directives instead of dropping (`detokenizer.ts:110-115`, `139-143`);
      tokenizer accepts `{...}` escapes outside string context too
      (`tokenizer.ts:169-183`).
- [ ] Preserve the hidden `0x0E` float: emit an override notation when the
      5-byte form disagrees with the digits (mirror Stage 3's design), honour
      it on tokenize (`detokenizer.ts:106-109`, `tokenizer.ts:284-288`).
- [ ] Spaces policy: preserve 0x20 separators through tokenize
      (hardware-faithful) — or explicitly document byte-exactness as
      out-of-scope and have the round-trip harness normalise. Preference:
      preserve.
- [ ] Accept line 0 (and 0–16383) at tokenize time with a lint warning
      instead of an error (`tokenizer.ts:87-102`), so `0 REM` protection
      imports keep working.
- [ ] Harden `parseTap` (`tapfile.ts:155-177`): pair headers with their
      following data block, skip CODE/array files instead of throwing, verify
      the parity byte in both `.TAP` import and the cassette decoder, report
      failures through the Stage 1 warning channel.
- [ ] 128K polish: restrict UDG escapes to `\a`–`\s` on the 128 dialect (warn
      on `\t`/`\u`); expand 0xA3/0xA4 correctly per dialect; route header
      names through the charset (`tapfile.ts:56-62`); fix the stale comment in
      `zxspectrum128/index.ts:29-34`.

**Depends on:** Stage 1.
**Verify:** `npm test`; a multi-file compilation `.TAP` and a fake-constant
protected `.TAP` both import with correct warnings and re-export faithfully.

## Stage 5 — BBC: context-aware import, escapes, Master BASIC IV ✅

Fix the context-blind detokenizer and give the BBC an escape notation
(findings 1–11 of the BBC audit).

- [x] Make `decodeBody` context-aware (`bbcmicro/detokenizer.ts`): tracks
      statement-start, string and verbatim (REM/DATA/`*`) state, mirroring the
      tokenizer's own inbound paths; keyword tokens and the 0x8D line-number
      marker are only interpreted in expression context, so a colour byte in a
      MODE 7 string no longer LISTs as `DIV` and 0x8D-in-a-string no longer
      eats three data bytes.
- [x] Escape notation for literal contexts covering 0x00–0x1F, 0x7F and
      0x80–0xFF: Spectrum-like `{0xNN}` plus named teletext escapes (`{RED}`,
      `{FLASH}`, `{DOUBLE HEIGHT}`, `{GRAPHICS BLUE}`, …) for 0x80–0x9F
      (`charset.ts` `TELETEXT_NAMES`/`parseChar`/`decodeSpan`). Accepted in the
      tokenizer's string/REM/DATA/`*` paths, emitted by the detokenizer.
- [x] 0x7F mapped both ways (`{0x7F}`); dedicated `bbcmicro/charset.test.ts`
      pins 0x00–0x1F / 0x7F / 0x80–0xFF in both directions (all 256 bytes
      round-trip decode→parse).
- [x] Structural problems reported through the Stage 1 warning channel:
      `detokenizeWithReport` warns on a bad length byte, a line that runs past
      the image end, and a missing 0x0D 0xFF end marker (wired into both BBC
      dialects' `detokenizeWithReport`).
- [x] Line numbers tightened: entered lines above 32767 are a non-fatal lint
      (still storable/runnable so imports survive), and lino targets above
      32767 (which wrap) are linted; `> 65279` stays fatal.
- [x] Master/BASIC IV: keyword table parameterised into `BASIC_II`/`BASIC_IV`
      variants threaded through the shared tokenizer/detokenizer; EDIT (0xCE)
      added for BASIC IV; `EXT#ch=` accepted as a statement on the Master;
      TIME$ / TIME$= byte output pinned in `bbcmaster.test.ts`.
- [x] Dot-abbreviation expansion (`P.` → PRINT, `ERR.` → ERROR, `GOS.` →
      GOSUB) for pasted/typed listings: `matchAbbreviation` resolves a
      `letters.` run against the ROM's keyword scan order
      (`ABBREVIATION_TOKEN_ORDER`), consuming the dot for a proper abbreviation
      and leaving a fully-typed keyword's dot literal. Verified byte-for-byte
      against the genuine ROM for every abbreviation of every keyword.
- [x] Round-trip fixtures: a MODE 7 teletext program with colour bytes and
      0x8D inside strings (byte-exact); a truncated `.bbc` (reported, not
      silently shortened).

**Depends on:** Stage 1.
**Verify:** `npm test` (including the existing jsbeeb-oracle corpus, which
must stay byte-identical); import a teletext `.bbc` and re-export unchanged.

## Stage 6 — C64: petcat interop, containers, readability 🔨

The PETSCII table is already total and injective; make it interoperable and
the `.prg` path honest (findings 1–12 of the C64 audit).

- [x] Accept petcat/VICE aliases on parse (`petscii.ts`): `{wht}` `{blk}`
      `{grn}` `{blu}` `{yel}` `{cyn}` `{pur}` `{lred}` `{orng}` `{brn}`
      `{gry1}`–`{gry3}` `{lgrn}` `{lblu}` `{rght}` `{rvof}` `{sret}`
      `{swlc}`/`{swuc}` `{f1}`–`{f8}` `{space}` `{shift-space}`,
      `{CBM-x}`/`{SHIFT-x}`, and decimal `{nnn}`. Canonical names kept on
      decode; the aliases are parse-only inputs (`PETCAT_ALIASES` +
      graphics-derived `{CBM-x}`/`{SHIFT-x}` + decimal branch in `parseC64Char`).
- [x] Name the function keys ($85–$8C → `{f1}`–`{f8}`) and $A0
      (`{shift-space}`).
- [x] `.prg` container: `detokenizeWithReport` warns "N bytes … appended
      machine code" for data after the null link, warns on a non-$0801 load
      address, and warns on truncation (`detokenizer.ts`, wired in `index.ts`).
      Re-emitting the ML payload on export is not feasible through the text
      tokenizer, so the loss is reported (Stage 1 channel) rather than silent.
- [x] Adopt Unicode Symbols-for-Legacy-Computing glyphs for the 12 genuinely
      distinct (of 18 candidate) codes in $A0–$DF — verified against the real
      character ROM bitmaps; the other 6 ($A0/$AA/$B4/$C3/$DD/$DE) are true
      hardware duplicates and stay `{$xx}`. Virtual GRAPHICS keys now insert
      their true byte for those 12 (`graphics.ts`, `petscii.ts`; code-fidelity
      test added).
- [ ] Lower-case bank: add a readable rendering for shifted-bank text (petcat
      convention or a display mode) so mixed-case imports aren't `{$xx}` soup;
      allow authoring lower-case PETSCII bytes (`petscii.ts:69-71`).
      **Deferred** — needs a display-mode flag threaded through
      detokenize/tokenize (the byte $41 is 'A' in the graphics set and 'a' in
      the lower/upper set); a charset-only change can't disambiguate. The glyph
      adoption above already removes most of the shifted-bank `{$xx}` soup.
- [~] Tokenize-only keyword abbreviations (`pO`, `gO`, `nE`, …) alongside `?`;
  accept `^` as a spelling of the `↑` power operator. `^` shipped
  (`keywords.ts`). The full abbreviation table is **deferred** — it needs a
  case-sensitive matcher and a fully ROM-verified table (a wrong entry would
  silently mis-tokenize, the very failure this plan guards against).
- [x] Downgrade out-of-range/non-ascending line numbers to warnings on import
      so such programs stay runnable (`tokenizer.ts`) — line numbers 64000–65535
      and non-ascending order are now `fatal: false`, and the statement-shape
      heuristics are too (Stage 1 lint/buildability split); >65535 stays fatal.
- [x] Route tape header filenames through the charset in both directions
      (`audio/cassetteEncoder.ts` `nameBytes`, `audio/cassetteDecoder.ts`
      `readName`).
- [x] Correct the "exact inverse" claim in `detokenizer.ts` (documents that
      LIST decodes tokens in string/REM/DATA context but we keep them verbatim).
- [x] Round-trip fixtures: a hybrid `10 SYS 2064` + ML `.prg`; a petcat
      listing pasted as source; a shifted-bank text `.prg`
      (`detokenizer.test.ts`).

**Depends on:** Stage 1.
**Verify:** `npm test`; petcat-exported listing tokenizes cleanly; hybrid
`.prg` import → export preserves the ML payload (or warns).

**Remaining before ✅:** lower-case display bank and the keyword-abbreviation
table (both noted above).

## Stage 7 — TRS-80: ROM-faithful forms, escapes, runtime ✅

Fix the stored-form divergences first (they corrupt every real tape), then
totalise the charset (findings F1–F14 of the TRS-80 audit).

- [x] `'` comments: emit `3A 93 FB` on tokenize; map 0xFB after REM back to
      `'` (collapsing the `:REM` prefix) on detokenize (`tokenizer.ts`
      keyword-emit, `detokenizer.ts` `APOSTROPHE_TOKEN`). Round-tripped in
      `foreignRoundTrip.test.ts`.
- [x] `ELSE`: emit the implicit `:` (`3A 95`) on tokenize; hide it on
      detokenize to match LIST (`tokenizer.ts`, `detokenizer.ts` `ELSE_TOKEN`).
- [x] Rebase `PROG_START` to 0x42E9 (`tokenizer.ts:18` + cascaded through
      `casfile.ts`, `emulator/trs80Machine.ts`, `aiProfile.ts`,
      `interpreter/program.ts`); `casfile.test.ts` pins the real base and the
      run-out-noise trim.
- [x] Totalise the charset with a `{0xNN}` escape notation (`charset.ts`
      rewritten with `parseChar`/`decodeSpan`): 0x00–0x1F/0x7F controls, the
      blank-graphics byte 0x80 and the 0xC0–0xFF compression codes all escape;
      lower-case 0x60–0x7F is preserved (folding removed). 0xC0–0xFF modelled
      as space-compression in the runtime, not glyph duplicates.
      `charset.test.ts` proves totality over all 256 bytes.
- [x] Alias `^` to the 0xD1 power token (`keywords.ts` `TRS80_ALIASES`); `↑`
      stays the LIST/detokenize spelling. (A dedicated ↑ virtual-keyboard key
      was left out — the `^` alias already makes the operator typeable on any
      keyboard.)
- [x] Runtime fidelity: `Screen.putCode` acts on the display-driver control
      codes (8 backspace, 13 newline, 14/15 cursor, 18 backspace-no-erase,
      28 home, 29 CR-to-line-start, 30/31 clears; 23 double-width recognised
      as a no-op mode) and prints 0xC0–0xFF as `code−0xC0` spaces; `CHR$`/`ASC`
      route through codes via `codeToRuntimeChar`/`runtimeCharToCode` (a PUA
      mapping so `ASC(CHR$(n)) === n`); the `1E-5` exponent-sign lexing accepts
      the tokenized minus (`interpreter/lex.ts`). Covered in
      `interpreter.test.ts`.
- [x] Recognise Model III 1500-baud `.cas` framing (0x55 leader, 0x7F sync) via
      `casFormat` and report it through the Stage 1 channel rather than
      mis-decoding (`casfile.ts`, `detokenizer.ts` `detokenizeProgramWithReport`).
- [x] Round-trip fixtures: a genuine-form program with `:REM'`, `:ELSE`,
      controls/graphics/compression bytes in strings and lower-case text, bare
      and Model I `.cas`-wrapped; truncation and Model III reports
      (`foreignRoundTrip.test.ts`).

**Depends on:** Stage 1.
**Verify:** `npm test`; export `.cas` of a `'`/ELSE program is byte-identical
to the documented real CSAVE form; the fixture tape imports/re-exports
byte-exactly.

## Stage 8 — Atom: total charset, lint vs buildability, FP ROM ✅

(Findings F1–F15 of the Atom audit.) Two items needed primary-source
verification before coding — marked ⚠; the verified conclusions are noted
inline.

- [x] Totalise the charset (`charset.ts` rewritten with `parseChar`/
      `decodeSpan`): a `{0xNN}` raw escape covers the control codes 0x00–0x1F /
      0x7F **and** the top-bit inverse-video bytes 0x80–0xFF (bit-7 is no longer
      masked), parsed and emitted both ways. **Deviation from the plan's `%c`
      inverse prefix:** on the FP ROM `%A`–`%Z` name the floating-point
      variables, so `%` must stay a literal character — inverse video therefore
      uses `{0xNN}`, not a `%` prefix. `tokenizer.test.ts` proves totality.
- [x] Apply the Stage 1 lint/buildability split: statement-shape lint is
      already `fatal: false` (from Stage 1) and no longer zeroes the image;
      re-confirmed for a misspelled keyword in `tokenizer.test.ts`.
- [x] ⚠ FP ROM coverage: verified `%A`–`%Z` are the FP variables (hence the
      charset keeps `%` literal, above). `validateStatements` now accepts `%`
      statement heads and the F-statement forms; `FDIM`, `FIF`, `FINPUT`,
      `FPRINT`, `FPUT`, `FGET`, `FUNTIL` and `LEN` added to `keywords.ts`.
- [x] Accept `*` COS-command statement heads (`*CAT`, `*LOAD`, …) in
      `validateStatements`.
- [x] Import hardening: `stripAtmHeader` rejects a non-BASIC `.atm` (load
      address ≠ #2900 or a payload not led by 0x0D) with a clear error
      (`atm.ts`); the cassette decoder verifies block-number continuity and the
      first block's load address (`audio/cassetteDecoder.ts`); truncated images
      warn via `detokenizeProgramWithReport`.
- [x] Warn (non-fatally) on export of a lower-case keyword ("won't run on a
      real Atom"), keeping the bytes verbatim so imports stay lenient
      (`tokenizer.ts` `warnLowerCase`).
- [x] Disambiguate digit-leading bodies on detokenize by inserting a
      separating space (`detokenizer.ts`).
- [x] ⚠ Doc/verification sweep: line 0 is accepted (unchanged); ↑/← at
      0x5E/0x5F round-trip as `^`/`_` (their display glyphs are an emulator
      concern, not the source charset); the `;` statement-separator role is now
      documented correctly in `aiProfile.ts`.
- [x] Round-trip fixtures: a program with inverse-video bytes in a string, a
      `*CAT` line and FP statements (bare and `.atm`-wrapped, byte-exact); a
      machine-code `.atm` that is rejected, not imported empty; a truncation
      report (`foreignRoundTrip.test.ts`).

**Depends on:** Stage 1.
**Verify:** `npm test`; a machine-code `.atm` import shows an error; an
inverse-video program round-trips byte-exactly.

## Stage 9 — Docs, samples, AI profiles ⬜

Make the conventions discoverable and keep them honest (audit finding C6 and
the per-dialect "escape design" items).

- [ ] Rewrite the escape tables in `docs/reference/file-formats.md`: one
      section per dialect documenting its full notation (currently only ZX81
      and Spectrum are documented; the claim that "BBC, C64, TRS-80 and Atom
      have their own … escapes defined in their charset.ts" becomes true only
      after Stages 5–8).
- [ ] Per-dialect reference pages (`docs/reference/*.md`) gain an "embedded
      control codes & graphics" section with the escape syntax and examples.
- [ ] AI profiles teach the escape syntax (e.g. C64 `{clr}`/`{down}` instead
      of only `CHR$(147)`; Spectrum `{INK 2}`; BBC teletext escapes) so the
      assistant produces idiomatic, importable code.
- [ ] At least one bundled sample per dialect exercises its escapes (keeps
      the notation continuously tested through `samples.test.ts`).
- [ ] Cross-link this plan from `docs/reference/dialect-roadmap.md` and mark
      shipped stages in the status table.

**Depends on:** Stages 2–8 (document what shipped).
**Verify:** `npm run docs:dev` renders; `npm test` samples suites pass;
`npm run format:check`.
