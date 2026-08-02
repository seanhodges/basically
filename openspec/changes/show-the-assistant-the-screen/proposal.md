## Why

The assistant can now be told whether its program ran, and — once
`read-the-screen-as-text` lands — what that program printed. Neither channel
says anything about a program whose entire output is pixels. A plotted circle,
a kaleidoscope, a maze drawn in semigraphics: for all of them the run outcome is
"ran without failing" and the screen text is blank. The two channels agree that
nothing happened, and both are wrong.

Colour is lost the same way. A Commodore or Spectrum program that draws the right
shape in the wrong ink is indistinguishable, through text, from a correct one.

The IDE is already drawing the answer sixty times a second. `renderTo` — the
machine seam member every dialect already implements, because the emulator pane
calls it every frame — will paint the running machine into any 2D context. A
second, offscreen context is the whole capture.

The cost objection turns out not to hold. An image costs
`⌈width / 28⌉ × ⌈height / 28⌉` visual tokens, and these are small machines: a
256×192 Spectrum screen is **70 tokens**, against roughly 250 for the same
screen as text. Measured across eight captures on three machines, the native
image was read back correctly every time — the ZX Spectrum's Maze menu
character-for-character, the BBC's four concentric circles in the right colours
and the right order. A 3× upscale cost 8.4× the tokens and added nothing.

> Sequenced last: after `read-the-screen-as-text`, which supplies both the
> preferred channel and the signal that decides when to escalate past it, and
> after `assert-program-results`, which is what gives the assistant something to
> check the screen against.

## What Changes

- The outcome of an assistant-driven run MAY carry **the screen as an image**,
  alongside what it already reports. Every registered machine can produce one,
  because every machine already renders.
- **Text stays preferred.** The image is sent when the screen text is empty or
  consists only of block glyphs while the program demonstrably ran — that is,
  when the machine drew something the text channel cannot express — or when the
  machine cannot report its screen as text at all. A program that printed its
  answer is reported as text, as it is today.
- The image is the machine's **own screen at its own resolution**, never
  enlarged. Enlarging costs tokens quadratically and buys nothing.
- A request gains the ability to carry an image at all: today a conversation
  turn is text and only text, on every provider. This is the substantive part of
  the change, and it is uniform — the behaviour is identical across all three
  supported providers and introduces no tool-calling.
- Machines that cannot report a runtime state are unaffected in the same way
  they are today: no outcome is reported, so there is nothing to attach an image
  to.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: the existing "Errors flow back into the conversation"
  requirement widens once more — what flows back from an assistant-driven run may
  now include the screen as an image, under a stated rule for when the image is
  sent rather than the text.

`program-execution` is deliberately **not** modified. Its "Runtime state is
visible to the IDE" requirement already covers what the IDE can observe about a
running program, and rendering the machine is already required behaviour; this
change consumes both rather than extending either. Nothing new becomes visible
to the *user*.

## Impact

- The capture itself is a few lines against the existing seam: an offscreen
  canvas sized to the machine's own `displayWidth`/`displayHeight`, one
  `renderTo`, one PNG encode. **No dialect, emulator, or machine-boundary
  changes, and no new optional seam member** — unusually for a change that
  covers all thirteen machines.
- The provider layer is where the work is. A conversation turn's content is a
  string today, shared by all three backends; it becomes a sequence of parts so
  that an image can travel beside the text. Each backend then expresses that in
  its own vendor's shape.
- The run-outcome channel added by `verify-generated-code-at-runtime` carries the
  image; no second channel is introduced.
- Conversation caching is unaffected: the image rides in the newest turn, after
  the cached prefix, exactly as the run report does today.
- The two machines that render with wide borders (the Acorn and Amstrad
  machines) send more of the frame than they need to. Trimming toward their
  logical resolution is a cost optimisation, not a correctness one — the
  full-border Acorn image was read correctly as it stands.
- The settings copy that names what is sent to the provider needs a line: the
  program's screen now goes too.
- No new dependencies.

## Non-goals

- **Replacing the text channel.** Text is exact where it applies; this is the
  channel for output text cannot express, and it defers to text by default.
- **Enlarging, cropping to a region of interest, or annotating the image.** The
  machine's screen as the machine drew it.
- **Video, or a sequence of frames.** One frame per run outcome. Whether an
  animation needs two frames to read as an animation is a real question, and a
  later one.
- **Audio.** The seam can report it; nothing here listens.
- **Extending the machine boundary.** `renderTo` already exists and is already
  implemented by every machine. Nothing is added.
- **Tool-calling.** The IDE decides whether to send the image, from what the
  machine reported. Asking the assistant to request one would need tools, which
  would end the cross-provider parity the run-outcome work was built to keep.
- **Showing the capture to the user.** They are already looking at the screen.
