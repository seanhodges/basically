## Why

The IDE's microcopy has drifted. Tooltips, accessible names and the short
blurbs inside dialogs were each written when their feature landed and never
revisited as a set, so today they disagree with each other and, in places, with
the code. One control carries a hand-typed key binding that misreports the
moment the shortcut is rebound; another labels itself two different ways in the
same element. Nothing guards the copy, so every new feature adds more drift.

## What Changes

- Every hover tooltip (`title`) and accessible name (`aria-label`) outside the
  virtual keyboard is rewritten to one house style: an imperative verb phrase
  saying what activating the control does, sentence case, no trailing period.
- Dialog subtitles, settings-row captions, panel empty-states and inline
  notices are cut down to what the user needs in order to act.
- Tooltips that are wrong are corrected. The renumber-line tooltip stops
  hard-coding its keystroke and reads the live shortcut map like its
  neighbours; the memory-map zoom slider stops calling itself two names.
- Strings duplicated between a toolbar button and its overflow menu item become
  one shared constant, so the pair cannot drift apart.
- A new ESLint rule, `local/no-vague-ui-labels`, fails the build on a label
  that is not an imperative phrase, ends in a period, exceeds the length
  budget, or hard-codes a list of machines.
- e2e selectors that match on reworded text are updated to follow the copy.

No control changes what it does, gains a shortcut, or loses one. This is a copy
and lint change.

## Non-goals

- **Virtual keyboard keycaps and the graphics palette** (`src/keyboard/`).
  Their label text is already a behavioural guarantee in the `virtual-input`
  capability — a keycap "labelled with the key, and any modifier, that produces
  it", a control code "labelled with the character code". Restyling those is a
  separate change with its own delta.
- **The published docs site** (`docs/guide/`, `docs/reference/`). Different
  audience, different voice, different review.
- **Changing behaviour.** No control gains, loses, or alters an action.
- **A general i18n or string-extraction layer.** Copy stays inline where it
  lives today, except for the few literals hoisted to kill duplication.

## Capabilities

### New Capabilities

- `control-labelling`: what a control tells the user about itself — that every
  control names its action rather than its category, that its hover tooltip and
  its name for assistive technology agree, and that a label reporting a keyboard
  shortcut or the supported machines tells the truth.

This guarantee is cross-cutting: it holds for the toolbar, the tab bar, the
memory map, the dialogs and the standalone player alike. It is written as its
own capability rather than folded into `shell-navigation`, whose purpose is
getting *out* of a surface, and rather than copied into the six capabilities
whose controls it governs.

### Modified Capabilities

None. No existing requirement changes: the controls keep doing exactly what
they did, and no baseline spec pins a label's wording.

The capabilities whose surfaces are most edited are `shell-navigation`
(toolbar, tab bar, docs drawer), then `memory-map`, `sharing-player`,
`ai-assistant` and `hardware-transfer`. They are named so the e2e run is scoped
correctly, not because their requirements move.

## Impact

**Code.** 101 `title=` / `aria-label=` sites across 21 `.tsx` files, half of
them in three: `src/components/Toolbar.tsx` (24),
`src/components/EditorTabBar.tsx` (17), `src/components/MemoryMapPanel.tsx`
(11). Plus dialog and panel helper text across `src/components/*Dialog.tsx`,
`SettingsForm.tsx`, `AiPanel.tsx`, `StatusBar.tsx` and `DocsDrawer.tsx`.

**Lint.** One new rule file and one `eslint.config.js` block, following
`eslint-rules/no-plan-references.js` exactly.

**Tests.** 287 `getByRole(..., { name })` selectors reference UI copy, but
Playwright matches `name` as a case-insensitive substring unless `exact: true`,
so only selectors whose matched substring is itself reworded need updating. The
`exact: true` sites are individually brittle and get checked one by one.

**Docs.** One bullet in `CLAUDE.md` under *Conventions*, citing the new rule.

**Dependencies.** None added.
