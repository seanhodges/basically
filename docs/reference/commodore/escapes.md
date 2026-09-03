---
title: Commodore PETSCII escape codes
---

<script setup>
import { commodoreEscapes } from '../../../src/reference/escapes/commodore';
</script>

# Commodore PETSCII escape codes

Every escape that can be typed in Commodore source, and the PETSCII byte it
stores. PETSCII is shared byte-for-byte across the whole Commodore 8-bit line,
so this table is the escape reference for the Commodore 64, the VIC-20 and the
PET alike. Escapes are recognised in string literals, REM and DATA bodies.
Filters can be prefilled with `?q=` and `?cat=` query parameters.

## Colour on a monochrome machine

The colour-control escapes (`{red}`, `{cyan}`…) drive the colour display on the
C64 and VIC-20. On the monochrome PET they store and round-trip identically but
have no visible effect.

The lower-case display bank is not yet modelled, so a program that switches to
it shows the upper-case/graphics shapes instead.

## petcat and VICE aliases

Canonical names follow this app's decode. The petcat/VICE aliases — `{wht}`,
`{rvof}`, decimal `{147}`, `{CBM-x}`/`{SHIFT-x}` — are accepted on input, so
archived petcat listings paste straight in. They are accepted, never produced: a
listing exported from here uses the canonical name.

In a `{CBM-x}`/`{SHIFT-x}` name, `x` is whatever the keycap says, so the symbol
keys work as well as the letters — `{SHIFT-*}` is the horizontal line and
`{CBM-+}` the chequerboard.

Where a code is spelled several ways in the wild the alternatives are accepted
too, spaces and all: reverse video takes `{rvon}`, `{rvson}` or `{rvs on}`, and
`{rvoff}`, `{rvof}`, `{rvsoff}` or `{rvs off}`.

## Shifted-letter keyword abbreviations

`pO` for `POKE` and `goS` for `GOSUB` tokenize as they do on the machine and
list back in full. The `{SHIFT-x}` escape spells the shifted letter where the
plain capital would be ambiguous.

See also the [Commodore BASIC reference](../commodore) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="commodoreEscapes" />
