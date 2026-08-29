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

That promotes a detail that did not matter while the mirror was write-only: the
database is one per origin and shared by every browser tab, while the document,
the autosave and the chosen machine are all per tab by design (see the session
slot with a localStorage backup in `src/storage/settings.ts`). Durable files
have to be per tab too, or a second tab would show and overwrite the first's.

**Seam impact: none.** `MachineFileStore` on the `Dialect` /`MachineEmulator`
seam is unchanged, and no dialect or emulator code is touched. The machines that
read files back already do so through the store; making the store non-empty at
start is the whole of the feature on the machine side.

## Goals / Non-Goals

**Goals:**

- A start serves the program the files its machine already has.
- Files last across runs, resets, pane unmounts and browser reloads.
- A machine is never served or shown another machine's files, and a browser tab
  is never served, shown, or robbed of files by another tab.
- What the IDE mounts for the program to load is never kept, on any path.
- Discarding a file is deliberate and permanent.

**Non-Goals:**

- Per-document scoping and any quota policy — see the proposal's Non-goals. The
  reclaim of a closed tab's rows below is housekeeping for keys nothing can
  reach again, not an eviction policy for files a tab still holds.
- Sharing files between tabs, adopting a closed tab's files into a new one, or
  any other coordination between tabs. Isolation is the whole of it.
- Persisting what the IDE mounts. The mounted mark does not go in the schema:
  mounted content is the document going to the machine afresh on every run, so
  the right answer is not to store it at all.
- Carrying old rows forward. The version 0 rows predate every guarantee this
  change makes and are dropped by the migration.

## Decisions

### The store gains `hydrate`, and the mirror becomes a source

`hydrate(dialectId)` reads the rows for this tab and that machine and merges
them into the in-memory map, **keeping the in-memory entry wherever a name collides** — memory
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

### A row belongs to a tab, so the file's name is no longer its key

Each row carries the id of the browser tab that wrote it, and restore, purge and
delete all filter on it. Two tabs can save `SCORES`, so the name alone can no
longer be the primary key: the collection takes a **composite primary key** over
the tab id and the name (RxDB builds the stored key by joining the fields with a
separator, and requires both to be required and final). Tab ids are generated,
so they never contain the separator and the join is unambiguous.

The tab's id lives in its own `sessionStorage`, generated on first read, beside
the per-tab settings that are already kept that way. That is what makes the
reload guarantee work and stop where it should: `sessionStorage` survives a
reload of the tab, so the files come back; a brand-new tab gets a new id and
starts empty, which is the isolation being asked for.

It deliberately does **not** use `readSessionFirst`/`writeThrough`, the
localStorage-backed pattern the dialect and autosave keys use. That backup
exists to seed a new tab from the last edited program; applied to identity it
would hand every new tab the previous tab's id and undo the whole change. The id
is session-only, and a browser with storage blocked (the in-memory stand-in in
`src/storage/safeStorage.ts`) therefore gets a fresh id per load: no durability
there, which is the degradation that module already promises.

### Reclaiming what a closed tab left

Rows keyed to a tab that no longer exists are unreachable for ever, so something
has to reclaim them. A shared registry in localStorage — tab id to a last-seen
timestamp, refreshed by each tab at boot and while it writes — is enough: at
boot, a tab drops registry entries older than a cutoff and purges the rows of
tab ids the registry no longer vouches for. Nothing needs to run at unload,
which is the event browsers do not reliably deliver.

Alternatives considered: reclaiming at unload (unreliable); ageing rows by their
own `updatedAt` (wrong — a tab left open for weeks would have its files swept
out from under it); `navigator.locks` for true liveness (async, and more
machinery than a timestamp for the same answer).

### The schema version, and rows that cannot be read

The new field and the new primary key change RxDB's schema hash, so the
collection goes to version 1 with a migration strategy, and the
`migration-schema` plugin is imported dynamically beside the storage and
dev-mode ones. RxDB's own version bump is what makes this safe: an existing
database is opened and migrated in place. Nothing is removed and recreated
behind the user's back.

The strategy **drops every version 0 row** by returning null. Those rows carry
no tab and cannot be attributed to one; they were written under a regime where
the IDE purged the collection on every start, so none of them was ever meant to
outlive a run; and among them are the mounted files the old code mirrored, which
must never come back as program output. Returning null also means no version 0
row is ever written under the new primary key — RxDB drops the row before the
write — so the key change costs no special handling.

Alongside it, at row granularity, the same rule: **a row the store cannot read
back is deleted where it is found.** No tab id, bytes that will not decode, a
missing field — the restore removes it rather than skipping it or half-applying
it. The in-memory map is the authority and the mirror is only useful while it
can answer with a file, so a row that cannot is worth less than the space it
occupies, and leaving it would mean meeting it again on every restore.

`multiInstance` stays off. It was questionable while tabs wrote the same rows;
with the row sets disjoint by construction, and the only cross-tab writes being
the reclaim of rows whose tab the registry says is gone, it is honest.

### Per-machine and per-tab means the purge is scoped too

`clear()` purges the whole collection today, which would make a filter on
restore worthless — switching away from a machine and back would find nothing —
and would now also let one tab wipe every other tab's rows. The purge is scoped
to the store's current tab and machine instead, so discarding the files of the
program or machine being left never reaches beyond them.

That needs the store to know its machine at all times. Today `dialectId` has
exactly one writer — `clear(nextDialectId)` — and the run effect's clear is what
re-tags it on every run. With that clear gone, a fresh page load would never tag
the store, and every mirrored save would be written under an empty machine id
and be invisible to a filtered restore for ever. The store gets an explicit
`setDialect(id)`, called from boot, from restore and from the store's machine
actions, so tagging never depends on a restore having completed. The tab id is
read once when the store is created; unlike the machine, it never changes.

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

- **A tab's files go when the tab does.** Closing a tab abandons what its
  programs wrote; a new tab starts empty and cannot reach them, and the reclaim
  sweep eventually deletes them. This is the cost of the isolation, not a bug —
  but it makes the download the user's only way to keep a file for good, which
  the documentation must say plainly.
- **Duplicating a tab copies its `sessionStorage`** in the browsers that offer
  it, so the copy starts life sharing an id, and the two tabs then share files
  as every tab does today. Bounded and rare; the copy's document is a duplicate
  too, so the shared files are at least the right program's.
- **A tab whose storage is blocked gets a new id per load** and so keeps nothing
  across a reload. Consistent with what `safeStorage` already promises, and the
  files still work for the session.
- **The reclaim sweep deletes rows another tab still wants** if that tab has not
  refreshed the registry within the cutoff → the refresh runs at boot and while
  the tab writes, and the cutoff is generous (days, not hours), so a tab has to
  be gone, not merely idle, to be reclaimed.
- **Existing users carry rows written under the old regime**, including mounted
  ones, which a restore would present as program output → the migration drops
  every version 0 row. Under the old rules those rows were purged on the next
  start anyway, so nothing a user could see is lost.
- **A row that cannot be read back** — a partial write, a decode failure, a row
  with no tab — → deleted where it is found, so a single bad row can never
  poison a restore or come back on the next one.
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

- Nothing to deploy but the code. The collection goes to version 1 and RxDB
  migrates the existing database in place on first open, dropping the version 0
  rows; no database is removed.
- Rollback is a revert, and needs no cleanup: the reverted code declares version
  0 against a version 1 database and cannot open the collection, which is a case
  it already handles — every use of the mirror there is best-effort and nothing
  reads it, so the IDE goes back to files that last exactly one run.

## Open Questions

None outstanding. The lifetime rules (survives a reload; reset keeps; machine
switch and a different program discard; per-machine scoping) were settled with
the user before this was written.
