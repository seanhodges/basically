## Context

Two shapes have to change for the assistant to drive the machine, and they are
independent of each other.

The first is the provider layer. `src/ai/aiClient.ts` is one function — pick a
backend, clamp what that backend can honour, stream — and each backend turns one
`StreamOptions` into one API call. Everything above works in whole turns: one
request in, one answer out. Driving is not a bigger request; it is several
requests that make one turn, with the IDE doing work in between.

The second is reach. The machine lives in a `useRef` inside `EmulatorPane` and is
handed out through one prop ref to the virtual keyboard, the game controller and
the memory map. `src/ai/aiStore.ts` — which orchestrates every answer and already
reacts to run outcomes — has no access to it at all.

Neither is a new architectural idea. The app already has a blessed way for a
non-React module to reach the pane (`src/app/screenCapture.ts`), and the machine
already exposes everything driving needs. See
`docs/contributing/architecture.md` for how `src/ai/`, the store and the pane sit
relative to one another.

## Goals / Non-Goals

**Goals:**

- One place owns the exchange loop, so its bound and termination rule exist once.
- Backends stay "one request in, one result out" — the shape they have now.
- The existing path stays byte-identical when nothing asks to drive, so nothing
  that works today can regress.
- Driving reuses the machine's own key data and the controller's own role
  bindings, so no machine-specific code is added anywhere.
- Prompt caching survives.

**Non-Goals:**

- Playing a game well; driving reaches a state, it does not compete.
- Replacing any part of the fence-block protocol with tools.
- Bringing every backend to parity — one that cannot be given tools says so.

## Impact on the Dialect / MachineEmulator seam

**No change to the seam.** Driving uses members that already exist and are
already required or feature-detected: `setKey`, `releaseAllKeys`, `runFrame`,
`readScreenText`, and the optional `setJoystick`. Key naming comes from
`Dialect.keyboardLayout`, which is required data every dialect already ships, and
joystick roles from the controller bindings that live in that same layout. No
member is added, no member changes shape, and no machine-specific branch is
introduced above the seam.

## Decisions

### The exchange loop lives in `aiClient`, not in each backend

`aiClient` calls the chosen backend repeatedly — appending the assistant's calls
and the IDE's results to the message list each time — until a reply stops
calling. Backends keep their present signature and know nothing about looping.

*Why:* the loop is entirely provider-agnostic, and `aiClient` is already where
cross-provider policy lives (it clamps `maxTokens` per provider and strips
`effort` for backends without it). Putting it in the backends would mean three
copies of the same bound and termination rule, drifting apart.

*Alternative considered — Anthropic's `client.beta.messages.toolRunner`.* It
would run the loop for the backend that matters most, with per-turn hooks.
Rejected: Anthropic-only and beta-namespace, so the other backends still need a
hand-written loop, and the two would differ in exactly the semantics worth having
identical.

### Driving happens on the turn that already judges the screen

The answering turn cannot drive: the program does not exist yet, let alone run.
The IDE already makes a second, automatic turn after a checked run — the one that
shows the assistant the screen and asks it to judge its own program. That turn
already has a loaded program, a live machine and a captured screen. It becomes
the turn on which the assistant may also drive, before giving the same verdict it
gives today.

*Why:* it is the only moment where driving is meaningful, and it already exists
as a round trip with the right context. Inventing a third turn would mean a
second set of rules for when it happens.

*Alternative considered — drive during the run check itself,* from a script the
assistant wrote up front. Rejected: it cannot react to what is on screen, which
is the whole reason for choosing an interactive shape.

### The IDE reaches the machine through a module-level registry

A small `MachineControl` registered by `EmulatorPane`, read by the AI layer —
exactly the shape `screenCapture.ts` already uses, for exactly the same reason.

*Why:* the alternative is threading a handle from the pane through the store into
`aiStore`, which the store's own convention forbids (cross-module commands bump a
counter; no shared handles). The screen capture faced this and solved it with a
module-level registration; a second consumer of the same pattern is cheaper than
a second pattern.

*Alternative considered — the counter protocol,* bumping a request and reading an
outcome per action. Rejected: it is built for one round trip per run, and driving
is many round trips inside one run; the bookkeeping would dwarf the work.

### The driver advances frames itself rather than taking the frame hook

`EmulatorPane.registerFrameHook` is a **single slot** — it assigns one callback.
The virtual keyboard and the game controller both use it, and that is safe only
because the app makes those two mutually exclusive. A third consumer would
silently clobber whichever overlay is open.

So the driver runs its own bounded advance loop over `runFrame()` — which is what
the machines' own private boot-time key-tapping helpers already do, with timings
proven against real ROMs — rather than registering a hook. Key releases are
deferred by frame count as the input engine does, so the ROM's keyboard scan
actually sees a press.

*Why:* it sidesteps the clobbering entirely instead of turning one slot into a
set, and it keeps driving deterministic — the driver decides exactly how many
frames each step costs.

### The machine is held still between actions

A tool round trip is seconds of network, and the pane's loop keeps ticking after
a check settles. Left running, the assistant would act on a screen that had moved
on. Driving freezes the machine for its duration and advances it only through the
driver.

*Why:* determinism, and it costs nothing — a check already runs unwatched and
never takes focus, so there is no animation anyone is looking at to interrupt.

### Keys are named from the machine's keyboard data, never as raw tokens

`setKey` takes an opaque machine-defined token, and those tokens are genuinely
not uniform across machines. The assistant is given the key names for its machine,
derived from that machine's keyboard layout, and the driver resolves them.

*Why:* the tokens are documented as opaque, so writing them directly would be
building on something explicitly not guaranteed. The layout is required `Dialect`
data, so the names can be derived without constructing an emulator — which
matters because the system prompt must be buildable from the dialect alone and
must stay byte-stable per dialect for caching. A crosscheck test asserts the
derived names still match what the machines actually accept, the same anti-drift
pattern the machine-observability table already uses.

### Waiting can be on screen text, not only on a frame count

*Why:* it is the difference between driving that works and driving that is
flaky. Machines differ by seconds in how long they take to boot and to reach a
prompt, so any fixed number of frames is either wasteful or wrong. Reading the
screen back as characters is available on every registered machine, so waiting
for the prompt to actually appear is both cheaper and more reliable than guessing.

### The screen as text is a reading that already happens

At the frame the verdict settles, the machine's characters are already read — the
verdict forces a final sample — at the same instant the picture is captured. That
reading is currently reduced to pass/fail and discarded. It is kept and carried
instead.

*Why:* it is free, and it is the same moment as the picture, so the text and the
image cannot disagree about what the machine was doing. Reading again later would
be both a second cost and a second moment.

### Tools are a fixed set or not offered at all

Whatever tools are offered must be identical across a conversation's turns and
serialized deterministically.

*Why:* tool definitions render *ahead* of the system prompt, at the very front of
the cached prefix. A set that varies between turns invalidates the system prompt
and the whole thread behind it — worse than not caching. A fixed set is exactly
as stable as the per-dialect system prompt already is. This is why the Anthropic
backend's existing comment, which justifies caching partly on "there are no
tools", states the wrong invariant: what matters is that the set does not vary.

### Whether a backend can be given tools is declared, not discovered

A flag on the provider metadata beside `acceptsImages` and `supportsEffort`.

*Why:* it is the rule the assistant capability spec already follows for being
shown a screen — a stated property, never found out by attempting it.

## Risks / Trade-offs

- **The frame-hook slot gets clobbered** → the driver never registers one; it
  advances frames itself.
- **A varying tool set silently destroys the prompt cache** → fixed set,
  deterministic serialization, and the corrected comment records why so the next
  reader does not reintroduce it.
- **A long drive falls out of the cache lookback window** → a cache breakpoint
  walks back at most 20 content blocks and each exchange appends two, so the
  bound on actions is chosen to stay under it rather than picked for feel.
- **The assistant "fixes" a program that was fine, because its driving was
  wrong** → driving failures are reported as their own thing and leave
  expectations unchecked; they never fail the run or trigger a correction.
- **Driving costs real time and tokens on every checked answer** → it happens
  only where the assistant asked, and text rather than pictures is the default
  observation, which is roughly an order of magnitude cheaper per look.
- **A program that ends while the assistant is still driving** → the driver
  reports the machine's state rather than pretending; the assistant reports on
  what it saw.
- **The Anthropic backend currently drops blocks it does not recognise** → this
  is the one non-additive edit; left alone, a reply that called a tool would look
  empty rather than failing loudly.
- **The e2e stub becomes stateful across requests** → accepted, because the stub
  exists to test the wire format and a stub that answers once cannot test a loop.

## Open Questions

- Whether OpenAI and Gemini are wired for tools in this change or declared
  without the capability initially. Declaring honestly is correct either way, and
  only the Anthropic path is needed for the behaviour to land.
