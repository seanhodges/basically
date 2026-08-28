## Context

The IDE's UI layer is described in `docs/contributing/architecture.md`; this
change touches only the React components under `src/components/` and
`src/player/`, and adds one lint rule. Nothing about the app's structure moves.

**Impact on the Dialect / MachineEmulator seam: none.** No label edited here is
produced by a dialect. Machine and target names still come from
`src/dialects/registry.ts` through the seam, and they reach the DOM as template
literals and expressions, which the new rule deliberately does not inspect (see
Decisions). No file under `src/dialects/` or `src/emulator/` is edited.

Today there is no convention, no rule, and no test governing UI copy, so the
strings drift independently. The audit found 101 in-scope `title` /
`aria-label` sites in 21 files, half of them in three.

## Goals / Non-Goals

**Goals:**

- One consistent voice for every tooltip and accessible name.
- Correct the labels that misreport what a control does.
- Make the convention mechanically enforceable, so a future feature cannot
  quietly reintroduce the drift.
- Keep the e2e suite green without freezing the copy to protect it.

**Non-Goals:**

- The virtual keyboard and graphics palette (`src/keyboard/`), whose labels are
  specced behaviour under `virtual-input`.
- The published docs site.
- Any behaviour change, added shortcut, or i18n layer.

## Decisions

### Icon-only controls keep BOTH `title` and `aria-label`, even when identical

The audit first read the four identical `title`/`aria-label` pairs in
`MemoryMapPanel.tsx` as redundant. They are not. Those controls render a bare
glyph (`✕`, `−`, `+`, an eye icon), so:

- `title` is what a sighted mouse user gets on hover. Remove it and the button
  becomes an unexplained symbol.
- `aria-label` is the accessible name. Remove it and the name falls back to the
  glyph, or to `title` — weaker and less predictable.

So an identical pair is the *correct* pattern for an icon-only control, and the
rule must not flag it. What is a genuine defect is a pair that **disagrees**:
the zoom slider's `title="Zoom"` against `aria-label="Zoom level"`. One control,
two names, and the hover text does not match what a screen reader announces.

*Alternative considered:* drop `title` and rely on the accessible name. Rejected
— it silently removes the hover tooltip for the majority of users to satisfy a
tidiness instinct.

### The rule enforces what is mechanically checkable, not "is this imperative?"

Proving a string is an imperative verb phrase needs part-of-speech tagging. A
regex that tries will be wrong in both directions — it will pass `"Documentation"`
and fail `"Run to the next BASIC line"`. Rather than ship a rule nobody trusts,
`local/no-vague-ui-labels` checks only high-precision signals:

| Check | Why it is safe |
| --- | --- |
| Trailing period | Unambiguous; labels are not sentences. |
| Over the length budget | A tooltip past ~60 chars is prose in the wrong slot. |
| Leading gerund (`"Running…"`, `"Opening…"`) | Reliably not imperative. |
| Hard-coded dialect/machine list | `registry.ts` is the source of truth (CLAUDE.md). |
| `title` and `aria-label` on one element that disagree | Exactly the zoom bug. |
| A curated `VAGUE_LABELS` denylist | Exact strings this audit already judged noun-only. |

The denylist is the honest part of the design: it does not generalise, but it
is seeded with every bare noun the audit found (`"Documentation"`, `"Settings"`,
`"Zoom"`, `"New tab"`, …), so re-introducing one of those exact strings fails
the build. Judging a *newly invented* noun label stays a review job, backed by
the convention bullet in `CLAUDE.md`.

*Alternative considered:* a Vitest guard like `src/e2eCapabilityLayout.test.ts`.
Rejected — lint reports at the offending line in the editor, which is where a
copy mistake is cheapest to fix.

### Only literal attribute values are inspected

The rule reads `JSXAttribute` nodes whose value is a plain string literal. It
skips template literals and expressions, so labels composed from user data
(`` `Rename ${buffer.name}` ``), from the live shortcut map (`withKeys(...)`),
or from dialect data are never flagged. This is what keeps the rule off the
seam, and it is also why the *fix* for the hard-coded-keystroke bug is to route
that string through `withKeys` — doing so moves it out of the rule's reach for
the right reason, because it is no longer a fixed claim about a keybinding.

### Shortcuts belong in `title`, not `aria-label`

`withKeys(text, id)` appends `(Ctrl+I)` from the live shortcut map. That suffix
is useful on hover and noise in a screen reader, which announces the accessible
name on every focus. Where a control has both, the shortcut goes in `title`
only.

### e2e selectors follow the copy

Playwright matches `getByRole`'s `name` as a case-insensitive **substring**
unless `exact: true`. So of the 287 name-matching selectors, only those whose
matched substring is itself reworded break — appending or changing a shortcut
suffix breaks nothing. The `exact: true` sites are brittle to any edit and get
reviewed individually. Selectors are updated to match the new copy; the copy is
not frozen to protect them.

## Risks / Trade-offs

- **A rewrite breaks an e2e selector nobody re-ran** → the affected capability
  folders are named explicitly in tasks and must pass before those tasks are
  checked off.
- **The denylist rots as the UI grows** → accepted. It is a ratchet against
  known-bad strings, not a complete judge; the convention bullet carries the
  general rule.
- **Length budget produces false positives on a genuinely complex control** →
  the budget is set from the audit's real distribution, and the rule supports
  the standard `eslint-disable-next-line` escape with a required comment.
- **Reviewers disagree with a rewrite** → copy is subjective. The proposal
  fixes the style up front so review argues about individual strings, not the
  rule.
- **Rewriting a label changes what a screen-reader user has learned** → real
  but small, and outweighed by the labels that are currently wrong.

## Open Questions

- The exact length budget. The audit's longest in-scope label is the whole-program
  renumber tooltip; the budget should be set just under the shortest string we
  agree is too long, once the full inventory lands.
