## Context

`docs/contributing/architecture.md` covers the `Dialect`/`MachineEmulator` seam
and the run loop; this design does not restate them.

`MachineEmulator.isProgramRunning(): boolean | null` already exists as an
optional member with a three-value answer — running, not running, and "not
answerable yet" for a machine still booting or still being handed the program.
Eight machines implement it. Three consumers read it, and they are already
chained: the run-outcome rules settle a frame, the stopwatch takes its ending
from those rules, and the run control asks whether the timing has settled. One
signal drives all three, so nothing between them needs building.

What is missing is the signal on five machines. The existing implementations all
poll a cell — the Commodore machines read the cursor-blink flag the ROM only
maintains at its prompt, the Acorn and Amstrad machines read the BASIC line
cell, the Altair reads its screen, and the TRS-80 interpreter reads its own state
machine. The five holdouts have no such cell, which is why they omit the member.

## Goals / Non-Goals

**Goals:**

- Every registered machine answers whether a BASIC program is executing.
- The answer is exact rather than heuristic: `false` means the ROM has stopped
  running the program, not that something on screen looks like a prompt.
- A machine sitting at an `INPUT` prompt reports that the program is running.
- The obligation is stated in the contract and enforced by one shared test.

**Non-Goals:**

- Line-level debugging, altering the program, or reporting why a program
  stopped — all as stated in the proposal.

## Decisions

### Observe the ROM stopping the program, rather than polling for a prompt

On the five holdouts, "a program is running" is not recorded anywhere. But
"the program has stopped" is an event: the ROM reaches its command loop, once,
and it only gets there by giving up on the program.

*Why not a system variable:* the sweep documented on the machines found none,
and re-running it confirms the finding. On the ZX81 the code path is identical
too — idling at the `K` cursor, waiting at an `INPUT` prompt, and sitting after
a report all execute exactly the same 126 ROM addresses, because in SLOW mode
every kind of waiting is the same display loop. The states differ in what is on
the stack, not in what executes.

*Why not the screen:* a machine waiting at an `INPUT` prompt is running a
program, and on the Sinclair machines its screen is a cursor indistinguishable
from the editor's. Any prompt-shaped or cursor-shaped test reports a program
waiting for input as finished, which is a false "finished" — the one error that
matters, because it stops the profiler, tells the assistant the program ended,
and flips the run control mid-run.

*Why not a sentinel line appended to the program:* it would change the program's
line numbering, size, memory figures and profile, and would not fire for `STOP`,
an error, a `GOTO` elsewhere, or the user's own interrupt key. Instrumentation
must not change what the program does.

### One ROM address per machine, latched, not polled

Each address is reached **exactly once** per termination, so the machine holds
the answer rather than recomputing it. The address is compared on the
instruction step the machine already runs, next to the tape traps the four Z80
machines already keep there; the Atom compares inside the `debugInstruction`
hook it already registers.

| Machine | Address | What the ROM is doing there |
| --- | --- | --- |
| ZX81 | `0x06AE` | The branch taken when `NXTLIN` has no next line, or `ERR_NR` holds a report — the ROM's own decision that the program is over. Falls through to printing the report and `JP $04C1` back to the editor. |
| ZX80 | `0x0488` | The BREAK-key test falling into a byte-identical report printer (`LD A,(ERR_NR)` / `LD BC,(PPC)` / `INC A` / `CP 9`). |
| ZX Spectrum 48K | `0x1303` | The main loop's `HALT`, reached only when the `CALL $1B8A` (LINE-RUN) above it returns — and for a typed `RUN`, that call returns when the program stops. |
| ZX Spectrum 128K | `0x032C` in ROM 0 | The editor ROM's own main-loop `HALT`, which the ROM re-enters at `0x0321` by resetting SP to RAMTOP before printing whatever report ERR_NR holds. |
| Acorn Atom | `0xC2CF` | `LDA #$3E` — the ROM loading `'>'`, its command prompt, at the head of the command loop. |

Every address was derived by booting the committed ROM and tracing it, never
from recollection, and each is pinned by the test that reproduces the trace.

### Arming differs per machine, because their load paths do

The latch is armed inside `loadProgram`, and *where* is a fact about each ROM
rather than a style choice:

- **ZX81 and ZX80** never reach their address during boot or load: their `LOAD`
  auto-runs the program through `NXTLIN` and never returns to the editor first.
  Arming anywhere in `loadProgram` is safe.
- **The Spectrum and the Atom** type their `RUN` at the command prompt, and every
  completed command line reaches the address once. The Spectrum's count of prior
  command lines even varies with the document — it types an extra `CLEAR` when
  the program has memory blocks below RAMTOP. So the latch is armed immediately
  after the `RUN` is submitted, and the next hit is the termination. Counting
  hits would break the moment a document gained a block.

Arming must happen *before* injection completes, not after `loadProgram`
returns: a short program starts and finishes inside the frames `loadProgram`
pumps, and a latch armed afterwards would miss its only signal and report "not
answerable" forever.

### The three states, per machine

`null` while booting or injecting, as today. `false` once the address has been
observed. `true` in between — but "in between" is reached differently:

- Machines with `currentLine()` promote to `true` when a BASIC line becomes
  determinable, so the seconds a machine spends being handed the program are not
  charged to it.
- **The Atom has no `currentLine()`**, so it reports `true` from arming until the
  address is seen. That can report `running` a fraction of a second early —
  between `RUN` being submitted and the ROM starting — which is the safe
  direction, because it can never produce a false `finished`.

This is also why run state is required while line-level debugging stays
optional: the Atom demonstrates a machine that can answer the first and not the
second.

### The latch describes the run the IDE started

A machine that polls a cell tracks the machine; a latch tracks the run. If the
user types `RUN` on the emulated keyboard after a program has ended, the polling
machines report `true` again and the latching machines do not.

*Why accept the difference:* every consumer asks about the run the IDE started —
the stopwatch times that run, the assistant checks that run, and the run control
offers to start that program again. Making the latch chase user-typed commands
would mean recognising a `RUN` typed on a key matrix, on four ROMs, to serve a
question nothing asks. The contract states which of the two a machine provides
so that the difference is deliberate rather than discovered.

### Required means required to answer, not merely to have the method

Dropping the `?` from the signature is not enough: `isProgramRunning() { return
null }` satisfies the type and leaves the run control stuck exactly as today. The
obligation is behavioural — a machine handed a program that terminates must
report `true` and then `false` within a bounded number of frames — and is
enforced by a single registry-driven test that boots every registered machine.

That test replaces five per-machine traces that already sample the same thing
frame by frame, following the pattern the palette matrix uses: one shared list,
one test, every machine.

## Risks / Trade-offs

- **The ZX Spectrum 128K needed its own address.** Tracing it (task 2.4) showed
  the expectation was wrong in one way and right in another: 128 BASIC runs the
  interpreter out of ROM 1 but returns to the editor in ROM 0, so `0x1303` is
  never reached on this machine at all, and the address above is ROM 0's
  equivalent. The paging concern was real — the same instruction address inside
  ROM 1 is executed a dozen times over during an ordinary running program, so an
  ungated compare reports a running program finished within a second or two. The
  compare is therefore qualified by the paged-in ROM, exactly as the tape traps
  beside it already are.
- **A crashed machine reports "running" forever.** If a program jumps into the
  weeds the ROM never returns to its command loop. That is honest — nothing
  finished — and matches today's behaviour; the assistant's run check already
  has an absolute frame cap for it.
- **The address is a fact about one ROM image.** A different ROM revision would
  need its own value. The images are committed under `public/roms/`, the traces
  are reproduced by the tests, and a mismatched image fails those tests rather
  than silently misreporting.
- **A latch is state.** It must be reset by `loadProgram` on every run, which the
  arming step does by construction, and it must not survive `dispose()`.

## Migration Plan

The seam change is breaking, so the five machines land before the member is made
required (task groups 2–3 before 4). The deletions in group 5 depend on every
machine answering, including the 128K, so they come last.

## Open Questions

None blocking. The 128K's paging check is a task rather than a question — the
approach is known, only its result is not.
