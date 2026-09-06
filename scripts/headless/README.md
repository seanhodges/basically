# @basically/cli

The [Basically](https://github.com/seanhodges/basically) toolchain outside the
browser: describe a machine, check a listing, build one into a file the machine
loads, run one and report its screen, or check one against what it should do —
and serve the same operations to an editor over the Language Server Protocol or
to an agent over the Model Context Protocol.

```sh
npm install -g @basically/cli

basically machines                       # every machine, and whether it runs here
basically info commodore64               # memory, BASIC rules, keywords, formats
printf '10 PRINT "HI"\n' | basically run -m bbcmicro --screen-text
```

## ROMs

This package carries no ROM images. A machine runs on a bare install when it
needs no ROM at all, or when its emulator carries its own ROM set — `basically
machines` says which. For any other machine, point the toolchain at images you
already have:

```sh
export BASICALLY_ROM_ROOT=/path/to/a/directory/holding/roms
```

`--rom-root <dir>` on a single `run` or `check` overrides it.

## Documentation

<https://ba.sical.ly/docs/>

## Licence

GPL-3.0-or-later. See `LICENSE`.
