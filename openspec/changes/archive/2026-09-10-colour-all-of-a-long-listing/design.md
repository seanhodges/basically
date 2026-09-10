## Context

How the language server reaches the browser editor's own reading of a program —
`src/lsp/` holding pure handlers, one `EditorState` per open document, colour
walking the same stream-language tree a click resolves a point in — is described
in `docs/contributing/architecture.md` (*Serving an editor: the language server*).
Nothing about that shape changes here.

What changes is a number. `treeCovering` in `src/editor/tokenAt.ts` is

```ts
ensureSyntaxTree(state, upto, PARSE_BUDGET_MS) ?? syntaxTree(state)
```

with a single 50ms budget, and it has two callers whose needs turn out not to be
the same one:

| Caller | Asks to parse | Editor is | Failure looks like |
| ------ | ------------- | --------- | ------------------ |
| `tokenAt` (a click, via `referenceRow.ts`) | to the end of one line | waiting | one missing menu row |
| `tokensIn` (colour, via `semanticTokens.ts`) | to the end of a program or range | not waiting | the listing renders uncoloured |

The first is bounded by a line however long the program is. The second grows with
the program, so it is the only one that can reach the budget — and when it does,
the fallback is the lazy tree, a fixed ~3 KB, which is why the failure is a cliff
rather than a shorter answer.

## Goals / Non-Goals

**Goals:**

- Colour reported for a program covers all of what was asked about.
- The interactive path keeps the budget and the fallback it has, because both are
  right for a click.
- The cost of the new guarantee is known and stated in numbers, not asserted.

**Non-Goals:**

- Retuning the click budget, or changing anything the browser editor shows.
- Making the other LSP answers complete — they never read the lazy tree, so they
  already are.
- Semantic token deltas; incremental parsing across requests.

## Impact on the Dialect / MachineEmulator seam

**None.** No member is added to `Dialect` or `MachineEmulator`, and no dialect
file changes. The classification still comes from `Dialect.languageSupport()`;
this changes only how long the server is willing to spend reading it.

## Decisions

### The budget belongs to the caller, not to the module

Two callers with different exposure are sharing one constant, and the one that
can actually reach it is the one the constant was not chosen for.

**Decision: `treeCovering` takes the budget as an argument.** `tokenAt` passes the
interactive budget it already has; `tokensIn` passes its own. The shared helper
keeps its job — a tree parsed at least this far, or the lazy one — and stops
deciding a policy that differs between its callers.

The alternative, raising the single constant until colour is safe, was rejected:
it would silently give the click path a latency cap chosen for a request nobody
is waiting on, which is the same conflation in the other direction.

### Colour parses to completion

Measured on this machine, the stream parse is linear at roughly 0.2ms per
kilobyte:

| Listing | Unbounded parse |
| ------- | --------------- |
| 56 KB (larger than a Spectrum can hold) | ~35ms |
| 111 KB | 61ms |
| 584 KB | 109ms |
| 1.2 MB (25× any machine's memory) | 240ms |

**Decision: the colour path parses without an interactive cap.** A listing is
bounded in practice by what the machine it is for can hold — tens of kilobytes,
so ~10ms — and even an absurd file is a fraction of a second, once, on a request
the editor is not blocked on. Buying completeness for that is the right trade.

A generous backstop cap — seconds rather than milliseconds — was considered and
rejected. It would re-admit exactly the silent truncation the specification now
forbids, in return for protecting against a case the linearity above says does not
exist: a stream language tokenizes each line once, so there is no input that makes
this super-linear.

### The withdrawn claim is corrected where it was made

The shipped design note for `colour-a-program-by-its-machine` says a budget that
runs out yields what was parsed and "resolves itself on the next request".
Measurement says otherwise: the `EditorState` is cached per version, the timed-out
parse keeps none of its progress, and five successive requests each returned the
same ~3 KB. **Decision: correct that note rather than leave a false statement
standing in the archive**, since the next person to read it would reason from it.

## Risks / Trade-offs

- **A very large document delays other requests on the same connection** → The
  server answers serially, so a 240ms parse of a 1.2 MB file holds up whatever is
  behind it. Accepted: that file is 25× larger than any machine this product
  targets can load, the cost is linear and one-off per document version, and the
  editor asks for a range rather than the whole program whenever it is showing
  one screen of a long file.
- **The measurements come from one machine** → They set the shape (linear, sub-
  millisecond per kilobyte), not a threshold anything depends on. Nothing in the
  design turns on a specific number, which is the point: removing the threshold is
  what removes the class of failure that produced this change and the CI failure
  before it.
- **A test could re-encode the old cliff by accident** → The test that already
  proves `tokensIn` reaches past the lazy region asserts its own premise; the new
  work adds one that asserts completeness for a listing far larger than the old
  budget would have covered, so a reintroduced cap fails loudly.
