## Context

The IDE lays its shell out two ways (the split map is in
`docs/contributing/architecture.md`): a two-column layout for tablets and
desktops, and a single-pane tabbed layout for phones and phone-landscape. The
run's three states are derived in one place, `src/app/runControl.ts`
(`runControlStateOf` → `play | pause | continue`, plus its glyph and label),
but only one control consumes it: the round run control over the editor,
rendered by `Workspace.tsx` and shown only on the tabbed layout's editor tab.

Every other surface predates that derivation. The toolbar's run buttons and
the overflow menu's Run actions each read `emulatorStatus` directly and gate
Step and Continue on `paused`; the Continue chord does the same in
`useGlobalShortcuts.ts`. The result is three surfaces that can release a pause
and none that can take one.

The two button surfaces never render together: the toolbar's run buttons carry
`desktop-only`, hidden at or below 768px wide and in phone-landscape, and the
overflow trigger carries `mobile-only`. So this is one behaviour rendered by
two disjoint sets of markup, not a control that has to work in both.

## Goals / Non-Goals

**Goals:**

- One derivation of the run's state behind every control that offers to pause
  or continue, so the surfaces cannot drift.
- A pause reachable from the two-column layout, from the emulator tab, and
  from the keyboard.
- The blue and the glyphs already established by the run control over the
  editor, so the toggle reads the same wherever it appears.

**Non-Goals:**

- Publishing the conditions that refuse a pause (see Risks).
- Any change below the `Dialect` / `MachineEmulator` seam.

## Seam impact

None. Pausing is already expressed as a request counter the emulator pane
watches, and the machine's own contribution - whether a program is still
running - is already read through `MachineEmulator.isProgramRunning` by the
timing this derivation consumes. No dialect, machine or emulator core is
touched, and no new capability is asked of the seam.

## Decisions

### The toolbar and menu derive their two positions from the existing state

`runControlStateOf` keeps its three-position result and gains a mapping to
what a surface with its own separate Play should show:

```
runControlStateOf(status, {pausable, programEnded})
        'play'          'pause'            'continue'
          │                │                    │
   over the editor:    ▶ (green)          ❚❚ (blue)            ▶ (blue)
   toolbar / menu:     Continue, refused  Pause, offered       Continue, offered
```

Alternative considered: re-deriving from `emulatorStatus` inside the toolbar.
Rejected - it would duplicate the two rules that are easy to get wrong (a
machine with no debugger offers no pause; a program that has ended is no
longer pausable even though the machine runs on at its prompt), and those
rules would then have two places to be fixed.

### A surface with its own Play refuses rather than falls back

The run control over the editor is the only control on its layout, so its
third position has to be Play. The toolbar and the menu both carry a separate,
always-live Play, so their toggle has only two faces and a refused state.
Falling back to Play would give those surfaces two buttons that both start the
program, and would let a mis-aimed click restart a run at the moment it ended.

The refused state wears the Continue face, which is what the toolbar shows at
rest today - so a toolbar with nothing running looks exactly as it does now.

### Blue is the accent with dark ink, and not `button.primary`

The run control over the editor pairs `--accent` with `#06152e` ink, because
white on that blue only just clears the *large*-text contrast threshold. The
toolbar's buttons are 13px, where it would not clear it at all, so this cannot
reuse `button.primary` (accent + white). It gets its own class alongside
`button.run`, same shape, different hue.

Menu items have no fill and take their emphasis from hover, so in the overflow
menu the change is the glyph and the word only. The glyph set is already
shared (`▶ Play`, `⤵ Step`, `■ Stop`), so `❚❚ Pause` needs nothing new.

### The chord keeps its id and changes its name

`run.continue` stays the identifier - ids are internal, never persisted, and
renaming one would churn the binding table for nothing - and its dispatch
gains the running case. Its label becomes the name of both halves, since that
label is what the shortcut table and the menu hints render.

### The width of the toolbar toggle is pinned

"❚❚ Pause" and "▶ Continue" do not set to the same width, so without a floor
the Stop button beside them would shuffle sideways every time the run changes
state. The button takes a `min-width` sized to the longer face.

## Risks / Trade-offs

- **A pause can still be refused silently.** `canPauseRun` drops the request
  while an assistant answer is being checked, while the assistant is driving
  the machine, and before the first frame is drawn. Those flags live in the
  emulator pane's refs, not the store, so no control can grey itself out for
  them. → Ships as parity with the control over the editor, which has always
  behaved this way; lifting the flags into the store is a separate change with
  its own re-render cost.
- **The toolbar's Continue moves under the user's cursor.** Someone who
  learned "third button releases the breakpoint" now finds a Pause there
  mid-run. → It acts on the state it shows, and the state it shows is the one
  the run is in; the alternative (a fourth button) spends bar width that the
  container queries already fight over at tablet widths.
- **An accessible name that changes.** Tests and assistive tech that address
  the button by name see it change with the run. → The e2e suite already
  addresses the run control over the editor by test id for exactly this
  reason; the toolbar assertions follow the same rule.
- **A stale comment becomes wrong.** The pause effect in the emulator pane
  explains that it leaves the mobile tab alone because its only sender lives
  on the editor tab. With a sender on the emulator tab that reasoning no
  longer holds, though the behaviour still does - the menu's own action
  switches tabs before the request is sent. → Rewrite the comment with the
  change.

## Open Questions

None outstanding.
