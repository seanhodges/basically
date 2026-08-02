## Context

The porting comparison already works the port out. For a given pair of machines
it computes which commands the target lacks and what to write instead, which are
spelled differently, which behave differently, which mean something else under
the same name, which control codes change, and what is specific to this pair —
and, inside the IDE, it narrows all of that to the commands the open program
actually uses.

`Convert with AI` then discards it. The guide posts `{ toId, toLabel }` to the
app, and the app turns that into one sentence naming the target. The assistant
is not told which machine the program is coming from, let alone what the
comparison found. The port is worked out twice: once from tested data and thrown
away, then again from the model's recollection.

Everything needed to stop doing that is already in place. `ground-generation-in-
the-reference` moved the comparison engine out of the documentation site into
`src/reference/`, where the application can reach it, and left the question of
what to do with the pair-anchored porting data as an open question for this
change. The app already computes the open program's vocabulary — it is what it
sends the guide so the guide can narrow — so the narrowing input needs no new
analysis.

See `docs/contributing/architecture.md` for the reference layer, the AI request
path and the documentation-iframe boundary; this document records only what is
decided on top of them.

**Dialect / MachineEmulator seam: no impact.** Nothing here touches
`src/dialects/types.ts`, a tokenizer, an emulator or a machine adapter. The
change lives in the reference layer, the AI request builders, one React
component and one Vue component. `Dialect` is read for the four fields the
reference layer already reads from it (`id`, `name`, `manufacturer`, `year`, and
`docsReference` for the page slug).

## Goals / Non-Goals

**Goals:**

- A conversion request carries what the comparison worked out for this program:
  the source machine and the BASIC it runs, the commands the program uses that
  the target lacks with the advice written for each, the renames, the behaviour
  changes, the same-word-different-meaning warnings, the control codes to
  replace, and the guidance specific to this pair and this target.
- What travels is narrowed to the program, exactly as the guide's own report is.
- A port with nothing to work from — no program, or one that cannot be read as
  the language being ported from — is declined with a reason the user can act
  on, rather than attempted from recollection.
- Assembly happens where the program is, so a later entry point that is not the
  guide can reuse it unchanged.
- Every other part of the offer behaves identically: same trigger, same switch
  to the target machine keeping the program, same path when no assistant is
  configured, same text in the conversation thread.

**Non-Goals:**

- Changing what the comparison computes, how it narrows, or how it is displayed.
  `DialectCompare.vue` is not refactored onto the new composer.
- Automating the port. The user still asks, still reviews, still applies.
- Passing what the program did not use. The target's added capabilities stay
  out.
- Offering conversion from anywhere new.
- Verifying the ported program.

## Decisions

### 1. A pure composer in `src/reference/`, loaded on demand from `src/ai/`

New module `src/reference/portDescription.ts`, named to pair with the
`machineDescription.ts` that already sits beside it and composes the machine's
own definition for the system prompt. It is pure and node-testable, and imports
only its siblings — the rule `compare.ts` is written under and the reason both
the static documentation build and the IDE can use it.

```ts
export interface PortSide extends MachineIdentity {
  /** The machine's reference page, loaded on demand by the caller. */
  table: ReferenceTableData;
  /** Its escape table, where its page has one. */
  escapes?: EscapeTableData;
}

export function describePort(
  from: PortSide,
  to: PortSide,
  vocabulary: ProgramVocabulary,
): string;
```

`vocabulary` is required, not nullable: by decision 6 there is no path to a
conversion request without a readable program, so a null case would be
unreachable code pretending to be a policy.

Only the four tables are arguments, because those are what must stay
code-split; everything else it needs (`porting.ts`, `facts.ts`,
`domain-guidance.ts`, `domains.ts`) is module-level constant data it imports
directly, as `machineDescription.ts` does.

The app side is a thin loader, `src/ai/portReport.ts`, because
`eslint.config.js` forbids static imports of `src/reference/**` from
application code. Composing app-side instead would mean threading nine dynamic
imports through one function — `compare`, `porting`, `facts`,
`domain-guidance`, `domains` and the four tables — which is how that boundary
gets quietly worked around the next time someone needs it. The split already
exists once in this repository and is documented; a second, differently shaped
one would invite exactly the drift this change is trying to remove.

*Alternative rejected:* composing entirely in `src/ai/`. It loses the
node-testability that lets the composer be swept over every machine pair the
way `perMachineCompare.test.ts` is, and hides the composition behind dynamic
imports.

*Alternative rejected:* rewiring `DialectCompare.vue` to render from the shared
composer, so the guide and the assistant could not drift. It is an explicit
non-goal, the Vue script block is not typechecked, and the two consumers
genuinely differ — the page renders what the target adds, truncation controls
and the narrowing notice, none of which belong in a request.

### 2. The recipe is the guide's recipe

`describePort` replicates `DialectCompare.vue`'s composition step for step, so
the two answers come from the same calls with the same arguments:

1. `tableForMachine(page, id)` per side.
2. `diffKeywords(sourceTable, targetTable, { from, to, equivalences: keywordEquivalences })`.
3. `composeGuidance({ from, to, targetFacts, pairNotes: pairPortingNotes, falseFriends, domainGuidance })`.
4. `diffEscapes(sourceEscapes, targetEscapes)`.
5. Narrow with `diffForProgram`, `falseFriendsForProgram`, `escapeDiffForProgram`
   when a vocabulary is given.
6. Group with `capabilitySections(...)` and `escapeSections(...)`.

One trap to keep pinned by a test rather than by care: `DiffContext.from`/`to`
and `composeGuidance`'s `from`/`to` are **documentation page slugs**, while
`tableForMachine` takes **machine ids**. Several machines share a page. Both
values sit on `MachineIdentity`, so the mistake is available at every call site.

`capabilitySections` is called with `[]` for `newlyAvailable`, which enforces
the "do not pass what the program did not use" non-goal structurally, at the
point the sections are built, rather than by filtering the output afterwards.

### 3. Section shape

ALL-CAPS headings, `- ` bullets, sections joined by a blank line, empty sections
dropped — the register `machineDescription.ts` established, so the standing
machine description and the per-request findings read as one document rather
than two pasted together.

```
PORTING THIS PROGRAM     the two machines, the BASIC each runs, and that what
                         follows comes from the project's reference data,
                         narrowed to this program, and is to be preferred to
                         recollection
BEFORE YOU START         pair notes, then target notes (never narrowed)
SAME WORD, DIFFERENT MEANING
COMMANDS THIS PROGRAM USES THAT <TARGET> DOES NOT HAVE
                         by capability, with the `instead` line and the
                         substitution for each command
COMMANDS TO RENAME
COMMANDS WHOSE USAGE DIFFERS
CONTROL CODES THIS PROGRAM USES THAT <TARGET> DOES NOT HAVE
```

Deliberately left out:

- **`DomainGuidance.example` code blocks.** `describeMachine` already puts them
  in the system prompt verbatim for the target machine. They are the bulkiest
  part of the guidance and repeating them buys nothing.
- **What the target adds** — keywords and escapes both. Not work this port
  requires.
- **Language and hardware fact rows.** Not in the requirement's list, and the
  target's full language rules already lead the cached system prompt.
- **Escape `behaviourChanged`.** `escapeDiffForProgram` narrows only
  `mustReplace`; narrowing the other bucket would be new comparison logic and a
  fresh source of drift. "The control codes that must change" is `mustReplace`.

The `instead` lines and the substitutions for commands the program uses are
kept even though the system prompt carries the same sentences for the target
machine, because their value here is the linkage — *this program's* `POKE`, and
what to write for it — and each is one line, bounded by the program.

### 4. The findings travel in the user turn

They vary with the program, so they cannot go in the system prompt without
destroying the byte-stability per dialect that the providers' prefix caching
depends on. They are appended to the `request` argument of `buildUserMessage`,
which puts it last, so a turn reads: program → findings → the ask. No signature
in `promptBuilder.ts` changes, and its other callers are untouched.

### 5. The source machine travels with the request

`COMPARE_CONVERT_FIELDS` gains `fromId`, and `DialectCompare.vue` posts it. A
message asking for a port should say what the port is — both ends of it — and
the contract is pinned for free, because `DocsDrawer.test.ts` already asserts
that the fields the Vue side posts are exactly `COMPARE_CONVERT_FIELDS`. No
`fromLabel`: the app resolves the dialect from the registry and has the name,
manufacturer and year already. `toLabel` exists only because it predates the
id-based lookup.

The drawer resolves the source in three steps, before the machine switch:

1. `data.fromId`.
2. The source machine the guide last named in its vocabulary request. The
   documentation site is a separately built artifact with its own service
   worker, so a cached older bundle posting only `toId`/`toLabel` is a real
   case, not a hypothetical.
3. Neither resolves, or resolves to the target — **send today's message with no
   report.**

*Never* the IDE's selected dialect. The guide is normally reached by switching
to a machine that will not run the program and keeping it, so at convert time
the selected dialect is the machine being ported *to*. A source machine guessed
wrong yields confidently wrong advice carrying the authority of tested data,
which is worse than the recollection it replaces.

### 6. Without a readable program the port is declined, not attempted

The status decision is the one `vocabularyReply` already makes: tokenize as the
machine being ported *from*, using `tokenize().errors` and never `lint()`, so
ordinary half-finished editing does not keep discarding the narrowing. Only
`'ready'` proceeds.

`'empty'` and `'unreadable'` cancel the conversion. Nothing is sent, the machine
is not switched, the program is not touched, and the status bar says why —
`setStatusNotice`, the same channel a failed shared-program load and a failed
import already use, rendered by `StatusBar`. Two messages, naming the actual
obstacle: there is nothing written to convert, and the program cannot be read as
<source machine> BASIC so there is nothing to work the port out from.

This is the same shape as the unconfigured-assistant path that requirement
already owns — accepting an offer in a state that cannot produce an answer stops
early and says so, leaving machine and program as they were — and it is why the
new scenarios live in that requirement rather than beside the report.

*Alternative rejected:* handing over the un-narrowed report, mirroring what the
guide displays for an unreadable program. It is the more literal reading of "as
the comparison's own report is", but the guide is *showing a human* every
difference to browse, whereas the request is *instructing a model* to carry out
a port. Narrowed to nothing, the second becomes the assistant's own recollection
of both machines with the guide's authority stamped on it — the exact failure
this change exists to remove. Declining is the honest answer, and the user is
one keystroke from making the program readable.

*Alternative rejected:* hiding or disabling the button in the guide when the
program is empty or unreadable. The guide already knows the narrowing state, so
it could. But the app must handle the case regardless — a cached older
documentation bundle, or a future entry point that is not the guide — and a
button that vanishes explains less than a message that names the problem.

### 7. Degrade, never block

The report is an enhancement to an offer that already works, reached by a
click. So `loadPortReport` returns `null` rather than throwing: an unregistered
reference or escape page, a machine with no porting facts, a pair with no escape
tables, and `from === to` all fall back to today's message. This is the opposite
of `loadMachineReference`, which throws for an unregistered page because a test
sweeps every registered dialect and would catch it before a user could.

Note the two failure modes are deliberately different. A missing *source
machine* or a missing *reference page* is the app's own gap, invisible to the
user and no reason to refuse work it can still do adequately — so it degrades to
today's message. A missing or unreadable *program* is the user's own state, one
they can see and fix, and there is no adequate port to be had from it — so it
stops and says so (decision 6).

Everything the requirement says is unchanged stays unchanged, and is listed here
so a reviewer can check it: the trigger is the same button and message type;
`aiCredentials()` is still consulted first, so an unconfigured assistant still
opens its settings and leaves machine and program alone; the switch is still
`openSharedInIde({ dialectId, source })` followed by `showAiPanel()`; the
`displayRequest` shown in the thread is still `Convert this program to <label>`;
`maxTokens` and `baseSource` are untouched. The report and the system prompt are
awaited together, so the click does not serialise two chains of dynamic imports.

The program check from decision 6 goes *after* the credentials check and before
the switch, so the existing order is preserved: a user with no assistant sees
the same thing they see today whatever their program looks like. The whole guard
sits before `openSharedInIde`, which is what makes "the machine and the program
are left as they were" true for both cases rather than only the first.

## Risks / Trade-offs

- **[Risk] The guide's display and the request's report drift apart.** A future
  change to the page's recipe would not touch `portDescription.ts`. → Both call
  the same `compare.ts` functions with the same arguments; the composer's header
  names the page as the recipe it mirrors and the page carries a pointer back.
  The narrowing is pinned behaviourally: a command outside the vocabulary must
  never appear. Structural enforcement would mean refactoring the page, which is
  a non-goal.

- **[Risk] The report repeats what the system prompt already says**, wasting
  tokens and reading as contradiction where the two are phrased differently. →
  The example code blocks are dropped, capability guidance appears only for
  capabilities the program actually loses commands in, and substitutions only
  for commands in the narrowed set.

- **[Risk] A large program on a distant pair makes the turn big**, and unlike
  the system prompt it is not cached. → Bounded by the program's vocabulary
  rather than by the machines, which is what narrowing is for; the target's
  additions are never included; commands are named in runs per capability rather
  than one row each; a size bound is asserted by test.

- **[Risk] A stale cached documentation bundle posts no `fromId`.** → The
  fallback chain, ending in no report rather than a wrong one. The offer itself
  never breaks.

- **[Risk] The decline fires on a program the user considers fine**, turning a
  working button into a refusal. → The verdict is `tokenize().errors` filtered by
  `hasFatalErrors` — the same test the guide already uses to decide whether to
  narrow, so a program the guide is narrowing for will always convert. Variable
  and keyboard-entry advice does not count. The message names the obstacle and
  the machine it was read as, so the fix is visible rather than guessable.

- **[Trade-off] A user with a half-written program can no longer get a rough
  port.** Accepted, and it is the point: the request would have carried the
  guide's authority over the assistant's recollection. The program is one
  correction away from converting, and the editor already marks where.

- **[Risk] `ProgramVocabulary` is declared twice** — in `compare.ts` and in
  `programVocabulary.ts` — and could diverge silently. → A type-level
  assignability assertion in a test, which is exempt from the import rule.

- **[Trade-off] Control codes whose meaning changed between the machines are not
  handed over**, only the ones the target lacks, because that is the only bucket
  the narrowing covers. Reporting them would mean new comparison logic.

- **[Trade-off] Two consumers now compose from one engine**, so the engine's
  functions have a second caller constraining them. Accepted: that is the point
  of having moved it into `src/`.
