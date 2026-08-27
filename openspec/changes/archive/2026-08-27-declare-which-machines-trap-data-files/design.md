## Context

The store itself is settled and unchanged by this work: one `MachineFileStore`
handed to every machine at construction, one `EmulatorVfs` behind it, lifetime
owned by `EmulatorPane`. See `docs/contributing/architecture.md` for the seam and
the data flow around it.

What is missing is one fact: *which machines actually route that store into their
emulation*. Seven do. Four take the constructor option and never read it. Five are
never offered it, one of which records the bytes anyway and shows nobody.

Two properties of the seam make this fact impossible to derive rather than merely
undeclared, and they shape every decision below:

- `files` is a **constructor argument**. Nothing on the returned `MachineEmulator`
  says whether it was retained, so there is no member to probe the way
  `debugCapability.test.ts` probes `debugStep`.
- The machine constructors **do** use their `opts` object (for `roms`), so
  `noUnusedParameters` never fires on the field beside it. The compiler cannot see
  the drop by construction.

Which leaves declaring it and checking the declaration against behaviour.

## Goals / Non-Goals

**Goals:**

- One place that says, per machine, whether a running program's files are
  captured — readable by the app, not only by a test.
- A check that a claim is true, and that the set of non-claimants is exactly what
  someone wrote down and justified.
- An empty file list that distinguishes "nothing saved yet" from "this machine
  never could".
- An exemption table that reads as a to-do list for the four accept-and-drop
  machines, not as a settled hardware limitation.

**Non-Goals:**

- Wiring the CPCs, the PET, the VIC-20 or the PMD 85. Each is separate work,
  landing as one entry leaving the exemption table.
- Any change to `MachineEmulator`, to `createEmulator`'s `files` option, to the
  store, or to its lifetime.
- Whole-program `SAVE`/`LOAD`. The BBCs' untrapped `OSFILE`/`OSGBPB` and the
  Spectrums' deliberate pass-through of type-0 program saves stay out of scope and
  out of the flag's meaning.

## Decisions

### Seam impact: one optional field on `Dialect`, nothing on `MachineEmulator`

`Dialect` gains a single optional boolean. `MachineEmulator` is untouched, as is
`createEmulator`'s signature. The capability is a property of how a dialect wired
its machine, not a runtime service the app calls, so there is nothing for the app
to invoke and no reason to add a member that exists only to be probed.

This is the `debuggable` shape (`Dialect.debuggable` declared by hand, the
machine asked whether it agrees), with one difference recorded below: agreement
here is established behaviourally rather than with `typeof`.

### The flag is named for what it does, not how

**`capturesDataFiles?: boolean`.**

The working name through exploration was `trapsDataFiles`, and it is wrong for the
seam: the TRS-80 traps nothing. Its default backend interprets BASIC statements
and services `OPEN`/`PRINT#`/`INPUT#` directly, so a name built on "trap" would
describe six machines and mis-describe the seventh. "Captures" is what the
`persistence` requirement already says and is true of every claimant regardless of
mechanism — ROM trap, filing-system vector, KERNAL jump table or interpreter
statement.

`supportsDataFiles` was the other candidate; rejected because every dialect's
BASIC *supports* file statements in its keyword table — the CPC advertises
`OPENIN` and `OPENOUT` today — and the flag is about whether the emulation
services them, not whether the language has them.

Declared as `?: boolean` rather than `?: true`, matching `debuggable`, so a
dialect can state the negative explicitly where that reads better than omission.

### Claimants are checked behaviourally; non-claimants structurally

A claimant is booted on its real ROM and made to run a BASIC program that writes a
file and reads it back, asserting both that the store received the bytes and that
the program got them back. This is the `memoryActivity.test.ts` argument applied
one seam over — that file's own comment is the precedent: *"Behavioural rather
than a `typeof` check, deliberately. The hooks are three lines each and easy to
write in a way that compiles and records nothing."* Accept-and-drop is exactly
that failure mode.

A non-claimant gets a named entry in an exemption table and the exact-set guard,
and **is not run**. Two reasons, and the first is the more interesting:

1. Running the file statement is what the machine cannot do. On the PET and the
   VIC-20 the KERNAL waits on serial/IEEE handshake lines that idle high with no
   device modelled; on the CPCs `OPENOUT` reaches a cassette manager with no tape
   layer behind it. The program does not error, it sits there — so the assertion
   would burn the whole frame budget per machine to discover what the table
   already says. The hang *is* the finding, and it belongs in the exemption's
   reason text rather than in a timeout.
2. Even without the hang, "the store was not touched" only restates the
   declaration. It proves nothing the guard does not.

Alternative considered: run the non-claimants for a fixed short budget and assert
the store stayed empty, the way `memoryActivity`'s excused branch runs ten frames
and asserts no taps. Rejected — that branch works because ten frames of *ordinary
startup* already exercises the bus, whereas nothing in a machine's boot touches
the file store. It would be ten frames of proving nothing.

**What this costs, stated plainly:** the battery cannot distinguish "has no traps"
from "has traps that are broken" for a non-claimant. That gap is closed at the
transition rather than in the steady state — a machine gaining traps must set the
flag to leave the exemption table, and setting the flag moves it into the
behavioural branch. A machine cannot acquire working traps without being tested,
and cannot lose them without failing.

### The flag gets a consumer now, not only when the tabs land

A declared capability whose only reader is its own test is an exemption table with
extra ceremony. `VfsInspectorDialog` is the consumer available today: it reads the
active dialect straight off the store (`useIdeStore((s) => s.dialect)`, the
narrow-selector convention) and, for a machine without the flag, replaces the
empty-state copy — currently *"No files. Files appear here when the running
program saves data."* — with a statement that this machine does not capture the
files a program saves.

That is what makes this a behaviour change with a spec delta rather than internal
bookkeeping, and it is the same "explicable rather than silently empty" argument
`memoryActivity.test.ts` makes for the memory overlay.

### The spec delta ADDS rather than MODIFIES

`saved-data-appears-in-the-editor` already carries a `MODIFIED` delta on
*Programs can save and load their own files*, rewriting its lifetime and adding
the editor-tab presentation. Editing the same requirement here would collide at
sync time and force one change to carry the other's wording.

The new guarantee is separable in any case: the existing requirement governs
machines that do intercept, and says nothing about the ones that cannot. So this
change adds a requirement covering exactly that case, and the two compose in
either landing order.

**Ordering:** land this change's flag first regardless, so the data-tab strip has
something to read when it needs to know which machines can ever populate one.

### Probe programs live in a table keyed by language family

New `src/dialects/fileIoProbes.ts`, the shape of `operatorProbes.ts` and
`loopSpeedProbes.ts`: a program per family that writes a file, reads it back, and
prints a sentinel the test polls the screen for. A machine needing its own
spelling gets its own entry rather than a special case in the test.

Five families cover the seven claimants: Sinclair (`SAVE … DATA`, both
Spectrums), BBC (`OPENOUT`/`BPUT#`/`OPENIN`/`BGET#`, both Acorns), Atom
(`FOUT`/`BPUT`/`FIN`/`BGET` — near the BBC's but not the same calls), CBM BASIC
V2 (`OPEN`/`PRINT#`/`INPUT#` on device 8), TRS-80 Level II.

**None of these programs need inventing.** Each machine's own test already runs
one: `c64Machine.test.ts`, `bbcMachine.test.ts`, `atomMachine.test.ts`,
`spectrumMachine.test.ts` and `seqfiles.test.ts` all write a file and read it
back today. The probe table lifts programs that are already known to work on the
real ROMs; the per-machine tests stay where they are, keeping their own
machine-specific assertions.

### The boot harness gains an option, breaking nothing

`bootMachine` builds machines with `{ rom, ramKb }` only, so every boot test in
the suite — fourteen files — exercises the no-store branch, and no
registry-driven test can reach file I/O at all. It gains an optional `files`
passed through to `createEmulator`. Additive; no existing caller changes.

## Risks / Trade-offs

- **The suite gets slower.** → The battery is the boot-and-run-BASIC shape, which
  costs `loopSpeed.test.ts` ~36s across every registered machine. Only the seven
  claimants boot here and the non-claimants cost nothing, so expect appreciably
  less. Per-case timeouts follow the house budget for boot-heavy registry loops
  rather than the 30s global default.

- **A brittle probe fails for the wrong reason** — a machine's file statements
  work but the program never prints its sentinel. → The programs are lifted from
  tests that already pass on the real ROMs, and every failure message carries the
  screen text, per the `operatorBattery` convention, so a wrong-reason failure is
  legible rather than mysterious.

- **The flag drifts from reality on a new dialect.** → It cannot silently: a new
  dialect is either a claimant, and gets booted and run, or it is a non-claimant
  and the exact-set guard fails until someone writes down why. That is the whole
  point of the guard.

- **The exemption reasons decay into folklore.** → The four accept-and-drop
  machines get the drop named as the reason, not a hardware excuse, precisely so
  the entry reads as outstanding work. A reason that says "the store is accepted
  and dropped" invites the fix; one that says "no disk hardware" closes the
  question falsely.

- **Two changes touch `VfsInspectorDialog`.** → `saved-data-appears-in-the-editor`
  demotes it to an overflow surface but does not delete it, and this change edits
  only its empty state. Landing this first leaves that change a smaller merge and
  a flag it can read.

## Open Questions

- Does the empty-state wording name the machine ("The ZX81 does not capture…") or
  stay generic? Naming it is friendlier and the dialect is already in hand;
  settle at implementation against the copy in the surrounding dialog.
- Whether `zx81` and `zx80` read better as one exemption reason or two. They
  differ: the ZX81's SAVE trap deliberately elides the ROM's tape-output loop so
  no bytes are ever produced, while the ZX80 is simply never offered the store.
  Two entries, probably — the distinction is the kind the table exists to hold.
