## Why

Everything the assistant learns about its own program is pushed at it. The IDE
runs the program, watches it, forms a verdict, and hands over a sentence and at
most one picture. The assistant never touches the machine.

That is enough for a program that prints its answer and stops. It is not enough
for most of what these machines actually ran. A program sitting at an `INPUT`
prompt never reaches its result. A game sits on "PRESS FIRE TO START". A
menu-driven program shows a menu. In every one of those cases the screenshot the
assistant is shown — and the screenshot the *user* is shown under the reply — is
of the moment before anything interesting happened.

The gap is already written into the IDE, as advice to work around it: the
assistant is currently told to state only what its program definitely produces,
because "a program that waits for a keypress never reaches its result". So it is
steered away from writing the programs that need input at all, and the user is
shown a title screen instead of a game.

The machine has a keyboard and a joystick. The assistant should be able to use
them, look at what happened, and then say whether its program works.

## What Changes

- **The assistant can drive the running program.** Alongside the code it
  returns, it may ask to be given the machine once that program is running.
  Where it asks, it can type text, press the machine's own keys, work the
  joystick, wait, and look at the screen — repeatedly, deciding each step from
  what the last one showed.
- **It sees the screen as text as well as a picture.** The characters on screen
  are already read at the moment the verdict is formed and then thrown away; that
  reading becomes something the assistant can be shown. Text is the cheaper and
  exact answer for a program whose output is words, and it is available on every
  machine; the picture stays for what only a picture can settle.
- **Waiting can be on the screen rather than on a clock.** It can wait for text
  to appear rather than guessing a number of frames, which is what makes driving
  reliable on machines that take their time booting.
- **The machine is held still between the assistant's actions.** What it acts on
  is the screen it was last shown, not one that moved on while it was thinking.
- **The user is told when the machine was driven** — and only then. Input
  changes what happened, so a screen the user cannot otherwise reproduce is
  explained; waiting and looking change nothing and are not narrated.
- **Driving that does not work out is not the program's failure.** A wait that
  times out, a key that does not exist on this machine, a machine that never came
  up: reported as unchecked, never as the program being wrong.
- **Whether the assistant can be given the machine is a property of the chosen
  provider**, stated up front like being shown a screen already is.
- **The provider layer learns to carry tools.** A request can offer them, a reply
  can call them, and the client runs the exchange to a bounded end. This is the
  mechanism the above is built on rather than a feature of its own.

## Non-goals

- **Not playing the game.** Driving is for reaching the state worth verifying —
  past a prompt, past a title screen, into a running loop. It is not for playing
  a game well, and nothing here tries to.
- **No new capture point.** The picture and the screen text both come from the
  moment the run is already observed. This change spends readings that are
  already taken.
- **The fence-block protocol stays.** ` ```basic `, ` ```basic-expect `,
  ` ```basic-view ` and ` ```basic-judge ` are how the assistant and the IDE
  already talk, and none of them is being replaced by a tool.
- **No unattended driving.** The machine is driven only while checking an answer
  the assistant gave, only where it asked, and only within a bound. Nothing
  drives the user's own run.
- **No new machine capability.** Keys, the joystick and reading the screen all
  exist on the machine seam already; this change uses them rather than extending
  them.
- **Nothing is stored.** A screen the assistant was shown is not retained, which
  is the rule that already holds for every shown screen.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: gains the ability to drive the machine while checking its own
  program — to send keyboard and joystick input and to read the screen back as
  text as well as a picture — bounded, gated on the chosen provider, reported as
  unchecked when the driving itself fails, and stated to the user when input
  actually changed what happened.

`virtual-input` is **not** affected: the controller's roles and per-machine
bindings are reused exactly as they are, and nothing about the on-screen keyboard
or gamepad changes. `program-execution` is not affected: the run itself, its
verdict rules and its bounds are unchanged.

## Impact

- **`src/ai/providers/`** — tools on the request and the reply, a capability flag
  beside `acceptsImages`, and the Anthropic backend no longer discarding blocks
  it does not recognise. Its prompt-cache comment currently justifies caching
  partly on "there are no tools" and needs correcting: tool definitions render
  ahead of the system prompt, so a *fixed* set is as stable as that prompt
  already is.
- **`src/ai/aiClient.ts`** — the bounded exchange loop, beside the existing
  per-provider clamping.
- **`src/ai/aiStore.ts`** — the turn that judges a screen becomes the turn that
  may also drive the machine first.
- **`src/ai/machineObservability.ts`** — what the assistant is told it can press
  on this machine, derived from the machine's own keyboard data.
- **`src/ai/expectations.ts`** — the new views the assistant can name.
- **`src/app/`** — a driver for the machine, reached the same module-level way
  the screen capture already is; the screen text carried alongside the picture.
- **`src/components/EmulatorPane.tsx`** — registering the driver, holding the
  machine still, and keeping the screen reading it already takes.
- **`e2e/ai-assistant/`** — a scenario that drives; the stubbed backend answers a
  sequence of requests rather than one.
- **Dependencies** — none added or removed.
