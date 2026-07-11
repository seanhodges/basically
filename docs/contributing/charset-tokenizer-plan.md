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
| 2     | Sinclair (ZX81/ZX80): total charset                 | ⬜     |
| 3     | ZX81/ZX80: numeric payloads & tokenizer leniency    | ⬜     |
| 4     | Spectrum 48/128: code-context bytes & containers    | ⬜     |
| 5     | BBC: context-aware import, escapes, Master BASIC IV | ⬜     |
| 6     | C64: petcat interop, containers, readability        | 🔨     |
| 7     | TRS-80: ROM-faithful forms, escapes, runtime        | ⬜     |
| 8     | Atom: total charset, lint vs buildability, FP ROM   | ⬜     |
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

## Stage 2 — Sinclair (ZX81/ZX80): total charset ⬜

Make the shared Sinclair charset total (audit ZX81/ZX80 findings F1–F3, F5,
F10). Highest-impact fix in the repo: currently 128/256 byte values per
machine collapse to `?`.

- [ ] Add a raw-byte escape to `sinclairCharset.ts` (e.g. `\{C4}`,
      zxtext2p-compatible where practical): `codeToText` emits it for every
      code with no printable/keyword form (replace the `'?'` fallback at
      `sinclairCharset.ts:117`); `parseChar` accepts it everywhere.
- [ ] Detokenizers stop routing string/REM bytes through lossy paths: keyword
      tokens inside strings become raw escapes (or keyword text where it
      re-tokenizes identically); the ZX81 REM body becomes byte-exact — emit
      `\{76}` for embedded NEWLINE instead of `'\n'`
      (`zx81/detokenizer.ts:79`), stop stripping trailing REM spaces
      (`zx81/detokenizer.ts:98`).
- [ ] Fix raw-quote-in-string detokenization (0x0B ZX81 / 0x01 ZX80 → escape,
      not `"""`), and accept `'\n'` in `toMachine` as the newline code for
      API symmetry (`sinclairCharset.ts:96-100`).
- [ ] Wire both dialects' unrepresentable-byte counts into the Stage 1 report.
- [ ] Round-trip fixtures: a `.P` with a machine-code REM line, tokens inside
      a string, and control bytes; the equivalent `.O`. All must round-trip
      byte-exactly.

**Depends on:** Stage 1 (report + harness).
**Verify:** `npm test` (charset + detokenizer + new round-trip fixtures);
import a real-world machine-code-REM `.P` and re-export it unchanged.

## Stage 3 — ZX81/ZX80: numeric payloads & tokenizer leniency ⬜

The remaining Sinclair items (findings F4, F6, F8, F9, F11, F12).

- [ ] Preserve the ZX81 `0x7E` float payload: on detokenize, compare the
      stored 5-byte float against re-encoding the printed digits; when they
      differ (or digits are absent) emit an override notation (e.g.
      `20\{=9999}`) that the tokenizer honours. Validate `encodeZxFloat`
      against ROM-produced bytes for a corpus of literals (`zxfloat.ts:31`).
- [ ] Accept `GO TO` / `GO SUB` spellings in the ZX80 tokenizer after
      confirming the 4K ROM keyword strings (`zx80/keywords.ts:116-121`).
- [ ] ZX81 tape names: scan beyond 10 bytes for the bit-7 terminator on
      decode (`zx81/audio/cassetteDecoder.ts:36`); relax `encodeName`'s
      `[A-Z0-9 ]` filter to the full charset (`cassetteEncoder.ts:27-35`).
- [ ] ZX80 integer literals > 32767: store digits as typed with a warning
      instead of erroring (`zx80/tokenizer.ts:183-188`).
- [ ] Decide + document: out-of-order pasted lines — sort (hardware
      behaviour) or keep the error; verify the ZX80 quote-image (0x81)
      convention against the ROM and document it either way
      (`zx80/charset.ts:91-92`).

**Depends on:** Stage 2.
**Verify:** `npm test`; a protection-style `.P` (digits ≠ float) imports and
re-exports byte-identically.

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

## Stage 5 — BBC: context-aware import, escapes, Master BASIC IV ⬜

Fix the context-blind detokenizer and give the BBC an escape notation
(findings 1–11 of the BBC audit).

- [ ] Make `decodeBody` context-aware (`bbcmicro/detokenizer.ts:32-56`): track
      quote state and verbatim mode after REM/DATA/`*`, mirroring the
      tokenizer's own inbound paths (`tokenizer.ts:193/219/259`); stop
      decoding tokens and 0x8D inside literals.
- [ ] Add an escape notation for string/REM/DATA contexts covering 0x00–0x1F,
      0x7F and 0x80–0xFF — style suggestion: Spectrum-like `{0xNN}` plus named
      teletext escapes (`{RED}`, `{FLASH}`, …) for 0x80–0x9F. Accept in the
      tokenizer's literal paths, emit from the detokenizer.
- [ ] Map 0x7F both ways; add a dedicated `charset.test.ts` pinning behaviour
      for 0x00–0x1F / 0x7F / 0x80–0xFF in both directions.
- [ ] Report structural problems (truncated `.bbc`, bad length bytes) through
      the Stage 1 warning channel instead of silently stopping
      (`detokenizer.ts:16-27`).
- [ ] Tighten line numbers: reject entered lines > 32767 (matching the ROM
      and both AI profiles, `tokenizer.ts:17`); lint GOTO/GOSUB targets that
      would wrap at `tokenizer.ts:178`.
- [ ] Master/BASIC IV: parameterise the keyword table; add EDIT (0xCE) for
      detokenize; allow `EXT#ch=` as a statement; pin TIME$ byte output with a
      test in `bbcmaster.test.ts`.
- [ ] Optional: dot-abbreviation expansion (`P.` → PRINT) for pasted
      listings.
- [ ] Round-trip fixtures: a MODE 7 teletext program with colour bytes and
      0x8D inside strings; a truncated `.bbc`.

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

## Stage 7 — TRS-80: ROM-faithful forms, escapes, runtime ⬜

Fix the stored-form divergences first (they corrupt every real tape), then
totalise the charset (findings F1–F14 of the TRS-80 audit).

- [ ] `'` comments: emit `3A 93 FB` on tokenize; map 0xFB after REM back to
      `'` (collapsing the `:REM` prefix) on detokenize
      (`keywords.ts:177-186`, `detokenizer.ts:54-61`).
- [ ] `ELSE`: emit the implicit `:` (`3A 95`) on tokenize; hide it on
      detokenize to match LIST (`tokenizer.ts:160-171`).
- [ ] Rebase `PROG_START` to 0x42E9 (`tokenizer.ts:18`, `casfile.ts`,
      `emulator/trs80Machine.ts:139-144`, `aiProfile.ts:6`); add a test that
      parses a real-base link chain and trims tape run-out noise.
- [ ] Totalise the charset with an escape notation (`language.ts:23`
      currently opts out): 0x00–0x1F controls, 0x80 blank-graphics, 0xC0–0xFF
      compression codes, and preserved lower-case 0x60–0x7F. Model the
      0xC0–0xFF range as space-compression (print semantics), not glyph
      duplicates (`charset.ts:91`).
- [ ] Alias `^` to the 0xD1 power token; keep `↑` in LIST/detokenize output
      (`keywords.ts:106`); consider adding ↑ to the virtual keyboard.
- [ ] Runtime fidelity: implement display-driver control codes in `Screen`
      (13 newline, 8 backspace-erase, 23 double-width, 28–31 home/CR/clears,
      14/15 cursor on/off), route `CHR$`/`ASC` through codes not glyphs
      (`interpreter/builtins.ts:47-49`, `interpreter/screen.ts:45-56`); print
      0xC0–0xFF as n spaces; fix the `1E-5` exponent-sign lexing
      (`interpreter/lex.ts:74-83`).
- [ ] Recognise Model III 1500-baud `.cas` framing (0x55 leader, 0x7F sync) in
      `isCasImage`/`parseCasImage`, or fail with a message naming the format
      (`casfile.ts:71-93`).
- [ ] Round-trip fixtures: a genuine-form tape with `'` comments, `:ELSE`,
      controls-in-strings and lower-case text.

**Depends on:** Stage 1.
**Verify:** `npm test`; export `.cas` of a `'`/ELSE program is byte-identical
to the documented real CSAVE form; the fixture tape imports/re-exports
byte-exactly.

## Stage 8 — Atom: total charset, lint vs buildability, FP ROM ⬜

(Findings F1–F15 of the Atom audit.) Two items need primary-source
verification before coding — marked ⚠.

- [ ] Totalise the charset: `%c`-style inverse-video prefix for bit-7 bytes
      (stop masking at `charset.ts:36`) and a raw escape for 0x00–0x1F / 0x7F
      (stop emitting bare `?` at `charset.ts:38`); parse both in `toMachine`.
- [ ] Apply the Stage 1 lint/buildability split: statement-shape findings
      (`tokenizer.ts:104-133`) stop zeroing the image (`index.ts:40`).
- [ ] ⚠ FP ROM coverage: verify the FP statement list (`FDIM`, `FIF`,
      `FINPUT`, `FPRINT`, `FPUT`, `FGET`, `FUNTIL`, `%A`–`%Z` variables)
      against _Atomic Theory and Practice_ / the FP ROM keyword table, then
      accept `%` and F-statement heads in `validateStatements` and add the
      missing keywords (`LEN` at minimum) to `keywords.ts`.
- [ ] Accept `*` COS-command statement heads (`*CAT`, `*LOAD`, …).
- [ ] Import hardening: `stripAtmHeader` checks load address (#2900) and
      leading 0x0D, throwing a clear "not a BASIC program" error
      (`atm.ts:60-69`); cassette decoder verifies block-number continuity and
      surfaces the header load address (`cassetteDecoder.ts:150-159`,
      `186-191`); truncated images warn via Stage 1.
- [ ] Warn on export of lower-case keywords ("won't run on a real Atom") or
      normalise keywords to upper case in the build path, keeping import
      lenient (`charset.ts:9-11`).
- [ ] Disambiguate digit-leading bodies on detokenize (insert a separating
      space, `detokenizer.ts:26`).
- [ ] ⚠ Doc/verification sweep: line-0 acceptance, ↑/← glyphs at 0x5E/0x5F,
      `;` statement-separator docs (`keywords.ts:24-25`, `aiProfile.ts:11`).
- [ ] Round-trip fixtures: an `.atm` with inverse-video strings, a `*CAT`
      line and an FP statement; a machine-code `.atm` (must error, not import
      empty).

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
