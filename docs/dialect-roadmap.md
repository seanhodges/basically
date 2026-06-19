# Dialect roadmap

Basically is built around one seam — the `Dialect` / `MachineEmulator`
contracts in `src/dialects/types.ts`. Adding a machine is additive: a folder
under `src/dialects/<id>/` plus one line in `src/dialects/registry.ts`, with no
changes to the editor, transfer, or UI layers (see `docs/adding-a-dialect.md`
and the `adding-a-target-system` skill).

This document tracks which machines we can realistically support, grouped by
**which already-bundled emulator can drive them**. The bundled emulator cores
are the limiting factor, so they define the tiers:

| Core                              | CPU          | Licence          | Wrapper                                                                                             | Powers                                   |
| --------------------------------- | ------------ | ---------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Z80.js (Molly Howell)             | Z80          | MIT              | `src/emulator/z80/` — vendored, 3 local patches (M1 hook, accessors, ESM export)                    | ZX81, ZX80, ZX Spectrum                  |
| jsbeeb 1.13.1 (Matt Godbolt)      | 6502 / 65C12 | GPL-3.0-or-later | `src/emulator/bbc/bbcMachine.ts`                                                                    | BBC Micro Model B, BBC Master            |
| viciious (Mike Dean / luxocrates) | 6510         | public domain    | `src/emulator/c64/c64Machine.ts`                                                                    | Commodore 64                             |
| cpu-6502-emulator (Jye Lewis)     | 6502         | ISC              | `src/emulator/6502/` — vendored, 3 local patches (sync `step()`, interrupt model, browser-safe BRK) | bundled but not yet wired to any dialect |

**Status legend:** ✅ shipped · 🔨 in progress · ⬜ planned · ⛔ blocked / needs
a new emulator core.

---

## Tier 1 — Reuse the bundled jsbeeb (6502 + Acorn hardware)

The lowest-effort additions: the emulator already exists, so most work is the
tokenizer/charset and pointing `BbcMachine` at a different `findModel()` name.

| Status | Machine           | CPU   | BASIC        | Notes                                                                                                                                                                                                                                                                                             |
| ------ | ----------------- | ----- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅     | BBC Micro Model B | 6502  | BBC BASIC II | `bbcmicro`; reference jsbeeb integration. Cassette WAV export (CFS over Kansas City Standard FSK). Variable watching via `readVariables()`.                                                                                                                                                       |
| ✅     | BBC Master        | 65C12 | BBC BASIC IV | `bbcmaster`; reuses the entire BBC language layer (BASIC IV shares BASIC II's tokens), keyboard, samples, and build targets — only the jsbeeb model name and AI profile differ. MOS 3.20 ROM already bundled. Cassette WAV export shared with BBC Micro. Variable watching shared with BBC Micro. |
| ⬜     | Acorn Atom        | 6502  | Atom BASIC   | jsbeeb-supported (`findModel('Atom')`), but needs the Atom ROM set added and a genuinely new BASIC dialect (different tokenizer/charset/keywords).                                                                                                                                                |
| ⛔     | Acorn Electron    | 6502  | BBC BASIC II | Not in jsbeeb 1.13.1. Would need a jsbeeb bump (newer jsbeeb gained Electron support) or a different core.                                                                                                                                                                                        |

**BBC Master implementation notes.** `src/emulator/bbc/bbcMachine.ts` takes a
model name; the Master needed two adjustments, both already made: its MOS 3.20
power-on only sets `PAGE` at ~1.45M cycles (vs the Model B's ~725K), and the
OS keyboard-buffer addresses differ between OS 1.20 and MOS 3.20, so auto-`RUN`
is typed through the key matrix (OS-version independent) rather than poked into
the buffer.

---

## Tier 2 — Reuse the Z80 core, simple / CPU-driven display

Low-to-medium effort: the CPU is free, the video is character-cell or a
straightforward bitmap driven by the CPU.

| Status | Machine                    | CPU | BASIC                    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | -------------------------- | --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅     | Sinclair ZX81              | Z80 | Sinclair BASIC           | `zx81`; the reference Z80 integration (FAST/SLOW, NMI generator, R-register interrupt). Cassette WAV (Sinclair pulse scheme). Variable watching via `readVariables()`.                                                                                                                                                                                                                                                                                        |
| ✅     | Sinclair ZX Spectrum 48K   | Z80 | Sinclair BASIC           | `zxspectrum`; `.TAP` format and cassette WAV (standard ROM tape encoding). Variable watching via `readVariables()`.                                                                                                                                                                                                                                                                                                                                           |
| ✅     | Sinclair ZX80              | Z80 | ZX80 integer BASIC       | `zx80`; integer-BASIC tokenizer/detokenizer, `.O` image format, authentic tape-LOAD trap + auto-RUN, cassette WAV export. **Known gaps:** (1) ZX80 functions (`RND`, `PEEK`, `USR`, `CHR$`, `CODE`, `ABS`, `STR$`, `TL$`) are not yet tokenized — they are matched via a separate name table at ROM `0x0BBA` rather than a token range; the `aiProfile` tells the assistant to avoid them. (2) No variable introspection (`readVariables()` not implemented). |
| ⬜     | ZX Spectrum 128K / +2 / +3 | Z80 | Sinclair BASIC           | Extend `zxspectrum` with memory paging (port `0x7FFD`) and AY-3-8912 sound.                                                                                                                                                                                                                                                                                                                                                                                   |
| ⬜     | TRS-80 Model I / III       | Z80 | Microsoft Level II BASIC | Simple monochrome character display; Microsoft BASIC tokenizer.                                                                                                                                                                                                                                                                                                                                                                                               |

**ZX80 implementation detail.** The ZX80 is essentially the ZX81 in FAST mode
only (no NMI generator, no SLOW mode), so its machine wiring is the ZX81's
minus the NMI path. The token table was finalised against the ROM's
keyword-decode routine at `0x05A9` (string table based at `0x00BA`): operators
and separators are single tokens `0xD5`–`0xE5`, commands run `0xE6`–`0xFE`
(`PRINT=0xF4`, `RUN=0xF7`, `LOAD=0xFC`, `REM=0xFE`). Lines are stored as
`u16 BE line number` + body + `0x76` with no length field. The load/run path
traps the tape leader-detection loop at `0x020C`, drops the `.O` image into RAM
at `0x4000`, and resumes at `0x0283`; because the ZX80 does not auto-run a
loaded program, `RUN` is then typed through the key matrix. The virtual keyboard
reuses `Zx81Keyboard` directly (identical 8×5 matrix). Cassette images carry no
program name (raw dump only).

---

## Tier 3 — Reuse the bundled viciious (6510 + C64 hardware)

Medium effort for machines very close to the C64; high effort for anything else,
since viciious is C64-specific (VIC-II + SID + 2×CIA). The standalone
`cpu-6502-emulator` core at `src/emulator/6502/` is available for non-C64 6502
machines, but it is a bare CPU only (instruction count, not cycle-accurate
T-states) — each new machine needs its own bus: memory map, I/O, video.

| Status | Machine              | CPU  | BASIC                     | Notes                                                                                                                                                                                                                                                 |
| ------ | -------------------- | ---- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅     | Commodore 64         | 6510 | Commodore BASIC v2        | `commodore64`; native BASIC v2 tokenizer, `.prg` import/export ($0801 load address). PAL frame timing (63 cycles × 312 rows). Variable watching via `readVariables()`. **Known gap:** no cassette audio support (tape I/O not exposed from viciious). |
| ⛔     | VIC-20 / PET         | 6502 | Commodore BASIC           | viciious is C64-only; would need a separate VIC-20/PET core. The standalone 6502 core could drive it, but VIC-I (VIC-20) and CRTC (PET) video must be implemented from scratch.                                                                       |
| ⛔     | Apple II             | 6502 | Applesoft / Integer BASIC | Needs a custom soft-switch memory map and video (text / lores / hires). Standalone 6502 core could provide the CPU.                                                                                                                                   |
| ⛔     | Atari 400 / 800 / XL | 6502 | Atari BASIC               | ANTIC display-list + GTIA graphics hardware; no ready-made core.                                                                                                                                                                                      |
| ⛔     | Oric-1 / Atmos       | 6502 | Oric BASIC                | Custom ULA; no ready-made core.                                                                                                                                                                                                                       |

**viciious vendoring notes.** `src/emulator/c64/viciious/` is the public-domain
subset of upstream commit `69f0dc6`, unmodified — excludes webpack build, DOM
host, ROM source modules, and monitor UI. The vendored core carries ~40 upstream
`TODO` comments (VIC-II timing edge cases, SID ADSR curve scaling, CIA serial
shifter, tape bounds checking); none block current use but are worth tracking
against upstream if emulation accuracy issues arise.

---

## Tier 4 — Reuse the Z80 core, but with complex custom video / sound

High effort: the CPU is free but each machine has a bespoke video chip (and
often a sound chip) that must be emulated before BASIC output is visible.

| Status | Machine                                                | CPU | BASIC            | Key challenge                                                       |
| ------ | ------------------------------------------------------ | --- | ---------------- | ------------------------------------------------------------------- |
| ⬜     | Amstrad CPC 464 / 6128                                 | Z80 | Locomotive BASIC | Gate Array + CRTC video, AY-3-8912 sound                            |
| ⬜     | MSX / MSX2                                             | Z80 | MSX BASIC        | TMS9918 VDP + AY sound — most reusable, covers the whole MSX family |
| ⬜     | Enterprise 64 / 128                                    | Z80 | IS-BASIC         | Nick + Dave custom chips                                            |
| ⬜     | Memotech MTX, Tatung Einstein, Sord M5, Camputers Lynx | Z80 | various          | Niche; each a bespoke video implementation                          |

(The Jupiter Ace is deliberately excluded — it runs Forth, not BASIC.)

---

## Tier 5 — Need a new emulator core (out of current scope)

These popular machines can't reuse any bundled core: jsbeeb only models Acorn
hardware, viciious is C64-specific, and we have no 6809/68000 core.

| Status | Machine                    | CPU   | Why blocked           |
| ------ | -------------------------- | ----- | --------------------- |
| ⛔     | Dragon 32 / 64, Tandy CoCo | 6809  | No 6809 core bundled  |
| ⛔     | Commodore Amiga, Atari ST  | 68000 | No 68000 core bundled |

---

## How a machine gets promoted a tier

1. **Tier 1 → shipped:** clone the `bbcmaster` pattern — share the BBC language
   layer if it's an Acorn BASIC, or add a new tokenizer/charset, and point
   `BbcMachine` at the jsbeeb model name (add its ROMs under `public/roms/`).
2. **Tier 2 → shipped:** follow `docs/adding-a-dialect.md`, reusing the ZX81 /
   Spectrum Z80 wiring. The work is the tokenizer, the image format, and the
   video snapshot.
3. **Tier 3 → shipped (C64-adjacent):** adapt the existing `C64Machine` wrapper
   if the target's hardware is close enough to the C64. For other 6502 machines,
   wire the standalone `src/emulator/6502/` core into a new machine class with a
   custom memory map, I/O, and video — then proceed as for Tier 2.
4. **Tier 4 → Tier 2:** the gating work is the video (and sound) chip. Once
   that renders a frame, the rest is a normal dialect.
5. **Tier 5 → any tier:** vendor or write the CPU/system core (the way the Z80
   core and jsbeeb were brought in), then proceed as above.
