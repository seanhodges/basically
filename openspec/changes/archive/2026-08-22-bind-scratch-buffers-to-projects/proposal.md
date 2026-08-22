# Bind scratch buffers to projects

## Why

Scratch buffers are session-only by design: they are excluded from autosave and
from the saved project bundle, so a snippet the user spent real time on is gone
after a reload and can never be kept alongside the program it was written for.
Every other kind of work in the IDE survives a crash; this one does not, and
users have no way to opt in.

## What Changes

- A scratch buffer becomes part of the project rather than a session workbench.
- Saving a project SHALL include its scratch buffers; opening that project SHALL
  restore them with their names and contents.
- Autosave SHALL carry scratch buffers, so they survive a reload or a crash the
  same way the program does.
- **BREAKING (behavioural)**: scratch buffers no longer outlive a document swap.
  Creating a new project clears them, and so does every load that replaces the
  document — opening a project, opening a plain source file, loading a sample,
  importing a file. Previously all of these left them standing.
- An in-place assistant apply is an edit to the open program, not a document
  swap, and SHALL leave scratch buffers untouched.
- Editing a scratch buffer still does not mark the document as having unsaved
  changes. Because New and Open now discard buffers, the discard confirmation
  gains a second trigger: it SHALL also ask when scratch buffers exist.
- Restored buffers come back without breakpoints; breakpoints stay session state.
- Switching target machine still discards them, and share links still carry none.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `persistence`: the requirement "Scratch buffers do not persist" is replaced —
  buffers are now autosaved, saved into the project bundle, restored on open, and
  cleared by a new project or any document-replacing load. Three of its four
  scenarios invert; the machine-switch scenario is unchanged.
- `code-editor`: "Disposable scratch buffers" no longer guarantees that buffers
  leave what saving produces unchanged — a saved bundle now carries them. What
  the document *builds, runs and shares* is still the program, and buffers still
  do not dirty the document.

## Impact

- Project bundle format: an additive optional field in the `project.json`
  metadata plus one plain-text zip entry per buffer. No format version bump —
  bundles without it load with no buffers, matching how every other optional
  field was added.
- Browser storage: one new autosave key alongside the existing ones.
- The document-lifecycle actions in the store (create, open, replace, load) and
  the file commands that save, open and guard document replacement.
- Existing behaviour tests that assert non-persistence invert, in unit tests and
  in the scratch-buffer browser journey.
- The user guide's scratch-buffer section.

## Non-goals

- Share links still carry no scratch buffers.
- No per-buffer dialect: buffers remain implicitly the active machine's and are
  still discarded on a machine switch rather than converted or held aside.
- No breakpoint persistence, for scratch buffers or for the program.
- No project library or manager UI — a "project" remains the single active
  document plus its bundle on disk.
- No change to what a scratch buffer runs, or to how running one works.
