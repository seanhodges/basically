---
name: authoring-dialect-samples
description: >-
  Write or port the bundled sample BASIC programs for a Basically dialect
  (hello, circles, breakout, maze, kaleido) accurately and to project
  convention. Use when adding a dialect's samples, porting the canonical set to
  a new machine, fixing an inaccurate or broken sample, or wiring a sample's
  machine-code block. Covers the per-sample intent, the accuracy gotchas
  (Pitteway circles, keyword-as-variable collisions, solvable mazes), the
  samples.ts / block registration shape, running each sample on the dialect's
  own emulator to see what it really does, and the colocated samples.test.ts
  checks each dialect must ship. A sub-skill of adding-a-target-system (its
  Stage 3), usable on its own.
---

# Authoring a dialect's sample programs

Every dialect ships the **same canonical sample set, in the same order**, ported
to that machine's own BASIC. The samples are the first thing a user runs, so
they must be _accurate_ — authentic to the machine, correct in their maths, and
green under the dialect's colocated `samples.test.ts`. This skill is how you get
them right.

> **Match behaviour, not bytes.** Port each program to the target's BASIC so it
> _does the same thing_; never translate byte-for-byte, and **never point a
> dialect at another machine's `.bas`**. When a machine genuinely can't express a
> sample, degrade gracefully (see below) rather than shipping something broken.

## Step 0 — Derive the authoritative set (don't trust this list)

The set grows. Read the shipped dialects' `samples.ts` **now** and take the union
as truth:

```
src/dialects/*/samples.ts          # the registered set + order per dialect
src/dialects/*/samples/*.bas       # the programs themselves
```

Study **three or four** existing versions of each program before you write —
they show the same behaviour expressed several ways across colour models and
input schemes. Good reference trios: `zx81/`, `zxspectrum/`, `commodore64/`,
`bbcmicro/`.

The canonical set, last known (verify against the folders):

| `name`         | `title`        | Must demonstrate                                                                                   |
| -------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| `hello.bas`    | `Hello world`  | A greeting; show off text colour / display. **The starter for a fresh document** — keep it lively. |
| `circles.bas`  | `Circles`      | Concentric circles via the Neal–Pitteway integrator (see gotcha).                                  |
| `breakout.bas` | `Breakout`     | Paddle bounces a ball off a wall of bricks; score; lose when it drops. Real-time input.            |
| `maze.bas`     | `Maze`         | Fixed wall map; move a marker to the exit. **Must be solvable.**                                   |
| `kaleido.bas`  | `Kaleidoscope` | Mirrored plotting driven by a machine-code routine (block or `#BIN` REM).                          |

**Order is fixed and `hello` is always first** (the fresh-document starter). The
colocated test asserts both.

### Graceful degradation (only when a sample truly can't be ported)

Keep every sample you can, in the same relative order; drop or swap only with a
real hardware reason, and document it in the `samples.ts` doc comment. Precedents:

- `zx80/` and `atom/` omit `breakout` — no non-blocking key read for a real-time paddle.
- `atom/` adds `files.bas` (Data files) in breakout's slot to exercise its filesystem.
- `trs80/` and `zxspectrum128/` ship no `kaleido.asm` (no machine-code block).

## Per-sample accuracy

### circles — the Pitteway integrator (the classic bug)

Draw each ring with the **Neal–Pitteway midpoint recurrence**, which uses `E/2`
on the two X half-steps:

```
X = X - E/2*Y : Y = Y + E*X : X = X - E/2*Y
```

Two failure modes to avoid, both of which _tokenize fine but look wrong_:

1. **Full `E` instead of `E/2`** turns the recurrence into a √2:1 **ellipse**
   integrator — the "circles" render as flattened ovals.
2. **Too few iterations.** One step rotates by ≈ `E` radians, so a closed ring
   needs **≥ 2π/E** iterations. Loop fewer and each ring is an open arc with a
   visible gap. Pick the loop count from `E` (e.g. `E=1/40` → ~260 steps).

Centre the rings and size the radii in the machine's **graphics coordinate
space** so they read as round on screen. Carry the recurrence in a `REM` like the
siblings do, and — crucially — **name loop/temporary variables so none collides
with a keyword** (see the keyword gotcha; the historical CPC "circles hang" was a
`RAD=` variable tokenizing to the `RAD` keyword).

### maze — must stay solvable

Store the wall map as `DATA` rows of **equal length**, walls as one glyph
(`#` or a solid block) and corridors as **blank cells** (spaces — not dots;
dotted corridors read as clutter). Put the marker's start cell on a walkable
square and place the exit `E`. The colocated test BFS-walks from start to exit
and **fails if it's unreachable**, so verify solvability before committing.
Size the grid to the machine's text screen (bigger reads better than a sparse
14×11) and read cursor keys / joystick so the on-screen pad drives it.

### breakout — real-time game parity

Offer what the machine has: a keyboard/joystick control menu, a
"press key/fire to start" gate, on-screen control hints, and `SOUND`/`BEEP`
feedback on bounce/brick/win/lose. Read input the machine's way (`INKEY(n)` /
`GET` / `INKEY$` and the joystick port), erase-then-redraw the ball and paddle
each frame, keep a tight paced loop, track score, and end on ball-drop. The
colocated test asserts the game reads keys so the pad works — keep that call
present.

### hello — the starter, keep it lively

This is what greets a fresh document, so make it show the display off (animated
colour cascade, flashing text — whatever the colour model affords) rather than a
static splash, within the machine's real limits (e.g. a 4-colour text mode can't
show a 16-colour cascade — switch modes or accept fewer colours authentically).

### kaleido — machine-code routine + BASIC front-end

The routine is **readable assembly in the repo, assembled on load** — no binary
fixtures. Two wiring mechanisms; use whichever the dialect supports:

**A. Memory block (most dialects).** Keep the source at `samples/kaleido.asm`
(its `ORG` = the block's load address). In `samples.ts` export a block const and
attach it to the kaleido entry:

```ts
import kaleidoAsm from './samples/kaleido.asm?raw';

/** The kaleidoscope routine's block layout (see samples/kaleido.asm). */
export const <ID>_KALEIDO_BLOCK = {
  name: 'kaleido',
  address: 0x8000,        // must equal the asm ORG, and sit in memoryBlocks.validRanges
  kind: 'code',
  asmSource: kaleidoAsm,
  entry: 0x8003,          // where BASIC CALL/SYS/USRs
} as const;

// …
{ name: 'kaleido.bas', title: 'Kaleidoscope', text: kaleido, blocks: [<ID>_KALEIDO_BLOCK] },
```

The `.bas` `INPUT`s the parameters, `POKE`s them to the block's low bytes, and
`CALL`/`SYS`/`RANDOMIZE USR`s the entry. `src/app/sampleBlocks.ts` assembles the
block through the dialect's `memoryBlocks.cpu` engine (`src/asm/registry.ts`,
`asmEngineFor`) when the sample loads. The block's `[address, address+len)` must
fit inside `memoryBlocks.validRanges`.

**B. Hidden `#BIN` REM (Sinclair machines).** Where the dialect
`supportsBinaryLines`, embed the routine as the `#BIN` machine-code REM instead
of a `blocks` entry (see `src/dialects/binaryDirective.ts` and `zx81/`); keep the
readable `samples/kaleido.asm` alongside as the source of truth.

## Writing correct dialect BASIC

- **Author from the dialect's own reference**, not memory: read its
  `aiProfile.ts` (documents the machine's exact statements, colour/graphics model,
  input calls, and the keywords to avoid) plus `docs/reference/<id>.md`.
- **Tokenize clean.** Every sample must produce **no fatal errors** from the
  dialect's `tokenize`/`lint`. Write line numbers **flush-left** (the line number
  is column 0), strictly ascending, in steps of 10; one statement layout per the
  dialect's rules (some allow `:`-separated multi-statement lines, some don't).
- **Keyword-as-variable collision (silent mis-run).** A variable whose name
  matches a keyword tokenizes to the keyword byte and the ROM mis-runs the line —
  it does _not_ error. Never name a variable after a keyword (`RAD`, `DEG`, `PI`,
  `TIME`, `SC` on some machines…). The colocated test guards `NAME=` assignments;
  also watch loop/array/`DIM` names it can't see.
- **Charset & graphics glyphs.** Use the dialect's `charset` — block/graphics
  characters as the real Unicode glyphs where one exists, `{0xNN}` escapes
  otherwise; reach for `CHR$(n)` only when computing codes.
- **Respect the machine.** Screen dimensions, colour model (fixed palette vs
  attributes vs pen/ink), and input model (`INKEY`/`GET`/`INKEY$`, joystick port)
  all differ per dialect — mirror the reference versions rather than importing a
  foreign idiom.

## Run every sample on the machine — not optional

**A sample is not finished until you have watched it run.** Tokenizing clean,
linting clean and round-tripping say nothing about whether the program does what
it is for: a statement the ROM rejects, a delay whose unit is not what the
reference claims, a coordinate window that draws ovals, a game wired to the
wrong keys and a redraw too slow to see all pass every static check.

Read **[running-samples.md](running-samples.md)** and follow it: boot the dialect
headless on its real ROM through `src/dialects/bootHarness.ts`, load the sample,
script its keys from the dialect's own `keyboardLayout.ts` `controller.bindings`,
read the screen back (`readScreenText()`, or the frame buffer written out as a
PNG that you actually look at), check the machine's error channel, and time how
long the picture takes. Fix what is wrong and run it again.

Only then write the colocated test below, and put in it the check that would
have caught what you just fixed.

## Ship the colocated `samples.test.ts`

Every dialect has one (`src/dialects/<id>/samples.test.ts`); copy the nearest
reference (`commodore64/`, `bbcmicro/`, `cpc464/`, `zx81/`) and adapt. The checks
that encode the conventions — keep all that apply:

1. **Canonical set & order**, `hello` first (starter).
2. **Every sample tokenizes without fatal errors** (and yields a real image).
3. **Game samples read input keys** (`INKEY(`/`GET`) so the on-screen pad drives them.
4. **Maze `DATA` is BFS-solvable** start→exit; rows equal length; start cell walkable.
5. **Kaleido block assembles clean** and lands inside `memoryBlocks.validRanges`;
   pin `entry` (e.g. `address + 3`). Add an optional **ROM-gated firmware render
   test** that runs the routine and asserts the 4-way mirror / a non-blank
   pattern — gate it on the ROM existing (`it`/`it.skip`) so it skips in ROM-less CI.
6. **No sample uses a reserved keyword as a variable name** (the collision guard).
7. **Every sample runs on the real ROM** — load it, run frames, and assert the
   machine's error channel is clean and it is still executing. Then pin what the
   run pass found: the rings' aspect, the paddle following `controller.bindings`,
   the bytes one maze move repaints. `src/dialects/pmd85/samples.test.ts` is the
   worked example. Gate on the ROM existing so a ROM-less checkout skips.

## Verify

- `npm run typecheck && npm test && npm run lint && npm run format:check` — all green.
- Run a single sample suite while iterating:
  `npx vitest run src/dialects/<id>/samples.test.ts`.
- The on-machine run above is the real check; `npm run dev` is the last look.
  Select the dialect and **run each sample** (the app auto-runs) to confirm in
  the browser what the headless run already showed.

## Guardrails

- **Names, titles and order are stable** — the test asserts them; don't rename or
  reorder to "fix" a sample.
- **Never point a dialect at another machine's `.bas`**; port the behaviour into
  its own BASIC.
- **No binary fixtures** — machine code ships as readable `.asm` (assembled on
  load) or a `#BIN` REM, never a checked-in blob.
- **Don't fabricate ROMs**; the firmware render test skips without one.
- **Never ship a sample you have not seen run.** "It tokenizes" is not evidence.
- **Delete the scratch run script**; the colocated `samples.test.ts` is what ships.
