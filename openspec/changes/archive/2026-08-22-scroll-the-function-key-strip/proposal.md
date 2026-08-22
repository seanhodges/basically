## Why

The on-screen function-key strip sized its keys from its own contents rather
than from the board, so a key's width depended on how many the machine had: the
Altair's three drew at three and a third keycaps, the PMD 85's thirteen at three
quarters of one. The first fix put them on the key rows' grid and let a strip
too wide for one line wrap onto a second.

Wrapping is the wrong answer. It costs keyboard height on the machine that can
least afford it — the PMD 85 already gives up a row of its own board to the
template — and it splits a single control into two bands, which reads as two
kinds of key rather than one. The function keys belong on one row.

The width is not negotiable either: a function key that is not the size of the
letter key beneath it is either hard to hit or visibly out of place, and which
of the two depends on an accident of how many function keys a machine's designer
happened to fit. Keeping both — one row, keycap-sized keys — means the row can
hold only as many keys as the board is wide, and the rest have to be reached by
scrolling.

## What Changes

- The function-key strip is one row on every machine and never wraps.
- A function key is drawn the size of a letter key on the board below it,
  whatever the machine's count.
- A machine with more function keys than the board is wide scrolls the row
  sideways to reach the rest, and shows that there are more.
- Scrolling the row does not press a key, and a key held without moving stays
  held — the machines that read function keys read them as held state.

Affected capability spec: `openspec/specs/virtual-input/spec.md`.

## Non-goals

- **No ceiling on the count.** A machine may put as many function keys on the
  strip as it needs; the guidance to design for a board's worth is documented,
  not enforced. The PMD 85's thirteen are there because nothing a host keyboard
  sends can reach them.
- **No change to the landscape strip**, which stands in the left gutter as a
  vertical stack and has its own space.
- **No change to which keys a machine puts on its strip.**
- **No new gesture.** Scrolling is the platform's own pan; the strip only stops
  swallowing it.
