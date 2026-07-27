## Context

The AI path is described in `docs/contributing/architecture.md`; this design does
not restate it. The relevant shape is: a reply streams into a module-level
conversation store, `extractCodeBlocks` pulls fenced blocks out of the markdown,
and `AiPanel` renders each block with three fixed buttons that call either
`replaceDocument` or `mergeBasicLines` + `replaceDocument`.

Three facts about the current code drive most of the decisions below.

1. **`mergeBasicLines` is not a text merge.** It parses both sides into a
   `Map<number, string>` keyed by BASIC line number, overlays the fragment, and
   re-sorts. That is why a diff needs no diff algorithm here — the change set is
   exactly derivable from the same parse. It also only ever calls `set()`, so
   deletion is currently impossible.
2. **`extractCodeBlocks` already captures the fence info string** into
   `CodeBlock.language`, and its regex already permits hyphens. A
   ` ```basic-partial ` tag needs no parser change.
3. **Applying already goes through CodeMirror's undo history.** `replaceDocument`
   bumps `docOverride`, and `CodeMirrorHost` dispatches it as an ordinary
   transaction — not excluded from history. Ctrl+Z therefore already restores the
   previous program after a mis-click.

**Dialect / MachineEmulator seam: no impact.** Nothing here touches
`src/dialects/types.ts` beyond the existing `AiProfile.systemPrompt` field, and
no machine-specific behaviour changes. The one dialect-facing edit moves shared
prompt text *out* of the 13 per-dialect profiles into the prompt builder, which
reduces per-dialect surface rather than adding to it.

## Goals / Non-Goals

**Goals:**

- Make "what kind of code block is this?" a first-class, testable fact.
- Offer only the apply actions that are correct for a block.
- Make a fragment's effect visible before it is applied, from the same code that
  performs the apply, so preview and apply cannot drift.
- Let a fragment express deletion, so small edits are not forced into whole
  listings.
- Shift the assistant toward returning the smallest correct edit.
- Reduce repeated input cost without changing what is sent.

**Non-Goals:**

- Diffing a whole listing against the current program (a real text-diff problem).
- Any change to the emulators, tokenizers, or machine behaviour.
- Any change to how much conversation history is sent (see the caching decision).
- New dependencies of any kind.

## Decisions

### Classification: the model declares, a heuristic cross-checks

The assistant tags the fence — ` ```basic ` for a whole listing,
` ```basic-partial ` for a fragment — and a line-number heuristic checks that
claim. Declared and heuristic agreeing (or the heuristic being inconclusive)
resolves; a direct conflict, or no tag with an inconclusive heuristic, resolves to
`unknown`.

**Why not a heuristic alone.** This was the tempting option and it is wrong. The
natural heuristic is "the block's line numbers are a subset of the program's, so
it is a fragment" — but a rewrite that *shrinks* a 40-line program to 12 lines has
exactly that shape. The dangerous case (merging a shrinking rewrite, resurrecting
28 dropped lines) is indistinguishable from the safe one. A heuristic cannot be
the primary signal.

**Why not the declaration alone.** Models drift, and an untagged reply would fall
back to today's ambiguous behaviour silently. The cross-check turns a mis-tag into
a visible "you choose" state instead of a wrong default.

**Why `unknown` rather than a safe default.** There is no safe default: replacing
with a fragment destroys the program, merging a full listing leaves stale lines.
When the signals conflict, asking is the only correct answer.

### Deletion: a bare line number

A fragment line that is only a line number deletes that line. This is how the edit
was expressed on the real machines, so it needs no explanation to the audience,
and it matches the existing comment's framing of merge as "how BASIC programmers
naturally think about edits".

Two guards: deletion applies **only** when merging a block classified as a
fragment, so a stray bare number inside a whole listing cannot silently destroy a
line; and binary line records are excluded, since they are taken from the existing
source by a separate path and must never be touched.

Alternative considered: an explicit `DELETE 250` directive. Rejected — invented
syntax the audience would not recognise from any of the machines, and more to
teach the model.

### The diff derives from the merge, not from a diff library

`mergeBasicLines` gains a sibling that returns the ordered change set —
context / added / removed / changed rows — and `mergeBasicLines` is re-expressed
in terms of it. The panel renders that same structure.

**Why not a diff library.** Unnecessary: the merge is a keyed map operation, so the
change set is exact rather than inferred. Also cheaper — the repo is
GPL-3.0-or-later and every new dependency needs a licence check and attribution.

**Why one function feeds both.** A preview computed separately from the apply is
the classic way these features go wrong. Deriving both from one plan makes the
drift untestable-by-construction, and a test asserting the two agree pins it.

**Why merge only.** A whole listing against the current program defeats the keyed
comparison the moment the rewrite renumbers or reorders, which is exactly when a
rewrite happens. That needs a real LCS diff and belongs in its own change.

### Inline, not side-by-side

The assistant panel is a narrow column and can sit in a split or tabbed layout.
Two columns of BASIC would wrap unreadably. Unified rows with a few lines of
context, collapsing untouched stretches, fits the space.

### Shared output-format rules move into the prompt builder

`buildSystemPrompt(dialect)` currently returns `aiProfile.systemPrompt` verbatim,
and all 13 profiles carry a byte-identical OUTPUT FORMAT bullet. The new rules —
when to send a fragment, the two fence tags, the bare-number delete — are
machine-independent and go in the builder; genuinely machine-specific bullets
(flush-left line numbers, RAM target, trailing sentence count) stay in the
profile.

**Why not edit 13 files.** The new rules are several lines, not one, and thirteen
copies is thirteen chances to drift. The spec requires the choice not to vary by
machine; one shared constant is how that is guaranteed rather than hoped for.

**Caching is unaffected**: composing a constant suffix keeps the result byte-stable
per dialect, which is what prefix caching needs.

Two per-dialect bullets do need editing: the ZX81 and ZX80 profiles instruct the
model to repeat binary records verbatim "when returning the complete program",
which is wrong advice for a fragment (it should omit them). Fragments are in fact
a win here — a fragment never re-emits those records, so that corruption risk
class disappears for small edits.

### Staleness: fingerprint the base, warn, don't block

The reply records a fingerprint of the source it was written against, carried
through the persisted conversation so it survives a reload. At apply time a
mismatch warns.

**Why warn rather than block.** Most edits still apply cleanly after an unrelated
change elsewhere in the program; blocking would be wrong more often than right.
Conversations stored before this change carry no fingerprint — treated as unknown,
no warning, matching today's behaviour.

The inline diff reinforces this without duplicating it: it is computed against the
*current* editor content, so a genuinely stale fragment visibly produces a nonsense
diff.

### Prompt caching: mark the prefix, change nothing about what is sent

The Anthropic adapter gains a top-level ephemeral `cache_control` at the default
5-minute TTL. Nothing else changes.

**Why this works already.** Caching is a prefix match over tools → system →
messages, and this app's prefix is already byte-stable: the system prompt is a
per-dialect module constant, there are no tools, and history is append-only and
copied verbatim. None of the usual silent invalidators (a timestamp in the system
prompt, a per-request id, non-deterministic serialisation, a varying tool set) are
present. The prefix is cache-ready and simply unmarked.

**Why the breakpoint must not go on the system prompt alone.** The minimum
cacheable prefix is model-dependent, and on the configured model it is 1024
tokens. Measured, the dialect prompts run roughly 700–1,670 tokens and most sit
*under* that line. A breakpoint there would silently never cache — no error, just
a zero cache-write count forever. Marking the end of the whole prefix clears the
minimum easily, because the first user turn already embeds the program.

**Why history is not trimmed.** The obvious saving — drop old turns, or strip the
embedded program from earlier ones — is in direct tension with caching and loses.
Any edit to an earlier turn changes the prefix and invalidates everything after
it, so the saving is repaid at full price on every later turn; it would also lose
the model's view of how the program evolved. Re-sending history verbatim is both
the accurate option and the cheap one.

**Adaptive thinking does not interact.** Toggling thinking invalidates the messages
cache but not the system cache, and the adapter sets it unconditionally and never
toggles it.

Expected, correct cache misses: switching machine changes the system prompt;
switching provider or model re-scopes the cache.

### Surfacing why the reply ended

The Anthropic adapter currently concatenates text blocks and never inspects why
generation stopped. Two consequences, both user-visible, both worth fixing here
because they produce the same destructive outcome this change exists to prevent:

- A reply truncated at the output limit arrives looking like a finished answer.
  The output limit is shared between adaptive thinking and the response text, so a
  long whole listing can stop mid-program — and the user can press *Replace
  program* on it.
- A declined request returns an empty body, which the existing empty-reply retry
  path mistakes for a transport failure, retries pointlessly, and reports as "no
  response twice".

The adapter surfaces the stop reason; the conversation store marks a truncated
reply incomplete (the display model already has an `incomplete` flag for
stop-mid-stream, which this reuses) and reports a decline as a decline.

Preferring fragments also reduces how often the output limit is approached at all.

## Risks / Trade-offs

- **The model mis-tags a block** → the line-number cross-check catches the
  clear-cut conflicts and degrades to an explicit user choice rather than a wrong
  default. Undo covers the rest.
- **The heuristic's thresholds are judgement calls** → they are only ever a
  cross-check, never the primary signal, so a mis-tuned threshold produces an
  extra "you choose" prompt rather than a wrong apply. Tuned against unit tests
  including the shrinking-rewrite case.
- **Preferring fragments is only a prompt nudge, not a guarantee** → accepted and
  planned for. Classification is deterministic and testable; the preference is
  not, and once a whole listing has arrived the tokens are already spent. The two
  halves are built and verified at different confidence levels, and the UI is
  correct either way.
- **A bare line number appearing in a fragment for some other reason** → deletion
  is gated on the block being classified as a fragment, and binary records are
  excluded. The inline diff also shows the deletion as a removed row before it is
  applied.
- **Existing conversations have no base fingerprint** → treated as unknown, no
  warning. Same behaviour as today; no migration needed.
- **A partial that changes nothing** → visible immediately in the diff as an empty
  change set, rather than an apply that appears to do nothing.
- **The apply path still cannot be covered end-to-end without a live provider** →
  the conversation is restored from storage on load, so a seeded conversation
  should make the button sets assertable without a provider. If that turns out not
  to be practical, it is called out rather than left silently uncovered.
- **Caching adds a write premium on the first turn** → a cache read costs about a
  tenth of an input token and a 5-minute write about a quarter more, so it pays
  back from the second turn. A conversation is multi-turn by definition; a
  one-shot request pays slightly more, which is the right trade.

## Migration Plan

No data migration. Conversations persisted before this change deserialise
unchanged — the base fingerprint is an optional field, and its absence is a
defined state (unknown base, no staleness warning).

Rollback is a straight revert: nothing here writes a new persisted format that an
older build would fail to read, and the added conversation field is ignored by
code that does not know about it.

## Open Questions

- Whether seeding a conversation into storage is enough to drive the apply buttons
  from an end-to-end test without a live provider. To be settled during
  implementation; if it is not workable, the gap is stated rather than papered
  over.
- The exact context width and collapsing threshold for the inline diff — a
  presentation detail to settle against a real narrow panel rather than in
  advance.
