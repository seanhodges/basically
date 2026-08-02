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

> Sequenced last: after `read-the-screen-as-text`, which supplies the text view,
> and after `assert-program-results`, which supplies both the optional reply
> block the assistant's choice rides in and the statement of what each machine
> can be asked about.

## What Changes

- The outcome of an assistant-driven run MAY carry **the screen as an image**,
  alongside what it already reports. Every registered machine can produce one,
  because every machine already renders.
- **The assistant chooses how to verify its own program.** Both views of the
  screen — as text, and as an image — are described to it, and it names the one
  it wants, or both, alongside the code it returns. The outcome then carries
  exactly what it named. Naming nothing means the screen text alone, which is
  the behaviour without this change.
- The choice belongs to the assistant because only the assistant knows what it
  just wrote. No rule the IDE could apply distinguishes a program that prints a
  table from one that draws a table border in block graphics, and guessing wrong
  is worse than asking.
- The assistant SHALL be able to make that choice well, which means being told
  what the machine in front of it can actually answer — a machine that cannot
  report its screen as text is one where asking for text is a mistake.
- The image is the machine's **own screen at its own resolution**, never
  enlarged. Enlarging costs tokens quadratically and buys nothing.
- A request gains the ability to carry an image at all: today a conversation
  turn is text and only text, on every provider. This is the substantive part of
  the change, and it is uniform — the behaviour is identical across all three
  supported providers.
- Machines that cannot report a runtime state are unaffected in the same way
  they are today: no outcome is reported, so there is nothing to attach an image
  to.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: the existing "Errors flow back into the conversation"
  requirement widens once more — what flows back from an assistant-driven run may
  now include the screen as an image, and which view comes back becomes the
  assistant's own choice rather than a fixed consequence of the outcome.

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
- The assistant's choice rides the reply-format contract that already exists —
  the fenced-block rules live in a byte-stable constant in the cached system
  prompt, and an extractor reads the blocks back. `assert-program-results` is
  already extending exactly that contract with an optional non-code block; this
  adds one more thing declared in it, plus a description of the two views in the
  prompt. The system prompt stays byte-stable per machine, so caching holds.
- Both views are captured whichever is asked for. The screen only exists while
  the machine is still running and unedited, so waiting to find out what was
  requested is not an option — the capture happens when the outcome is decided,
  and the assistant's choice governs what is *sent*, not what is taken.
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

- **Replacing the text channel.** Text is exact where it applies, and stays what
  an assistant that asks for nothing gets.
- **Tool-calling.** The assistant chooses, but it says so in the reply it was
  already going to send — it does not call out for the screen mid-turn. Real
  tools would mean an agentic loop and three per-provider tool protocols, ending
  the cross-provider parity the run-outcome work was built to keep, and the
  screen cannot be captured on demand anyway.
- **Looking again within a turn.** Having named a view, the assistant sees that
  view. If it wants a different one it says so on its next turn, which the
  existing automatic corrections already re-run.
- **Enlarging, cropping to a region of interest, or annotating the image.** The
  machine's screen as the machine drew it.
- **Video, or a sequence of frames.** One frame per run outcome. Whether an
  animation needs two frames to read as an animation is a real question, and a
  later one.
- **Audio.** The seam can report it; nothing here listens.
- **Extending the machine boundary.** `renderTo` already exists and is already
  implemented by every machine. Nothing is added.
- **Letting the user override the choice.** No setting, no toggle. If the
  assistant asks badly the answer is better wording in the prompt.
- **Showing the capture to the user.** They are already looking at the screen.
