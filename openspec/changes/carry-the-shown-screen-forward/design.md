## Context

Two paths put a picture of the machine in front of someone today, both built on
the same canvas read (`src/app/screenCapture.ts`, taken from the frame
`EmulatorPane` renders through the machine seam — see
`docs/contributing/architecture.md`):

1. **The run check.** When the IDE runs an answer to see how it went, the pane
   renders the verdict's frame and captures it once. That single capture becomes
   both the screen the assistant asked to see (where it asked) and the
   `finalScreen` handed to the user under the reply.
2. **The composer button.** "Show screen" calls `captureScreen()` — the live
   canvas, or the last frame stashed before the pane unmounted — and holds it in
   panel state until the request is sent.

Path 2 is the one being removed. Everything it existed for is already sitting in
the thread as a `ChatImage` on a message, which is a better source than the
canvas in three ways: it is the picture the user is actually looking at, it
survives the emulator pane being unmounted or restarted without any snapshot
machinery, and it costs nothing to obtain.

## Goals / Non-Goals

**Goals:**

- One capture of the machine per checked answer, serving every use of it.
- The screen the user is looking at is the screen the assistant is shown.
- No image is sent twice, and no thumbnail is shown twice.
- Everything the assistant asks for itself — views, visual expectations, the
  judging turn — keeps working exactly as it does.

**Non-Goals:**

- Not a rework of the capture module. `screenCapture.ts` keeps its shape; it
  simply loses its only non-run caller.
- No attach-and-remove UI to replace the button. There is nothing to remove: the
  request carries what the conversation is already showing, or nothing.
- No provider-seam change. Images already travel on user turns.

## Decisions

### The seam is untouched

**Decision:** no change to `Dialect` or `MachineEmulator`. This change removes a
caller of an existing app-level capture and reads messages already in the AI
store; the machine boundary is not involved at all.

### The screen comes from the thread, not the canvas

**Decision:** the request carries the `finalScreen` of the most recent assistant
turn that has one, rather than a fresh `captureScreen()`.

**Why:** those two used to be the same picture only by coincidence of timing. The
check runs the assistant's candidate program — which the user has not applied —
and the canvas keeps whatever that run left on it until something else runs. Ask
a question ten seconds later after pressing Play on your own program and the
button captured your program's screen while the thumbnail above your question
showed the assistant's. Reading the thread makes the two the same by
construction.

**Consequence:** with nothing checked yet, there is no screen to carry, where the
button would have offered the live canvas. That is the intended trade: an
unprompted capture of whatever the machine happens to be showing is exactly the
guess this change exists to stop making, and the user's program is one assistant
request away from being run and checked.

### Carried once, by looking at what the thread already sent

**Decision:** a pure reader over the message list — the latest `finalScreen`,
returned only when no user turn in the thread already carries that same image.

**Why:** the wire history replays every prior turn's image so the provider's
cached prefix stays byte-stable, so a picture that has been sent is still in
front of the model on every later turn. Attaching it again would pay for the same
pixels twice and destabilise the prefix that carrying images forward exists to
protect. Identity holds because the run check captures once: the image the judging
turn was sent and the image the user was shown are the same object.

**Alternative considered:** a module-level "pending screen" spent by the next
send, mirroring `pendingRunImage`. Rejected — it would be a second source of
truth about a thread that already knows the answer, and it would have to be
cleared correctly on reset, on restore and on every path that ends an answer.
A function of the messages cannot fall out of step with them.

### A carried screen is noted, not repeated

**Decision:** a user turn that carried a screen renders a short note rather than
the thumbnail it used to render.

**Why:** the picture it carried is the one immediately above it in the thread.
Two identical thumbnails a few lines apart read as two different screens. The
note keeps the conversation readable back — which request was asked against the
picture — without claiming there were two of them. A turn restored from storage,
which has the marker and not the pixels, already rendered exactly this note.

### The store flag goes with the button

**Decision:** `screenCaptureAvailable` is removed from the IDE store.

**Why:** it existed to enable and disable one button, and it is read nowhere
else. The capture registration in `EmulatorPane` stays — the run check still
needs it — it simply stops mirroring a flag nobody reads.

## Risks / Trade-offs

- **A request now carries an image the user did not explicitly attach.** Mitigated
  by it being the picture on screen in the same panel, by it going only to the
  provider the user chose and only where that provider accepts images, and by it
  being carried once rather than on every turn. The alternative — pressing a
  button to send the picture already in front of you — is the friction being
  removed.
- **Cost.** One image per checked answer that the user follows up on, at the
  machine's own resolution (about 70 visual tokens for a 256×192 screen — cheaper
  than the same screen sent as text). Unchanged where the user asks nothing after
  an answer.
- **No screen before the first checked answer.** Stated above; accepted.
