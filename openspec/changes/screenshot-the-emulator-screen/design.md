## Context

The emulator pane renders every machine into one `<canvas>` whose backing store
is always the machine's native display size — 256x192 on the Sinclair machines,
896x600 on the BBC, 402x282 on the C64, and so on — while the on-screen size is
a separate, fractional CSS scale fitted to the window. Nothing about that canvas
is per-machine: the pane calls `renderTo` and every machine paints itself.

`src/app/screenCapture.ts` already reads that canvas as a native-resolution PNG,
for the AI assistant. It owns a small registry with exactly the lifecycle a
screenshot needs — a live capture registered by the pane on its first painted
frame, a snapshot kept after Stop or unmount so a stopped machine still shows
what it drew, and a hard forget on a dialect or ROM change so one machine's
screen can never answer for another's. It is module-level and callable from
anywhere, which is how `AiPanel` reaches it.

What is missing is only the user-facing half: enlargement, a filename, a
download, and something to click.

See `docs/contributing/architecture.md` for the dialect seam and the store's
conventions; this change alters neither.

## Goals / Non-Goals

**Goals:**

- One screenshot path, shared by the IDE and the player, with no per-machine
  knowledge in it.
- An image that is honestly the machine's picture: square pixels, whole-number
  enlargement, no resampling anywhere in the chain.
- Reuse the capture and download plumbing that already exists rather than
  growing a second copy of either.
- The parts that can be tested without a browser are pure functions and are
  tested there.

**Non-Goals:**

- Any new `Dialect` or `MachineEmulator` member. See the seam note below.
- Compositing anything the IDE draws around or over the screen — bezel, fitted
  scale, CRT overlay, virtual keyboard.
- The proposal's other non-goals — clipboard, scale picker, recording, native
  screen formats, save-picker — stay closed here.

## Decisions

### Read the existing capture, don't register the canvas

Two ways to get the pixels: reach the `<canvas>` element itself (a second
module-level registry alongside the capture one, or a handle threaded out of the
pane), or consume `captureScreen()`, which already hands back the canvas as a
native-resolution PNG.

**Decision: consume `captureScreen()`.** Its lifecycle is already precisely the
one a screenshot wants, down to the awkward parts — the post-Stop snapshot that
the spec requires, and the forget-on-machine-change that stops a screenshot
being saved of a machine that is no longer there. A second registry would have
to reimplement all of it and then be kept in step with it, and would park a live
DOM node in module state.

The cost is that the pixels arrive base64-encoded and must be decoded before
they can be enlarged: encode, decode, re-encode. At these resolutions that is
sub-millisecond, and it buys one seam instead of two. This is the same trade the
capture module already documents for itself.

Consequence: **no store request counter.** The existing counters exist for
commands that must reach the pane; this one reaches a module, so the toolbar and
the player can both call it directly.

### Enlarge by a whole number, chosen from the machine's own width

An enlargement factor of `max(1, round(target / width))` against a target width
of roughly 1024 puts every machine in the tree between about 900 and 1300 pixels
wide: the 256-wide Sinclairs at 4x, the 640-wide CPC at 2x, the 896-wide BBC
left at 1x because it is already there.

Alternatives rejected: a fixed factor (4x is right for a Spectrum and absurd for
a BBC); "enlarge until at least N wide" (forces the BBC to 2x and 1792px for no
gain); asking the user (a dialog in front of a one-click action).

The rule is a pure function of one number, so the whole per-machine matrix is
pinned in a unit test driven off the registry rather than hardcoded anywhere in
source. Adding a machine cannot silently produce a bad size.

Enlargement is `drawImage` with `imageSmoothingEnabled = false` — the canvas
equivalent of the `image-rendering: pixelated` the screen already uses.

### The saved image is untreated

The CRT effect is a CSS pseudo-element over the canvas: it is not in the canvas
and cannot be read back, so carrying it into a file means redrawing it.

**Decision: don't. The file is the machine's raw output, at every setting.**

The effect's scanline period is a fixed number of CSS pixels over a canvas
fitted to the window at a fractional scale, so it has no honest size in machine
pixels. Redrawing it into an image enlarged by a whole number means picking a
density, and any choice is right only where the enlargement happens to match the
window's fit scale — subtly wrong for a user with a small window, and wrong the
other way for a user with a large one. A screenshot the user cannot trust to be
what they saw is worse than one that is consistently the machine's own picture,
which is the thing only this app can produce. Anyone who wants the effect in a
picture already has an operating-system screenshot tool that captures it
exactly.

Two alternatives rejected with it: redrawing the two gradients in canvas at the
output resolution (the density problem above is the whole objection — the
geometry is reproducible, the size is not), and rendering the pane through an
SVG `foreignObject` to let the browser draw its own CSS (cannot reach stylesheet
rules for a pseudo-element without inlining them, taints the canvas in some
browsers, and drags the bezel in).

Consequence: the screenshot path reads no app state at capture time. It takes a
program name and produces a file.

### Return a result; do not throw

The toolbar wraps its actions in a synchronous `guard()` that catches into the
error banner. An async screenshot's rejection would sail straight past it. So
the entry point resolves to a result — saved, or not-saved with a reason — and
each surface decides: the toolbar reports it, the player (whose button only
exists while a program is running) does not need to.

"Nothing has been drawn yet" is a *reason*, not an error: the capture registry
simply has nothing, because the pane registers only on the first painted frame.
That is also why there is no blank-canvas race to guard against.

### Filenames follow the export convention, plus a timestamp

The existing exports name files from the program: `PROGRAM` for an untitled
document, otherwise the uppercased, truncated stem, lowercased for the file. A
screenshot follows that and appends a timestamp, because unlike a `.p` or a
`.wav` — where a second export is the same artefact again — a second screenshot
is a different picture, and `program (1).png` is the browser losing that
distinction for us.

### Seam impact

**None.** No `Dialect` or `MachineEmulator` member is added, changed or read in
a new way. The feature sits entirely on the far side of the seam, on the canvas
the pane already renders into, and a new machine needs nothing done to it.

## Risks / Trade-offs

- **A user with the CRT effect on gets a file that does not look like their
  screen.** → Accepted deliberately, and the reason is above: the alternative is
  a file that looks like their screen at one window size and not at any other.
  The saved image is the machine's picture, which is the thing worth having.
- **Encode → decode → re-encode is wasteful.** → Sub-millisecond at these sizes,
  and it is what buys the single capture seam. Measured against one registry
  versus two, the cheaper thing was two registries and the wrong one won on
  correctness.
- **The compose step cannot be unit tested** — jsdom has no canvas. → The scale
  rule and the filename are pure functions with no DOM, tested there; the
  compose step gets exactly one browser proof, extending a spec that already
  boots a machine.
- **Whatever is on the canvas is in the picture, including diagnostics.** The PET
  renderer, for one, paints a load-error strip into its own framebuffer. → Left
  as-is and recorded here so it is not later filed as a bug: it is what the user
  sees, which is what a screenshot is for.
- **A very wide machine added later could enlarge to 1x and stay small.** → The
  registry-driven test asserts the resulting width for every registered machine,
  so the case surfaces when the machine lands rather than when a user complains.
