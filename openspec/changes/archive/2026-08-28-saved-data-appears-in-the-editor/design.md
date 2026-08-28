## Context

The IDE hands every machine a synchronous file store at construction, and six
machines write into it from their file-I/O traps. The store is authoritative in
memory — traps fire between CPU instructions and cannot await — with a
fire-and-forget mirror into IndexedDB so the inspector dialog can watch it
reactively.

Two facts about that store shape this design. It is cleared on emulator start
*and stop*, which is why a program's output does not survive the machine being
turned off. And it is already the single place every machine's file writes
converge, so nothing here needs a second copy of those bytes — only a way to see
them.

Separately, a block's `kind` is `'code' | 'data'`, where `'data'` means bytes at
an address that are not code. Files need a name in that vocabulary, and taking
`'data'` for them without renaming would leave one word meaning two things.

See `docs/contributing/architecture.md` for how the store, the block model and
the editor panes fit together.

## Goals / Non-Goals

**Goals:**

- A file a program saves is visible in the editor as it is written, and is still
  there after the machine stops.
- The bytes shown are the file, not the machine's container around it.
- The file can be taken out of the IDE, as bytes or as text.
- `kind` names three distinct things unambiguously, and no existing saved
  document changes meaning.
- Running a program continues to leave the document untouched.

**Non-Goals:**

- Returning a file to a later run, and the editability that would justify. A
  separate proposal.
- The `wrap` direction of the container seam.
- Whole-program `SAVE`, and the machines that do not trap file I/O at all.

## Decisions

### A data file is a projection of the file store, not a second collection

The obvious shape is to copy each saved file into the app store as it arrives —
subscribe to the file store, diff, and mirror. That is what an earlier draft did,
and it carries an adoption diff, a coalescing buffer, and every way two copies of
the same bytes can drift apart.

It is unnecessary once the file store's lifetime is made to match what the
feature needs. The store is already authoritative, already keyed by the file's
own name, already notifies on change. So a data file is a memoized projection of
a store snapshot — name, unwrapped payload, kind — read through
`useSyncExternalStore` over the notification the store already publishes.
Discarding a file is a delete against the store. There is one copy of the bytes
and no synchronisation to get wrong.

This follows the listing-block projection, which already derives a block list
from other state and memoizes it rather than mirroring it into the store.

*Alternative considered:* mirroring into the Zustand store, so data files sit
beside blocks and scratch buffers as ordinary state. Rejected: it duplicates the
bytes, and every consumer would then have to care which copy is current.

### The lifetime change is a deletion

The file store's clear points already implement the wanted rule everywhere but
one: cleared on run start, reset, machine change and unmount, kept across a
breakpoint pause. Only the clear at stop is wrong, because it is what destroys a
program's output the moment the user stops to look at it.

So the whole lifetime change is removing that one call. Nothing reads the store
between a stop and the next start — the machine is disposed at stop, and the next
start clears it — so extending its life past the stop is safe, and the "a run
starts clean" guarantee is untouched.

*Consequence to verify rather than assume:* the paths that replace the document
(new, open, sample, import, share boot) may only reach a clear today because a
machine happened to be running. Now that files outlive the machine, each of those
paths must be checked to actually clear, not presumed to.

*Alternative considered:* giving data files their own lifetime, longer than the
store's — kept across a restart, say, so a run could be compared with the last.
Rejected: two lifetimes over one set of bytes is what forces a mirrored
collection, and comparing runs is not something anyone has asked for.

### The kinds are a discriminated union, not an optional address

`kind` becomes `'code' | 'memory' | 'data'`. The temptation is one interface with
`address?: number`, but then every consumer of an address — the block linter, the
memory map, the run path's RAM injection, the export builders — has to defend
against an address that is never absent for anything they are given.

Instead the address lives on the arms that have one:

```
Block      = CodeBlock | MemoryBlock     // persisted; both carry an address
DataBlock                                 // session-scoped; no address
```

`MemoryBlock` keeps its existing name for precisely the thing it now denotes, so
most references simply become `Block`. Passing a data file anywhere an address is
required is a compile error rather than a runtime surprise, which is the property
worth having in a strict-TypeScript codebase.

*Alternative considered:* leaving `kind` alone and naming the new thing something
other than a block. Rejected — the user-facing vocabulary is what needed fixing,
and a second parallel noun for "named bytes in a tab" is the confusion, not the
cure.

### Old documents are read, not migrated

A `kind: 'data'` block in an existing autosave, project or share link means a
block of memory. Because data files are never serialized, a persisted `'data'`
is unambiguously legacy, so reading it as `'memory'` needs no version bump, no
rewrite of stored data, and no user action. The mapping goes in the three read
paths — project parse, autosave load, share decode — and nothing writes `'data'`
again.

*Alternative considered:* bumping the project format version. Rejected as
ceremony: a version bump earns its keep when old and new readers must
disagree, and here they cannot, because the ambiguous value can only ever have
had one meaning.

### The container seam is one optional dialect member, unwrap only

Most machines store the file's own bytes: the BBCs, the Atom, the C64 and the
TRS-80 all write raw payloads. The Spectrums do not — the tape deck stores a
whole two-block tape image, a header ahead of the data — so showing the stored
bytes directly would open a user's high-score table on tape framing.

This is machine-specific knowledge, so it belongs on the `Dialect` seam and
nowhere else: an optional member declaring how this machine's stored file splits
into payload and container. Absent means the stored bytes are the payload, which
is the honest default and correct for every machine but two. The `wrap` direction
is deliberately not part of it, because nothing in this change puts bytes back.

**Impact on the Dialect / MachineEmulator seam:** one optional `Dialect` member
added; `MachineEmulator` is untouched, and no machine's code changes. A dialect
that does not declare it behaves exactly as it does today. This keeps the rule
that machine-specific knowledge never leaks into the app: the projection asks the
dialect, it does not special-case the Spectrums.

### Read-only follows from the scope, it is not a separate choice

A data file is neither persisted nor returned to the machine, so an edit to one
would change nothing that outlives the tab. Shipping an editable view would be
offering a control that does not do anything. So the byte view is read-only,
unconditionally — not read-only-while-running — and becomes editable in the
change that gives those bytes a destination. That also removes the two-writer
question (the program writing a file the user is editing), the per-file undo
history, and the buffer-history key from this change entirely.

### The tab strip is bounded

A program in a loop can write arbitrarily many files, and each one appearing as a
peer of the BASIC tab would push the program's own tabs off the strip. The strip
shows a bounded number; the existing Emulator files dialog becomes where the rest
are reached, rather than remaining a second list of the same thing shown
elsewhere.

## Risks / Trade-offs

- **A document-replacing path does not actually clear the store** → files from
  the previous program would be shown against the new one. Each path gets an
  explicit test rather than being assumed to inherit the clear from a running
  machine.
- **Pressing Run discards the previous run's output without asking** → this is
  the specified behaviour, and the likeliest way a user loses something they
  wanted. Mitigated by the download being one action away in the tab itself, and
  by the data being reproducible by running again. Deliberately not guarded by a
  confirmation: the alternative is a prompt on every Run.
- **A program writing per-frame re-renders per notification** → the projection's
  snapshot is throttled, so the tab shows the file settling rather than every
  intermediate write.
- **The raw container is no longer downloadable on the Spectrums** → today's
  inspector hands back the stored tape image, which other emulators can load; a
  payload-only download loses that. Weighed against showing users tape headers
  they did not ask for. If it turns out to matter, a third "as saved" download is
  additive.
- **The kind rename touches many files** → it is mechanical and behaviour-free
  apart from one dialog's labels, so it lands as its own first commit, ahead of
  anything that could be confused with it.
- **A pending change uses the old vocabulary** → `edit-block-bytes` is
  implemented but not archived, and its requirement text says "a data block"
  where it now means a memory block. Archiving it before this change's specs are
  synced keeps the baseline consistent; this is a sequencing task, not a code
  dependency.

## Migration Plan

No user action, no data rewrite, no version bump. Existing autosaves, projects
and share links are read under the new vocabulary: a stored `'data'` block is a
memory block. Nothing writes that value again, so the ambiguity ends with the
documents that already exist.

Rollback is reverting the change: documents written by it hold only `'code'` and
`'memory'`, and a reverted build reading `'memory'` is the one case that would
need care — so `'memory'` should be accepted-and-ignored rather than rejected if
a revert is a live concern. In practice the exposure is one release.

## Open Questions

- Should the unsaved-changes warning cover data files, as it covers scratch
  buffers? Recommended no — they are program output, reproducible by re-running —
  but it is a deliberate choice, and Run discarding them is the sharper case.
- Should a "download as saved" option keep the raw container available on the
  Spectrums, or is the payload enough?
