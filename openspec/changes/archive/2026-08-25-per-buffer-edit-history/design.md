## Context

The editor pane presents one tab strip over three kinds of buffer — the BASIC
program, any number of scratch buffers, and any number of memory blocks — but
only two CodeMirror views exist behind it. One view serves the program and every
scratch buffer, swapping its document as the tab changes; a second view is
mounted for whichever code block is open. See
`docs/contributing/architecture.md` for how the editor sits in the app; the
relevant detail here is that "the editor" is a singleton in the store's
vocabulary while the user experiences it as many buffers.

Three consequences follow, and the change addresses all three:

1. The toolbar's edit commands travel over a request counter that only the
   BASIC view watches, so on a block tab they act on the hidden program.
2. The block view is keyed by block id, so React destroys and rebuilds it — and
   its history — on every block switch.
3. The buffer swap for the BASIC view is applied as an ordinary document
   change, so it enters the one shared history. Undoing it restores the outgoing
   buffer's text *into the incoming buffer*, and because the change listener is
   only muted for the forward swap, that text is written back to the store.

**Impact on the `Dialect` / `MachineEmulator` seam: none.** Nothing here is
machine-specific. The BASIC view's extensions are already built from the active
dialect and keep being built the same way; the block view's assembler engine is
still resolved from `dialect.memoryBlocks.cpu`. No dialect gains a new
obligation.

Constraint from an existing capability: `ai-assistant` requires that applying an
AI block be "reversible through the editor's normal undo". AI apply travels over
the same document-override channel that tab switching uses, so the fix cannot
simply mark that channel non-undoable — the channel has to be split by intent.

## Goals / Non-Goals

**Goals:**

- Toolbar edit commands act on the buffer on screen, as the keyboard already
  does.
- One edit history per buffer, surviving tab switches.
- Switching tabs is not a document change and cannot be undone.
- The AI assistant's undo guarantee is preserved unchanged.
- The block editor gains find/replace so every editable tab offers the same set.

**Non-Goals:**

- Persisting history across reload or into autosave.
- A history for the non-editor text inputs (AI prompt, settings, tab rename) —
  those keep the browser's native undo.
- Editing `kind: 'data'` blocks.
- Any change to key bindings.

## Decisions

### Serialize each buffer's history rather than caching live `EditorState`s

Switching buffers means putting a different document, selection and history into
a view. The obvious move — keep a `Map<bufferId, EditorState>` and hand the view
back the state it had — is wrong here, because the BASIC view configures four
`Compartment`s from live store state at build time: the line-number gutter, the
numbering/completion config, the breakpoint and heat gutter markers, and the
native-keyboard suppression. Those are reconfigured by effects that dispatch to
the *current* view only. A state parked in a cache while the user toggles the
line-number gutter comes back with the old configuration, and nothing would
re-run to correct it.

So the cache holds `state.toJSON({ history: historyField })` and restores with
`EditorState.fromJSON(json, { extensions }, { history: historyField })`.
`historyField` is exported by the pinned `@codemirror/commands` (6.10.3) for
exactly this purpose — it is CodeMirror's documented multi-document recipe. The
document, selection and undo/redo stacks come back; every extension is rebuilt
from current store state, so no compartment can be stale. The cost is that
transient view state not covered by a serialized field (an open find panel, a
folded range) resets on a switch, which is the behaviour today anyway.

*Alternative considered:* one mounted view per buffer, hidden with CSS. Rejected
— it is already how the program/scratch split half-works, it multiplies the
lint, completion and gutter machinery per open buffer, and buffer count is
user-controlled.

### The buffer swap uses `view.setState`, not a transaction

`setState` replaces the view's state wholesale without going through the
transaction pipeline. Nothing observes it as a document change, so it can never
enter any history and can never fire the change listener that writes text back
to the store. This is the direct fix for the data-loss path, and it is why the
swap must stop travelling over the document-override channel at all rather than
being annotated `addToHistory: false` — an annotated transaction is still a
transaction, and the change listener would still see it.

### The document-override channel narrows to genuine replacement

`withActiveTab` stops pushing text; it only sets the active tab. The override
channel keeps exactly the callers that replace the *content* of the buffer on
screen — applying an AI block, opening a file, loading a sample, writing a
listing-backed block's bytes back into the program — and those stay ordinary
transactions, so they stay undoable and the `ai-assistant` requirement holds
without a special case.

This leaves one thing to get right: callers that replace the program's text
*while* the user is on some other tab, or that change tab as part of replacing
the document. The program's cached snapshot would then describe text that no
longer exists. The rule is that any caller replacing a buffer's content drops
that buffer's snapshot, and any caller replacing the whole document — file open,
sample load, player boot, machine switch — clears the cache outright, so a new
document starts with no history to undo into. That matches what a user expects:
undo does not reach across an Open.

*Alternative considered:* tagging each override with "undoable" or not and
keeping tab switches on the channel. Rejected — it leaves the histories merged,
so it fixes the swap without fixing the leak, and it puts intent in a flag
rather than in which mechanism is used.

### Commands are routed by which surface is showing, not by a view handle

Both views subscribe to the existing edit-command counter and act only when they
are the surface on screen, decided from the active tab's kind. This keeps the
store free of non-serializable `EditorView` handles and follows the project's
established convention of bumping a counter that a `useEffect` watches, rather
than holding cross-module handles.

The view-generic commands — undo, redo, cut, copy, paste, find, close-find,
including the clipboard fallbacks and the paste-permission message — move to a
shared module so both views run the same code. Renumbering stays with the BASIC
view, because it is a BASIC operation, and the toolbar disables those entries
while a block tab is showing instead of offering an action with no target.

### Block re-seeding is not undoable

When a block's bytes change from outside its editor, the editor is re-seeded
from the new bytes. That is not the user's edit and must not be reversible:
undoing it would leave assembly source that no longer describes the block's
bytes, which the editor would then re-assemble over the top. The re-seed is
applied so that it does not enter history.

## Risks / Trade-offs

- **The BASIC view's extension list is long and built inline; extracting it into
  a builder is the largest mechanical part of the change and could drop an
  extension.** → The builder is called from both the mount path and every
  restore, so a dropped extension fails immediately and visibly on first mount;
  the existing `e2e/code-editor/` specs cover highlighting, completion, lint,
  gutters, chips and the click menu.

- **`fromJSON` throws on a malformed snapshot, which would break tab switching
  rather than degrading it.** → Restoring falls back to a fresh state built from
  the buffer's current text when a snapshot cannot be restored; a lost history is
  the worst outcome, never a lost buffer.

- **Un-keying the block editor makes it long-lived, so per-block state that was
  previously reset by remounting is now the component's responsibility** — the
  pending assemble timer, the last-written-bytes marker and the reseed guard all
  currently rely on a fresh instance per block. → Those are reset explicitly on
  every block switch, and the switch flushes a pending assemble first, the same
  way unmounting does today.

- **Snapshots hold a full document copy plus history per buffer, for as long as
  the buffer exists.** → Buffers are user-created and small (BASIC programs and
  short assembly routines); snapshots are dropped when a buffer closes and
  cleared when the document is replaced.

- **Adding find/replace to the block editor introduces a second writer to the
  store's find-panel-open flag.** → Only the view on screen dispatches commands,
  and the panel closes on a tab switch as it does on a mobile pane switch today.

## Migration Plan

None required: no persisted data changes shape, and autosave carries no editor
history. The change is behavioural only and takes effect on load.

## Open Questions

None outstanding. The one judgement call already made: undo does not reach
across a document replacement (file open, sample load, machine switch), which is
a deliberate narrowing of today's accidental behaviour rather than a regression.
