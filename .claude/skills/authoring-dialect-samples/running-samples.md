# Running a sample on the machine

A sample that tokenizes, lints and round-trips can still be broken. Every trap
below was found this way and none of them raises a tokenizer error:

- a statement spelled like Microsoft's that the ROM does not accept
  (`INPUT "SEED";S` is a hard `Syntax err` on the PMD 85 — its `INPUT` takes no
  prompt);
- a delay whose unit is not what the reference claims (PMD 85 `PAUSE` counts in
  units of ~91 ms, so `PAUSE 255` is twenty-three seconds, not a quarter of one);
- a coordinate window that draws ovals because the drawing area is not square;
- a game whose keys are the wrong way round against the on-screen controller;
- a redraw so slow that nothing has appeared by the time anyone looks.

So: run each sample, look at the screen, fix, run again.

## 1. Boot it

Use `src/dialects/bootHarness.ts` — do not build new plumbing.

```ts
import { dialects } from '../registry';
import { bootMachine, installNodeRomLoading, hasRom } from '../bootHarness';
import { materializeSampleBlocks } from '../../app/sampleBlocks';

const undo = installNodeRomLoading(); // machines that fetch their own ROMs
const dialect = dialects.find((d) => d.id === '<id>')!;
const machine = await bootMachine(dialect);
machine.loadProgram(dialect.tokenize(sample.text).image, {
  blocks: materializeSampleBlocks(dialect, sample), // kaleido only
});
```

Run frames in a loop, yielding the macrotask every 20 or so — several machines
settle their ROM load on a timer and a tight synchronous loop never lets them
land. `runUntil`/`runFrames` in the harness already do this.

## 2. Script the input

`machine.setKey(token, down)`. **Take the tokens from the dialect's own
`keyboardLayout.ts` `controller.bindings`, never from the sample.** The
on-screen pad sends those, so they are the contract: a game reading any other
arrangement answers the pad's arrows with the wrong move, and it looks correct
in every screenshot.

A tap needs to survive a matrix scan — hold for ~12 frames, release, then give
the program ~40 frames to act:

```ts
machine.setKey(right, true);
runFrames(machine, 12);
machine.setKey(right, false);
runFrames(machine, 40);
```

## 3. Look at the screen

| What the machine offers                                                       | How to read it                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `readScreenText()` (every machine)                                            | `machine.readScreenText()?.lines` — print them numbered. The fastest check, and the only one for the Commodore/Acorn/CPC machines under node.                                     |
| `renderTo` via `putImageData` (the self-contained machines: Sinclair, PMD 85) | Pass a stub `CanvasRenderingContext2D` whose `createImageData` returns a plain object and whose `putImageData` keeps `img.data`. Write that RGBA to a PNG and **read the image**. |
| Its own video RAM                                                             | Where the layout is documented (PMD 85: `'C000`, 64-byte stride, six pixels a byte, top two bits attributes) this is the most precise, and it is what an assertion should use.    |
| The machine's error channel                                                   | `readReport()`, `isProgramRunning()`, `currentLine()`. A program stopped on a parameter error still leaves a plausible screen behind — check it every time.                       |

`renderTo` on the Commodore, Acorn and CPC machines draws through an offscreen
canvas and throws `document is not defined` under node; use `readScreenText()`
or video RAM for those, or drive them through the browser in `e2e/`.

A PNG writer needs no dependency — node's `zlib` is enough:

```ts
import { deflateSync } from 'node:zlib';
const crc32 = (b: Buffer) => {
  let c = ~0;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
};
const chunk = (t: string, d: Buffer) => {
  const l = Buffer.alloc(4);
  l.writeUInt32BE(d.length);
  const b = Buffer.concat([Buffer.from(t, 'latin1'), d]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc32(b));
  return Buffer.concat([l, b, c]);
};
function writePng(path: string, rgba: Uint8ClampedArray, w: number, h: number) {
  const raw = Buffer.alloc((w * 4 + 1) * h); // one filter byte per row
  for (let y = 0; y < h; y++)
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
```

Put the script in a scratch `*.test.ts` beside the dialect so vitest resolves the
`?raw` imports for you, write the PNGs to the scratchpad, and **delete the
script before committing** — what ships is the colocated `samples.test.ts`.

## 4. Accept only on this checklist

| Sample     | Accept only when                                                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hello`    | It animates and fills the display; printed text does not punch holes in drawn art (a printed cell clears its own pixels on most machines); a full pass takes seconds, not minutes.                                                     |
| `circles`  | Rings are **closed** (≥ 2π/E steps) **and round** — measure the ink bounding box and check width/height ≈ 1, in the pixels the canvas actually presents. Time the full picture: a ring per fifteen seconds is a sample nobody watches. |
| `breakout` | The paddle moves the way the pad's `left`/`right` point; the ball bounces off walls and paddle; bricks clear and the score rises; something sounds on each event.                                                                      |
| `maze`     | One press moves the marker one cell and repaints **only that cell** — count the changed bytes; walls block; the exit wins. A machine with no cursor addressing reprints the whole map instead: check the reprint is one map, not two.  |
| `kaleido`  | The block assembles, the routine runs from `USR`/`CALL`/`SYS`, and the mirror is symmetric over the whole grid.                                                                                                                        |

And on every sample, whatever else it does: **read the words off the screen**.
The greeting, the `* BASICALLY *` banner, `REACH E`, `YOU ESCAPED!`, `SCORE`,
`GAME OVER`, `SEED (0-255)` / `TWIST (0-255)` / `PASSES (1-9)` — the house text
in the skill's shared-vocabulary table. A string that is in the listing but
never reaches the display (printed off the bottom, overwritten by the next
frame, cut off by the column count) passes every static check and fails the
user, and that is why these are read back rather than grepped.

Then open the same sample on two other machines and read the three side by
side. Anything a user would notice as _different rather than adapted_ is drift,
and the fix belongs here, before the test is written.

Time everything. Frames ÷ the machine's `frameHz` is the wall-clock a user waits.

## 5. Fix, re-run, then promote

Iterate until the checklist passes. Then move every fact that could silently
regress into the colocated `samples.test.ts` — assertions on pixels and video
RAM, not screenshots. `src/dialects/pmd85/samples.test.ts` is the worked
example: it runs all five on the real ROM, measures the rings' aspect, drives
breakout from `keyboardLayout`'s own `controller.bindings`, and counts the bytes
one maze move repaints.

The test that would have caught the bug you just fixed is the one worth adding.
