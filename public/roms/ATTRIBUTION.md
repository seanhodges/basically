# Sinclair ROM attribution

`zx81.rom` is the 8K Sinclair ZX81 BASIC ROM ("improved" Edition 3),
copyright © 1981 Nine Tiles Networks Ltd / Sinclair Research Ltd, with rights
now held by Amstrad plc (acquired by Sky in 2007).

`zxspectrum.rom` is the 16K Sinclair ZX Spectrum 48K BASIC ROM,
copyright © 1982 Sinclair Research Ltd / Nine Tiles Networks Ltd, with rights
now held by Amstrad plc (CRC32 ddee531f — the standard 48K image).

`zx80.rom` is the 4K Sinclair ZX80 BASIC ROM, copyright © 1980 Nine Tiles
Networks Ltd / Sinclair Research Ltd, with rights now held by Amstrad plc
(CRC32 4c7fc597 — the standard ZX80 image).

`zxspectrum128.rom` is the 32K Sinclair ZX Spectrum 128K / +2 ROM (ROM 0 = the
128 editor/menu, ROM 1 = the 48 BASIC ROM), copyright © 1986 Sinclair Research
Ltd / Amstrad plc, with rights now held by Amstrad plc. It is *not* committed to
this repository — supply your own image (the standard 128K/+2 ROM, e.g. the
"128-0.rom" + "128-1.rom" pair concatenated into one 32768-byte file) at
`public/roms/zxspectrum128.rom`, or load one at runtime; the emulator boot test
skips when it is absent.

Amstrad has long granted permission for the distribution of Sinclair ROM
images for use with emulators, provided the copyright notice remains intact
and no fee is charged for the ROM itself. This is the same basis on which
open-source emulators such as sz81, EightyOne and Fuse distribute these
images. Amstrad's permission notice is archived at
https://worldofspectrum.org/assets/amstrad-roms.txt (originally posted to
comp.sys.sinclair, 1999).

If you are the rights holder and want this file removed, please open an
issue — the IDE also supports supplying your own ROM image at runtime.

# Acorn ROM attribution

`os.rom` (Acorn MOS 1.20), `BASIC.ROM` (BBC BASIC II), `b/DFS-0.9.rom`
(Acorn DFS 0.9) and `master/mos3.20` (Master MOS 3.20, used only by the
in-emulator BASIC tokenizer) are copyright © 1981–1986 Acorn Computers Ltd.

`atom/Atom_Kernel.rom` (Acorn Atom kernel/MOS), `atom/Atom_FloatingPoint.rom`
(the Atom floating-point ROM) and `atom/Atom_Basic.rom` (Atom BASIC) are the
Acorn Atom ROM set, copyright © 1979–1982 Acorn Computers Ltd.

Unlike the Sinclair ROMs there is no formal blanket permission from the
rights holder, but these images have been distributed with BBC Micro
emulators (jsbeeb, BeebEm, b-em, MAME and others) for some thirty years on a
de-facto-tolerated basis. They are included here, unmodified, solely for use
with the bundled emulator. The images themselves are copies of the ones
shipped by jsbeeb (https://github.com/mattgodbolt/jsbeeb).

If you are the rights holder and want these files removed, please open an
issue.

# Commodore ROM attribution

`c64/basic.bin` (Commodore BASIC v2), `c64/kernal.bin` (KERNAL) and
`c64/chargen.bin` (character generator) are the three Commodore 64 ROMs, the
firmware originally copyright © 1982 Commodore Business Machines, with rights
now held by Cloanto / C64 Forever.

These images are assembled from the from-scratch disassembly sources bundled
with the [viciious](https://github.com/luxocrates/viciious) emulator (see
`src/emulator/c64/viciious/LICENSE-VICIIOUS.md`) and are functionally
compatible with the original C64 ROMs. As with the Acorn ROMs there is no
formal blanket permission from the rights holder, but C64 ROM images have been
distributed with emulators (VICE, CCS64, and others) for decades on a
de-facto-tolerated basis. They are included here solely for use with the
bundled emulator.

If you are the rights holder and want these files removed, please open an
issue — the IDE also supports supplying your own ROM image at runtime.
