# Look up a keyword where it is written

## Why

Looking up a keyword in the language reference today goes through the editor's
*selection*. Both editors mirror their main selection's text into the store, and the
Docs toolbar button, the drawer's open handle and F1 each read it and open the drawer at
`reference/<page>?q=<first word of the selection>`.

That gesture is indirect and largely undiscoverable. A bare caret on `PRINT` yields an
empty selection, so the user must first *select* the word — every test double-clicks
before pressing anything — and then travel to a button elsewhere on screen. Nothing
connects "this word" to "that button".

Meanwhile the editor already answers the same class of question well. Clicking a
variable offers **Usages** in a one-row menu anchored under the name, shaped like the
completion popup. "Tell me about this token" is one question; it should have one answer,
in one place.

## What Changes

- Clicking or tapping a command, function or operator offers a **Reference** row in the
  editor's existing click-anchored menu, opening the active machine's language reference
  at that keyword.
- Keywords spelled short — the Acorns' `P.`, the Commodores' `pO`, a symbol standing for
  a whole command — are read as the keywords they are, throughout: coloured as that
  keyword rather than as a name and a full stop, no longer counted as variables, and
  looked up as the keyword rather than the abbreviation. The tokenizers have always
  accepted these spellings; the highlighter and the variable scanner were behind them,
  so a pasted archive listing reported variables the program does not have.
- The BBC Master highlights and completes from its own BASIC IV keyword table and
  resolves dotted spellings by its own ROM's scan order, rather than borrowing the
  Micro's.
- The assembly editor gains the same menu for machine-code instructions and assembler
  directives, opening the reference for the block's processor. It has no menu today.
- The menu grows from a fixed single row to a list, and the mechanism is lifted out of
  the variable-usages feature so the assembly editor can mount it without dragging the
  usages machinery along. **Usages behaviour is unchanged.**
- The menu claims Escape while it is open, so dismissing it no longer also dismisses the
  surface behind it. New behaviour; today only the usages *bar* is Escape-dismissible,
  and an open offer is not.
- **BREAKING (user-visible):** the Docs toolbar button, the drawer handle and F1 stop
  reading the selection. They behave as they do today with nothing selected — the docs
  home from a BASIC tab, and still the processor's page from a machine-code block tab,
  which was never selection-driven. The mirrored selection state is removed from the
  store.
- A pending porting comparison keeps winning for every opener that does not name a
  topic. The Reference row *does* name one, so it goes straight to the keyword.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-editor`: **ADDED** a requirement for looking up a keyword, operator or
  machine-code instruction from the editor, and for presenting several offers about one
  token in a single menu. This behaviour has no baseline requirement today — it exists
  only in an e2e test — so it is added rather than amended. "Find a variable's usages"
  is **not** modified: its wording ("by clicking or tapping it", "any pending offer")
  stays true.
- `porting-guidance`: **MODIFIED** "The comparison is offered, not imposed, where it
  would cover the work". Its guarantee that "opening the documentation **by any means**
  while that comparison is still current SHALL land on it rather than on the usual
  topic" predates any route that names a topic. Read literally it would hijack an
  explicit keyword lookup. Narrowed to openers that do not name a topic — the toolbar
  button, the drawer handle, F1 and the porting indication all keep landing on the
  comparison.

## Non-goals

- No change to what the reference pages contain, or to how their search matches names
  and short spellings. The lookup seeds the existing search; `dialect-toolchain` keeps
  owning what happens next.
- No right-click context menu. The menu stays left-click/tap anchored, as the usages
  feature deliberately chose — hovering is unavailable on the touch devices this editor
  is used on, and the caret alone would fight the completion popup for the anchor.
- No baseline requirement is added for what the Docs button, handle and F1 open. That
  was unspecced before this change and stays unspecced; only the selection input is
  removed. Noted as a known gap.
- No new reference rows, and no change to which tokens earn one.
- The variable-usages model — which occurrences count on which machine — is untouched.

## Impact

**Affected specs:** `openspec/specs/code-editor/spec.md` (added requirement),
`openspec/specs/porting-guidance/spec.md` (one requirement narrowed).

**Affected code:**

- New: a token-under-position reader built on the dialect's own highlighter, the menu
  mechanism split out of the usages view, and the Reference row itself.
- `src/editor/variableUsagesView.ts` — keeps the usages field, bar, marks and theme;
  contributes a row instead of owning the menu.
- `src/components/CodeMirrorHost.tsx`, `src/components/AsmEditor.tsx` — mount the menu;
  both drop their selection-mirroring listeners.
- `src/app/docsTopic.ts` — the topic resolvers take a keyword rather than a selection;
  the contextual resolver keeps only its tab-driven half.
- `src/app/store.ts` — the mirrored selection field and its setter are removed.
- `src/styles.css` — the menu's own classes are renamed away from the usages feature and
  gain a per-row icon; the bar and mark classes stay.

**Seam impact:** none. The change reads the `Dialect`'s existing `keywords` and
`languageSupport()`, and the assembly engine's existing `cpu` and `mnemonics`. Nothing
is added to the `Dialect` / `MachineEmulator` interface.

**Docs:** `docs/guide/keyboard-shortcuts.md` currently states the F1-with-a-selection
behaviour and becomes false; `docs/guide/writing-basic.md` and
`docs/guide/machine-code.md` gain the new gesture. Sidebar untouched.
