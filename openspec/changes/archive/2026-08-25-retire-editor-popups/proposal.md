## Why

The editor's two transient popups — the autocomplete list and the click-a-token
offers menu — survive, and paint in front of, any dialog, panel or drawer opened
after them. Both are CodeMirror tooltips, and CodeMirror's own base theme puts
`.cm-tooltip` at `z-index: 500`; nothing between the tooltip and the document
root creates a stacking context, so that 500 competes directly with the app's
overlay bands (dialogs at 100, the documentation drawer at 90, the toolbar at 40)
and wins every time.

The layering inversion is only half of it. A popup is anchored to a caret
position the user has stopped looking at: once they open something over the
editor, the popup is stale whether or not it is visible. The editor already
takes this view of its find/replace panel, which is dismissed when the mobile
view tab changes.

## What Changes

- Raising any surface over the editor — a dialog, a panel, the documentation
  drawer, a mobile pane tab — retires the editor's transient popups.
- The on-screen input overlays are excluded: the virtual keyboard, the game
  controller and the controller remap picker are the editor's own input path,
  and the keyboard auto-shows when a pane takes focus, so retiring the
  completion list as it appears would fight the user mid-word.
- The app's overlay layers are lifted clear of CodeMirror's tooltip band, so a
  popup raised *after* a surface — possible beside the half-width documentation
  drawer, which leaves the editor visible and clickable — is covered by it
  rather than covering it. The layers become a single documented scale rather
  than per-file numbers.

## Non-goals

- The find/replace panel and the variable-usages bar are unchanged. They are
  persistent bars the user opened deliberately, they live inside the editor's
  own scroller rather than floating over the app, and find is already dismissed
  on a mobile tab switch.
- The relative order of anything drawn *inside* the workspace is unchanged: the
  virtual keyboard, the floating run button and the mobile memory-map pane stay
  where they are, deliberately below the editor's popups so a completion at the
  foot of the editor stays readable on a phone.
- No change to which surfaces exist, to how they are dismissed, or to the two
  dismissal gestures.

## Affected specs

- `shell-navigation` — the capability that owns what happens when a surface is
  raised over the editor.

`code-editor` is unaffected: what the popups offer, and how they are dismissed
by Escape, is unchanged.
