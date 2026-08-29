## Context

The emulator virtual filesystem is the store a machine's file traps write into.
Its shape and the reason for it are in `docs/contributing/architecture.md`; what
matters here is that the in-memory map is authoritative because ROM traps fire
between CPU instructions and cannot await, and that every mutation is mirrored
fire-and-forget into RxDB/IndexedDB.

Today the mirror has no reader. Emptying the store is what the IDE does on an
emulator start, a reset, a pane unmount, a machine change, and every path that
replaces the open document; the mirror is purged along with it. This change
gives the mirror a reader — the store itself, at start and at boot — which turns
it from a debugging window into the thing that makes a program's data last.

**Seam impact: none.** `MachineFileStore` on the `Dialect` /`MachineEmulator`
seam is unchanged, and no dialect or emulator code is touched. The machines that
read files back already do so through the store; making the store non-empty at
start is the whole of the feature on the machine side.

## Goals / Non-Goals

**Goals:**

- A start serves the program the files its machine already has.
- Files last across runs, resets, pane unmounts and browser reloads.
- A machine is never served or shown another machine's files.
- What the IDE mounts for the program to load is never kept, on any path.
- Discarding a file is deliberate and permanent.

**Non-Goals:**

- Per-document scoping, cross-tab coordination, quota or eviction policy — see
  the proposal's Non-goals.
- Any change to the persisted schema. The `files` collection stays at version 0;
  a schema change alters RxDB's schema hash and would need a version bump, a
  migration strategy and the `migration-schema` plugin, which is not a price
  worth paying for a field whose only use would be to filter rows out.

## Decisions

### The store gains `hydrate`, and the mirror becomes a source

`hydrate(dialectId)` reads the rows for that machine and merges them into the
in-memory map, **keeping the in-memory entry wherever a name collides** — memory
is authoritative and is by definition the newer of the two — then notifies, so
the tabs appear. Rows are applied oldest-save-first: `list()` is documented as
oldest first, and both the tape deck and the tab strip lean on that order, which
a primary-key query would scramble.

Three properties it must have, each of them load-bearing:

- **Queued on the same chain as the mirror writes, not merely generation-
  checked.** `clear()` bumps the generation synchronously but only *queues* the
  purge. A hydrate issued after a clear captures the new generation, so a
  generation check alone passes, and a direct read could still see rows the
  queued purge has not deleted yet — resurrecting exactly the files the clear
  discarded. Hydrate therefore runs at the tail of the pending chain, and
  re-checks the generation before applying what it read.
- **It never rejects.** The run effect turns anything thrown into a machine
  error, so a blocked or failing IndexedDB (a private window, storage denied)
  would surface as a bogus emulator failure and abort the run. Hydrate warns and
  resolves, like the mirror writes already do.
- **It cannot hang a run.** RxDB is a lazily imported async chunk, so a first
  run would otherwise block on that download plus the database open. Hydrate
  races a short timeout; memory is authoritative, so a late restore just means
  the files appear a beat later, or on the next run.

Alternative considered: reading the mirror through an RxDB subscription and
letting the tabs render from it directly. Rejected — it makes the mirror a
second source of truth for the bytes the machine is running against, which is
the duplication `src/app/dataBlocks.ts` exists to avoid.

### Two restore points

1. **On start**, in place of the run effect's clear. It goes *before* the
   effect's existing `cancelled` / machine-identity guard, so that guard stays
   the last thing before `loadProgram` — the whole reason it is written where it
   is. Restoring before `loadProgram` also gives the right precedence: the
   document's mounted files land on top of the restored set and win.
2. **At IDE boot**, from a hook wired into `src/App.tsx` in the style of
   `useOpenShared`, so a reload puts the tabs back without the user pressing
   Run. Deferred to an idle callback for the same reason hydrate is raced
   against a timeout at start.

### Mounted files are actively unpersisted

The IDE mounts the document's own memory blocks and imported tape files for the
program to `LOAD`, marked `mounted` so they are not shown back as program
output. Today those saves **are** mirrored — only the flag is dropped from the
row — so a restore would bring them back unmarked and present the user's own
blocks as files their program wrote.

A mounted save therefore mirrors as a **row removal** for that name, not as a
no-op: skipping the write alone would leave a stale row from a previous run's
program under the same name, which the next restore would resurrect.

Second, with no clear on start, mounted entries would accumulate in memory
across runs — a renamed block leaves its old name mounted for ever, still served
by the deck. The run effect drops the mounted entries (memory only, no purge, no
generation bump) immediately before `loadProgram`, which re-mounts everything it
needs. The pair of rules is: mounted content is given afresh every run and never
persisted.

### Per-machine means the purge is per-machine too

`clear()` purges the whole collection today, which would make a machine filter
on restore worthless: switching away from a machine and back would find nothing.
The purge is scoped to the store's current machine instead, so discarding the
files of the program or machine being left never reaches into another machine's
rows.

That needs the store to know its machine at all times. Today `dialectId` has
exactly one writer — `clear(nextDialectId)` — and the run effect's clear is what
re-tags it on every run. With that clear gone, a fresh page load would never tag
the store, and every mirrored save would be written under an empty machine id
and be invisible to a filtered restore for ever. The store gets an explicit
`setDialect(id)`, called from boot, from restore and from the store's machine
actions, so tagging never depends on a restore having completed.

### The emulator lifecycle stops clearing

Every `clear()` leaves `EmulatorPane` — the run, reset, unmount and
machine/ROM-change effects. The invariant becomes: **the emulator lifecycle
never discards files; only the store's document-lifecycle actions do.** Those
stay as they are: the machine switch, the player boot, a named document load,
and a sample/new/import load.

One consequence to call out rather than let happen: dropping the pane's
machine/ROM effect also removes the only reaction to installing a custom ROM.
Files now survive a ROM swap, which is right — same machine, same program.

### The player keeps nothing

The player renders the same emulator pane and boots through the store, which
discards files. With durable data that means opening a share link in a second
tab would silently delete the IDE's saved files, and running someone else's
program would leave its files in the user's own store.

The player therefore puts the store in a memory-only mode — the mirror is a
no-op, the purge is skipped, restore resolves immediately — set in `src/main.tsx`
where the shell is already chosen, before any React render and so before any
machine can exist.

Alternative considered: injecting a throwaway store into the pane as a prop.
Rejected: the tab projection and the tab strip import the singleton directly, so
the injection would have to reach three more modules to buy the same isolation.

### Confirming a discard

The existing block-delete pattern, exactly: a pending name in the store, a
dialog rendered unconditionally from `App.tsx` that hides itself on a null, and
confirm/cancel actions. Two details the block dialog already gets right and this
one must copy — the request validates that the file still exists before opening
the dialog, and the pending name is nulled by every document-lifecycle action,
or a stale dialog would offer to delete a file that went with the previous
document. The tab switch back to the program moves out of the tab strip and into
the confirm action, so the deletion and the switch land in one commit.

The menu item stays "Delete", beside a block's; only the confirmation is new.

## Risks / Trade-offs

- **A database shared by every browser tab, while the document is per tab** →
  Two IDE tabs on the same machine will show each other's files and overwrite
  each other's rows. Accepted and documented (the note at the top of the
  database module is updated); the player's memory-only mode removes the worst
  case, which was a share link destroying the IDE's data. A real fix means a
  per-tab key on the row, which is a schema version and a migration.
- **Existing users carry rows written under the old regime**, including mounted
  ones, which the first restore after the upgrade would present as program
  output → the first boot of the new code purges the collection once and records
  that it has, so nobody inherits leftovers from a regime where they were never
  meant to outlive a run.
- **A first run now waits on the database** → raced against a short timeout, and
  the restore is idempotent, so a slow database costs a beat, not a run.
- **A machine's own behaviour changes without its code changing**: a Spectrum
  `LOAD ""` arms the trap when the store is non-empty, so a program that loads
  without having saved now finds leftovers where a first run used to find an
  empty deck; a TRS-80 `OPEN "I"` now succeeds against a previous run's file.
  This is the feature, not a regression — but it is the sharpest edge of it, and
  the user's way out is discarding the file.
- **Files grow without bound** → no eviction is proposed; payloads are tens of
  KB and the mirror already swallows write failures, so a full quota degrades to
  files that do not outlive the session rather than to a broken run.

## Migration Plan

- One-time purge on the first boot of the new code, recorded alongside the
  IDE's other browser settings, so pre-change rows never surface as tabs.
- No schema version change, so no RxDB migration strategy and no risk to opening
  an existing database.
- Rollback is a revert: the old code purges the collection on its next start
  anyway, so a reverted build cleans up after this one on its own.

## Open Questions

None outstanding. The lifetime rules (survives a reload; reset keeps; machine
switch and a different program discard; per-machine scoping) were settled with
the user before this was written.
