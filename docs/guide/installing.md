---
title: Installing the toolchain
---

# Installing the toolchain

The IDE runs in a browser and needs nothing installed. Everything it can do
outside the browser — describing a machine, checking a listing, building one
into a file the machine loads, running one and reporting its screen, serving
[an editor](./language-server) or [an agent](../reference/mcp-server) — is a
command-line toolchain you install once:

```bash
npm install -g @basically/cli
```

That gives you two commands: `basically`, which does the work, and
`basically-server`, the host it talks to. You need [Node.js](https://nodejs.org)
22 or newer, and nothing else.

```bash
basically machines                # every machine, and whether it runs here
basically info bbcmicro           # memory, BASIC rules, keywords, formats
printf '10 PRINT "HI"\n' | basically run -m bbcmicro --screen-text
```

`basically --help` names every operation; `basically <operation> --help` says
what one takes.

## What runs straight away

Most of the toolchain never needs a ROM. Listing the machines, describing one,
checking a program and building one all work on a fresh install, for every
machine — only actually _running_ a machine needs its ROM.

And several machines run with no ROM installed at all. `basically machines`
says which:

```
bbcmicro       BBC Micro      run  The BBC’s computer literacy machine…
bbcmaster      BBC Master     run  The BBC Micro, upgraded…
atom           Atom           run  Acorn’s forerunner to the BBC Micro…
trs80          TRS-80         run  Tandy’s Radio Shack original…
ge235          GE-235         run  The machine BASIC was born on…
zx81           ZX81             -  Sinclair’s million-selling breakthrough…
```

A `run` in that column means this installation can run the machine. Two kinds
of machine can, out of the box: the Acorns, whose emulator carries its own ROM
set, and the machines whose BASIC is interpreted directly and needs no ROM
image at all. So you can write, check, build and run a program the moment you
have installed the toolchain.

Everything else needs you to say where its ROM is.

## ROMs

Basically ships no ROM images and fetches none on your behalf. The machines
above are the exception because their ROMs are not the product's to ship — they
come from the emulator, or they do not exist.

If you have images of your own, point the toolchain at the directory holding
them and every machine whose image is there becomes runnable:

```bash
export BASICALLY_ROM_ROOT=/path/to/roms
basically machines                # more of them say "run" now
basically run game.bas -m zx81 --screen-text
```

On Windows:

```powershell
$env:BASICALLY_ROM_ROOT = 'C:\path\to\roms'
```

The directory is the one _containing_ a `roms/` folder, laid out the way the
IDE expects — `roms/zx81.rom`, `roms/c64/kernal.bin`, and so on. Run
`basically machines` after setting it to see which machines it reached.

Say it once, in your shell profile, and every command uses it. To read from
somewhere else for a single run, name it on that run:

```bash
basically run game.bas -m zx81 --rom-root /somewhere/else
```

`--rom-root` beats `BASICALLY_ROM_ROOT`, and both beat anything the toolchain
would otherwise find near itself.

## One host, many commands

The machine a program runs on stays up between commands. The first command that
needs one starts a host in the background; every command after it reaches the
same host, and so the same machine:

```bash
basically run game.bas -m bbcmicro --hold   # leave the machine running
basically drive 'PRESS SPACE; WAIT 50'      # act on it
basically look                              # see what it did
basically server stop                       # let it go
```

`basically server` says whether a host is running and what it is holding. An
editor and an agent share that same host, so all three reach one warm copy of
the toolchain rather than starting three.

## Where next

- [Editing in another editor](./language-server) — the language server
- [Serving an agent](../reference/mcp-server) — the Model Context Protocol
  server
- [Testing programs](./testing-programs) — checking a program against what it
  should do
