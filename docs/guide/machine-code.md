# Programming the Z80/6502

BASIC is where most programs start, but for speed — smooth movement, sound, a
screen painted in one frame — you drop into assembly. Basically lets you write
Z80 or 6502 routines right beside your BASIC program as one or more named
**memory blocks**: a run of code or data with a name, a load address, and a
kind. When you Run, every block is written into memory before the program
starts, so a `RANDOMIZE USR`, `SYS`, `CALL` or `PEEK` finds it exactly where it
expects.

You write blocks in the machine's own assembly language. For the full
instruction set, directives and operand syntax the editor accepts, see the
[Z80 assembly](../reference/z80-assembly) and [6502 assembly](../reference/6502-assembly)
references — one per CPU, shared by every machine that uses it.

## Writing a block

The [tab strip](./writing-basic#the-tab-strip) above the editor shows your
**BASIC** program plus one tab per block. Press **+** after the last tab and
choose **New assembly block**: it
appears at the machine's suggested address with a one-instruction return stub,
and its tab opens the **assembly editor**. Type assembly and it re-assembles as you go, with
errors flagged inline; the bytes it produces are the block. Try it with the
**Kaleidoscope** sample (choose **File ▸ New project**, pick the ZX Spectrum and
start from that sample), which pairs a BASIC front-end with a routine that
paints the whole screen.

**Right-click** a block's tab (or **long-press** on a touch screen) for its
menu:

- **Settings** — rename the block, move it to another address, switch it between
  **code** and **data**, and set an optional entry address or comment. Moving a
  block re-assembles it at the new address, so labels keep pointing to the right
  place.
- **Download .bin** — the block's bytes, exactly as they are.
- **Load bytes…** — replace the block's contents from a file. The block keeps
  its own name, address and kind; only what it holds changes.
- **Delete** — removes the block after a confirmation.

The assembly editor is for **code** blocks. A **data** block — a sprite table, a
character set, a level map — is not assembly and never will be, so its tab opens
the **byte editor** instead (see below). So does a code block on a machine
Basically has no assembler for. The BASIC tab is the program itself — it has no
menu and can't be deleted.

::: tip ZX81 & ZX80
On these machines a block is machine code hidden inside a `REM` line, so it
travels as part of the BASIC listing. The assembly you type is a convenience for
editing — the saved program keeps the bytes.
:::

Click an instruction or an assembler directive and choose **Reference** from the
menu that opens under it: the documentation opens at that instruction's entry on
the reference page for the processor this block runs on. Registers and your own
labels have nothing to look up, so they offer nothing.

## Editing a block's bytes

The byte editor shows a block as rows of bytes: the address each row starts at,
the bytes themselves in hexadecimal, and the characters the machine's own
character set gives them — not ASCII, so what you see is what that machine would
show. Where there is room the two views sit side by side, and where there is not
(a phone, a narrow window) they become **Hex** and **Characters** tabs.

They are two views of one thing, so a change through either shows in the other
straight away, and one undo takes it back in both.

To change a byte, put the cursor on it and type: hexadecimal digits in the hex
view — anything else is ignored there — or a character in the character view,
which is encoded through the machine's character set. A character that machine
has no code for is refused and the block is left alone, rather than being stored
as something else.

Editing inside a block **overwrites**: a byte you change stays at its address
and nothing around it moves, so BASIC that calls into the block keeps working.
The block's **length** is yours to change, though:

- type a value one position past the last byte and the block grows by it;
- press **Backspace** there, or **Delete** on the last byte, and it shrinks;
- for a bigger change than you would want to type, edit the **byte count** in
  the strip above the block — growing pads with zeros, shrinking truncates.

Nothing here asks you to confirm, because undo reaches a length change the same
as any other edit. **Fill** sets a run of bytes to one value: name the address
range and the value, and it fills what falls inside the block.

The on-screen keyboard types into the byte editor just as it does into your
BASIC program, so a block can be edited on a touch screen.

## Bringing in existing machine code

You don't have to type everything. Import a real program file — **File ▸
Import**, or drag it onto the editor — and any machine code it carries is turned
into blocks automatically. The status bar reports what came in, including
anything it had to skip.

A machine's plain program file (the ZX81 `.P`, the BBC `.bbc`, the Atom `.atm`,
the TRS-80 `.cas`) holds only the BASIC listing. To bring machine code in — or
carry it back out — use the machine's **disc image** instead, which bundles the
program with every block in one file: the BBC `.ssd`, the Commodore `.d64`, or
the Atom and TRS-80 `.dsk`. The ZX81 and ZX80 are the exception — their blocks
live inside the listing itself, so they always travel with the program. For
exactly which formats carry code, and how, see each machine's
[file formats](../reference/file-formats#machine-code-data-blocks) reference.

## Running it

Press **Run** as usual. Each block is written into memory at its address before
the program starts, then Basically checks the blocks against the machine's
memory and:

- **refuses to run** if a block would sit on top of the BASIC program itself
  (the status bar names the block so you can move it), and
- **warns but still runs** if a block sits over live hardware such as the screen
  — occasionally useful, but the display may overwrite it.

If the program calls its machine code (say `10 RANDOMIZE USR 32768` on the
Spectrum, or `10 SYS 49152` on the C64), you see the effect immediately — a
routine that changes the border colour flips it the moment the line runs.

## Shipping it to your machine

Choose **Run on real hardware** to export your program in the target machine's
native format (tape, disc or the matching file). Where that format can carry
machine code, your blocks ship with the program — often with an optional
**auto-loader** so a single `LOAD ""`, `*RUN` or `CLOAD` on real hardware pulls
in every block and starts the program for you.

Not every machine's format has room for separate blocks. When yours doesn't, the
Transfer dialog says so and asks before exporting the BASIC program on its own.
For exactly what each machine's tape, disc and file formats carry, see the
[File formats reference](../reference/file-formats#machine-code-data-blocks).

**Save project** writes your document as a **project bundle** (`.zip`) — a zip
holding your BASIC source, each block's bytes and assembly, and a small metadata
file together — so **Open project** and reload keep the whole thing intact. To
download just the BASIC listing as a `.bas`, right-click the **BASIC** editor tab
and choose **Download .bas** (each block tab offers its own `.asm`/`.bin`).

## Sharing it

[Publish to Web](./publishing) carries a program's blocks with it. The short
link bundles the BASIC source **and** its machine code, so whoever opens it runs
the complete program — the blocks load into memory just as they do for you — and
**See the Code** opens the whole thing, blocks included, in the editor. A shared
program with blocks only opens on a machine that can actually run it.
