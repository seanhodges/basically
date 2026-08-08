## Why

Trying a BASIC snippet means vandalising your program. There is nowhere in the
IDE to put a throwaway five-liner — a `PLOT` idea, a `PRINT` format, a
`RANDOMIZE USR` call into machine code you are writing — so the experiment goes
into the document, gets run, and gets undone back out again. The editor has one
BASIC buffer, and it is the thing you are trying not to break.

The tab strip already carries more than one thing: the BASIC source sits beside
one tab per memory block. What it does not carry is a *second place to write
BASIC*. Adding one is small, because the editor's document-push channel and the
"run a program that is not the editor's" path both already exist — the assistant
uses the second one every time it checks an answer it just wrote.

This proposal is deliberately half of the original idea. The other half — an
**immediate window** that evaluates an expression against a program paused at a
breakpoint — is a separate, larger change. Today a breakpoint pause is a *host*
freeze: the pane stops advancing frames and the BASIC ROM is left mid-`RUN`,
nowhere near a `READY` prompt, so there is nothing to type at. Reaching a real
immediate window means breaking the *program* the way the ROM does, per machine.
Nothing here forecloses that, and the per-buffer debug state below is groundwork
for it.

## What Changes

- The editor tab strip gains **scratch tabs**: disposable BASIC buffers, created
  on demand, several at a time, named `Scratch 1`, `Scratch 2`… and renameable.
- **Run runs the buffer you are looking at.** With a scratch tab showing, Run
  tokenizes and boots that snippet; with the BASIC or a block tab showing, Run
  runs the program exactly as it does today.
- A scratch run **carries the document's memory blocks**, so a snippet can call
  into machine code the user is writing in a block tab.
- A scratch buffer is **fully debuggable**, against **its own breakpoints**.
  Breakpoints stop being a single per-document set and become a property of the
  buffer they were set on.
- Scratch buffers are **session-only**: never autosaved, never written into a
  project bundle, never carried by a share link. They are gone on reload.
- Scratch buffers **survive New / Open / Sample / Import** — a scratch is a
  workbench, not part of the document — and are **cleared on a target-machine
  switch**, where the snippets are written in a BASIC the new machine does not
  speak.
- **The document is never touched by any of this.** Save, Share, hardware export
  and the AI assistant keep meaning the program, whatever tab is showing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-editor`: one requirement added — *Disposable scratch buffers* — covering
  creating, naming, switching between and closing scratch buffers, and the
  guarantee that editing one leaves the program untouched.
- `program-execution`: the existing *One action runs the current source*
  requirement gains that "current source" means the buffer on screen, and that a
  scratch run carries the document's memory blocks. The existing *Line-level
  debugging on capable machines* requirement gains that breakpoints belong to the
  buffer they were set on, and that a running debug session keeps the breakpoints
  of the buffer that started it.
- `persistence`: one requirement added — *Scratch buffers do not persist* —
  pinning the non-persistence as a behavioural guarantee rather than leaving it
  as an absence.

`memory-blocks` is **not** affected. Block tabs, their editors and their
lifecycle are unchanged; a scratch run reads the document's blocks exactly as a
program run does.

`sharing-player` is **not** affected. The player is emulator-only and has no tab
strip; share links carry the program, as they do now.

## Non-goals

- **The immediate window.** No evaluation of an expression or a bare statement
  against a live or paused machine. A scratch buffer is a small numbered
  program — the tokenizers require line numbers — and running one is a cold boot,
  not an injection into a running machine.
- **Changing `debugStep` to a ROM-level break.** The pause stays a host freeze.
  This change makes debug state per-buffer; it does not change what a pause *is*.
- **Persisting scratch buffers anywhere.** No autosave, no project bundle, no
  share link, no URL. Disposable means disposable.
- **A second mounted editor.** One `CodeMirrorHost` continues to exist; the tab
  strip changes which buffer it shows. See the design for why this is a
  constraint rather than a preference.
- **Scratch buffers for the assistant.** The AI panel keeps reading and writing
  the program. Pointing it at a scratch buffer is a coherent idea and a separate
  one.
- **Preserving undo history across a tab switch.** A single EditorView means a
  switch replaces the document, as `replaceDocument` already does.

## Impact

Affected code (confirm against the tree when implementing):

- `src/app/store.ts` — a `scratchTabs` list; `activeBlockId` generalised to a
  three-way active-tab value (BASIC / block / scratch); scratch actions; a
  selector for the active buffer's breakpoints; the lifecycle resets.
- `src/components/Workspace.tsx` — route the single editor's document-push and
  change handler by which tab is active.
- `src/components/EditorTabBar.tsx` — render scratch tabs; turn the `+` button
  into a two-item menu; a scratch tab context menu; render the strip
  unconditionally, since it currently returns `null` for a dialect with no
  memory-block support and scratch tabs are dialect-independent.
- `src/components/EmulatorPane.tsx` — run the active buffer; keep the debug
  session's breakpoints pinned to the buffer that started it.
- `src/components/CodeMirrorHost.tsx` — breakpoint gutter and the F9 toggle read
  the active buffer's set; the paused-line highlight shows only when the buffer
  on screen is the one running.
- The `source` readers that should follow the buffer on screen rather than the
  document: `src/app/useProgramStats.ts`, `src/components/MemoryMapPanel.tsx`,
  `src/components/ProcedureListDialog.tsx`, `src/components/DocsDrawer.tsx`,
  `src/app/docsTopic.ts`.

Prior art to reuse rather than reinvent: the editor's existing document-push
channel (`docOverride`), which file-load and AI-apply already drive; the
assistant's existing "run a source that is not the editor's" path in the run
effect; `useDismiss` and `useLongPress`, already imported by the tab strip, for
the new menus.

No dependency changes.
