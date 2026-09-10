## 1. Settle how a played machine's display is carried

The design leaves the rate guarantee open until this is measured. Nothing in
group 4 or the spec's wording should be finished before it is.

- [ ] 1.1 Measure what one frame costs to carry at full rate for the widest
      display among the registered machines: raw pixels, raw pixels through
      low-level raw deflate, and an encoded picture, on a machine that is idle
      and one that is scrolling. Record the numbers where the spike can be read
      later.
- [ ] 1.2 Decide from 1.1 whether full frames hold at the machine's own rate or
      whether only what changed between frames must be sent, and write the
      choice into `design.md` as a decision rather than leaving it in Open
      Questions.
- [ ] 1.3 Confirm the WebSocket handshake and framing are worth hand-rolling
      against `node:http`'s upgrade rather than falling back to the view's
      existing arrangement; if the fallback wins, revise the carriage decision in
      `design.md` before writing any of it.

## 2. The operations conversation over standard streams

Independent of the play channel, and the smaller half of the change.

- [ ] 2.1 Admit the operations conversation to the entry point that serves a
      conversation over the process's own streams, which is limited today to the
      other two by nothing but its own signature.
- [ ] 2.2 Accept it in the argument parser alongside the operations that serve an
      editor and an agent, and reject the same malformed forms they reject.
- [ ] 2.3 Add its usage text beside theirs, saying how an application is expected
      to start it.
- [ ] 2.4 Colocated tests: the conversation is served over the streams, a caller
      served this way holds a machine separate from the command line's shared
      one, and starting it without naming a machine is not the caller's mistake.

## 3. A machine that runs on its own clock

- [ ] 3.1 Add a self-correcting pacing loop beside the machine — in its worker,
      not on the host's thread — that runs however many frames are due against
      wall-clock time, caps the catch-up so a stall cannot avalanche, and re-reads
      the machine's rate every tick rather than caching it.
- [ ] 3.2 Start and stop that loop with the play channel, so a machine nobody is
      playing advances exactly as it does today.
- [ ] 3.3 Colocated tests: a machine whose rate is not a round number keeps time;
      a machine whose rate changes mid-run is followed rather than played at the
      rate it started at; a stalled tick does not produce a burst of catch-up
      frames; and a machine with no play channel advances only when asked.

## 4. The play channel

- [ ] 4.1 Extend the seam between a caller's machine and its projection so keys
      travel toward the machine, satisfied both where the machine is in-process
      and where it is in a worker — the first thing to cross it in that
      direction, and worth saying so where the seam is described.
- [ ] 4.2 Serve the channel from the host's listener, reusing the loopback
      binding, the unguessable per-channel address, the `Host` check and the
      no-referrer posture the view established, and binding nothing until a
      caller has asked.
- [ ] 4.3 Carry frames as 1.2 settled, dropping a frame rather than queueing it
      when the far end is behind, and skipping frames identical to the last.
- [ ] 4.4 Take keys as the opaque tokens the machine seam already accepts, named
      as the schedule grammar names them, so a key pressed live and the same key
      in a schedule reach the machine identically.
- [ ] 4.5 End the channel with the caller that asked for it — given up,
      disconnected, disappeared, or the host stopped — stopping the clock and
      leaving nothing reachable at its address.
- [ ] 4.6 Colocated tests: the address admits only what was given it and never a
      guessed or ended one; a request from off this computer is refused; frames
      are dropped rather than queued; a key reaches the machine as the same key a
      schedule would press; and the channel ending stops the machine advancing.

## 5. The page

- [ ] 5.1 Write the page the channel is played through as a sibling to the view's
      — standalone, no framework, no build step of its own, inlined into the
      host's bundle so an installed toolchain resolves nothing at runtime.
- [ ] 5.2 Map the browser's key codes onto the machine's key names in the page,
      so the host never sees a browser event.
- [ ] 5.3 Say what the channel is showing — a machine being played, no machine
      up, or a machine that has gone — so a still picture is never ambiguous.
- [ ] 5.4 Size the machine's picture to whatever frame the embedding application
      gives it, at its own aspect ratio, as the view's page does.

## 6. Playing as an operation, and what it costs other requests

- [ ] 6.1 Declare playing as one operation, answering with an address, whether
      one was already open, and why there is none when there is none. Declare its
      absence from the agent's protocol and from the assistant together with the
      reason, so the parity check reads it as a decision rather than a gap.
- [ ] 6.2 Refuse the holder's requests that act on or measure a machine being
      played, naming the reason and how to stop; answer the ones that only read
      it, and say in the operation's own description that this is what playing
      costs.
- [ ] 6.3 Let a caller give up its play channel without giving up its machine.
- [ ] 6.4 Colocated tests: a measurement of a played machine is refused with the
      remedy; two reads of one may differ without that being a fault; the
      refusals stop the moment the channel ends; and the parity check passes with
      the declared exemptions.

## 7. One projection at a time

- [ ] 7.1 End a view when the caller asks to play the same machine, and end a
      play channel when it asks for a view, telling the caller which happened
      rather than leaving an address that has quietly stopped answering.
- [ ] 7.2 Colocated tests: each direction ends the other and says so, and the
      ended projection's address admits nothing afterwards.

## 8. Documentation

- [ ] 8.1 Document playing beside watching, saying in its own words — not by
      reference to the view's — that possession of the address admits acting on
      the machine rather than watching it.
- [ ] 8.2 Document the operations conversation over standard streams beside the
      other two, and say that a caller served that way holds its own machine.
- [ ] 8.3 Update `docs/contributing/architecture.md` where its shape changed: the
      second kind of projection, the seam gaining a direction, and the clock that
      now exists beside a machine.

## 9. Quality gates

- [ ] 9.1 `npm run typecheck`
- [ ] 9.2 `npx vitest run src/server/ src/ops/ src/cli/ src/dialects/headless/` —
      the folders this change touches. The full suite is CI's job.
- [ ] 9.3 `npm run lint`
- [ ] 9.4 `npm run format:check` (or `npm run format` to fix)
- [ ] 9.5 `npm run docs:build`, required because group 8 changes `docs/`.
- [ ] 9.6 No e2e run applies. This change is toolchain-only and adds nothing to
      the browser app; the capabilities it touches — `machine-play`,
      `toolchain-daemon`, `display-view`, `headless-cli` — have no `e2e/` folder,
      which the capability-layout test permits for capabilities with no browser
      surface. If any part of this change reaches the IDE after all, add the
      matching `npm run e2e:chromium -- e2e/<capability>` run here and leave it
      unchecked until it passes.
