# Dialect roadmap

Which machines we could support next, and what each would cost. **Tiers are
effort, not hardware family:** Tier 1 is a language layer over hardware a
bundled core already drives, Tier 3 needs a chip emulated first, Tier 4 is
blocked. Which core a machine would run on is a column, not a grouping.

`src/dialects/registry.ts` is the source of truth for what ships; the Shipped
table below is pinned to it by `dialect-roadmap.test.ts`. Before planning
anything, look for a shipped sibling - it is by far the cheapest shape - then
follow `docs/contributing/adding-a-dialect.md`.

**Status legend:** ✅ shipped · 🔨 in progress · ⬜ planned · ⛔ blocked / needs
a new emulator core.

## Bundled cores

The cores are the limiting factor, so a candidate's tier is mostly a question of
what its hardware needs on top of one. Their vendoring caveats - what each core
does not model, and what the adapters make up for - are in
[Architecture](/contributing/architecture#vendored-core-caveats).

| Core                              | CPU          | Licence          | Wrapper                                                                      |
| --------------------------------- | ------------ | ---------------- | ---------------------------------------------------------------------------- |
| Z80.js (Molly Howell)             | Z80 / 8080   | MIT              | `src/emulator/z80/` - vendored; 8080 machines add `src/emulator/i8080/`      |
| jsbeeb 1.13.1 (Matt Godbolt)      | 6502 / 65C12 | GPL-3.0-or-later | `src/emulator/bbc/`, `src/emulator/atom/`                                    |
| viciious (Mike Dean / luxocrates) | 6510         | public domain    | `src/emulator/c64/`                                                          |
| 6502.ts (Christian Speckner)      | 6502         | MIT              | `src/emulator/6502/` - a bare CPU; each machine adds its own in-tree bus     |
| _(none - clean-room interpreter)_ | n/a          | this project     | `src/dialects/<id>/interpreter/` - no core to vendor, no ROM to redistribute |

## Shipped

Grouped by core. Implementation detail lives in the code and in each machine's
reference pages; what a row carries here is the one fact that bears on porting
work, plus any gap a program can run into.

| Machine               | Dialect         | CPU   | Core           | Note                                                                       |
| --------------------- | --------------- | ----- | -------------- | -------------------------------------------------------------------------- |
| Sinclair ZX81         | `zx81`          | Z80   | Z80.js         | Reference Z80 wiring: FAST/SLOW, NMI generator, R-register interrupt       |
| Sinclair ZX80         | `zx80`          | Z80   | Z80.js         | Integer BASIC, `.O` images. No variable watching                           |
| ZX Spectrum 48K       | `zxspectrum`    | Z80   | Z80.js         | `.TAP`; scanline ULA contention, so raster bands hold. No floating bus     |
| ZX Spectrum 128K / +2 | `zxspectrum128` | Z80   | Z80.js         | Sibling of `zxspectrum` plus paging and AY. +2A/+3 not emulated            |
| Amstrad CPC 464       | `cpc464`        | Z80   | Z80.js         | Gate Array, CRTC 6845, PPI and AY; `.cdt` tape                             |
| Amstrad CPC 664       | `cpc664`        | Z80   | Z80.js         | Sibling of `cpc464`; BASIC 1.1. Tape only - no FDC, no `.dsk`              |
| Amstrad CPC 6128      | `cpc6128`       | Z80   | Z80.js         | Sibling of `cpc464`; BASIC 1.1 and 128K banking. Tape only                 |
| SAM Coupé             | `samcoupe`      | Z80   | Z80.js         | Four ASIC modes, SAA1099; ROM ships by permission. Discs import-only       |
| Sony HB-10P (MSX1)    | `hb10p`         | Z80   | Z80.js         | TMS9918A VDP and PSG, parameterised for later MSX1s. MSX2 out of scope     |
| MITS Altair 8800      | `altair8800`    | 8080  | Z80.js + i8080 | No video: an 88-2SIO board and a terminal. String churn invisible to stats |
| Tesla PMD 85-2        | `pmd85`         | 8080  | Z80.js + i8080 | 288×256 bitmap; BASIC-G is paged in from a ROM module, not mapped          |
| BBC Micro Model B     | `bbcmicro`      | 6502  | jsbeeb         | Reference jsbeeb integration; CFS cassette over Kansas City FSK            |
| BBC Master            | `bbcmaster`     | 65C12 | jsbeeb         | Sibling of `bbcmicro`; BASIC IV shares BASIC II's tokens, MOS 3.20         |
| Acorn Atom            | `atom`          | 6502  | jsbeeb         | Own tokenizer and charset; `.atm` binaries. No variable watching           |
| Commodore 64          | `commodore64`   | 6510  | viciious       | `.prg` at $0801, PAL timing. No cassette audio - tape I/O not exposed      |
| Commodore PET 4032    | `pet`           | 6502  | 6502.ts        | BASIC 4.0 via the `CbmVariant` seam; no video chip, screen RAM by chargen  |
| Commodore VIC-20      | `vic20`         | 6502  | 6502.ts        | Unexpanded PAL, from-scratch VIC-I renderer; 3583 BASIC bytes free         |
| Apple I               | `apple1`        | 6502  | 6502.ts        | WozMon + Integer BASIC; PROMs emulated as logic. No sound, no joystick     |
| Apple II              | `apple2`        | 6502  | 6502.ts        | Integer BASIC; text, lo-res and hi-res into one raster. No Disk II         |
| Apple II Plus         | `apple2plus`    | 6502  | 6502.ts        | Applesoft on the `apple2` board. `AND`/`OR`/`NOT` are logical, not bitwise |
| Atari 800             | `atari800`      | 6502  | 6502.ts        | ANTIC, GTIA, POKEY, PIA; AltirraOS and Altirra BASIC redistribute freely   |
| Atari 400             | `atari400`      | 6502  | 6502.ts        | Sibling of `atari800`; the RAM figure is the only divergence               |
| TRS-80                | `trs80`         | -     | interpreter    | Level II BASIC, ROM-free; a Z80 + ROM mode waits on a user-supplied image  |
| GE-235                | `ge235`         | -     | interpreter    | Dartmouth BASIC on a teletype. No step debugger, watcher or data capture   |

## Tier 1 - Language layer only

A bundled core, or an interpreter a shipped machine already runs on, covers the
hardware, so there is no new emulator work at all: a keyword table, a charset, a
memory map, an AI profile and metadata.

`src/dialects/bbcmaster/` is the reference implementation - four hand-written
files, everything else imported from the sibling, and the whole hardware
divergence expressed as one model parameter (`new BbcMachine('Master')`).
`cpc664` and `atari400` are the same shape. Point `docsReference` at the base
dialect's page and the docs work stays nearly free. A machine name that links
out has a plan under `dialect-plans/` already written.

| Status | Machine                                             | BASIC             | Core        | Note                                                                   |
| ------ | --------------------------------------------------- | ----------------- | ----------- | ---------------------------------------------------------------------- |
| ⬜     | TRS-80 Model III / 4                                | Model III BASIC   | interpreter | Source-compatible Level II superset, same display; no ROM question     |
| ⬜     | [General Electric GE-635](./dialect-plans/ge635.md) | Dartmouth 4th ed. | interpreter | Strings, matrices, multi-line functions; shares `ge235`, ASCII not BCD |

## Tier 2 - New bus, simple display

The CPU is free and the display is a memory-mapped character grid or a plain
bitmap, with no custom chip to work out first. Wire the core into an in-tree bus
as `pet` and `vic20` do, then proceed as for any dialect.

| Status | Machine                            | BASIC                    | Core    | Note                                                                       |
| ------ | ---------------------------------- | ------------------------ | ------- | -------------------------------------------------------------------------- |
| ⬜     | Compukit UK101 / OSI Superboard II | Microsoft 6502 BASIC     | 6502.ts | 1K character display, 6850 ACIA, no video chip. Commodore BASIC's ancestor |
| ⬜     | Mattel Aquarius                    | Microsoft BASIC (subset) | Z80.js  | 40×24 text, 80×72 semigraphics; 4K RAM, so very little program space       |
| ⬜     | Exidy Sorcerer / Nascom 2          | Microsoft BASIC          | Z80.js  | Mono character display, programmable charset; the MS variable lint fits    |
| ⬜     | Commodore CBM 8032                 | Commodore BASIC 4.0      | 6502.ts | Language free via `CbmVariant`, but the 80-column 6545 CRTC is new         |

## Tier 3 - New bus, custom video or sound chip

The CPU is free but a bespoke chip must be emulated before BASIC output is
visible. That chip is the gating work; once it renders a frame the rest is a
normal dialect, so these promote to Tier 2 rather than shipping directly.

The Electron would be the **third** BBC-family variant, which is the trigger
flagged in `src/dialects/bbcmaster/index.ts` for factoring the shared language
layer into a `src/dialects/bbcShared/` module.

| Status | Machine                                                   | BASIC                | Core    | Note                                                                   |
| ------ | --------------------------------------------------------- | -------------------- | ------- | ---------------------------------------------------------------------- |
| ⬜     | Acorn Electron                                            | BBC BASIC II         | 6502.ts | BBC language layer free, but jsbeeb has no Electron: needs a ULA bus   |
| ⬜     | Commodore C16 / Plus/4                                    | Commodore BASIC 3.5  | 6502.ts | `CbmVariant` extension; the TED is video, sound and timers in one chip |
| ⬜     | Oric-1 / Atmos                                            | Oric BASIC           | 6502.ts | Custom ULA, and no ready-made core to borrow one from                  |
| ⬜     | Amstrad CPC 464plus / 6128plus / GX4000                   | Locomotive BASIC 1.1 | Z80.js  | Language free from `cpc6128`, but the ASIC replaces the Gate Array     |
| ⬜     | Enterprise 64 / 128                                       | IS-BASIC             | Z80.js  | Nick and Dave custom chips, both bespoke                               |
| ⬜     | Memotech MTX / Tatung Einstein / Sord M5 / Camputers Lynx | Various              | Z80.js  | Niche, and a bespoke video implementation each                         |

## Tier 4 - Blocked

Not a question of effort: each of these lacks something we cannot supply from
the tree, or would add nothing the registry does not already cover.

| Status | Machine                       | CPU        | Why blocked                                                                      |
| ------ | ----------------------------- | ---------- | -------------------------------------------------------------------------------- |
| ⛔     | BBC Model B+ / Master Compact | 6502       | jsbeeb ships no such model, so the free BBC language layer has nothing to run on |
| ⛔     | Commodore PET 2001 / CBM 3032 | 6502       | BASIC 2.0, not the shipped PET's 4.0: a new variant and ROM set for no new gain  |
| ⛔     | Commodore 128                 | 8502 + Z80 | Dual CPU, the VDC beside the VIC-II, BASIC 7.0; its C64 mode adds nothing        |
| ⛔     | Dragon 32 / 64, Tandy CoCo    | 6809       | No 6809 core bundled, and none vendorable without writing one                    |
| ⛔     | Commodore Amiga, Atari ST     | 68000      | No 68000 core bundled, and the machines are far past the BASIC-in-ROM era        |

## Pre-microcomputer targets

Machines older than the microcomputer have no core to reuse and no prospect of
one being vendored, so they ship as clean-room interpreters on the TRS-80's
pattern. The first of a family pays for the interpreter; the rest share it
through a machine profile rather than forking it, which is why the GE-635 sits
in Tier 1 above and why the Honeywell 6000 becomes a delegation sibling of it
once it lands.

Adding the GE-235 widened the era bound in `src/dialects/registry.test.ts` to
1960-1995; widening it again belongs in the plan for the machine that needs it,
not in a passing test edit.

## Acorn Atom language gaps

Genuine Atom BASIC features the shipped `atom` tokenizer does not cover, so they
are absent from `src/reference/atom.ts` too:

- the memory indirection operators `?` (byte), `!` (4-byte word) and `$`
  (string) - the Atom's idiomatic replacement for `PEEK`/`POKE`;
- the remainder operator `%` and the bitwise `&` (AND), `\` (OR) and `:` (XOR);
- `LEN`, `COUNT`, `PTR`, `BGET`/`BPUT`, `EXT`, `FIN`/`FOUT` and `SGET`/`SPUT`.

## How a machine gets promoted a tier

1. **Tier 1 → shipped:** clone `src/dialects/bbcmaster/`. Import charset,
   keywords, tokenizer, detokenizer, language, keyboard, samples and targets
   from the base dialect; own only the memory map, memory blocks, AI profile and
   metadata; express the hardware delta as a model parameter.
2. **Tier 2 → shipped:** follow `docs/contributing/adding-a-dialect.md`. The work
   is the tokenizer, the image format and the video snapshot over a new in-tree
   bus.
3. **Tier 3 → Tier 2:** emulate the video (and sound) chip first. Nothing else
   can be verified until it renders a frame.
4. **Tier 4 → any tier:** vendor or write the missing core, or contribute the
   missing model upstream, then proceed as above.

Move the machine's row into the Shipped table as it registers - the roadmap test
fails while a registered dialect is still sitting in a tier.
