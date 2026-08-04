## Context

Most of what this change is named for is already built, and reading the code first
is what shaped the design. The stream handle, generation counter and correction
budget live at module scope in the AI store rather than in React, so closing the
panel cannot cancel anything; the store's subscription to the IDE store is
registered at import time, so unrequested corrections run with the panel shut; the
thread is written through to per-tab storage on every finalize and throttled while
streaming; and the emulator already swaps its animation-frame loop for a timer when
a check is armed and the page is hidden, so a background tab still reaches a verdict.

So the work is not "make the assistant survive being away" — it is to say so in the
specs, pin it with tests, and close the one case that genuinely leaks: an answer
still streaming when the page goes away. That answer's text is persisted, but the
flag it is persisted under (`incomplete`) is the same one a user-pressed Stop
produces, and the only place that flag surfaces is inside a code block — so an
answer cut off mid-prose comes back looking finished.

The second half of the change follows from the first. A thread this durable needs a
deliberate way out, and there is currently none short of loading another program.

See `docs/contributing/architecture.md` for the store/panel layering this works
within.

## Goals / Non-Goals

**Goals:**

- Distinguish "the page went away" from "the user stopped it", and surface it on the
  message rather than only inside a code block.
- Offer the interrupted request again in one action.
- Give the composer `/clear` and `/hide`.
- Write the existing keep-working-while-away behaviour into the spec and cover it
  with tests, changing no code to do it.

**Non-Goals:**

- Resuming a stream, or keeping a request alive across a reload.
- Persisting the pending unrequested correction — see the proposal's non-goals.
- A general command parser. Two exact matches, no arguments, no registry.
- Any change to the `Dialect` / `MachineEmulator` seam. **This change does not touch
  it.** Nothing here is machine-specific: it is conversation state, browser storage
  and panel layout, all of which sit above the seam and behave identically on every
  dialect. No dialect folder, emulator core or ROM is involved.

## Decisions

**Narrow the existing flag rather than replace it.** `incomplete` already means "do
not offer this as finished code", and a requirement depends on that. Adding a
separate `interrupted` marker alongside it — set only when the persisted message was
still streaming — keeps that guarantee untouched while making the cause legible.
The alternative, a single `reason` enum replacing `incomplete`, would have been
tidier on paper but rewrites a flag other requirements lean on, and orphans threads
stored by earlier versions. `interrupted` is simply absent on those, which reads
correctly as "cut short, cause unknown".

**Derive it from the write, not from a lifecycle hook.** Only the throttled
mid-stream write can see a message that is still streaming; every finalize path
clears the streaming flag before persisting. So the marker falls out of what is
already happening, with no `pagehide`/`visibilitychange` listener to get wrong. A
listener would also be unreliable exactly when it matters — a tab discarded by the
OS never fires one.

**Ask again, do not splice.** Taking the offer puts the same request afresh and
leaves the cut-short answer above it. Removing the dead turn would read as if it
never happened and would diverge from how a stopped answer already behaves.

**Commands are handled before the guards, not after.** `/clear` exists for the case
where the panel is stuck busy or was never configured, so matching it after the
busy check or the API-key gate would disable it precisely when it is needed. They
are matched at the very top of the send path, exactly, case-insensitively, on the
trimmed input.

**`/hide` closes the panel through the same action the panel already uses to step
aside for the machine, not through the toolbar's toggle.** The toggle flips the
desktop panel flag only, which does nothing on the tabbed layout, where the panel is
mounted whenever the layout is tabbed and visibility is driven by the selected tab.
The action the panel already holds clears the panel flag *and* selects the machine's
tab, so one code path closes it correctly on both layouts. It touches layout state
only — never the conversation — so preserving the session needs no work.

**`/clear` reuses the existing reset.** Aborting, ignoring late deltas, zeroing the
correction budget and wiping stored conversation are all already one action, used
when a different program becomes active. `/clear` gives it a user-reachable trigger;
no new store action is introduced.

## Risks / Trade-offs

- **A user types `/clear` meaning to send it as text** → Both commands are matched
  only as the entire message, so anything longer is an ordinary request. There is no
  confirmation step: the command is the escape hatch, and a prompt in front of it
  would blunt it. The thread it discards is a conversation, not the user's program,
  which is untouched and separately autosaved.
- **`/hide` reads as "stop bothering me" but is not a mute** → A stage that surfaces
  the assistant still surfaces it, which is deliberate existing behaviour. Stated in
  the proposal's non-goals rather than worked around, so the expectation is set.
- **The interrupted marker depends on the throttle having fired** → An answer
  interrupted within the first second of streaming may have nothing persisted to
  mark. That is already true of the text itself, so the failure mode is an absent
  turn rather than a mislabelled one.
- **Two commands invite a third** → Kept as a local table of exact strings, not a
  registry, so the cost of the next one is a line and the cost of not needing one is
  nothing.
