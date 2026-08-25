---
name: authoring-dialect-samples
description: >-
  Write or port the bundled sample BASIC programs for a Basically dialect
  (hello, circles, breakout, maze, kaleido) accurately and to project
  convention. Use when adding a dialect's samples, porting the canonical set to
  a new machine, fixing an inaccurate or broken sample, or wiring a sample's
  machine-code block. Covers the house vocabulary every port must carry (the
  fixed greeting, banner, maze goal, scoreboard and kaleidoscope prompts) and
  when a machine may deviate, the per-sample intent, the accuracy gotchas
  (Pitteway circles, keyword-as-variable collisions, solvable mazes), the
  samples.ts / block registration shape, running each sample on the dialect's
  own emulator to see what it really does, and the colocated samples.test.ts
  plus cross-dialect sampleConventions.test.ts checks each dialect must pass. A
  sub-skill of adding-a-target-system (its Stage 3), usable on its own.
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

> **Same product, different BASIC.** A user switching machines must meet the
> same programs, not a family resemblance. What is allowed to differ is how the
> machine draws, sounds and reads keys. What the program _says_ is not: the
> greeting, the goal, the prompts and the sign-offs are fixed house text, and a
> port that reworks them has drifted even if every line runs.

## The shared vocabulary — the strict part

These are **requirements, not suggestions**, and
`src/dialects/sampleConventions.test.ts` fails the build on each of them across
every registered dialect. Read them before you write a line: the Apple 1's
first port passed every other rule in this skill — it tokenized, ran, drew and
tested clean — and still shipped `HELLO, WORLD!` / `GOODBYE.` where the set says
`HELLO FROM THE <machine>` / `* BASICALLY *`, a `*` marker where the set says
`O`, and one combined kaleidoscope prompt where the set asks three.

| Sample     | Fixed text and glyphs                                                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hello`    | Opens `10 REM HELLO FROM THE <machine>`. Prints `HELLO FROM THE <machine>` in a cascade. **Signs off on a `* BASICALLY *` banner**, centred.                                                                                |
| `circles`  | Three concentric rings, drawn once, from the Pitteway recurrence.                                                                                                                                                           |
| `breakout` | A visible **`SCORE`** label that rises, and **`GAME OVER`** when the ball is lost. Control menu, press-to-start gate and on-screen control hint where the machine can offer them.                                           |
| `maze`     | Walls one repeated glyph (`#`, or a solid block where the charset has one), corridors **blank**, exit **`E`**, marker **`O`**. An on-screen hint naming the goal: **`REACH E`** + the controls. Wins on **`YOU ESCAPED!`**. |
| `kaleido`  | Named `KALEIDOSCOPE` in its opening REM. **Three separate prompts, in order: `SEED (0-255)`, `TWIST (0-255)`, `PASSES (1-9)`.** Then POKE, call the entry, wait, and **`GOTO` back for another** — it never just ends.      |

Two narrow allowances, and no others:

- **A narrower screen may shorten a string, never restyle it.** The VIC-20's 22
  columns give `HELLO VIC-20` and the CPC's MODE 0 twenty give `HELLO CPC!`;
  both still greet. Count the columns before you shorten, and shorten the
  greeting rather than dropping the banner.
- **A number may follow the hardware.** The Apple 1 asks `PASSES (1-4)` because
  a pass is eight seconds at one character per video field. The _shape_ of the
  prompt does not move with it.

Everything else that differs must be forced by the machine, and the force must
be **named in the `samples.ts` doc comment** — which control keys, because the
machine's own cluster is `5 6 7 8` or `Z X K M`; a whole map reprinted, because
there is no cursor addressing; a sample missing entirely, because there is no
non-blocking key read. "It read better this way" is not a hardware reason, and
a deviation nobody wrote down is a bug the next port will copy.

### Controls: follow the machine, then the set

The one place the set defers to the machine outright. Use the cluster the
machine's own users used and its `keyboardLayout.ts` `controller.bindings`
sends — Sinclair `5 6 7 8`, Atom `Z X K M`, PMD 85's `K0`–`K3`, BBC `Z X K M`,
CPC cursor keys. **Where the machine has no such convention, the set's answer is
`W A S D`** (Commodore, TRS-80, Altair, Apple 1). Whichever you pick, name it in
the on-screen hint beside `REACH E`.

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

**Drop the whole sample; never ship a thinned one.** The choice is the full
program in the house vocabulary or nothing — a `maze` with no `REACH E`, a
`breakout` with no score, a `kaleido` that ends after one picture are all worse
than the honest omission, because they read as the set and behave as something
else. Keep every sample you can, in the same relative order; drop or swap only
with a real hardware reason, and **name that reason in the `samples.ts` doc
comment** — it is the only record of why this machine differs, and the
per-dialect doc comments are where a reviewer checks. Precedents:

- `zx80/` and `atom/` omit `breakout` — no non-blocking key read for a real-time paddle.
- `atom/` adds `files.bas` (Data files) in breakout's slot to exercise its filesystem.
- `trs80/` and `zxspectrum128/` ship no `kaleido.asm` (no machine-code block).

## Registering the set (`samples.ts`)

Only the program text is per-dialect: every machine ships the canonical five
under the same file names, the same menu titles and the same order, so
`standardSamples()` (`src/dialects/sampleKit.ts`) builds the list and the
dialect supplies just its imported sources:

```ts
import { standardSamples } from '../sampleKit';
import hello from './samples/hello.bas?raw';
// …

export const <id>Samples: SampleFile[] = standardSamples(
  { hello, circles, breakout, maze, kaleido },
  { kaleidoBlock: <ID>_KALEIDO_BLOCK },
);
```

- **A sample this machine can't offer** is a key left out (the ZX80 and the Atom
  pass no `breakout`, the TRS-80 no `kaleido`); the rest keep their order.
- **`kaleidoBlock`** attaches the machine-code block to `kaleido.bas` and
  nothing else. Omit it where the routine rides in a `#BIN` REM instead.
- **A sample of the dialect's own** goes in `insertBefore`, keyed by the
  canonical sample it sits ahead of - the Atom's `files.bas` before `kaleido`.
- A dialect whose set deviates further than that hand-writes the array; the
  helper is there to make the common case cheap, not to be mandatory.

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

The fixed text: marker **`O`**, exit **`E`**, an on-screen **`REACH E`** hint
carrying the controls, and **`YOU ESCAPED!`** on the way out. Pad the win line
with trailing spaces where it overwrites a longer one; do not reword it.

**Size is a budget, not a preference.** Take the shared 39-column map where the
machine has the screen and the RAM for it, and shrink only when it does not —
the Apple 1's map is 9×19 because 2048 bytes hold its program _and_ variables,
and that arithmetic belongs in the `samples.ts` doc comment. Redrawing only the
changed cell is the norm; a machine with no cursor addressing reprints the whole
map instead, and says so in a `REM`.

### breakout — real-time game parity

Offer what the machine has: a keyboard/joystick control menu, a
"press key/fire to start" gate, on-screen control hints, and `SOUND`/`BEEP`
feedback on bounce/brick/win/lose. Read input the machine's way (`INKEY(n)` /
`GET` / `INKEY$` and the joystick port), erase-then-redraw the ball and paddle
each frame, keep a tight paced loop, track score, and end on ball-drop. The
colocated test asserts the game reads keys so the pad works — keep that call
present. The fixed text is a visible **`SCORE`** label and **`GAME OVER`** on
ball-drop; a machine that cannot poll a paddle in real time ships no `breakout`
at all rather than a typed-input substitute.

### hello — the starter, keep it lively

This is what greets a fresh document, so make it show the display off (animated
colour cascade, flashing text — whatever the colour model affords) rather than a
static splash, within the machine's real limits (e.g. a 4-colour text mode can't
show a 16-colour cascade — switch modes or accept fewer colours authentically).

Lively is the licence; the words are not part of it. Open on
`10 REM HELLO FROM THE <machine>`, cascade `HELLO FROM THE <machine>` down the
screen with the machine's own positioning (`PRINT AT`, `TAB(n)`, `LOCATE`, or a
`TAB n` statement), and close on the centred **`* BASICALLY *`** banner. The
Sinclairs spell the banner in inverse video and the Atom and CPC drop the stars
their charset and width cannot carry — the word still lands, and that is the
line: restyle the banner, never omit it.

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
```

and pass it to `standardSamples()` as `kaleidoBlock` (see above).

The `.bas` front end is the same program on every machine, and the shape is
fixed: clear the screen, **three separate `INPUT`s in the order `SEED (0-255)`,
`TWIST (0-255)`, `PASSES (1-9)`**, three `POKE`s into the block's low bytes, the
call, a wait for a key, then `GOTO` back to the top. Combining the prompts,
dropping the ranges or ending after one picture are all drift. Where the ROM's
`INPUT` takes no prompt string (PMD 85, ZX80, ZX81) `PRINT` the same wording
first — the prompt the user reads does not change because the statement did. On
a machine that cannot poll a key, the next prompt _is_ the wait.

It `POKE`s the parameters to the block's low bytes and
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
8. **The house text this machine now carries** — the greeting and banner your
   `hello` actually printed, the marker and win line your `maze` drew, the
   prompts your `kaleido` asked. Assert them off the screen you read back, not
   off the source: a string in the listing the display never reached is the
   failure mode this catches.

Two cross-dialect suites run over your dialect the moment it is registered, and
neither is yours to relax:

- `src/dialects/sampleConventions.test.ts` — the shared vocabulary above,
  checked across every registered dialect. If it fails on your machine, fix the
  sample; if the machine genuinely cannot carry the rule, drop the sample and
  say why in `samples.ts`.
- `src/dialects/sampleKit.test.ts` — file names, titles and order.

## Verify

- `npm run typecheck && npm test && npm run lint && npm run format:check` — all green.
- Run a single sample suite while iterating:
  `npx vitest run src/dialects/<id>/samples.test.ts`.
- Check the house vocabulary across the whole set:
  `npx vitest run src/dialects/sampleConventions.test.ts src/dialects/sampleKit.test.ts`.
- The on-machine run above is the real check; `npm run dev` is the last look.
  Select the dialect and **run each sample** (the app auto-runs) to confirm in
  the browser what the headless run already showed.

## Guardrails

- **Names, titles and order are stable** — the test asserts them; don't rename or
  reorder to "fix" a sample.
- **The house text is stable too** — `HELLO FROM THE <machine>`,
  `* BASICALLY *`, `REACH E`, `YOU ESCAPED!`, `SCORE`, `GAME OVER`,
  `SEED (0-255)` / `TWIST (0-255)` / `PASSES (1-9)`. Improving the wording on
  one machine is how a set stops being a set; change it on all of them or on
  none.
- **A deviation needs a hardware reason, written down** in the `samples.ts` doc
  comment — columns, bytes, no key poll, no cursor addressing. Taste is not a
  reason.
- **Compare against a sibling before you call a port finished.** Open the same
  sample on two other machines and read the three side by side; anything a user
  would notice as _different rather than adapted_ is drift.
- **Never point a dialect at another machine's `.bas`**; port the behaviour into
  its own BASIC.
- **No binary fixtures** — machine code ships as readable `.asm` (assembled on
  load) or a `#BIN` REM, never a checked-in blob.
- **Don't fabricate ROMs**; the firmware render test skips without one.
- **Never ship a sample you have not seen run.** "It tokenizes" is not evidence.
- **Delete the scratch run script**; the colocated `samples.test.ts` is what ships.
