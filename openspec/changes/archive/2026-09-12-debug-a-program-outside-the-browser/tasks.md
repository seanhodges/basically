## 1. The driver learns to stop

The interface every operation is written against, and the one implementation both
sessions build from.

- [x] 1.1 Add the members that express stopping to the driver over one machine:
      the lines to stop before, running on to the next BASIC line, running on to
      the next stop or the end, and saying where the program is and whether this
      machine can be stepped at all.
- [x] 1.2 Take the machine's stopping path as something the holder hands in,
      beside the frame advance it already hands in, so that whatever a holder
      folds into a frame is folded into a step. A holder whose machine has no
      stopping path hands none, and the driver reports the machine cannot be
      stepped.
- [x] 1.3 Keep the line the caller resumed from beside the driver and thread it
      through every slice, so continuing off a line that is itself a stop does
      not stop again at once.
- [x] 1.4 Bound stepping and continuing with the frames bound the driver's waits
      already use rather than a new number, and report exhausting it as an
      ordinary outcome.
- [x] 1.5 Report what each step and each continue cost in the machine's own
      emulated time.
- [x] 1.6 Colocated tests against real ROMs: a program stops before a line it was
      told to stop on; stepping reaches the next line and not partway through a
      line the program dwells on; continuing off a line that is itself a stop
      runs on; a program that will not finish exhausts the bound and says so;
      stepping off the end of a program says the program ended; and a machine
      with no stopping path says it cannot be stepped.

## 2. The held machine remembers where it is stopping

- [x] 2.1 Hold the lines to stop before beside the machine the host holds for a
      caller, so they survive between requests as the machine does, and are that
      caller's alone.
- [x] 2.2 Take the stopping path in the runner that holds a machine for every
      caller, in place of the bare frame advance, only where a line has been
      named or a step asked for — so a machine nobody has asked to stop keeps
      exactly the path it takes today.
- [x] 2.3 Carry the requests across to a machine held in a worker and the answers
      back, on the arrangement that already carries a key toward one.
- [x] 2.4 Colocated tests: the lines in force survive between requests; two
      callers' machines stop independently; a machine nobody asked to stop
      advances as it does today; and a machine in a worker answers the same as
      one in this thread.

## 3. A run can be told where to stop

- [x] 3.1 Accept the lines to stop before as part of what a run is asked for, and
      have the run take the stopping path when any is named.
- [x] 3.2 Report a run that stopped distinguishably from one that ended and one
      that used up its frames, naming the line it stopped before, and leave the
      machine there.
- [x] 3.3 Refuse a run told where to stop on a machine whose ROM is absent, as
      the caller's mistake, with the remedy the schedule's refusal already names.
- [x] 3.4 Colocated tests: a run stops before the line it was told to; a run
      whose stop is never reached ends as it would have with none asked for; the
      three ways a run can finish are told apart without reading prose; and a
      romless machine refuses before anything is run.

## 4. The four operations

- [x] 4.1 Declare naming the lines to stop before, stepping, continuing and
      asking where — one operation each, each with what it needs, what it answers
      and what it does to a machine being played.
- [x] 4.2 Declare each one's absence from the assistant with its own reason,
      about the IDE around that caller rather than about the operation, so the
      parity check reads each as a decision rather than a gap.
- [x] 4.3 Route all four to the command line and to an agent, and check the
      parity test passes with the declared exemptions in both directions.
- [x] 4.4 Colocated tests: each operation answers a caller holding no machine by
      saying how to get one; each outcome survives being written as JSON and read
      back; and the parity check holds.

## 5. Whether a machine can be stepped

- [x] 5.1 Report whether a machine can be stepped where a machine is described,
      read from what that machine declares rather than from a list beside it.
- [x] 5.2 Answer a caller that asks a machine which cannot be stepped to stop,
      step or continue by saying so and naming what it can still do.
- [x] 5.3 Colocated tests: every registered machine's description agrees with
      whether it implements a stopping path; and asking one that does not to stop
      is answered rather than failing.

## 6. Playing and debugging stay opposites

- [x] 6.1 Refuse naming the lines to stop before, stepping and continuing while a
      play channel is open, naming the reason and how to stop, on the terms the
      measuring operations already use. Answer asking where.
- [x] 6.2 Colocated tests: each of the three is refused with the remedy while a
      machine is played; asking where is answered; and all three are answered
      again the moment the channel ends.

## 7. The command line

- [x] 7.1 Accept the four operations in the argument parser, and the lines to stop
      before as an option on a run, rejecting the malformed forms the neighbouring
      operations reject.
- [x] 7.2 Render each outcome as columns and prose the way the held-machine
      operations beside them are rendered, and add each one's usage text.
- [x] 7.3 Colocated tests: the grammar accepts each operation and the run option;
      a malformed list of lines is the caller's mistake; and the usage text names
      the operations and the option.

## 8. Documentation

- [x] 8.1 Document debugging a program outside the browser, beside the pages for
      watching and playing one: how a run is told where to stop, what stepping
      and continuing answer, and that a machine which cannot say which line it is
      executing cannot be stepped.
- [x] 8.2 Say in the page for an embedding application that these operations are
      among the ones it reaches, since an editor is the caller this is most for.
- [x] 8.3 Update `docs/contributing/architecture.md` where its shape changed: the
      members the driver gained, the state the held machine gained, and the
      direction the worker boundary gained an answer on.

## 9. Quality gates

- [x] 9.1 `npm run typecheck`
- [x] 9.2 `npx vitest run src/app/ src/ops/ src/mcp/ src/server/ src/cli/
      src/dialects/` — the folders this change touches, including the
      registry-driven suites that hold every machine to what it declares. The
      full suite is CI's job.
- [x] 9.3 `npm run lint`
- [x] 9.4 `npm run format:check` (or `npm run format` to fix)
- [x] 9.5 `npm run docs:build`, required because group 8 changes `docs/`.
- [x] 9.6 `npm run e2e:chromium -- e2e/program-execution` — not because this
      change adds anything to the IDE, but because it changes the driver and the
      session the IDE's own debugger shares, and that folder is where the
      browser's breakpoint, step and continue coverage lives. Leave unchecked
      until it passes; a failure here is this change having reached the IDE after
      all.
