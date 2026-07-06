# Vendored viciious C64 core

The files under this folder are a vendored subset of
[viciious](https://github.com/luxocrates/viciious) by Mike Dean (luxocrates),
a from-scratch Commodore 64 emulator. They were copied unmodified from upstream
commit `69f0dc672c1dba46382065f2f4ed1631440f98b0`.

## License

From the upstream README:

> The emulation code and UI assets in Viciious were authored from scratch and
> placed in the public domain.

The vendored emulation code is therefore public domain, which is compatible
with this project's GPL-3.0-or-later license. The hand-written `index.d.ts`
type surface and the `index.js` barrel in this folder were authored for this
project.

The upstream README adds a caveat that the **ROMs** it ships (BASIC, KERNAL,
CHARGEN) are derived from works by other authors and are not placed in the
public domain. We do **not** vendor viciious's ROM source modules; the three
ROM images live under `public/roms/c64/` as binary assets — see
`public/roms/ATTRIBUTION.md`.

## Vendored files

Only the machine-`target` core and the `tools` it depends on were copied; the
webpack build, the `entry/*` host entrypoints, the DOM/terminal host modules,
the monitor/debugger UI, and the ROM source modules were intentionally left
behind. The IDE supplies its own host modules (in-memory video, key-matrix
keyboard, audio/joystick stubs) from `../c64Machine.ts`.

- `target/` — `bringup`, `runloop`, `wires`, `ram`, `vic`, `sid`, `sid_diag`,
  `cias`, `cpu`, `tape`
- `tools/` — `romLocations`, `serializerSupport`, `disasm`, `base64`,
  `c64FontCodePoints`, `palettes`, `parser`, `loadPrg`
- `debug.js`

`*.js` here is plain JavaScript kept out of the strict typechecker (no `allowJs`),
exactly as the vendored Z80 and 6502 cores are. The public surface the adapter
uses is described by the hand-written `index.d.ts`.
