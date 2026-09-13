## 1. The tap beside the machine

- [ ] 1.1 Add an activity tap in `src/dialects/headless/`, beside `frameTap.ts`
      and shaped like it: a sink it asks whether anything is watching and
      whether the far end is free, a per-frame call, a settle, and an
      accumulated cost for the runner to subtract.
- [ ] 1.2 Arm and disarm the machine's memory-activity recording from whether
      the sink is watching, so a machine nobody is mapping records nothing, and
      re-arm when the machine being mapped is replaced by another.
- [ ] 1.3 Drain with the recycle buffer the seam already documents, so a mapped
      run does not allocate an address-space-sized buffer per sample.
- [ ] 1.4 Reduce a drain to the coarsest grouping the picture can distinguish,
      and state in the module why a skipped drain widens the next window rather
      than losing anything - the property that makes this tap simpler than the
      display's.
- [ ] 1.5 Colocated `activityTap.test.ts`: nothing recorded while unwatched;
      a skipped sample's addresses appear in the next one; the cost is
      accumulated; a machine that cannot tap its bus is reported as one.
- [ ] 1.6 Fold the tap into the single per-frame step every path already folds
      through, beside the display's sampling, and subtract its cost where the
      display's is subtracted. Settle it after each request, for the same reason
      the display settles.

## 2. Carrying it

- [ ] 2.1 An encoder modelled on the play channel's frame encoder: compress the
      reduced activity, and skip a payload identical to the one before it.
- [ ] 2.2 Extend the machine thread's vocabulary with the map's open, activity
      and free messages, including the runtime sets that tell a note from a
      reply, and the link that spans an in-process machine and a worker one.
- [ ] 2.3 Hold the tap off until the host says the last payload landed, so a
      machine advancing faster than the far end drops samples rather than
      queueing them - the discipline the display's frames already have.

## 3. The projection

- [ ] 3.1 A map channel beside `src/server/view/` and `src/server/play/`: the
      layout and bands sent once on arrival, activity thereafter, and the state
      the map is showing.
- [ ] 3.2 Carry it over the WebSocket the play channel already serves, rather
      than a second carriage.
- [ ] 3.3 Move the band-collapse transform out of the IDE's components to
      somewhere both the browser application and the host may import, and
      compute the bands beside the machine so the page receives them ready to
      draw. Keep its existing tests passing against the new home.
- [ ] 3.4 A standalone hand-written page, in the manner of the other two and
      saying so: nothing from the IDE, no build step of its own, never learns
      its own address, and states in its own words what its address admits.
- [ ] 3.5 Wire it into the projection host: its route, its own set of live
      addresses, the minting collision check, the teardown when the last
      projection ends, and the page import. Leave the view/play exclusion
      untouched - a map joins neither side of it.
- [ ] 3.6 Tests over the feed with nothing bound, in the manner of the view
      feed's: a watcher arriving mid-run is caught up; a payload is dropped
      rather than queued when a watcher is behind; the state is said when the
      machine is let go.
- [ ] 3.7 Host tests: reachable only from this computer, the address is the
      whole of admission, a retired address is answered as one that never
      existed, and nothing is bound until a projection is asked for.

## 4. The operation

- [ ] 4.1 Declare the operation: it needs a session, it is answered while the
      machine is played, and its outcome is an address, whether one was already
      open, and why there is none when there is none.
- [ ] 4.2 Add the projection to what an operation may be given, so a caller that
      cannot serve one carries none and is told so rather than failing.
- [ ] 4.3 Register it, and add the action that gives a map up while keeping the
      machine - through the host protocol, the listener, the client and the
      command line's `--stop`.
- [ ] 4.4 A written exemption for the one caller that deliberately lacks it, in
      its own words rather than borrowed from the view's, and the rows the
      surface-parity tables need.
- [ ] 4.5 Tests: a machine with no described layout is refused and says why; a
      caller that can project nothing is refused and says why; asking twice
      hands back the map already open; a map survives a view and a play channel
      opening and closing beside it.

## 5. Documentation

- [ ] 5.1 `docs/contributing/architecture.md`: the projections table becomes a
      table of three, with a sentence on the tap and on why the map stands
      outside the view/play exclusion. Change the row, not the prose around it.
- [ ] 5.2 The command-line reference for the new operation, and the page that
      covers watching a machine.

## 6. Quality gates

- [ ] 6.1 `npm run typecheck`
- [ ] 6.2 `npx vitest run src/ops/ src/server/ src/dialects/headless/ src/components/memoryActivity/ src/dialects/memoryActivity.test.ts src/components/memoryBands.test.ts`
- [ ] 6.3 `npm run lint`
- [ ] 6.4 `npm run format:check`
- [ ] 6.5 `npm run docs:build`
- [ ] 6.6 `npm run e2e:chromium -- e2e/memory-map`
