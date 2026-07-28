# Bundled font attribution

Two small `woff2` faces ship here so that every character a supported machine's
character set can express renders as its real shape, whatever fonts the reader's
device happens to have. Both are **subsets** — only the code points the dialects
actually emit are redistributed, and ASCII is deliberately excluded so the faces
can sit first in the monospace stack without ever being consulted for ordinary
text (see the `@font-face` rules in `src/styles.css`).

`coverage.json` records exactly which code points each face carries;
`src/dialects/fontCoverage.test.ts` fails if a dialect starts emitting a
character no bundled face covers.

## `basically-graphics.woff2` — unscii-16

- **Font:** unscii 2.1, `unscii-16` variant (8×16 pixels per glyph)
- **Author:** Viznut (Ville-Matias Heikkilä)
- **Upstream:** http://viznut.fi/unscii/
- **Licence:** Public domain. Upstream states: "…the other variants are in the
  Public Domain" (the exception being `unscii-16-full`, below).

unscii is a bitmap font designed for character-cell art from classic system
fonts, which is precisely the shape vocabulary these machines used — so the
block graphics look like block graphics rather than like a text font's
approximation of them.

Covers 178 of the 187 code points the dialects emit.

## `basically-graphics-extra.woff2` — unscii-16-full

- **Font:** unscii 2.1, `unscii-16-full` variant
- **Author:** Viznut (Ville-Matias Heikkilä), incorporating glyphs from
  Fixedsys Excelsior and GNU Unifont
- **Upstream:** http://viznut.fi/unscii/
- **Licence:** GPL-2.0-or-later. Upstream states: "`unscii-16-full` falls under
  GPL because of how Unifont is licensed". Compatible with this project's
  GPL-3.0-or-later.

The nine code points `unscii-16` does not cover: `U+231C`–`U+231F` (the ZX81
corner brackets), `U+263C` (`☼`) and `U+2B60`–`U+2B63` (the wide arrows). Kept
as a separate `unicode-range`-gated face rather than switching the primary one,
so the licence footprint of the bytes actually served for the common case stays
public domain.

Both variants share one 8×16 grid at 64 units/em — advance 32 (0.5 em), ascent
64, descent 0 — so a single set of `@font-face` metric descriptors serves both.

## How the subsets were built

The code point lists come from the audit, not by hand — `requiredCodepoints()`
in `src/dialects/semigraphicsAudit.ts` is every non-ASCII character any
registered dialect renders:

```sh
# 1. the required code points, split by which upstream variant covers them
#    (see coverage.json for the resulting lists)
npx vite-node -e "…requiredCodepoints()…"   # → cps-primary.txt, cps-extra.txt

# 2. subset each variant to exactly its share, keeping the name table so the
#    upstream font's own name and copyright travel with the bytes
pyftsubset unscii-16.ttf \
  --unicodes-file=cps-primary.txt \
  --flavor=woff2 --layout-features='' --no-hinting --name-IDs='*' \
  --output-file=basically-graphics.woff2

pyftsubset unscii-16-full.ttf \
  --unicodes-file=cps-extra.txt \
  --flavor=woff2 --layout-features='' --no-hinting --name-IDs='*' \
  --output-file=basically-graphics-extra.woff2
```

`pyftsubset` is [fonttools](https://github.com/fonttools/fonttools) (`pip
install "fonttools[woff]"`, version 4.63.0 was used here). The upstream `.ttf`
files are the ones published at http://viznut.fi/unscii/ and are not committed —
only the subsets are.

## No fonts are derived from the bundled ROMs

The character shapes here come from unscii, not from `public/roms/`. The ROM
distribution permissions recorded in `public/roms/ATTRIBUTION.md` cover use with
an emulator, not general-purpose font redistribution.
