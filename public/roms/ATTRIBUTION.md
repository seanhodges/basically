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

`zxspectrum128.rom` is the 32K Sinclair ZX Spectrum 128K / +2 ROM, copyright
© 1986 Sinclair Research Ltd / Amstrad plc, with rights now held by Amstrad plc.
It is the standard image, formed by concatenating the two 16K halves: ROM 0 =
the 128 editor/menu (CRC32 e76799d2) followed by ROM 1 = the 48 BASIC ROM
(CRC32 b96a36be). Distributed on the same Amstrad permission as the other
Sinclair ROMs above. (The IDE also supports supplying your own ROM image at
runtime.)

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

`pet/basic-4-b000.901465-23.bin`, `pet/basic-4-c000.901465-20.bin` and
`pet/basic-4-d000.901465-21.bin` (Commodore BASIC 4.0, in three 4K banks at
$B000/$C000/$D000), `pet/edit-4-40-n-50Hz.901498-01.bin` (the 40-column,
50Hz/PAL editor ROM at $E000), `pet/kernal-4.901465-22.bin` (KERNAL at $F000)
and `pet/characters-2.901447-10.bin` (the character generator) are the six
Commodore PET (4032/40xx) ROMs, the firmware originally copyright © 1980–1982
Commodore Business Machines, with rights now held by Cloanto / C64 Forever.

They are the standard VICE/MAME PET 4.0 images, identified by their part
numbers and CRC32s (`ae3deac0`, `0fc17b9c`, `36d91855`, `3370e359`,
`cc5298a1`, `d8408674` respectively). As with the C64 and Acorn ROMs above
there is no formal blanket permission from the rights holder, but PET ROM
images have been distributed with emulators (VICE, MAME, and others) for
decades on a de-facto-tolerated basis. They are included here, unmodified,
solely for use with the bundled emulator.

If you are the rights holder and want these files removed, please open an
issue — the IDE also supports supplying your own ROM image at runtime.

`vic20/basic.bin` (Commodore BASIC v2 at $C000, part 901486-01),
`vic20/kernal.bin` (the PAL KERNAL at $E000, part 901486-07) and
`vic20/chargen.bin` (the character generator at $8000, part 901460-03) are the
three Commodore VIC-20 ROMs, the firmware originally copyright © 1981–1982
Commodore Business Machines, with rights now held by Cloanto / C64 Forever.
The filenames mirror the `c64/` naming.

They are the standard VICE/MAME unexpanded PAL VIC-20 images, identified by
their part numbers and CRC32s (`db4c43c1`, `4be07cb4`, `83e032a6`
respectively). As with the C64, PET and Acorn ROMs above there is no formal
blanket permission from the rights holder, but VIC-20 ROM images have been
distributed with emulators (VICE, MAME, and others) for decades on a
de-facto-tolerated basis. They are included here, unmodified, solely for use
with the bundled emulator.

If you are the rights holder and want these files removed, please open an
issue — the IDE also supports supplying your own ROM image at runtime.
