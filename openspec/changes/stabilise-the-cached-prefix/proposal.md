## Why

Every request carries the machine's whole language definition. Composed, that is
19,223 characters on a ZX80 and 37,544 on a BBC Master — roughly five to ten
thousand tokens, of which the machine description is between two thirds and three
quarters. That size was chosen deliberately: a summary of a machine is a summary
the assistant fills in from memory, and for the less famous machines its memory is
of a more famous relative.

It was also chosen on the understanding that it would be paid for once and read
back cheaply thereafter. `ground-generation-in-the-reference` says so in as many
words — a fuller description crosses the provider's minimum cacheable size, "after
which it is re-read at a fraction of its cost".

That has never happened. Three separate things vary inside the part of the request
the provider's cache keys on, and any one of them alone is enough to miss:

- The conversation replayed to the provider is rebuilt from what the panel shows,
  not from what was sent. A request is sent carrying the program and its errors;
  every later turn replays that same position as the bare sentence the user typed.
  The prefix therefore stops matching immediately after the system prompt, on
  every turn from the second onward.
- Whether the assistant is told it can drive the machine depends on which code
  path raised the request. The panel's own requests say it cannot; the requests
  the store raises to check and correct an answer say it can. That is a two
  kilobyte difference inside the system prompt, changing back and forth within one
  conversation.
- The tools are offered only by the turn that drives the machine. Tools are
  rendered ahead of the system prompt, so a set that appears and disappears
  invalidates everything behind it.

The comments around this code assert the opposite in each case — that the prefix
is byte-stable, that the tool set is fixed for a conversation. They describe an
intent the code does not carry out, which is why the defect has been invisible.

The cost is paid on every turn: the whole prefix is written at the cache's write
premium and never once read back. Nothing about the assistant's answers is wrong
today — this is a bill, not a bug in the output — but it is a bill nobody agreed
to, and it is roughly seven times the correct one by the fifth turn of a
conversation.

## What Changes

- The conversation replayed to the provider SHALL be what was actually sent. The
  panel keeps showing the user's own sentence; the wire keeps the full request it
  made. The program then appears once per turn in the history rather than only in
  the newest turn — which is the cost of a stable prefix, and a small one: the
  largest program any bundled sample reaches is 3,605 bytes, and history that
  matches is read at a tenth of the price of a prefix that does not.
- What the assistant is told about showing the screen and driving the machine
  SHALL be resolved once, from the chosen provider, and be the same for every
  request in a conversation. The two flags stop being optional, so a caller cannot
  omit one and silently get a different system prompt.

  This is the one place the change is visible in what the assistant is told, and
  it is a correction rather than a side effect. On a provider that can be given
  the machine, the user's own turns currently say the machine **cannot** be
  driven, and the turns the IDE raises to check an answer say it can. The first of
  those is simply false, and the assistant is being told it on exactly the turn
  where it is writing the program it might later want to drive.
- A conversation SHALL offer the same tools on every turn on a provider that
  supports them, rather than only on the turns that intend to use one. Driving is
  still asked for in the reply and still granted only once a program has been run
  and observed; what changes is that an attempt to act on the machine outside that
  window is refused and reported, rather than dropped without trace as it would be
  today.
- The comments that assert stability the code does not deliver are corrected, and
  the claim that the composed description falls under the provider's minimum
  cacheable size is removed. It does not: the smallest machine's prompt clears
  that minimum several times over.
- Both properties gain tests. The composed prompt is pinned byte-for-byte per
  machine, and its size is pinned per machine against a ceiling, so a section that
  grows says so in a failing test rather than on a bill. The design behind
  `ground-generation-in-the-reference` undertook to record those sizes and did
  not; this pays that debt in a form that cannot go stale.
- Whether to hold the cache for an hour rather than five minutes, and whether to
  spend a second of the four available breakpoints on the system prompt, are
  settled by measurement once the prefix is stable. Neither is worth deciding
  while the cache never reads.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: "The assistant can drive the program it wrote" gains two
  guarantees. What the assistant is told about whether the machine can be driven
  must describe what the chosen provider can actually do and must not vary between
  turns of one conversation — today it varies, and on the user's own turns it is
  wrong. And an attempt to act on the machine outside the window in which the
  machine is given must be refused and reported rather than passed over in
  silence, which is what makes a constant tool set safe.

Nothing else about what the assistant knows, what it answers, or what the user
sees changes. Everywhere but the driving rules the same text is sent, in the same
order, with the same meaning; what changes is that the provider can recognise it
as something it has already seen. The rest of `openspec/specs/ai-assistant/`
describes behaviour this change is careful to preserve, and is the check on it.

## Non-goals

- **Making the system prompt smaller.** Whether the machine's full command set
  needs to be standing context is a real question, and a separate one. It cannot
  be answered honestly while the cost of carrying it is seven times what it should
  be, and fixing that may shrink the question to nothing.
- **Moving the reference behind a tool.** Same reason, and it would additionally
  leave the two providers that do not support tools with no machine description at
  all.
- **Changing what the assistant is told.** No section is added, removed or
  reworded. The one wording change is to a comment.
- **Trimming the conversation.** History is not windowed, summarised or capped
  here. Growth is bounded in practice by the conversation resetting with the
  program, and a fat history that hits the cache is cheaper than a lean one that
  misses.
- **Reporting the cost to the user.** The instrument that makes this change
  verifiable in production is `report-what-a-request-cost`.

## Impact

- `src/ai/aiStore.ts` — the thread keeps the request as sent alongside the request
  as shown, and replays the former. `persist` decides which of the two reaches
  storage; conversation storage shares a few megabytes with the autosaved program,
  so this is a budget question, not a free one.
- `src/components/AiPanel.tsx` — two call sites that pass one capability flag and
  let the other default. Making both parameters required in `loadSystemPrompt`
  turns this class of mistake into a compile error, which is what strict
  TypeScript is for here.
- `src/ai/promptBuilder.ts` — the signature change; no change to what it composes.
- `src/ai/aiStore.ts`, `src/components/DocsDrawer.tsx`,
  `src/components/NewProjectDialog.tsx` — the other callers of the same function,
  each currently resolving the flags its own way.
- `src/ai/providers/anthropic.ts` — the comments; the cache TTL and breakpoint
  count if measurement supports changing them.
- `src/ai/aiClient.ts` — tools offered per conversation rather than per turn. The
  seam already strips tools for providers that do not support them and already
  bounds the exchange loop, so a turn that offers tools and never calls one
  behaves exactly as it does now.
- New colocated tests beside `src/ai/promptBuilder.test.ts`, driven from the
  dialect registry so every registered machine is covered rather than a chosen
  few.

No dialect, emulator or machine-boundary changes, and no new dependencies.
