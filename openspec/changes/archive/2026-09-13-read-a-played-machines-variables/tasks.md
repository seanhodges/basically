## 1. Move variables across the line

- [x] 1.1 In `src/ops/measure.ts`, change `variablesOp.played` from `'refuse'` to
      `'answer'`, and replace the comment above it with one saying that variables
      are read out of the machine without spending a frame, the way the screen
      is, and that the caller has caught a moment.
- [x] 1.2 Leave `profileOp.played` and `timeOp.played` refused, and say in each
      comment what makes them measurements: their figures are denominated in
      frames whoever is playing is spending.

## 2. Say what is still readable

- [x] 2.1 In `src/ops/play.ts`, extend the sentence in `beingPlayed()` that names
      what is answered while playing so it names the variables alongside the
      screen reads.
- [x] 2.2 Check `playOp.description` for the same claim and keep the two saying
      the same thing.

## 3. Hold it to the new line

- [x] 3.1 In `src/ops/play.test.ts`, remove `'variables'` from the refused
      operations in "refuses a measurement, naming the reason and how to stop",
      leaving `profile`, `time` and `drive`.
- [x] 3.2 Extend "answers a read, and two of them may differ without that being a
      fault" to cover `variables`: give the moving stub session a `variables()`
      that changes between reads, and assert two reads are both answered and
      differ.
- [x] 3.3 Add a case for a played machine that cannot report its variables: the
      answer says so rather than being refused for the machine being played.
- [x] 3.4 Confirm the existing "has every operation on the held machine say which
      it is" test still passes unchanged — nothing here adds an operation.

## 4. Say it where playing is documented

- [x] 4.1 In `docs/reference/playing-the-machine.md`, update the refusal sample
      output to match the new `beingPlayed()` wording, drop `variables` from the
      list of what is refused, and name it under "Reading still works".
- [x] 4.2 Check `docs/reference/watching-the-machine.md`,
      `docs/reference/debugging-a-program.md` and `docs/reference/mcp-server.md`
      for the same claim and correct any copy of it.
- [x] 4.3 Check `docs/reference/embedding-the-toolchain.md` for a statement about
      what an embedder can ask of a played machine, and extend it if present.

## 5. Gates

- [x] 5.1 `npx vitest run src/ops/` — the operations suite, where the moved test
      lives.
- [x] 5.2 `npm run typecheck && npm run lint && npm run format:check`.
- [x] 5.3 `npm run docs:build`, because `docs/` changed.
- [x] 5.4 By hand, which is what actually proves it: hold a machine, open a play
      channel, read the variables twice while a program runs and see both
      answered and differing, and see `profile` still refused naming the remedy.
- [x] 5.5 No e2e folder applies. This changes no app-visible behaviour — the IDE
      reads its emulator directly and is not a caller of this operation.
