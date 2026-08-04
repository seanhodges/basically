## Why

The assistant's thread already outlives a great deal: closing the panel, switching
view, backgrounding the tab, and reloading the page. None of that is written down,
so it is one careless refactor away from regressing. And the one case it does not
survive cleanly is the most visible: an answer still arriving when the page goes
away comes back looking finished. The user cannot tell it was cut short, and cannot
pick it back up except by retyping the request.

A thread that sticky also needs a way out. Today the only things that clear it are
opening a different program or switching machine, so a conversation that has gone off
the rails can only be escaped by loading something else and coming back.

## What Changes

- An answer interrupted by the page going away is restored **marked as cut short**,
  distinctly from one the user stopped, and whether or not it had begun any code. It
  offers to put the same request again — a fresh ask, because a stream cannot be
  resumed.
- The composer accepts two commands, neither sent to the provider:
  - `/clear` ends whatever is in flight and empties the thread and everything stored
    with it — working even while the assistant is busy or has no API key set.
  - `/hide` closes the assistant as its toolbar toggle does, leaving the conversation
    and any work in flight untouched.
- Leaving the page while an answer is still arriving is **confirmed first**, so the
  cheapest fix for a lost answer is the reload that never happens. Only while an
  answer is arriving — once it is in, leaving passes without comment.
- The behaviour that already holds — that putting the assistant away does not cancel
  a request, a check, or an unrequested correction — becomes a stated requirement.
  No code changes for this; it is written down so it stays true.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: adds requirements for an interrupted answer being recoverable, for
  the composer's `/clear` and `/hide` commands, and for the assistant continuing to
  work while it is out of sight; adds a reload scenario to `The conversation resets
  with the program`, which already claims the thread survives a reload but never
  asserts it.

## Non-goals

- **Resuming an interrupted stream.** The provider's streaming API is not
  reconnectable. The answer is offered again, not continued.
- **Guaranteeing an answer is never lost.** Confirming a departure only reaches a
  page the browser is unloading while it is still alive. A tab the OS reclaims, a
  crash, or a browser that ignores the confirmation all still lose the answer, which
  is why the interrupted marker remains the thing that actually handles the case.
- **Moving the assistant into a worker.** Considered and rejected — see design.md.
- **Persisting an in-flight request across a reload.** Nothing keeps talking to the
  provider once the page is gone; only the text that had already arrived is kept.
- **Persisting the pending unrequested correction.** That offer is built from a run
  that no longer exists after a reload, so restoring it would offer a correction for
  something that never ran.
- **Making `/hide` a mute.** A stage that surfaces the assistant still surfaces it;
  `/hide` puts the panel away, it does not opt out of being shown again.
- **A general command language.** Two commands, matched exactly — not a prefix
  parser, arguments, or an extensible registry.

## Impact

- `src/storage/settings.ts` — `PersistedMessage` gains an `interrupted` marker.
- `src/ai/aiStore.ts` — `DisplayMessage` carries it; `persist()` sets it only for a
  still-streaming answer; hydration restores it. `reset()` is unchanged and becomes
  what `/clear` calls.
- `src/components/AiPanel.tsx` (+ its CSS module) — the cut-short note and its
  **Ask again** button, and the command handling at the top of `send`. `/hide` reuses
  the store's existing `showEmulator()`, which the panel already holds.
- `src/ai/unloadGuard.ts` (new) + one call from `src/App.tsx` — the departure
  confirmation, armed and disarmed off the AI store.
- Tests: `src/ai/aiStore.test.ts`, `e2e/aiStub.ts` (a reply that holds the connection
  open, so reload-mid-stream stops being manual-only), `e2e/ai-assistant/`.
- No new dependencies, no change to the `Dialect` seam, nothing machine-specific.
