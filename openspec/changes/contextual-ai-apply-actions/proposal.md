## Why

The assistant offers the same three actions — **Replace program**, **Merge
lines**, **Replace + Run** — under every code block it produces, regardless of
what the block actually contains. Nothing in the IDE knows whether a block is a
whole listing or a handful of changed lines, so it cannot steer the user, and
both mistakes are one click away: pressing *Replace program* on a fragment wipes
the program, and pressing *Merge lines* on a full rewrite resurrects every line
that rewrite deliberately dropped. Neither is recoverable by reading the screen —
the buttons look identical either way.

The same missing distinction is expensive. Every dialect's prompt currently
forbids fragments outright ("respond with the COMPLETE program, not a diff"), so
changing one line in a two-hundred-line program costs a full re-emission of that
program — once in the reply itself, and again on every later turn, because the
whole conversation is re-sent with each request.

## What Changes

- **Generated code blocks are classified** as a whole listing or a partial
  fragment. The assistant states which it is returning; the IDE cross-checks that
  against the block's line numbers and treats a disagreement as unknown rather
  than guessing.
- **Only the actions valid for the block are offered.** A fragment offers merge
  (and merge-and-run); a whole listing offers replace (and replace-and-run). When
  the kind genuinely cannot be established, both are offered and labelled as
  such. Applying stays a single click with no confirmation step — the editor's
  undo already recovers a mis-click.
- **A fragment is shown as an inline diff against the current program**, so what
  the merge will actually change is visible before it is applied. The block as
  the assistant wrote it stays available.
- **A fragment can delete a line**, written as a bare line number — how the edit
  is expressed on the real machines. Without this, any edit that removes a line
  forces a whole listing.
- **The assistant prefers the smallest correct edit**: a fragment when the change
  is notably smaller than the program, a whole listing for new programs and large
  rewrites. The output-format rules that say so are shared across machines rather
  than duplicated per machine.
- **A stale fragment is flagged.** A fragment is a delta against the program as it
  was when the reply arrived; if the program has changed since, the user is warned
  before merging rather than blocked.
- **A truncated or declined reply is no longer offered as ordinary code.** A reply
  cut short by the output limit is marked as incomplete instead of appearing as a
  finished answer that can be applied, and a declined request is reported as such
  instead of being retried as an empty reply.
- **Repeated context is cached** between turns of a conversation. No change to
  what is sent — purely a cost reduction.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: the requirement that generated code lands in the editor safely
  changes — the apply actions offered are contextual to the kind of code block,
  a fragment's effect is visible before it is applied, and a fragment may delete
  lines. Adds a requirement that the assistant returns the smallest correct edit,
  and a requirement that an incomplete or declined reply is not presented as
  applicable code.

## Non-goals

- **No diff for the replace path.** Comparing a whole listing against the current
  program is a general text-diff problem (renumbering and reordering defeat a
  line-number comparison) and would need a diff algorithm or a new dependency.
  Separate change.
- **No side-by-side diff.** The assistant panel is narrow; the diff is inline.
- **No confirmation dialogs.** Undo already covers a mis-click, and a confirm step
  on every apply would cost more than it saves.
- **No new dependencies.**
- **No trimming, summarising or rewriting of conversation history.** Editing an
  earlier turn breaks the reusable prefix that makes caching work, so it would
  cost more than it saves as well as losing the record of how the program evolved.
- **No token accounting or cost display** in the UI.
- **No change to the emulator, tokenizers, or any machine-specific behaviour.**

## Impact

- **Affected capability spec:** `openspec/specs/ai-assistant/spec.md`.
- **Affected code:** the AI code extractor and line merge, the prompt builder, the
  assistant panel and its styles, the conversation store and its persisted shape,
  the Anthropic provider adapter, and the shared output-format rules currently
  duplicated across every dialect's AI profile.
- **Affected tests:** colocated tests for the extractor, prompt builder and
  conversation store; the assistant's end-to-end folder.
- **Affected docs:** the contributing architecture page names the current buttons.
- **Dependencies:** none added. The inline diff is computed from the same merge
  logic that performs the apply, so no diff library is introduced.
- **Migration:** conversations persisted before this change carry no record of the
  program a reply was based on; those are treated as unknown and simply do not
  raise a staleness warning, matching today's behaviour.
