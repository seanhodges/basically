## Why

The machine's screen is the whole point of the app, and there is no way to get
that picture out of it. A user who wants to show what a program draws — in a
forum post, a README, a bug report, a gallery of what an eight-bit machine can
still do — is left to their operating system's screenshot tool, which captures
the browser's *rendering*: the picture at whatever fractional zoom the pane
happened to fit into the window, resampled by the compositor, inside a bezel,
under a CRT overlay. That is a blurry, non-integer-scaled image of a machine
whose entire aesthetic is square pixels.

The pixels themselves are already read back, at their own resolution, every time
the AI assistant is shown what a program drew. Nothing about the machine's own
picture is missing; only a way for the user to ask for it.

## What Changes

- A **Save a screenshot** action, wherever the IDE shows a running machine: an
  icon button in the toolbar, the same action in the standalone player's top
  bar, and a desktop keyboard shortcut.
- Invoking it downloads the machine's screen as a **PNG at the machine's own
  pixels**, **enlarged by a whole-number factor** so square pixels stay square
  and the file is legible at ordinary viewing sizes rather than being a 256x192
  thumbnail.
- The image is the machine's **raw output**: no bezel, no IDE chrome, and no CRT
  overlay whatever the CRT setting is. What the machine drew is what the file
  holds.
- A machine that has **stopped** still yields the last frame it drew. Asking
  before a machine has drawn anything says so, rather than saving a blank
  picture.
- The file is named after the program, with a timestamp, so a second screenshot
  of the same program is a second file rather than `program (1).png`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `program-execution`: one requirement added — *The machine's screen can be
  saved as an image*. It sits beside the existing *Runtime state is visible to
  the IDE* requirement, which already guarantees the running screen can be read
  back as text; this is the same screen as a picture, for the user rather than
  for the IDE.

`sharing-player` is deliberately **not** modified. The new requirement is worded
against "wherever the IDE shows a running machine's screen", which covers the
player as well as the IDE, so the player surface needs no separate guarantee —
the same way the player's existing hardware-export action is covered by
`hardware-transfer` rather than by a player-specific requirement.

`hardware-transfer` is **not** affected: a screenshot is not an export to
hardware. It carries no program, loads nowhere, and belongs to no build target.

## Non-goals

- **Copy to clipboard.** A second delivery mechanism with its own browser gating
  and its own fallback, for a file the user can already save. Worth doing later
  on its own merits; it is not what is missing today.
- **A scale picker at capture time.** The whole-number rule already produces a
  sensible size for every machine without asking. An extra dialog in front of a
  one-click action would cost more than it settles.
- **Capturing the IDE's rendering — bezel, CRT geometry, virtual keyboard.** The
  operating system's screenshot tool already does that, and does it better.
  What only this app can produce is the machine's own pixels.
- **Baking the CRT effect into the saved image.** Considered and rejected. The
  effect is a fixed pixel size over a screen fitted at a fractional scale, so it
  has no honest size in machine pixels: any density baked into the file is right
  only at one window size and subtly wrong at every other. An image that is
  sometimes not what the user saw is worse than one that is always the machine's
  own output.
- **Recording.** No video, no GIF, no animated capture. A still frame is the
  scope; motion is a different feature with different constraints.
- **Machine-specific image formats.** No SCR, no native screen dumps. PNG,
  because the point is a picture anyone can look at.
- **Choosing where the file goes.** It downloads, like every other file the app
  produces. No save-picker, no destination setting.

## Impact

- A new app-level module owning the screenshot: the whole-number enlargement
  rule, the filename, the compose step, and the download. It reads the existing
  screen capture the emulator pane already registers (`src/app/screenCapture.ts`)
  rather than reaching for the canvas itself, and hands off to the existing
  `downloadBlob` helper in `src/storage/files.ts`. Both halves already exist;
  neither has a second implementation added.
- `src/components/Toolbar.tsx` and its mobile overflow menu, and
  `src/player/PlayerApp.tsx`'s top bar, gain the action. A new icon joins
  `src/components/icons.tsx`.
- `src/app/shortcuts.ts` and `src/app/useGlobalShortcuts.ts` gain one entry, and
  `docs/guide/keyboard-shortcuts.md` its row.
- **No change to the `Dialect` / `MachineEmulator` seam.** Every machine already
  answers "what do you look like" by rendering to the pane's canvas; this reads
  that canvas and needs no new per-machine knowledge, no per-dialect
  configuration, and no work when a machine is added.
- No new dependencies. The enlargement and the PNG encode are
  `CanvasRenderingContext2D` and `HTMLCanvasElement.toBlob`.
