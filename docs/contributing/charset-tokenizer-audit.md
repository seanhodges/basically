# Charset & tokenizer feature-completeness audit

> Audit of every registered dialect's character set, tokenizer, detokenizer and
> binary/tape import-export paths, focused on **unmapped UDGs, control
> characters/sequences and byte values** that real hardware supports but the
> IDE loses or corrupts. Companion staged plan:
> [`charset-tokenizer-plan.md`](charset-tokenizer-plan.md).
>
> Method: one deep review per machine family against the actual code (all
> claims carry `file:line` evidence); the Sinclair, C64 and TRS-80 findings
> were additionally verified empirically by executing the real modules and
> enumerating byte values through `detokenize → tokenize`.

## The shape of the problem

Every import path — the Import dialog, drag-and-drop
(`src/app/fileCommands.ts:75`), and cassette decode
(`src/components/ImportDialog.tsx:72`) — funnels through
`dialect.detokenize(bytes)` and loads whatever string comes back, always
reporting success. Every export path funnels through `dialect.tokenize`.
Feature-completeness therefore reduces to four properties, per dialect:

1. **Total charset** — every machine byte 0x00–0xFF has a text form that
   `toMachine` can turn back into the same byte (glyph, named escape, or raw
   byte escape). A dialect that maps a byte to `?`/space/nothing silently
   corrupts imports.
2. **Context-aware detokenizer** — keyword tokens, line-number markers and
   numeric payloads must only be interpreted _outside_ string literals, REM
   and DATA bodies; inside them, bytes are data.
3. **Faithful stored forms** — the tokenizer must emit the same bytes the
   real ROM stores (hidden float payloads, implicit `:` before ELSE, spaces),
   or exports differ from genuine files and re-imports drift.
4. **Robust containers** — the `.P`/`.O`/`.TAP`/`.bbc`/`.prg`/`.cas`/`.atm`
   parsers must handle real-world archives (multi-file tapes, hybrid
   BASIC+machine-code files, non-default load addresses, truncation) or fail
   loudly rather than silently truncate.

No dialect currently satisfies all four. Two are close on (1): the
**Spectrum** (total via `{0xNN}` raw escapes) and the **C64** (total via an
injective 256-entry PETSCII table with `{name}`/`{$xx}` escapes). Both are the
models the plan generalises from.

### Cross-cutting gaps (affect every dialect)

- **C1 — No fidelity channel on import.** `Dialect.detokenize` returns a bare
  string (`src/dialects/types.ts:330`); there is no way to report "N bytes
  were unrepresentable / this file was truncated / trailing machine code was
  dropped". `ImportDialog.tsx:72` and `fileCommands.ts:75` therefore always
  announce success. Every silent-loss finding below is amplified by this.
- **C2 — Ambiguous fallback characters.** Sinclair maps 128 byte values to
  `'?'` (`src/dialects/sinclairCharset.ts:117`) — which is itself the glyph of
  a real code, so corruption is undetectable. BBC maps unknowns to `?`
  (`bbcmicro/charset.ts:42`), TRS-80 to space (`trs80/charset.ts:93`), Atom to
  `?` after masking bit 7 (`atom/charset.ts:36-38`). All re-tokenize without
  error to _different bytes_.
- **C3 — Lint conflated with buildability.** Several dialects zero the
  runnable image on any `TokenizeError` (`atom/index.ts:40`,
  `commodore64/index.ts:47-50`), so an import that renders fine but trips a
  heuristic (line 0, `*CAT`, non-ascending lines) can be viewed but never run
  or re-exported. Real machines store such programs and only fail (if at all)
  at RUN.
- **C4 — Hidden numeric payloads discarded.** The ZX81 (`0x7E` + 5-byte
  float) and Spectrum (`0x0E` + 5-byte float) store an authoritative binary
  number after the printed digits; both detokenizers discard it and re-derive
  it from the digits. Classic "digits say 20, float says 9999" protection
  tricks silently change meaning.
- **C5 — No import-direction tests.** Round-trip tests all start from
  app-authored source. No dialect has a fixture that starts from a _foreign_
  byte image containing control codes, tokens-in-strings, or top-bit bytes.
- **C6 — Community notations not honoured.** The C64 escapes are
  petcat-_styled_ but reject every actual petcat/VICE name; the ZX81 follows
  zxtext2p and the Spectrum follows zmakebas only partially. Pasting real
  archive listings fails.

## Per-dialect findings

Severity key: 🔴 corrupts data silently · 🟠 loses data or rejects valid
programs · 🟡 divergence/polish.

### ZX81 / ZX80 (`src/dialects/zx81/`, `zx80/`, shared `sinclairCharset.ts`)

The printable half is complete and symmetric: 0x00–0x3F plus inverse
0x80–0xBF all round-trip (block graphics `▘▝▀▖▌▞▛`, grey `\!!`-style escapes,
`%A` inverse prefix — `zx81/charset.test.ts:42-47`), and both keyword tables
are complete (ZX81 0xC1–0xFF less unused 0xC3; ZX80 0xD5–0xFE less its unused
slots). The other 128 byte values per machine do not survive.

- 🔴 **`'?'` fallback corrupts 128/256 byte values to 0x0F.**
  `sinclairCharset.ts:117`; verified for every value on both machines.
  Control/cursor codes 0x70–0x7F, unused 0x43–0x6F, and tokens have no text
  form; `?` re-tokenizes to 0x0F with zero errors.
- 🔴 **Keyword tokens inside strings destroyed.** `zx81/detokenizer.ts:52-63`,
  `zx80/detokenizer.ts:47-57` route string bytes through `toUnicode`; real
  hardware accepts tokens in strings and PRINT expands them (`CHR$(245)` →
  `PRINT`).
- 🔴 **ZX81 machine-code REMs are not import-safe.** The classic `1 REM`
  stash: bytes → `?`; an embedded 0x76 becomes `\n`, splitting the line so the
  import no longer tokenizes (`zx81/detokenizer.ts:79`); trailing spaces are
  stripped (`zx81/detokenizer.ts:98`). Real hardware preserves all of it via
  the line-length field.
- 🔴 **0x7E float payload discarded** (`zx81/detokenizer.ts:71-74`) and
  re-encoded from digits (`zx81/tokenizer.ts:195-217`); hidden-GOTO
  protection silently rewritten (verified). `encodeZxFloat` rounding vs the
  ROM parser is unvalidated (`zxfloat.ts:31`).
- 🟠 **Raw quote byte inside a string** (0x0B ZX81 / 0x01 ZX80) detokenizes to
  `"""` → "Unterminated string" on re-tokenize.
- 🟠 **ZX80 `GO TO` / `GO SUB` spellings rejected** (`zx80/keywords.ts:116-121`;
  the 4K ROM lists the spaced forms) — period listings fail to paste.
- 🟡 `toMachine('\n')` throws while `toUnicode(0x76)` emits `'\n'`
  (`sinclairCharset.ts:96-100`); ZX81 tape names capped at 10 bytes on decode
  and over-filtered on encode (`zx81/audio/cassetteDecoder.ts:36`,
  `cassetteEncoder.ts:27-35`); ZX80 integers > 32767 rejected at edit time
  (`zx80/tokenizer.ts:183-188`); out-of-order lines error instead of sorting;
  ZX80 quote-image convention (0x81, `zx80/charset.ts:91-92`) is app-invented
  and unverified against the ROM.

### ZX Spectrum / 128 (`src/dialects/zxspectrum/`, `zxspectrum128/`)

The strongest dialect: the charset is **total** — every byte has a
re-encodable form (`{0xNN}` fallback, `{INK n}`…`{TAB n}` directives, `\a`–`\u`
zmakebas UDGs, block glyphs), proven by its own tests
(`charset.test.ts:106-114`), and everything inside strings/REM round-trips
byte-exactly (`detokenizer.test.ts:119-127`). Gaps sit outside string
contexts and at container level.

- 🔴 **Bytes outside strings/REM are dropped** — UDGs, colour controls and
  their operands vanish (`detokenizer.ts:110-115`, `139-143`), and the
  tokenizer accepts no escapes there (`tokenizer.ts:169-183`), so
  colour-listing and protection bytes are unrepresentable, not just lossy.
- 🔴 **Hidden 0x0E float discarded** (`detokenizer.ts:106-109`) and re-derived
  via `parseFloat` (`tokenizer.ts:284-288`); fake-constant protection changes
  behaviour; `encodeSpectrumNumber` may drift a mantissa LSB (`numbers.ts:20-66`).
- 🟠 **Inter-token spaces never emitted** (`tokenizer.ts:188-192`) — no real
  .TAP round-trips byte-exactly (semantics preserved, bytes not).
- 🟠 **Line 0 / lines > 9999 rejected** (`tokenizer.ts:87-94`) though the
  detokenizer emits them (`0 REM` protection is common), so imports lint-fail;
  same for non-ascending lines (`tokenizer.ts:95-102`).
- 🟠 **`parseTap` fragile** (`tapfile.ts:155-177`): first-header/first-data
  pairing breaks CODE-first tapes and compilations; parity byte never checked
  (`tapfile.ts:148`), nor in the audio decoder
  (`audio/cassetteDecoder.ts:146-167`).
- 🟡 **128K divergences unmodelled**: real 128K has 19 UDGs (A–S) with
  0xA3/0xA4 as SPECTRUM/PLAY, but the 128 dialect reuses the 48K charset
  verbatim (`zxspectrum128/charset.ts:4`); a 128 tape imported under the 48K
  dialect drops PLAY/SPECTRUM tokens outside strings. Also: tokens inside
  strings render as `{0xNN}` rather than keyword text; header names bypass the
  charset (`tapfile.ts:56-62`); stale "not yet registered" comment
  (`zxspectrum128/index.ts:29-34`).

### BBC Micro / Master (`src/dialects/bbcmicro/`, `bbcmaster/`)

Best-in-repo tokenizer (byte-for-byte regression-tested against the genuine
ROM via jsbeeb, `tokenizer.test.ts:59-93`; 0x8D line-number codec correct both
ways, `lineNumber.ts:13-28`; dual pseudo-variable tokens handled). Worst-in-repo
import: the charset covers **only 0x20–0x7E** and the detokenizer is
context-blind.

- 🔴 **Detokenizer decodes tokens inside strings/REM/DATA**
  (`detokenizer.ts:32-56` has no quote/REM state): a MODE 7 string holding
  teletext colour byte 0x81 imports as the keyword text `DIV`. The tokenizer
  proves the asymmetry — its string (`tokenizer.ts:259-273`), REM/DATA
  (`tokenizer.ts:219-225`) and `*`-command (`tokenizer.ts:193-199`) paths all
  copy verbatim inbound.
- 🔴 **0x8D inside a string** eats three data bytes and becomes digits
  (`detokenizer.ts:37-45`).
- 🔴 **Control codes in strings destroyed**: 0x00–0x1F → `?`
  (`charset.ts:42`); 0x0A/0x0D in a string becomes `\n`, splitting the BASIC
  line so re-tokenize fails (`charset.ts:39`). Real programs embed VDU codes
  (0x0C CLS, 0x07 beep) in strings routinely.
- 🟠 **No escape notation at all** — teletext strings can only be authored as
  `CHR$(129);"…"` concatenations (`toMachine` throws outside 0x20–0x7E,
  `charset.ts:24-29`); 0x7F unmapped both ways.
- 🟠 **BBC Master is BASIC II re-exported** (`bbcmaster/index.ts:8-20`):
  BASIC IV's EDIT token 0xCE absent from `keywords.ts`, `EXT#ch=` falsely
  linted, TIME$ byte output correct only by accident and untested.
- 🟡 `MAX_LINE = 65279` (`tokenizer.ts:17`) vs real entry limit 32767 (the AI
  profiles even say 32767); GOTO targets wrap via `& 0xffff` silently
  (`tokenizer.ts:178`); truncated `.bbc` imports silently shortened
  (`detokenizer.ts:16-27`); dot-abbreviations (`P.`) not expanded; no
  charset.test.ts exists.

### Commodore 64 (`src/dialects/commodore64/`)

Structurally the best charset: an injective 256-entry PETSCII table
(`petscii.ts:34-51`) makes detokenize → tokenize **byte-exact for every byte
inside strings/REM/DATA** (verified). All 76 BASIC V2 tokens present;
verbatim-region handling matches the ROM cruncher. Gaps are interoperability
and container-level.

- 🔴 **Hybrid `.prg` (BASIC stub + machine code) silently truncated** at the
  null link (`detokenizer.ts:35-37`) — the most common real-world `.prg` form
  loses its payload; re-export produces a dead file.
- 🟠 **Every canonical petcat/VICE escape name is rejected** — `{wht}`,
  `{rvof}`, `{f1}`, `{CBM-A}`, decimal `{193}`… all throw (`petscii.ts:98`
  has no alias map), despite the module claiming petcat style
  (`petscii.ts:19-20`). Real archive listings cannot be pasted.
- 🟠 **Non-$0801 load addresses misparsed silently** (`detokenizer.ts:29`):
  VIC-20/PET/C128 `.prg`s detokenize to garbage with no error.
- 🟠 **No shifted (lower-case) bank**: mixed-case programs import as `{$xx}`
  soup; `toMachine` folds a–z to $41–$5A (`petscii.ts:69-71`) so lower-case
  PETSCII bytes can never be authored.
- 🟡 ~50 codes render as `{$xx}` though they are distinct hardware glyphs
  (mirror ranges $60–$7F/$E0–$FE; 18 codes like $A8/$C3–$C8 collapsed by the
  viciious font table — Unicode 13 legacy-computing glyphs exist for all);
  virtual GRAPHICS keys insert the canonical twin's byte for ~14 keys
  (`graphics.ts:20-25`); f1–f8 ($85–$8C) unnamed; keyword abbreviations
  (`pO`, `gO`) unsupported; `^` not accepted for `↑`; lines $FA00–$FFFF and
  non-ascending order lint-fatal on import (`tokenizer.ts:212-226` +
  `index.ts:47-50`); tape filename paths bypass the charset
  (`audio/cassetteDecoder.ts:66`, `cassetteEncoder.ts:66-74`); neither samples
  nor the AI profile mention the `{...}` escapes.

### TRS-80 (`src/dialects/trs80/`)

Level II token table complete and byte-correct; the 2×3 block-graphics ↔
Unicode-sextant mapping (0x81–0xBF) is mathematically right including the
U+1FB00 skip patterns (verified); strings/REM/DATA suspend keyword expansion
correctly. The gaps are real-hardware stored forms and the byte ranges around
the graphics.

- 🔴 **`'` comments stored/imported wrong.** Real ROMs store `'` as
  `3A 93 FB` (`:REM'`); the tokenizer emits bare 0x93
  (`keywords.ts:177-186`) and 0xFB is missing from the detokenizer table, so
  a genuine tape's `10 'HI` imports as `10 :REM🬸HI` (verified).
- 🔴 **`ELSE` missing its implicit `:`** (`tokenizer.ts:160-171` emits bare
  0x95; real form is `3A 95`) — exported `.cas`/WAV should ?SN ERROR on real
  hardware; the in-app interpreter masks the bug.
- 🟠 **Program base off by one**: `PROG_START = 0x42e8` (`tokenizer.ts:18`) vs
  real TXTTAB 0x42E9 — link words differ from real CSAVE output and
  `programByteLength`'s junk-trimming never works on genuine tapes
  (`casfile.ts:34-47`, verified).
- 🟠 **Control codes 0x00–0x1F → space, both directions lossy**
  (`charset.ts:93`); 0x80 (blank graphics) collapses onto 0x20; 0xC0–0xFF
  treated as glyph duplicates of 0x80–0xBF when the print-path semantics are
  space-compression codes (`charset.ts:91`); lower-case 0x60–0x7F folds to
  upper on encode (`charset.ts:56`) so Model III programs lose case.
- 🟠 **No escape notation at all** (`language.ts:23` opts out); graphics can
  only be authored by pasting astral-plane Unicode.
- 🟡 `^` silently swallowed instead of aliasing the 0xD1 power token (only the
  untypeable `↑` works, `keywords.ts:106`); runtime `CHR$()` destroys control
  codes via `glyph` (`interpreter/builtins.ts:47-49`); the runtime lexer
  misparses `1E-5` (sign is tokenized 0xCE but `lex.ts:74-83` wants ASCII);
  Model III 1500-baud `.cas` (0x55 leader/0x7F sync) unrecognized
  (`casfile.ts:71-93`).

### Acorn Atom (`src/dialects/atom/`)

The happy path is sound (Atom BASIC is stored as near-plain ASCII; framing,
`.atm` and 300-baud CFS audio well-tested). The charset is a 7-bit window and
the statement validator is stricter than the machine.

- 🔴 **Bit-7 (inverse video) silently stripped** (`charset.ts:36` masks
  `code & 0x7f`) and control codes/0x7F become a literal `?` — which is the
  Atom's byte-indirection operator, so corruption re-tokenizes cleanly
  (verified: `41 C1 C2 07 0C 7F` → `AAB???` → `41 41 42 3F 3F 3F`, zero
  errors). No escape notation exists (`language.ts:20-22`).
- 🟠 **Statement lint zeroes the image** (`index.ts:40`): floating-point-ROM
  statement forms (`FPRINT`, `%A=…`, `FIF`…) and `*` COS commands (`*CAT`) are
  all flagged (`tokenizer.ts:104-133`) although the dialect explicitly targets
  the Atom-Tape-FP model — genuine FP programs neither lint nor run.
  (FP statement syntax should be verified against _Atomic Theory and
  Practice_ before fixing.)
- 🟠 **Non-BASIC `.atm` imports as an empty document with a success message**
  (`atm.ts:60-69` never checks load address or leading 0x0D;
  `detokenizer.ts:20-30` returns `''`); cassette path likewise discards the
  header's load/exec addresses (`cassetteDecoder.ts:186-191`).
- 🟠 **Lower-case accepted, lints clean, exports verbatim** — real Atom BASIC
  matches keywords byte-for-byte upper-case, so the export fails on hardware
  with no warning here (`charset.ts:9-11`, `tokenizer.ts:106`).
- 🟡 Digit-leading bodies detokenize ambiguously (`10` + body `23=1` →
  `1023=1`, verified — bytes change on round-trip, `detokenizer.ts:26`);
  missing keywords (`LEN`, …) trigger false single-letter-variable lint;
  line 0 accepted; cassette decoder splices past missing/duplicate block
  numbers silently (`cassetteDecoder.ts:150-159`); `;` documentation conflicts
  with its actual statement-separator role (`keywords.ts:24-25`,
  `aiProfile.ts:11`); ↑/← glyph fidelity for 0x5E/0x5F unverified.

## Round-trip status at a glance

| Dialect          | Charset total?               | Strings/REM byte-exact?                     | Code context byte-exact?            | Container robust?         |
| ---------------- | ---------------------------- | ------------------------------------------- | ----------------------------------- | ------------------------- |
| ZX81             | ❌ half the byte space → `?` | ❌ tokens/controls lost, REM splits         | ❌ float payload lost               | ⚠️ pointer-sane, name cap |
| ZX80             | ❌ half the byte space → `?` | ❌ tokens/controls lost                     | ✅ (integers re-derived)            | ⚠️ pointer-sane           |
| Spectrum 48/128  | ✅ total                     | ✅ proven byte-exact                        | ❌ drops bytes, float + spaces lost | ❌ multi-file/parity      |
| BBC Micro/Master | ❌ 0x20–0x7E only            | ❌ **corrupts** (tokens decoded in strings) | ✅ (incl. 0x8D)                     | ⚠️ silent truncation      |
| Commodore 64     | ✅ total & injective         | ✅ proven byte-exact                        | ⚠️ ROM-impossible patterns only     | ❌ hybrid PRG/load addr   |
| TRS-80           | ❌ ctrls/0x80/0xC0–0xFF/case | ❌ ctrls→space, case folds                  | ❌ `'`/ELSE forms, base −1          | ⚠️ Model III cas missing  |
| Acorn Atom       | ❌ 7-bit, bit-7 masked       | ❌ flattened to `?`/ASCII                   | ✅ verbatim (when accepted)         | ❌ ML `.atm` → empty doc  |

Full per-machine detail (coverage tables, every finding with evidence and
verification status) lives in the plan's per-stage checklists; the staged
remediation is in [`charset-tokenizer-plan.md`](charset-tokenizer-plan.md).
