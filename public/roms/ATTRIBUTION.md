# How this folder is laid out

One folder per machine, named for the dialect id it belongs to
(`src/dialects/<id>/`), holding that machine's image or image set:
`zx81/`, `zxspectrum128/`, `commodore64/`, `cpc464/`, `pet/`, `vic20/` and so
on. A machine's `romUrl` in its dialect file points into its own folder, and
nothing else reaches across.

One image is shared rather than owned: the Atari 400 and 800 ran the same
firmware, so `atari400` and `atari800` both point at `atari/atari.rom`, a
folder named for the pair instead of for either dialect id. Duplicating the
bytes to satisfy the rule would be the worse answer.

**The Acorn images are the exception, and must stay where they are.** `os.rom`,
`BASIC.ROM`, `b/DFS-0.9.rom`, `master/mos3.20` and `atom/*.rom` sit at the top
of this folder because those paths are not ours to choose: the BBC Micro, BBC
Master and Atom run on jsbeeb, whose model table (`jsbeeb/src/models.js`) names
each ROM by that literal path and whose loader fetches it as
`<base>/roms/<name>`. This subtree is a copy of jsbeeb's own `public/roms/`,
kept in the layout jsbeeb expects. Moving or renaming any of it stops those
three machines booting in the browser — the unit tests would not catch it,
because under node jsbeeb reads these images straight out of
`node_modules/jsbeeb/public/roms/` instead.

# Sinclair ROM attribution

`zx81/zx81.rom` is the 8K Sinclair ZX81 BASIC ROM ("improved" Edition 3),
copyright © 1981 Nine Tiles Networks Ltd / Sinclair Research Ltd, with rights
now held by Amstrad plc (acquired by Sky in 2007).

`zxspectrum/zxspectrum.rom` is the 16K Sinclair ZX Spectrum 48K BASIC ROM,
copyright © 1982 Sinclair Research Ltd / Nine Tiles Networks Ltd, with rights
now held by Amstrad plc (CRC32 ddee531f — the standard 48K image).

`zx80/zx80.rom` is the 4K Sinclair ZX80 BASIC ROM, copyright © 1980 Nine Tiles
Networks Ltd / Sinclair Research Ltd, with rights now held by Amstrad plc
(CRC32 4c7fc597 — the standard ZX80 image).

`zxspectrum128/zxspectrum128.rom` is the 32K Sinclair ZX Spectrum 128K / +2 ROM, copyright
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

`commodore64/basic.bin` (Commodore BASIC v2), `commodore64/kernal.bin` (KERNAL) and
`commodore64/chargen.bin` (character generator) are the three Commodore 64 ROMs, the
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
The filenames mirror the `commodore64/` naming.

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

Three 32K firmware images ship here, each formed by concatenating that machine's
two standard 16K halves — the lower ROM (the OS/firmware) followed by the upper
ROM (Locomotive BASIC):

- `cpc464/cpc464.rom` — the Amstrad CPC 464: lower ROM CRC32 `815752df`, upper ROM
  (Locomotive BASIC 1.0) CRC32 `7d9a3bac`. As the machine's own boot banner
  states, it is **copyright © 1984 Amstrad Consumer Electronics plc and
  Locomotive Software Ltd**.
- `cpc664/cpc664.rom` — the Amstrad CPC 664: lower ROM (OS v2) CRC32 `3f5a6dc4`,
  upper ROM (Locomotive BASIC 1.1) CRC32 `32fee492`. Its banner states
  **copyright © 1984 Amstrad Consumer Electronics plc and Locomotive Software
  Ltd**. Its BASIC 1.1 is an earlier revision than the 6128's and hashes
  differently; the AMSDOS ROM is not included, so the IDE runs the 664
  tape-only even though the real machine has a disc drive built in.
- `cpc6128/cpc6128.rom` — the Amstrad CPC 6128: lower ROM (OS 2.x) CRC32
  `0219bb74`, upper ROM (Locomotive BASIC 1.1) CRC32 `ca6af63d`. Its banner
  states **copyright © 1985 Amstrad Consumer Electronics plc and Locomotive
  Software Ltd**. The AMSDOS ROM is not included: the IDE runs the 6128
  tape-only, and the machine boots to BASIC without it.

In all three images the two rights holders are distinct, and the copyright
notice inside the image is unaltered here.

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
Amstrad (for BASIC) and Locomotive (for the firmware). All three images are
included here, unmodified and with their copyright notices intact, on that same
basis.
(The IDE also supports supplying your own ROM image at runtime, from Settings ▸
Emulator, so the bundled copies can be removed without disabling the feature. A
replacement image may be any size; it is fitted to the machine's ROM area, which
for these machines is the full 32K, both banks.)

If you are a rights holder (Amstrad or Locomotive Software) and want these files
removed, please open an issue and they will be taken out.

# Apple ROM attribution

`apple1/apple1.rom` is the Apple I firmware, copyright © 1976 Apple Computer, Inc. It is
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

The two halves are unmodified copies of the images distributed with
[alangarf/apple-one](https://github.com/alangarf/apple-one) (the monitor) and
[alexander-akhmetov/apple1](https://github.com/alexander-akhmetov/apple1) (the
interpreter), each checked against a second independent copy before being built
into the file. The interpreter is the original Apple release rather than the
Replica 1 revision: it addresses the display register through its `$D0F2` mirror
at `$E3D6`/`$E3DB`, where the Replica 1 image was changed to the canonical
`$D012`. For anyone rebuilding the file, the SHA-256 of each part is

    monitor  256 bytes  e5af0d1c4057bd8e0ef5cb069c208ff7cc0984a7dff53b12c5cf119de8cb5c25
    BASIC   4096 bytes  bf80009454610a1066489da635a8afb51ad42442d307251896a53bedbeaadd46
    file    4352 bytes  c8b17a7c2da55eca91e38fced792108ddca0be12192b810fbb0ebd1be14e30eb

(The IDE also supports supplying your own ROM image at runtime, from Settings ▸
Emulator, so the bundled copy can be removed without disabling the feature. A
replacement image may be any size; it is fitted to the machine's ROM area, which
for this machine is the full 4352 bytes, both parts.)

If you are the rights holder and want this file removed, please open an issue and
it will be taken out.

`apple2/apple2.rom` is the Apple II firmware, copyright © 1977–1978 Apple Computer, Inc.
It is the whole `$D000`–`$FFFF` window as one 12288-byte image, in address order,
and holds four sockets:

    Programmer's Aid #1  $D000-$D7FF  2048 bytes
    empty socket         $D800-$DFFF  2048 bytes ($FF fill)
    Integer BASIC        $E000-$F7FF  6144 bytes
    Monitor              $F800-$FFFF  2048 bytes

The monitor half is the **original** one, not the Autostart ROM the Apple II Plus
shipped with: its reset vector is `$FF59`, so RESET drops into the monitor's `*`
prompt rather than restarting a program. That is the machine this dialect is, and
it is the one thing to check if the file is ever replaced.

Steve Wozniak's Integer BASIC and monitor, and Apple's own Programmer's Aid. As
with the Apple I image above there is no formal permission from the rights
holder, and the same de-facto tolerance applies: this image ships with the Apple
II emulators (AppleWin, apple2js, MAME, microM8 and others) and is published
alongside the machine's documentation by the Apple II Documentation Project. It is
included here, unmodified, solely for use with the bundled emulator.

The file is an unmodified copy of the image distributed with
[AppleWin](https://github.com/AppleWin/AppleWin) (`resource/Apple2.rom`), checked
socket by socket against the independent copy in
[apple2js](https://github.com/whscullin/apple2js) (`js/roms/system/original.ts`):
Programmer's Aid #1, Integer BASIC and the Monitor are byte-identical between the
two, and the `$D800` socket - unpopulated on a machine with Programmer's Aid #1
fitted, since that ROM is 2K - is the only place they differ, where this copy
reads as the `$FF` a floating bus settles to. For anyone rebuilding the file, the
SHA-256 of each part is

    Programmer's Aid #1  2048 bytes  e35d2e96d7b395dd3c035726e76c417b05813ae9675ca7108d5988dc980110a3
    empty socket         2048 bytes  d0ff1b294b5288d1ae1421eadf5b2d38a8752b76d472ff30bed9028e25b1c5b8
    Integer BASIC        6144 bytes  189c95ff289a186108580d3e416f3ec3d8c636246a9aeed9814e769257eb8a19
    Monitor              2048 bytes  882db0fbe15c7cfe395fe41451c759c4a21c09ff8fa161473c549fbce7733964
    file                12288 bytes  f34e573b9de203203ac4a8c6cab7ab0f974facf13c40bf6e362fbb92197199f9

(The IDE also supports supplying your own ROM image at runtime, from Settings ▸
Emulator, so the bundled copy can be removed without disabling the feature. A
replacement image may be any size; it is fitted to the machine's ROM area, which
for this machine is the full 12288 bytes.)

If you are the rights holder and want this file removed, please open an issue and
it will be taken out.

`apple2plus/apple2plus.rom` is the Apple II Plus firmware, copyright © 1978–1979 Apple
Computer, Inc. It is the same `$D000`–`$FFFF` window as `apple2/apple2.rom` above, as
one 12288-byte image in address order, and holds two parts rather than four:

    Applesoft II  $D000-$F7FF  10240 bytes
    Autostart Monitor  $F800-$FFFF  2048 bytes

Applesoft fills five 2K sockets contiguously, which is why there is no
Programmer's Aid and no empty socket here. The monitor is the **Autostart** one
rather than the original: its reset vector is `$FA62`, so RESET restarts BASIC
instead of dropping into the monitor's `*` prompt, and the machine signs on in
Applesoft with no command typed at it. That is the difference between this image
and `apple2/apple2.rom`, and it is the one thing to check if the file is ever replaced.

**Applesoft II is Microsoft's code, not Apple's.** Apple licensed the interpreter
from Microsoft in 1977 and Apple's copyright notice is what the machine prints,
but the floating-point BASIC underneath is the same 6502 interpreter Microsoft
sold to Commodore and others — unlike the Apple I and Apple II images above,
which are Wozniak's own work throughout. Both rights holders are therefore named
here. As with those images there is no formal permission from either, and the
same de-facto tolerance applies: this image ships with the Apple II emulators
(AppleWin, apple2js, MAME, microM8 and others) and is published alongside the
machine's documentation by the Apple II Documentation Project. It is included
here, unmodified, solely for use with the bundled emulator.

The file is an unmodified copy of the image distributed with
[AppleWin](https://github.com/AppleWin/AppleWin) (`resource/Apple2_Plus.rom`),
and every byte of it is confirmed against an independent copy in
[apple2js](https://github.com/whscullin/apple2js): the Applesoft half is
byte-identical to that project's `js/roms/system/apple2j.ts` (the Japanese
II J-Plus, which fits the same interpreter behind a localised monitor), and the
monitor half to its `js/roms/system/intbasic.ts` (a II Plus with the Integer
BASIC firmware card fitted, which keeps the Autostart monitor). Between the two
there is no byte here taken on trust. For anyone rebuilding the file, the
SHA-256 of each part is

    Applesoft II       10240 bytes  ed8d83176bb9445b3eaa815e07956777bdfaa9e4892a8d7f5019dead62434c4c
    Autostart Monitor   2048 bytes  29465303e7844fa56a8c846d0565e45f5ee082f98f2ccf1b261de4a7e902201b
    file               12288 bytes  fc3e9d41e9428534a883df5aa10eb55b73ea53d2fcbb3ee4f39bed1b07a82905

(The IDE also supports supplying your own ROM image at runtime, from Settings ▸
Emulator, so the bundled copy can be removed without disabling the feature. A
replacement image may be any size; it is fitted to the machine's ROM area, which
for this machine is the full 12288 bytes.)

If you are the rights holder and want this file removed, please open an issue and
it will be taken out.

# MITS ROM attribution

`altair8800/altair8800.rom` is Altair 8K BASIC 4.0 — Microsoft's first product, written by
Bill Gates, Paul Allen and Monte Davidoff, copyright © 1975–1976 Microsoft and
licensed to MITS, whose own copyright notice the image prints on sign-on. It is
not a ROM: the base Altair had no firmware at all, only an empty S-100
backplane, and you either toggled a bootstrap in on the front panel or loaded
BASIC from paper tape into RAM at 0x0000. This file is that object tape, and the
emulator copies it to 0x0000 the way the tape reader would have.

It is the 8192-byte image that signs on as

    ALTAIR BASIC REV. 4.0
    [EIGHT-K VERSION]
    COPYRIGHT 1976 BY MITS INC.

an unmodified copy of the one the SIMH AltairZ80 software collection distributes
as `8kbas.bin` (https://schorn.ch/altair.html, `altsw.zip`). The addresses, the
keyword tokens and the console port numbers this dialect is built on were all
read off this exact image, so another Altair BASIC version may boot but is not
what the dialect was derived against. For anyone replacing the file:

    md5     97eead711723295e9ce4f52b300002cf
    sha256  dfe4b1576c6ac9fe1a47e9ba0fe697f098209ef8eab61cd54cffc626a84152d3

The licensing is worth stating precisely, because it is the thinnest basis of
anything here. There is no permission to lean on, as there is for the Sinclair
and Amstrad images: Microsoft has granted none, the rights holder is very much
extant, and Microsoft's 2025 open-source release was the **6502** BASIC under
the MIT licence — a different interpreter for a different processor, which does
not cover the 8080 Altair BASIC this machine runs. What this ships on is the
same de-facto tolerance as the Apple, Acorn and Commodore images above: the tape
has been distributed with the Altair emulators for decades — SIMH's AltairZ80
collection, z80pack, MAME and the Altair Clone's own downloads among them — and
is published alongside the machine's documentation by the Altair preservation
sites. The machine it runs on was discontinued in 1978 and the interpreter has
had no commercial life since. The image is included here unmodified, with its
copyright notice intact, solely for use with the bundled emulator.

That is a weaker basis than a grant, and it is recorded as such rather than
dressed up. If you are a rights holder and want this file removed, please open
an issue and it will be taken out.

(The IDE also supports supplying your own image at runtime, from Settings ▸
Emulator, so the bundled copy can be deleted without disabling the feature. A
replacement may be any size; it is fitted to the 8192 bytes the interpreter
occupies. Without the file the machine still constructs, the emulator opens with
a message saying what is missing, and the tests that need the interpreter skip
rather than fail.)

# Tesla ROM attribution

`pmd85/pmd85.rom` is the Tesla PMD 85-2 firmware, copyright © 1985–1986 Tesla
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

# Atari ROM attribution

`atari/atari.rom` is the Atari 400/800 firmware, and unlike every other image here it
ships on an explicit grant rather than on tolerance: both halves are clean-room
reimplementations by Avery Lee, written for the
[Altirra](https://www.virtualdub.org/altirra.html) emulator and offered under
the FSF all-permissive licence. No Atari-copyright code is involved.

It is two images in one file, because the machine needs both and the emulator
seam carries one image: the first 10240 bytes are **AltirraOS 3.49**, the
operating system that lives at `$D800`–`$FFFF`, and the remaining 8192 bytes are
**Altirra 8K BASIC 1.59**, the BASIC cartridge that lives at `$A000`–`$BFFF`.
The OS comes **first** rather than in address order, so that a file carrying
only the OS pads the cartridge window to `$FF` — which the machine reads at
`$BFFC` as "no cartridge fitted" and boots to the Memo Pad, exactly as an 800
with an empty slot, rather than becoming a machine that cannot reset.
`scripts/build-atari-rom.mts` builds the file from the two images and verifies
both before writing.

Both halves are unmodified copies of the byte arrays the
[atari800](https://github.com/atari800/atari800) emulator carries in
`src/roms/altirraos_800.c` and `src/roms/altirra_basic.c`, which are in turn
compiled from the `emuos` sources in the Altirra distribution. Each of those
files carries the same notice, reproduced verbatim:

> Altirra - Atari 800/800XL emulator
> Kernel ROM replacement, version 3.11
> Copyright (C) 2008-2018 Avery Lee
>
> Copying and distribution of this file, with or without modification,
> are permitted in any medium without royalty provided the copyright
> notice and this notice are preserved. This file is offered as-is,
> without any warranty.

> Altirra BASIC, version 1.58
> Copyright (C) 2008-2022 Avery Lee
>
> Copying and distribution of this file, with or without modification,
> are permitted in any medium without royalty provided the copyright
> notice and this notice are preserved. This file is offered as-is,
> without any warranty.

The version numbers in those two notices are the ones upstream wrote and have
not kept current: the images themselves sign on as AltirraOS 3.49 and Altirra
8K BASIC 1.59, and those are the versions this dialect was derived against. For
anyone rebuilding the file, the SHA-256 of each part is

    OS      10240 bytes  1bbb1d3f72017654725fc71ad6aa8ffd786637541fd49ddda3c32f7ada73db18
    BASIC    8192 bytes  19fd64377895eb5d4414319855322dd3f860c21fdc1df9adc0e98ab72c540913
    file    18432 bytes  1cfe13fb1d8197c09ec15dbbb7254cae1b7770c02c4b6bf25dd1e7d475af4f35

(The IDE also supports supplying your own ROM image at runtime, from Settings ▸
Emulator, so the bundled copy can be replaced with a genuine Atari OS and
BASIC pair. A replacement image may be any size; it is fitted to the machine's
ROM area, which for this machine is the full 18432 bytes, both parts.)

# Sony ROM attribution

`hb10p/hb10p.rom` is the 32K Sony HB-10P system ROM: the 16K MSX BIOS at `0x0000`
followed by the 16K MSX BASIC 1.0 at `0x4000`, as one image in one chip exactly
as the machine carries it. The BIOS half is copyright © 1985–1986 ASCII
Corporation and Sony Corporation, the BASIC half copyright © 1983 Microsoft,
whose notice the image prints on sign-on:

    MSX BASIC version 1.0
    Copyright 1983 by Microsoft

It is the image openMSX names `hb-10p_basic-bios1.rom` in its
`Sony_HB-10P.xml` machine configuration. The addresses, the workspace pointers,
the key matrix and the keyboard's own character table this dialect is built on
were all read off this exact image, so another MSX1 BIOS may boot but is not
what the machine was derived against. For anyone replacing the file:

    md5     1d89c2d66e18538b1065d1c37cb83e4d
    sha1    5e7c8eab238712d1e18b0219c0f4d4dae180420d
    sha256  88eff516d7d706b8a4e5a512697444bd5a851e403c82006bcbfc537be3c47976

The licensing is the thinnest basis of anything here, alongside the Altair
image, and for the same reason: **there is no permission to lean on**. Neither
ASCII nor Microsoft nor Sony has granted one, all three rights holders are
extant, and Microsoft's 2025 open-source release was the **6502** BASIC under
the MIT licence — a different interpreter for a different processor, which does
not cover the Z80 MSX BASIC here. What this ships on is the same de-facto
tolerance as the Acorn, Commodore and MITS images above: MSX system ROMs have
been distributed with the emulators for decades — blueMSX, fMSX, MAME and the
MSX preservation archives among them — and openMSX identifies this one by
checksum in its own shipped configuration. The machine was discontinued in the
late 1980s and the interpreter has had no commercial life since. The image is
included here unmodified, with its copyright notice intact, solely for use with
the bundled emulator.

That openMSX itself ships **C-BIOS** rather than this file is worth stating
plainly, because it is the strongest evidence that the basis is thin: C-BIOS is
a clean-room MSX BIOS written precisely so that a distribution needs no
permission. It is not an alternative here, because it has no BASIC in it at all
and BASIC is the whole of what this IDE runs.

That is a weaker basis than a grant, and it is recorded as such rather than
dressed up. If you are a rights holder and want this file removed, please open
an issue and it will be taken out.

(The IDE also supports supplying your own image at runtime, from Settings ▸
Emulator, so the bundled copy can be deleted without disabling the feature. A
replacement may be any size; it is fitted to the machine's ROM area, which for
this machine is the full 32768 bytes. Without the file the machine still
constructs, the emulator opens with a message saying what is missing, and the
tests that need the ROM skip rather than fail.)

# MGT ROM attribution

`samcoupe/samcoupe.rom` is the 32K SAM Coupé ROM version 3.0, copyright © 1989-1990
Dr Andrew J. A. Wright (CRC32 e535c25d, SHA-256
14d52ffc635a2ece0244aa3fd327bab5ee796f92570361aade0d6df3eba41d9f).

This one rests on an explicit grant from its author rather than on tolerance -
footing shared here only by the Sinclair images and the Altirra pair. The ROM
archive in Simon Owen's `samrom` repository
(https://github.com/simonowen/samrom), where this copy comes from, states it in
its ReadMe:

> Also included are many versions of the ROM binaries, released with kind
> permission from the ROM author, Dr Andy Wright.

The World of SAM ROM archive (https://www.worldofsam.org) distributes the same
images on the same permission, and SimCoupe credits the same grant.

The permission covers the binary. It is **not** the `samrom` repository's own
licence, and the distinction matters here: that repository is GPL-2.0, while
this project is GPL-3.0-or-later, and the two are incompatible for linked code.
Nothing is linked — `samcoupe/samcoupe.rom` ships as a data asset under `public/roms/`,
loaded at runtime by the emulator, and it travels on Dr Wright's permission
alone. The ROM's own assembly source is published in that repository for
anyone who wants to read what the machine is executing.

If you are the rights holder and want this file removed, please open an
issue — the IDE also supports supplying your own ROM image at runtime, from
Settings ▸ Emulator. A replacement image may be any size; it is fitted to the
machine's ROM area.
