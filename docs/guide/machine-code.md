# Machine code & data blocks

Some BASIC programs don't live on BASIC alone: they load a block of machine code
or a table of data into memory and then call or read it. Basically keeps that
extra content as one or more named **memory blocks** attached to your document —
each a run of raw bytes with a name, a fixed load address, and a kind (code or
data). When you Run, the blocks are written straight into the machine's memory
before the program starts, so a `RANDOMIZE USR`, `SYS`, `CALL` or `PEEK` finds
them exactly where it expects.

This page covers **creating, bringing in, running, exporting and sharing** a
program with machine code. Every machine that can run BASIC here can also hold
blocks; where they can live differs per machine — see each machine's language
reference page for its address ranges.

## Creating and deleting blocks

The tab strip above the editor always shows your **BASIC** program plus one tab
per block. Press the **+** button after the last tab to create a new
machine-code block: it appears at the machine's suggested address with a
one-instruction return stub, its tab opens the assembly editor, and everything
you type re-assembles as you go. Try it with the **Kaleidoscope** sample
(File ▸ Samples on the ZX Spectrum), which pairs a BASIC front-end asking for a
few numbers with an assembly routine that paints the whole screen.

**Right-click** a block's tab (or **long-press** it on a touch screen) for
its menu:

- **Settings** opens the block's details — rename it, move it to another
  address, switch it between code and data, and set an optional entry address
  or comment. Moving a block that has assembly source re-assembles the
  routine at its new address, so absolute label references keep working.
- **Delete** removes the block (after a confirmation) — its bytes and
  assembly source leave the document.

The BASIC tab is the program itself — it has no menu and can't be deleted.

## Bringing in machine code

The most common way to get a block is to import a real program file that carries
one. Basically recognises machine code in several native formats and turns it
into blocks automatically:

- A **ZX Spectrum `.TAP`** that contains CODE files imports each one as a block.
  Tapes that use a tiny loader to pull in a bigger program are handled for you —
  the loader is set aside and the real program imported.
- A **Commodore `.prg`** that loads somewhere other than the BASIC start comes in
  as a block at that address; a normal program with machine code tacked on after
  it brings that trailing code in as a block too.
- An **Acorn Atom `.atm`** that loads outside the BASIC text area is treated as a
  machine-code or data file and imported as a block.
- A **TRS-80 SYSTEM `.cas`** imports each of its records as a block.

Import a file from **File ▸ Import**, or just drag it onto the editor. The status
bar tells you what came in, including any notes about parts of the file that were
skipped. The [file formats reference](../reference/file-formats#machine-code-data-blocks)
lists exactly which formats carry blocks.

Some machines — the ZX81, ZX80 and BBC — save only their BASIC program to a
file, with no room for a block. For those, drag a **sidecar file** named
`<name>-<addr>.bin` (for example `sprite-0x8000.bin`) onto the editor: its bytes
are added to the current program as a block at the address in its name. This
works on any block-capable machine and adds to your document rather than
replacing it.

A program that carries blocks is saved as a **project bundle** (`.bproj`) — a
single readable file holding your BASIC source and its blocks together — so
Open, reload, and autosave all keep the whole thing intact. Plain BASIC programs
still save as ordinary `.txt`.

## Running it

Press **Run** as usual. Before the program starts, each block is written into
memory at its address, and the machine is set up so the program can reach it.
Then Basically checks the blocks against the machine's memory and:

- **refuses to run** if a block would sit on top of the BASIC program itself
  (the status bar names the block, so you can move it), and
- **warns but still runs** if a block sits over live hardware such as the screen
  — useful sometimes, but the display may overwrite it.

If the program calls its machine code (say `10 RANDOMIZE USR 32768` on the
Spectrum, or `10 SYS 49152` on the C64), you'll see the effect immediately — a
routine that changes the border colour flips it the moment the line runs.

## Exporting it

On the **ZX Spectrum**, "Run on real hardware" exports the whole program:
the `.TAP` file (and the cassette audio) becomes a multi-file tape holding
your BASIC program plus one CODE file per block, so importing it back — here
or in any Spectrum emulator — restores everything. Leave **auto-loader**
ticked and the tape leads with a tiny generated loader that CLEARs memory,
loads every block, and runs your program, so on a real Spectrum a single
`LOAD ""` does it all; untick it if your program does its own loading, and
the tape carries the load-only program first with the CODE files after it.

Other machines export the BASIC program only for now — the Transfer dialog
says so whenever your document has blocks — and the serial bridge always
sends just the BASIC program.

## Sharing it

[Publish to Web](./publishing) carries a program's blocks with it. The short
link you get bundles the BASIC source **and** its machine code, so whoever opens
it plays the complete program — the blocks load into memory just as they do for
you — and **See the Code** opens the whole thing, blocks included, in the editor.
Only machines that support memory blocks can receive a shared program that has
them, so a link always opens on a machine that can actually run it.
