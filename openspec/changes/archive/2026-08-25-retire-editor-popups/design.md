# Design: retire-editor-popups

Architecture context: `docs/contributing/architecture.md`. No impact on the
`Dialect` / `MachineEmulator` seam — this is app-shell and editor-chrome work,
and nothing here reads a machine's specifics.

## Which surfaces retire the popups

`src/app/surfaces.ts` already holds the single registry of "what can be open",
and both dismissal gestures derive their notion of the topmost surface from it.
Its own comment names the failure mode a second list invites: two hardcoded
lists are what once left eleven dialogs answering to neither gesture. So the
answer to "does opening this retire the popups?" is read from the same table
rather than from a new one.

The registry already carries one optional per-surface flag, `autoShown`, for the
keyboard that appears without being asked for. A second optional flag marks the
surfaces that are the editor's *input path* rather than something raised over
it — the keyboard, the controller, and the controller's remap picker. Everything
else retires popups by default, so a dialog registered later gets the behaviour
without anyone remembering to ask for it. A registry-driven unit test pins that
default: every entry except the three flagged ones must retire.

The alternative — a store counter each opener bumps, in the idiom of
`editorCommand` / `jumpTarget` — was rejected for exactly the reason above. It
puts the obligation on every future dialog author instead of on the table.

## Where the retiring happens

Two hosts mount CodeMirror: the BASIC editor and the assembly editor. Both mount
the token menu; only the BASIC editor mounts autocompletion. One shared hook,
given the host's view ref, serves both — closing a completion list where none is
mounted is already a no-op in CodeMirror, so the assembly editor needs no
special case.

The hook acts on the **rising edge** of "a surface is open", not on the state
being true. Acting on the state would make the half-width documentation drawer
permanently suppress the token menu beside it, which is the case the layering
half of this change exists to serve.

## Layering

CodeMirror's `.cm-tooltip { z-index: 500 }` comes from its own base theme, and
the app's rule is not to fork vendored behaviour. Two ways to get the app's
surfaces above it:

1. **Isolate the editor host** — give it a stacking context so CodeMirror's
   internal bands (gutters 200, panels 300, tooltips 500) collapse into one app
   layer. Clean, but it also drops the tooltips below the virtual keyboard and
   the floating run button, which sit above the editor on purpose. A completion
   list at the foot of the editor would disappear behind the keyboard on a
   phone — a worse bug than the one being fixed.
2. **Lift the app's overlay bands above 500.** Preserves every relationship that
   is currently right and inverts only the ones that are wrong.

The second is taken. The bands become custom properties declared once, beside
the existing `.cm-tooltip` overrides that already document CodeMirror's
runtime-injected rules, so the reason for the numbers is written down where the
numbers are. Relative order among the lifted surfaces is unchanged; the toolbar's
dropdown keeps its own value because the toolbar already isolates itself, and the
in-workspace bands (keyboard, run button, mobile memory pane) are deliberately
left below the popups.
