## Context

The assistant path today is text in, text out: `promptBuilder` composes the
system prompt and the user turn, `aiClient.streamChat` dispatches to one of three
provider backends, and the reply is mined for code and expectations. The only
thing the assistant ever learns about a run is what `EmulatorPane`'s AI run check
reads back through the machine seam — `readReport`, `isProgramRunning`,
`readVariables`, `readScreenText` — all of which are words. The pixels the user
is actually looking at never leave the canvas. See
`docs/contributing/architecture.md` for how these pieces fit together.

Two properties of the existing system shape everything below. First, the frame is
already there: `EmulatorPane` renders `machine.renderTo(ctx)` into a canvas sized
to the machine's native display, so a capture is a read of a canvas the app
already owns. Second, the request path is deliberately austere — the wire history
is append-only text and the system prompt is byte-stable per dialect, which is
what makes Anthropic prefix caching pay from the second turn. Adding an image
must not disturb either.

## Goals / Non-Goals

**Goals:**

- Let the user attach the machine's current display to a request, and let a
  failed AI-initiated run carry the display it failed on.
- Give the assistant a visual expectation form it settles by looking at its own
  program's output, feeding the existing bounded correction loop.
- Model "can this provider be shown an image" as a stated capability, so the
  degraded path is deliberate rather than a runtime surprise.
- Keep the added cost proportional: nothing is sent unless the user asks or a run
  needs judging, and prompt caching keeps working.

**Non-Goals:**

- No `Dialect`/`MachineEmulator` change (see below).
- No pixel analysis in the IDE — no OCR, no diffing, no heuristics over the
  bitmap. The only thing that interprets pixels is the model.
- No image bytes in `localStorage`.
- No animation, no frame history, no capture of anything but the emulator
  display (never the surrounding UI).

## Decisions

### The machine seam is untouched

**Decision:** the capture is taken from the `<canvas>` `EmulatorPane` already
renders into, via `toDataURL('image/png')`. No member is added to `Dialect` or
`MachineEmulator`, and no dialect gains machine-specific screenshot code.

**Why:** `renderTo(ctx)` is already the seam's answer to "what does this machine
look like", and every registered machine implements it. A `captureScreen()` seam
member would be thirteen reimplementations of one canvas read, and would have to
be kept in step with `renderTo` forever. Alternative considered: reading the
machine's framebuffer directly per dialect — rejected for exactly that reason,
and because the canvas is definitionally what the user is looking at, which is
the thing the user means when they say "look at this".

**Consequence:** capture is only possible where a canvas exists. Handled below.

### Capture is a module-level handle, with a last-known snapshot

**Decision:** a small `src/app/screenCapture.ts` module holds (a) a capture
function `EmulatorPane` registers while mounted, and (b) the most recent snapshot,
refreshed when the pane unmounts or the machine stops. The store carries only a
boolean for whether a capture is available, which the composer's attach control
subscribes to.

**Why:** on the split layout, opening the assistant closes the emulator pane, and
in the tabbed mobile layout only one of them is mounted at a time — so the
obvious "read the canvas when the user clicks attach" fails in precisely the
situation where the user is talking to the assistant. Snapshotting on unmount
costs one `toDataURL` per pane teardown and makes the last display the user saw
attachable. Alternatives considered: capturing every frame into the store
(a `toDataURL` per 20ms — rejected outright), and keeping the emulator mounted
but hidden (a layout change well outside this change's scope). This follows the
existing convention for non-render data — the same shape as `aiStore`'s
module-level stream handle with store state for what the UI must re-render on.

### PNG, at the machine's own resolution

**Decision:** capture as PNG, straight off the pane's canvas, unscaled.

**Why:** these displays are 256×192-ish with tiny palettes, so PNG is both
lossless and small — JPEG's chroma subsampling is actively harmful on
single-pixel plot lines and 8×8 character cells.

**Superseded, after this change shipped.** This section originally chose an
integer nearest-neighbour upscale to a ~512px long edge, reasoning that
provider-side resampling might smear the detail that matters. The earlier
`show-the-assistant-the-screen` proposal (archived alongside this one) had
already measured the question and answered it the other way: across captures on
three machines the native image read back correctly every time — a Spectrum menu
character-for-character, the BBC's concentric circles in the right colours and
order — while a 3× upscale cost 8.4× the visual tokens and added nothing. At
`⌈w/28⌉ × ⌈h/28⌉` tokens a 256×192 screen is about 70, cheaper than the same
screen as text. Measurement beats the worry, so the upscale (and the offscreen
canvas it needed) is gone. Do not reintroduce it without new measurements.

### One optional image on a user turn; capability on the provider

**Decision:** `ChatMessage` grows an optional image attachment (media type plus
base64 data), valid on `user` turns only, and `ProviderMeta` grows an
`acceptsImages` flag. Each backend maps the attachment onto its own shape:
Anthropic an `image` content block ahead of the text block, OpenAI an
`image_url` content part with a data URI, Gemini an `inlineData` part.

**Why:** `ProviderMeta` is the synchronous, SDK-free half of the provider seam —
which is what the composer needs to gate its attach control and what
`promptBuilder` needs to decide whether to teach the visual expectation form,
neither of which may load a vendor SDK. All three backends accept images today,
so the flag is `true` across the board; it exists so the degraded path is written
and testable now rather than discovered by a future text-only provider. Rejected:
sniffing capability from the model id (a lookup table that would rot), and
sending the image and catching the error (a wasted request and a user-visible
failure for something knowable up front).

### Images stay in the wire history

**Decision:** once sent, an attachment stays on that turn for the rest of the
conversation's wire history. It is not stripped from earlier turns on later
requests.

**Why:** prefix caching depends on the earlier turns being byte-identical to what
was cached. Rewriting a past image into a text marker would change the prefix and
cost a full cache write on every subsequent turn — more expensive than the cached
image, which reads at a fraction of an input token. It also keeps the
conversation honest: a follow-up question about "the screen you saw" refers to
something still in context.

### The saved conversation stores a marker, not pixels

**Decision:** `persist()` writes a boolean marker for a turn that carried a
screen; the bytes are dropped. A restored thread renders the marker as "screen
shown" with no thumbnail, and restored turns go back on the wire without images.

**Why:** the conversation backup lives in `localStorage` alongside everything
else the IDE persists, with a few megabytes for the lot; a handful of screen
PNGs would evict autosaves. A reload already invalidates the provider's cache
prefix, so nothing is lost there either.

### Visual expectations: `SCREEN SHOWS`, judged by the assistant

**Decision:** the expectation grammar gains a third form,
`SCREEN SHOWS <description>`, parsed to a `visual` expectation. The local
evaluator never passes or fails one — it returns `unchecked`, because no machine
can judge it. When the run check settles and visual expectations are present and
a capture and an image-capable provider both exist, the store issues one
automatic turn carrying the captured display, asking the assistant to judge each
stated description against it and — if any does not hold — return the corrected
program in the same reply. The verdict comes back in a small fenced block the
store parses; the code block in the same reply is offered exactly as any other
correction is.

**Why one turn rather than two:** a separate "judge" turn followed by a "fix"
turn doubles the request count and the latency for the failing case, and the
model has everything it needs to do both at once. Folding them keeps the cost of
being shown the screen to one request.

**How it meets `MAX_AUTO_FIX_ATTEMPTS`:** the budget counts corrections, not
round trips. Judging is how the run's outcome is established — the visual
counterpart of reading `readReport` — so a judging turn does not spend an
attempt by itself, and a run that looked right costs nothing. When the same turn
comes back with a failure and a corrected program, that correction increments the
counter exactly as an error correction does, so a visually-checked run gets the
same two unrequested corrections as any other and no more. The judging turn is
issued once per run (the run check settles once), which is what bounds it without
being counted: further judgements need another run, and runs are user-initiated.
Rejected: charging the judging turn to the budget — it makes the machinery for
checking a run compete with the corrections that machinery exists to trigger, so
a program judged good would have silently cost the user one of its two chances to
be fixed later.

**Why the assistant judges rather than the IDE:** the alternative is the IDE
deciding what "the maze is drawn with no gaps" means, which is the pixel analysis
this change explicitly does not do.

**Why a distinct form rather than reusing `SCREEN CONTAINS`:** `SCREEN CONTAINS`
is checked locally, for free, every few frames, against decoded characters. That
is strictly better than a round trip whenever it applies, so it must not be
displaced. The two forms name genuinely different questions: "is this text on the
screen" and "does this look right".

**Gating:** `buildExpectationRules` already varies per dialect (two machines
cannot report variables) while staying byte-stable per dialect. The visual form
is gated on the provider instead of the machine, so the composed system prompt
becomes stable per (dialect, provider) pair rather than per dialect — still
stable across a conversation, which is all caching needs, since a provider switch
starts a new request path anyway.

### The failure path carries the frame; the success path does not

**Decision:** `EmulatorPane` captures at the moment the run check reaches its
verdict — after rendering that frame, so the capture is the frame the verdict was
formed on — and only when the verdict is a failure or a visual expectation is
waiting to be judged. The capture rides on the store's run outcome next to the
outcome and expectation results it already carries.

**Why:** the working case is the common case and must stay free. Capturing at the
verdict rather than at an arbitrary later moment means the picture and the words
describe the same instant, which matters for a program that is still animating.

## Risks / Trade-offs

- **Cost per correction rises.** A retro screen is on the order of 70-100 input
  tokens at native resolution, and it persists in history. → Bounded by only
  ever sending on attach or on a failing/judging run, by one judging turn per
  run, and by the unchanged `MAX_AUTO_FIX_ATTEMPTS` cap on the corrections that
  follow. (Originally a larger worry, when the capture was upscaled - see the
  superseded decision above.)
- **The assistant marks its own homework.** A model asked whether its program did
  what it said may be generous. → The verdict only ever gates an *additional*
  unrequested correction; a false pass leaves the user exactly where they are
  today, and a false fail costs one bounded attempt and is stoppable.
- **A capture may be stale.** The snapshot kept for the attach control is the
  last frame before the pane unmounted or the machine stopped. → The thread shows
  what was sent, so the user can see if it is not what they meant; the run-check
  capture (the automatic path) is never stale by construction.
- **`toDataURL` can taint or fail.** A canvas is same-origin here and nothing
  external is drawn into it, but a failure must not break the run check. →
  Capture is best-effort: on failure the outcome travels without a frame and
  visual expectations report unchecked, which is the same path as a text-only
  provider.
- **The prompt is now stable per (dialect, provider) rather than per dialect.**
  → No cache impact within a conversation; switching provider mid-thread already
  changes the wire format entirely.
- **A new fenced block for verdicts is another thing the model can get wrong.** →
  A malformed or missing verdict is treated as "not judged" — reported unchecked,
  no correction — matching how `expectations.ts` already keeps malformed lines
  rather than dropping them.

## Migration Plan

Purely additive and self-gating: with no attachment and no `SCREEN SHOWS` line,
every path is byte-identical to today's. There is no data migration — persisted
conversations gain an optional marker field older code ignores, and older
conversations simply have none. Rollback is removing the attach control and the
visual form; nothing persisted depends on either.

## Open Questions

- Where the attach control sits on the narrow mobile composer, which is already
  tight — settled during implementation against the existing composer layout.
- Whether the "screen shown" marker in a restored thread should read differently
  from a live thumbnail beyond the missing image; a caption is assumed sufficient.
