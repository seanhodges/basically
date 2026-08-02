## Context

The AI path and the run-a-program path are described in
`docs/contributing/architecture.md`; this design only covers where they meet.

They meet in one place today. `AiPanel.applyText` lands generated text in the
editor and, for the two apply-and-run actions, calls `requestAiRun()`, which
bumps `runRequest` and sets `aiRunCheckSeq` to match. `EmulatorPane` sees the new
`runRequest`, loads the program, and — because the two counters agree and the
machine can introspect its error state — arms a watcher inside its
`requestAnimationFrame` loop. That watcher polls `machine.readReport()` for a
bounded window and pushes the first genuine error to `reportRun()`. A
module-level subscription in `aiStore` turns that into a `pendingFix` the user
can click.

Three properties of that watcher shape this design:

- It discards everything except an error. The window expiring, the program
  ending cleanly, and the machine never coming up are all the same silent
  non-event.
- It lives in a `requestAnimationFrame` callback in a React component, because
  that is what owns the machine handle. The assistant's request/response cycle
  lives in an async function in a Zustand store. Neither can await the other.
- It already degrades correctly. `typeof machine.readReport === 'function'` is
  false on two of the registered machines, and they simply get no check.

One inaccuracy to fix while here: the comment arming the watcher says the check
comes from "Replace + Run", but `applyText` is shared by both apply-and-run
buttons, so a merged fragment already arms it too. The comment is wrong, not the
code.

## Goals / Non-Goals

**Goals:**

- Every terminal state of an assistant-driven run reaches the assistant, success
  included.
- A genuine runtime error is corrected without the user having to ask, a bounded
  number of times.
- Identical behaviour across all three AI providers.
- Machines that cannot introspect their error state behave exactly as they do
  today.

**Non-Goals:**

- Judging whether the program is *correct* — only whether it ran. Asserting on
  variables and screen output is later, separate work.
- Starting the machine from a plain apply. Applying stays one action.
- Tool-calling on any provider.
- Reshaping the `Dialect` / `MachineEmulator` seam. One optional member is
  added; nothing existing changes, and answering it stays optional.

## Decisions

### `readReport()` alone cannot tell a finished program from a running one

The obvious reading — a report of `{ isError: false }` means "back at READY, no
error" — does not survive contact with the machines. Checked against every
implementation:

| Machine | while running | after a clean end | on an error |
| --- | --- | --- | --- |
| ZX81, Spectrum, Spectrum 128 | `{ isError: false, code: '0' }` | **identical** | `{ isError: true }` |
| CPC 464, CPC 6128 | `{ isError: false }` | **identical** | `{ isError: true }` |
| BBC Micro, BBC Master | `null` | `null` | `{ isError: true }` |
| C64, VIC-20, PET | `null` | `null` | `{ isError: true }` |
| TRS-80 | `null` | `null` | `{ isError: true }` |

The Sinclair and CPC ROMs hold "0 OK" in their report cell the whole time a
program runs, so treating a non-error report as "finished" would report every
Sinclair run as finished on its first frame — and never see the error that
arrives thirty frames later, which is a regression of the check that works
today. The other machines report `null` both while running and while idle, so a
clean run is indistinguishable from a machine that never came up.

Through `readReport()` alone the only observable distinction is **an error
appeared inside the window, or it did not**. The four-way outcome therefore
needs one more question, which the next decision adds.

### The seam gains one optional question: is a program executing?

`MachineEmulator` gets an optional `isProgramRunning(): boolean | null`,
alongside the optional `readReport` / `readVariables` / `currentLine` members it
already has, and detected the same way. Three states, because two are not
enough:

- `true` — a BASIC program is executing.
- `false` — nothing is executing; BASIC is back at its prompt.
- `null` — not answerable yet: the machine is still booting, or is still being
  handed the program. Without this a machine would read as "finished" during the
  seconds between `loadProgram` and the injected `RUN` taking effect.

What each machine answers it from, all state it already reads:

| Machine | Signal |
| --- | --- |
| BBC Micro / Master | `currentLine()` — null once the program stops (already relied on by the step debugger) |
| CPC 464 / 6128 | `currentLine()` — the firmware zeroes its current-line pointer at the Ready prompt |
| TRS-80 | the interpreter's own execution state |
| C64 / VIC-20 | `BLNSW` (`$CC`), the editor's cursor-blink flag: 0 at the prompt, non-zero while a program runs |
| PET | `BLNSW` (`$A7`) — the same flag, at BASIC 4.0's address |
| ZX81 / Spectrum / Spectrum 128 | **none** — not implemented |

The Sinclair machines are the deliberate gap. Their `PPC` keeps the last line
executed after a program stops, so `currentLine()` cannot answer this, and a
sweep of every system variable across several running and several finished
programs turned up no cell that stably distinguishes the two. (The Spectrum's
`ERR_SP` does, by four bytes of stack depth — too incidental to build on, and
the ZX81 has no equivalent at all.) The remaining option, trapping the ROM's
keyboard-wait loop, costs a comparison per instruction in the Z80 inner loop and
only separates two outcomes that behave identically, so it is not worth it.

A machine that does not answer degrades exactly as one with no `readReport`
does: its runs report `still-running` when no error appears, which the assistant
is told is a run that did not fail.

Note what this cannot see on the machines that do answer: a program blocked on
`INPUT` reads as finished on the Commodore machines (the cursor blinks for an
`INPUT` prompt as it does at the READY prompt). Both readings are non-failing
and neither triggers a correction, so the distinction costs nothing here.

### `still-running` is a success, not a timeout

Most of the bundled samples are game loops that never return to READY; treating
"did not finish" as a failure would report almost every working program as
broken.

Alternative considered: keep reporting only errors and add a separate "ran
clean" signal. Rejected — two channels for one question, and the caller still has
to reconcile them.

### The outcome crosses to the assistant as a sequence-tagged store field

`EmulatorPane` produces it (it owns the machine); `aiStore` consumes it. The
existing `runReport: { seq, report }` becomes an outcome carrying the same `seq`,
so a stale outcome from a superseded run is ignorable by comparison, exactly as
today.

Alternative considered: give the store a handle to the machine and drive frames
from `aiStore` so the retry could be a plain `await`. Rejected — it breaks the
project's no-shared-handles convention, and the frames still have to be pumped by
the pane's animation loop, so the handle would buy nothing.

### The retry is a state machine in `aiStore`, not an `await`

The correction cannot be sequenced inside `send()`, because the run that produces
its input happens in another module's frame loop, an unknown number of frames
later. So `aiStore` keeps a small amount of state — how many automatic attempts
this applied block has used — and the existing module-level subscription advances
it when a new outcome arrives.

### An automatic correction is an ordinary follow-up turn

The mechanics already exist: the empty-reply retry appends a synthetic assistant
turn (to keep role alternation valid) and a follow-up user turn, then re-runs the
same attempt function. The `retrying` flag on the message shape already drives
the "reformatting" affordance in the panel.

The follow-up content is `buildRunFix(source, report)` — the same content the
manual banner sends. The model therefore sees identical context whether the fix
was automatic or clicked, and there is one prompt to maintain rather than two.

This is why no tool-calling is needed. A follow-up turn works identically on all
three providers, which matters because they have three different tool APIs, and
because the Anthropic backend's cache breakpoint depends on the prefix staying
byte-stable with no tool definitions in it.

### The cap is per applied block, and the banner is the fallback

Two automatic attempts, counted per applied block and reset when the user sends a
new request. On exhaustion the existing `pendingFix` banner appears, so the
terminal state is what happens today — the change makes the first two corrections
free, it does not remove the manual path.

Alternative considered: cap per conversation. Rejected — a long session would
exhaust its budget early and silently stop self-correcting.

### Automatic corrections are visible and interruptible

An attempt in flight uses the existing busy/retrying affordances and the existing
Stop. It must not begin while the user is editing: the fingerprint machinery that
already detects a program changed since a reply arrived is what decides this.

### Seam impact

One optional member added, `isProgramRunning()`, and nothing else changed:
no existing member is altered or removed, every machine that omits it keeps
working, and the app reaches it through the same `typeof` test it already uses
for the rest of the optional introspection surface. The eight machines that
implement it answer from state they already read for the debugger or the
report, so no new ROM archaeology rides along.

## Risks / Trade-offs

- **Automatic requests spend the user's own API budget.** → Hard cap of two per
  applied block, visible while running, cancellable with the existing Stop, and
  never triggered by anything but an apply-and-run the user initiated.

- **A retry can be spent on an error the assistant cannot diagnose** — a program
  waiting on input, or a hardware quirk it cannot observe. → The cap bounds the
  waste at two turns, after which the user sees the same banner they see today.

- **On the Commodore machines the report is obtained by scanning the screen for a
  line containing `ERROR`.** A program that prints such a line could be reported
  as failing. → Pre-existing behaviour, not introduced here; but this change acts
  on the report automatically rather than only offering it, so a false positive
  now costs a wasted turn instead of an ignorable banner. The cap bounds it.

- **`ended-ok` and a user-pressed BREAK are indistinguishable**, since both are
  `isError: false`. → Both are genuinely "the program stopped without failing",
  which is what the assistant is told; nothing is retried either way.

- **The run-state signal is per-machine and empirical.** The Commodore
  cursor-blink flag and the BBC/CPC current-line pointers were confirmed against
  the real ROMs, but they are ROM behaviour, not documented contract. → Each is
  pinned by a colocated test that boots the genuine ROM and checks a looping
  program against a finished one, so a wrong reading fails the suite rather than
  reaching the assistant. And a wrong reading is bounded anyway: it can only
  mislabel one non-failing outcome as another, never invent a failure.

- **The outcome is reported while a long program is still running.**
  `still-running` is decided by the window expiring, so a program that would have
  errored on frame 200 reports success at frame 150. → Accepting a bounded window
  is what keeps the check cheap; the existing windows are unchanged, and a later
  error still reaches the user through the normal emulator display.
