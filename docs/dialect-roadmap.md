# Dialect roadmap

Basically is built around one seam — the `Dialect` / `MachineEmulator`
contracts in `src/dialects/types.ts`. Adding a machine is additive: a folder
under `src/dialects/<id>/` plus one line in `src/dialects/registry.ts`, with no
changes to the editor, transfer, or UI layers (see `docs/adding-a-dialect.md`
and the `adding-a-target-system` skill).

This document tracks which machines we can realistically support, grouped by
**which already-bundled emulator can drive them**. The two bundled emulators
are the limiting factor, so they define the tiers:

1. **In-tree Z80 core** — `src/emulator/z80/z80core.js` (MIT, machine-
   independent). Powers the ZX81 and ZX Spectrum 48K. Reusable by any Z80
   machine, but each needs its own bus: memory map, I/O ports, interrupt
   wiring, and video.
2. **jsbeeb** (`jsbeeb@1.13.1`, GPL-3.0) — a full 6502 + Acorn hardware
   emulator. Powers the BBC Micro Model B. Its `findModel()` also resolves the
   **BBC Master** and the **Acorn Atom**; it does **not** include the Acorn
   Electron in this pinned version.

**Status legend:** ✅ shipped · 🔨 in progress · ⬜ planned · ⛔ blocked / needs a
new emulator core.

---

## Tier 1 — Reuse the bundled jsbeeb (6502 + Acorn hardware)

The lowest-effort additions: the emulator already exists, so most work is the
tokenizer/charset and pointing `BbcMachine` at a different `findModel()` name.

| Status | Machine           | CPU   | BASIC        | Notes                                                                                                                                              |
| ------ | ----------------- | ----- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅     | BBC Micro Model B | 6502  | BBC BASIC II | `bbcmicro`; reference jsbeeb integration                                                                                                           |
| ✅     | BBC Master        | 65C12 | BBC BASIC IV | `bbcmaster`; reuses the whole BBC language layer (BASIC IV shares BASIC II's tokens) — only the jsbeeb model differs. MOS 3.20 ROM already bundled |
| ⬜     | Acorn Atom        | 6502  | Atom BASIC   | jsbeeb-supported (`findModel('Atom')`), but needs the Atom ROM set added and a genuinely new BASIC dialect (different tokenizer/charset/keywords)  |
| ⛔     | Acorn Electron    | 6502  | BBC BASIC II | Not in jsbeeb 1.13.1. Would need a jsbeeb bump (newer jsbeeb gained Electron support) or a different core                                          |

**BBC Master implementation notes.** `src/emulator/bbc/bbcMachine.ts` now takes
a model name; the Master needed two adjustments, both already made:
its MOS 3.20 power-on only sets `PAGE` at ~1.45M cycles (vs the Model B's
~725K), and the OS keyboard-buffer addresses differ between OS 1.20 and MOS
3.20, so auto-`RUN` is now typed through the key matrix (OS-version
independent) rather than poked into the buffer.

## Tier 2 — Reuse the in-tree Z80 core, simple / CPU-driven display

Low-to-medium effort: the CPU is free, the video is simple (character display
or a straightforward bitmap).

| Status | Machine                    | CPU | BASIC                    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | -------------------------- | --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅     | Sinclair ZX81              | Z80 | Sinclair BASIC           | `zx81`; the reference Z80 integration (FAST/SLOW, NMI generator)                                                                                                                                                                                                                                                                                                                                                                                           |
| ✅     | Sinclair ZX Spectrum 48K   | Z80 | Sinclair BASIC           | `zxspectrum`                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 🔨     | Sinclair ZX80              | Z80 | ZX80 integer BASIC       | `src/dialects/zx80/` — **emulator foundation present**: the 4K ROM is bundled, the machine boots it (memory map, system variables and display rendering reverse-engineered and tested), and the ZX81 keyboard matrix is reused. **Remaining:** the integer-BASIC tokenizer/`.O` format and the program load/run path — the ZX80's load/list entry points and its software-timed keyboard editor need mapping against a ROM disassembly. Not yet registered |
| ⬜     | ZX Spectrum 128K / +2 / +3 | Z80 | Sinclair BASIC           | Extend `zxspectrum` with memory paging and AY-3-8912 sound                                                                                                                                                                                                                                                                                                                                                                                                 |
| ⬜     | TRS-80 Model I / III       | Z80 | Microsoft Level II BASIC | Simple monochrome character display; Microsoft BASIC tokenizer                                                                                                                                                                                                                                                                                                                                                                                             |

**ZX80 progress detail.** The ZX80 is essentially the ZX81 in FAST mode only
(no NMI generator, no SLOW mode), so its machine wiring is the ZX81's minus the
NMI path. Confirmed against the real ROM (CRC32 `4c7fc597`): 4K ROM mirrored to
0x3FFF, character bitmaps at ROM `0x0E00`, and the system-variable pointers
`VARS=0x4008`, `E_LINE=0x400A`, `D_FILE=0x400C` (the display file sits at the
top of memory with no leading NEWLINE, unlike the ZX81). The ROM's keyword
table was extracted (THEN, TO, NOT, AND, OR, LIST … LET, NEXT, PRINT, NEW, RUN,
STOP, CONTINUE, IF, GO SUB, LOAD, CLEAR, REM); the command block LIST…CONTINUE
maps to tokens `0xED…0xFD`, but a handful of tail tokens and the load/run
trigger still need confirming before the dialect is wired up and registered.

## Tier 3 — Reuse the Z80 core, but with complex custom video / sound

High effort: the CPU is free but each machine has a bespoke video chip (and
often a sound chip) that must be emulated before BASIC output is visible.

| Status | Machine                                                | CPU | BASIC            | Key challenge                                                                         |
| ------ | ------------------------------------------------------ | --- | ---------------- | ------------------------------------------------------------------------------------- |
| ⬜     | Amstrad CPC 464 / 6128                                 | Z80 | Locomotive BASIC | Gate Array + CRTC video, AY-3-8912 sound                                              |
| ⬜     | MSX / MSX2                                             | Z80 | MSX BASIC        | TMS9918 VDP + AY sound — but most reusable, as it covers a whole family of MSX clones |
| ⬜     | Enterprise 64 / 128                                    | Z80 | IS-BASIC         | Nick + Dave custom chips                                                              |
| ⬜     | Memotech MTX, Tatung Einstein, Sord M5, Camputers Lynx | Z80 | various          | Niche; each a bespoke video implementation                                            |

(The Jupiter Ace is deliberately excluded — it runs Forth, not BASIC.)

## Tier 4 — Need a new emulator core (out of current scope)

These popular machines can't reuse either bundled emulator: jsbeeb only models
Acorn hardware, and we have no 6809/68000 core. Each would mean vendoring or
writing a new CPU/system core first.

| Status | Machine                     | CPU   | Why blocked                                             |
| ------ | --------------------------- | ----- | ------------------------------------------------------- |
| ⛔     | Commodore 64 / VIC-20 / PET | 6502  | VIC/VIC-II + SID; jsbeeb can't drive non-Acorn hardware |
| ⛔     | Apple II                    | 6502  | Custom video and soft-switch memory map                 |
| ⛔     | Atari 400 / 800 / XL        | 6502  | ANTIC + GTIA display list hardware                      |
| ⛔     | Oric-1 / Atmos              | 6502  | Custom ULA                                              |
| ⛔     | Dragon 32 / 64, Tandy CoCo  | 6809  | No 6809 core bundled                                    |
| ⛔     | Commodore Amiga, Atari ST   | 68000 | No 68000 core bundled                                   |

---

## How a machine gets promoted a tier

1. **Tier 1 → shipped:** clone the `bbcmaster` pattern — share the BBC language
   layer if it's an Acorn BASIC, or add a new tokenizer/charset, and point
   `BbcMachine` at the jsbeeb model (add its ROMs under `public/roms/`).
2. **Tier 2 → shipped:** follow `docs/adding-a-dialect.md`, reusing the ZX81/
   Spectrum Z80 wiring. The work is the tokenizer, the image format, and the
   video snapshot.
3. **Tier 3 → Tier 2:** the gating work is the video (and sound) chip. Once
   that renders a frame, the rest is a normal dialect.
4. **Tier 4 → Tier 1/2:** vendor or write the CPU/system core (the way the Z80
   core and jsbeeb were brought in), then proceed as above.
