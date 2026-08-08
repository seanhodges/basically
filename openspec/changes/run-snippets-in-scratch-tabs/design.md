## Context

See `docs/contributing/architecture.md` for the dialect seam, the store's
command-bus conventions and the run data flow; this change alters none of them.

The constraint that shapes everything below is a property of the existing
editor component rather than a preference. `CodeMirrorHost` is a **singleton by
construction**: it writes editor focus, the current selection and the
find/replace panel's open state *into* the store, reads the Edit-menu command
channel, the jump-to-line channel, the breakpoint set and the paused debug line
*out* of it, and owns the callback ref through which the on-screen virtual
keyboard types. Mounting a second instance would give the Edit menu two
responders, have two components racing to mirror "the" selection, and leave the
virtual keyboard with no defined target on exactly the devices where it is the
only way to type.

## Goals / Non-Goals

**Goals**

- A place to write and run throwaway BASIC that cannot damage the document.
- Several such places at once, cheap to make and cheap to discard.
- Snippets that are debuggable, because a snippet that misbehaves is the reason
  you wrote it.
- No new persistence surface, and no new way for the document to be lost.

**Non-Goals**

- The immediate window, and any change to what a debugger pause *is* (see the
  proposal's non-goals).
- Preserving per-buffer undo history across a tab switch.

## Decisions

### One editor, many buffers

**Decision: keep exactly one `CodeMirrorHost` and change which buffer it
shows.** The alternative — a second instance, gated by a "scratch mode" prop
that suppresses the singleton behaviours — means threading a switch through
focus mirroring, selection mirroring, find/replace, the Edit-menu channel,
jump-to-line, the breakpoint gutter and the debug highlight, and then answering
"which editor does the virtual keyboard type into?" for touch users. That is a
refactor of the most delicate component in the tree, bought to avoid a document
swap that the app already performs.

Pushing a document into the editor already has a mechanism: the `{text, seq}`
channel that file-load and AI-apply drive. A tab switch becomes one more
producer on it. The channel is the editor's single inbound path either way, so
this generalises an existing concept rather than adding one.

The cost is that switching tabs replaces the EditorView's document and undo
history does not survive the switch — the same behaviour a file load already
has. Buffer *contents* survive, because every keystroke is mirrored to the store
as it is typed.

### `source` keeps meaning the program

**Decision: `source` continues to hold the document, and scratch text lives in
its own list.** The inverse — making `source` mean "whatever buffer is active"
— reads as cheaper (every consumer follows the tab for free) and is a trap: Save,
Share, hardware export and the assistant would silently follow the scratch, so
each would need an explicit opt-out anyway, and each failure mode is a user
losing or publishing the wrong thing.

Keeping `source` as the document inverts the audit into an opt-*in*, which is
the safe direction: a reader that is forgotten keeps showing the program, which
is wrong but harmless, rather than exporting a snippet under the document's name.

The readers split cleanly, and the list is short enough to enumerate:

| Follows the buffer on screen | Always the document |
| --- | --- |
| the run path | hardware export |
| status-bar size and error counts | the assistant's source and staleness base |
| the memory map | save / open |
| the procedure outline | share links |
| contextual documentation | autosave |

The change handler and the document-push are selected in `Workspace` by which
tab is active, rather than branched inside `setSource`. `setSource` carries
document semantics a scratch must not trigger — marking the document dirty,
clearing a preserved boot-disc image, the untitled-and-empty rule — and those
are easier to keep correct by not entering the function than by guarding each
one.

### Breakpoints belong to the buffer they were set on

A single per-document breakpoint set stops making sense the moment a second
buffer can run: the sets are keyed by BASIC line number, and line 20 of a
snippet has nothing to do with line 20 of the program.

**Decision: each buffer owns its set.** The document keeps the store's existing
set; each scratch buffer carries its own, which means closing a tab drops its
breakpoints with it and needs no cleanup path. A selector resolves "the active
buffer's breakpoints" for the gutter and the toggles, mirroring the existing
derived-blocks selector.

**The subtle half is the running session.** The debug loop re-reads the
breakpoint set from the store on *every* slice, once per frame. Left as-is, a
user who switches tabs while a program is paused would silently swap the live
session's breakpoints for another buffer's. So the buffer that started a run is
captured when the run starts, alongside the other per-session run state, and the
session resolves breakpoints from *that* buffer until it ends.

The same reasoning applies to the paused-line highlight and the "paused at line
N" status: both belong to the buffer that is running, and are shown only while
that buffer is the one on screen. Otherwise pausing a snippet would highlight an
unrelated line of the user's program.

This is the piece that most directly serves the immediate window later: a
debugger whose state is already per-buffer is one that can gain a ROM-level
break without first being untangled from a single-document assumption.

### A boot-disc document must not swallow a scratch run

The run path short-circuits on a preserved boot-disc image: a document imported
from a multi-file disc runs that image verbatim and never tokenizes its source
at all, because the disc's own loader has to run. A scratch run has to bypass
that branch, or on precisely those documents the Run button would appear to do
nothing.

Recorded here because it is invisible from the feature's description and cheap
to miss: the failing case is a document *type*, not a code path anyone would
think to exercise while building a tab strip.

### A scratch run is a cold boot

Loading a program boots the ROM, so running a snippet restarts the machine, as
every run does. This is worth stating because "scratch" invites the expectation
that it is somehow lighter. It is not — and that is exactly why it cannot serve
as the immediate window, which must not disturb the state it exists to inspect.

A scratch run carries the document's memory blocks, because testing a call into
machine code you are writing is a first-order reason to want a scratch buffer.
It does not carry preserved tape files, an imported auto-start line, or a
boot-disc image: those describe how the *document* was imported and have no
bearing on a snippet.

### Lifecycle

**Decision: scratch buffers survive a change of document and die with the
machine.** Opening a different program leaves them alone — the workbench is not
part of what you are working on. Switching target machine clears them, because
the snippets are written in a dialect the new machine does not speak and would
sit there failing to tokenize.

Non-persistence is the default falling out of holding them only in the store: no
autosave key, no bundle entry, no share payload. Worth asserting in tests
anyway, since the autosave signature and the bundle serializer are the two places
where a future field could quietly acquire persistence.

## Impact on the Dialect / MachineEmulator seam

**None.** No change to `Dialect`, to `MachineEmulator`, or to any dialect's
implementation. A scratch buffer is tokenized by the active dialect's existing
`tokenize` and loaded by its existing `loadProgram`, on exactly the path a
program run takes. Every machine gains scratch tabs at once, and none of them
learns anything about them.

The immediate window would be the opposite — it is a seam change, which is
another reason the two belong in separate proposals.

## Risks / Trade-offs

- **`CodeMirrorHost` regressions.** The one-editor decision exists to avoid
  touching its singleton wiring, but the change still alters how its document
  arrives and where its breakpoints come from. Find/replace, virtual-keyboard
  typing, Edit-menu commands and jump-to-line all route through it and all need
  re-checking.
- **Run means something different depending on the tab.** A user on a scratch
  tab who reaches for the run shortcut expecting their program gets the snippet.
  Mitigated by the tab strip making the active buffer obvious and the run
  control naming what it will run; not eliminated.
- **Undo history resets on a tab switch.** Accepted, and consistent with the
  existing document-swap behaviour.
- **The active-tab generalisation touches store internals broadly.** Replacing a
  nullable block id with a three-way value reaches every place the active tab is
  reset or repaired, including the fixups that repoint it when a block is
  deleted. Mechanical, but wide, and a missed site is a tab strip pointing at
  something that no longer exists.
