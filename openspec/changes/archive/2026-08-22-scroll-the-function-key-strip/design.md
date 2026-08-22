## Context

The strip is one of the two surfaces the virtual keyboard draws (see
`docs/contributing/architecture.md` for the keyboard's place in the app). It is
data-driven like the rest of it: a layout supplies `functionKeys` and nothing
about their size.

## Decisions

**The strip's tracks are the key rows' tracks.** The row grid is
`GRID_COLUMNS` columns with the keyboard's row gap between them, and an ordinary
key spans `KEY_SPAN` of them. The strip uses a column grid whose track is that
same fraction of its own width, so a strip key of the same span is the same size
as a keycap, and exactly a board's worth of them fills the row. Overflow past
that is scrollable rather than wrapped or squeezed. The alternative — dividing
the strip's width by however many keys the machine has — was rejected: it makes
key size an accident of the machine's design, which is the bug this replaces.

For that identity to hold, the strip has to occupy the same box as the rows. It
now takes the rows' width, wide-screen cap and centring, where before it spanned
the whole keyboard. A strip that also carries the mode-tab toggle gives up the
toggle's share and its keys come out slightly under a keycap; compensating would
push a board's worth of keys into scrolling on machines whose keys all fit
today, which is a worse trade.

**Centring is alignment, not padding.** A strip with fewer keys than fill the
row is centred by the grid's own alignment, falling back to the start edge once
the keys overflow — a centred overflow would put the first key off the edge no
scroll can reach. The previous approach padded the strip with inert filler keys;
those would have become dead space to scroll past.

**A drag on the strip is the row scrolling, not a slide across keys.** Elsewhere
on the keyboard a drag slides between keys, hit-tested per pointer move. On the
strip that would press every key the finger crossed into the live matrix during
the slop before the platform recognises the pan. Pointers that start on the
strip therefore skip the slide hit-test; the key they went down on stays held
until the lift, or until the platform takes the pan and cancels the pointer.
This is what keeps a held function key held, which the machines need.

**The overflow cue is derived from the layout, not measured.** Whether a strip
has more keys than the board is wide is a fact about the layout's data, so the
keyboard can say so without reading back any geometry. The platform's own
scrollbar is an overlay one that fades out — the same reason the graphics
palette draws its own overflow cues — so it is not enough on its own.

## Seam impact

None. The `Dialect` / `MachineEmulator` contract is untouched: layouts still
declare `functionKeys` with no size of their own, and no machine-specific code
is involved.

## Risks

- The strip's keys are sized by a percentage of a scrolling grid's own width.
  This is defined behaviour (the percentage resolves against the scrollport, and
  scrollable overflow does not feed back into it), but it is load-bearing enough
  to be worth pinning in the browser rather than by inspection.
- A key's touch bleed extends past the last key and counts as scrollable width,
  which would show a scrollbar on a strip whose keys all fit. The row absorbs
  that in padding it takes back with a negative margin, so the tracks still
  divide the same width the rows divide.
