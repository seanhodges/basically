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
issue — the IDE also supports supplying your own ROM image at runtime, from
Settings ▸ Emulator. A replacement image may be any size; it is fitted to the
machine's ROM area.

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
issue.

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
issue.

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
issue.

# Amstrad CPC ROM attribution

Two 32K firmware images ship here, each formed by concatenating that machine's
two standard 16K halves — the lower ROM (the OS/firmware) followed by the upper
ROM (Locomotive BASIC):

- `cpc/cpc464.rom` — the Amstrad CPC 464: lower ROM CRC32 `815752df`, upper ROM
  (Locomotive BASIC 1.0) CRC32 `7d9a3bac`. As the machine's own boot banner
  states, it is **copyright © 1984 Amstrad Consumer Electronics plc and
  Locomotive Software Ltd**.
- `cpc/cpc6128.rom` — the Amstrad CPC 6128: lower ROM (OS 2.x) CRC32
  `0219bb74`, upper ROM (Locomotive BASIC 1.1) CRC32 `ca6af63d`. Its banner
  states **copyright © 1985 Amstrad Consumer Electronics plc and Locomotive
  Software Ltd**. The AMSDOS ROM is not included: the IDE runs the 6128
  tape-only, and the machine boots to BASIC without it.

In both images the two rights holders are distinct, and the copyright notice
inside the image is unaltered here.

The licensing is not a single blanket grant, so it is worth stating precisely:

- **Amstrad's permission.** Cliff Lawson, speaking for Amstrad, extended
  Amstrad's long-standing "distribute the ROMs with your emulator" permission
  (the same one that covers the Sinclair ROMs above — Amstrad acquired the
  Sinclair computer business in 1986) to the CPC machines, saying it "applies
  equally well to all the CPC stuff." The condition is that the copyright
  message is not altered and that Amstrad's retained copyright is acknowledged
  — Amstrad ask that redistributions note they "have kindly given their
  permission for the redistribution of their copyrighted material but retain
  that copyright."
- **Locomotive Software's copyright.** Parts of the firmware are also
  © Locomotive Software, a separate rights holder, and Lawson noted that "some
  bits of that are also (c)Locomotive so you need to seek their permission too
  — however I don't think there's ever a problem in so doing." Locomotive have
  generally granted this, but their own stated position has been more
  conservative than Amstrad's: redistribution on a non-profit basis (any charge
  covering only distribution costs) and with prior written permission. This
  project is free and non-commercial, and distributes the image unmodified
  solely for use with the bundled emulator, which is consistent with that.

This combined Amstrad-plus-Locomotive basis is how the long-running CPC
emulators (CPCemu, WinAPE, Arnold, Caprice32, JavaCPC) ship these images;
CPCemu's documentation, for example, credits distribution permission from both
Amstrad (for BASIC) and Locomotive (for the firmware). Both images are included
here, unmodified and with their copyright notices intact, on that same basis.
(The IDE also supports supplying your own ROM image at runtime, from Settings ▸
Emulator, so the bundled copies can be removed without disabling the feature. A
replacement image may be any size; it is fitted to the machine's ROM area, which
for these machines is the full 32K, both banks.)

If you are a rights holder (Amstrad or Locomotive Software) and want these files
removed, please open an issue and they will be taken out.

# Apple ROM attribution

`apple1.rom` is the Apple I firmware, copyright © 1976 Apple Computer, Inc. It is
two images in one file, because the machine needs both and the emulator seam
carries one image: the first 256 bytes are the monitor PROM that lives at `$FF00`
(the "WozMon"), and the remaining 4096 bytes are Integer BASIC, which the machine
loaded into RAM at `$E000` from cassette. The monitor comes **first** rather than
in address order, so that a file carrying only the monitor pads into a machine
that boots to the monitor prompt with no interpreter fitted — which is a real
Apple I with no BASIC tape loaded, rather than one that cannot reset.
`scripts/build-apple1-rom.mts` builds the file from the two images and verifies
both before writing.

Both are Steve Wozniak's code, written for a computer Apple sold some two hundred
of and discontinued in 1977. As with the Acorn and Commodore ROMs above there is
no formal permission from the rights holder, but these two images have been
distributed for decades on a de-facto-tolerated basis: they ship with the
Apple-1 replica and reproduction kits, with the Apple-1 emulators (POM1, Sim6502,
MAME and others), and are published alongside the machine's documentation by the
Apple-1 Registry (https://www.apple1registry.com). They are included here,
unmodified, solely for use with the bundled emulator.

(The IDE also supports supplying your own ROM image at runtime, from Settings ▸
Emulator, so the bundled copy can be removed without disabling the feature. A
replacement image may be any size; it is fitted to the machine's ROM area, which
for this machine is the full 4352 bytes, both parts.)

If you are the rights holder and want this file removed, please open an issue and
it will be taken out.

# MITS Altair 8800 — the image that is missing

`altair8800.rom` is **not here, and will not be**. This section exists so its
absence reads as a decision rather than an oversight.

The Altair had no firmware at all: the base machine shipped with an empty
S-100 backplane, and you either toggled a bootstrap in on the front panel or
loaded BASIC itself from paper tape into RAM at 0x0000. The tape everyone
loaded was Altair 8K BASIC — Microsoft's first product, copyright © 1975–1976
Microsoft (as MITS's licensee), and still under copyright with no
redistribution grant. Microsoft's 2025 open-source release was the **6502**
BASIC under the MIT licence, a different interpreter for a different processor;
it does not cover the 8080 Altair BASIC this machine runs. Unlike the Sinclair
and Amstrad ROMs above there is no permission to lean on, and unlike the
Commodore and Acorn ones there is no decades-old de-facto tolerance either, so
nothing ships.

To use the Altair 8800 dialect, supply your own image at
`public/roms/altair8800.rom`. What the emulator expects is the 8192-byte 8K
BASIC 4.0 object tape that signs on as

    ALTAIR BASIC REV. 4.0
    [EIGHT-K VERSION]
    COPYRIGHT 1976 BY MITS INC.

(md5 `97eead711723295e9ce4f52b300002cf` — the image the SIMH AltairZ80 software
collection distributes as `8kbas.bin`). The addresses, the keyword tokens and
the console port numbers this dialect is built on were all read off that image,
so a different Altair BASIC version may boot but is not what it was derived
against.

Without the file the machine still constructs and the test suite still passes:
the emulator opens with a message explaining what to supply, and the tests that
need the interpreter skip rather than fail.

# Tesla ROM attribution

`pmd85.rom` is the Tesla PMD 85-2 firmware, copyright © 1985–1986 Tesla
Piešťany / Tesla Bratislava. It is two chips in one file, because the machine
needs both and the emulator seam carries one image: the first 4096 bytes are
Monitor 2, the PMD 85-2 operating system that lives at `0x8000`, and the
remaining 9216 bytes are BASIC-G V2.0, the ROM Module the machine shipped with.
That module is not addressable memory — the Monitor reads it a byte at a time
through an 8255 and copies it into RAM — so it is appended rather than mapped.
The same 4K + 9K concatenation is how the Didaktik Alfa (a licensed PMD 85
clone) has always been distributed as a single image.

The two halves are unmodified copies of `monit2.rom` and `basic2.rmm` as
shipped by [GPMD85Emulator](https://github.com/pmd85/GPMD85Emulator), Roman
Bórik's GPL-3.0 emulator of the machine, whose `rom/README.md` documents each
image's size and load address.

Tesla was a Czechoslovak state enterprise and no longer exists. As with the
Acorn and Commodore ROMs above there is no formal blanket permission from a
rights holder, but these images have been distributed with PMD 85 emulators —
GPMD85Emulator, MAME and others — for decades on a de-facto-tolerated basis.
They are included here, unmodified, solely for use with the bundled emulator.

If you are the rights holder and want this file removed, please open an
issue — the IDE also supports supplying your own ROM image at runtime, from
Settings ▸ Emulator.
