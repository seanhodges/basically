## Why

The language server colours a listing by walking the bound machine's own reading
of it, and that walk is bounded by a parse budget. When the budget runs out the
answer is not a shorter answer — it is a **cliff**. The fallback is the lazily
parsed tree, which covers a fixed few kilobytes whatever the program's length,
so the editor is told the colour of the first three kilobytes and nothing about
the rest:

| Listing | Coloured when the budget runs out |
| ------- | --------------------------------- |
| 13 KB   | 22.8% |
| 56 KB   | 5.4% |
| 114 KB  | 2.7% |

The budget is generous enough that nothing in this repository triggers it — the
largest bundled sample is 3.6 KB — but it is not generous enough to be safe. A
Spectrum program is capped at what the machine holds, about 48 KB of source, and
that parses in ~35ms against a 50ms budget: inside it on an idle machine, over it
on a busy one. That is not hypothetical. The same budget, in the same shape, has
already failed once on a loaded CI runner measured at roughly five times slower.

And it does not heal. The document's `EditorState` is cached per version, so
every request about an unedited program reuses one state; five successive
requests each timed out and each reported the same three kilobytes. **The design
note shipped with `colour-a-program-by-its-machine` claims a budget that runs out
"resolves itself on the next request". That is wrong, and this change corrects
it.** Nothing resolves it until the user edits the program — so a listing opened
to be *read* stays uncoloured for as long as it is open, and pays the full
timeout on every request to stay that way.

The deeper fault is that one number is serving two callers with different needs.
A budget is a latency cap, and it is the right idea for the click path, which
answers synchronously and whose failure is one missing menu row. A colour request
is asynchronous — the editor is not waiting on it — and its failure is a listing
that renders essentially uncoloured. The browser editor never meets this because
CodeMirror keeps parsing in the background between frames; the language server is
request and response, with no such loop to finish the job.

## What Changes

- **Colour reported for a program covers the whole of what was asked about.** An
  answer about a program is about all of it, and an answer about a range is about
  all of that range — not about however much happened to be parsed in time.
- **The claim that a short answer heals itself is withdrawn**, in the specification
  and in the design note that made it.
- **The cost of colouring is separated from the cost of answering a click.** What
  bounds an interactive answer is not what should bound one the editor is waiting
  on asynchronously.
- **What the click path does is unchanged.** Its budget, its fallback and its
  failure mode all stay as they are; this change stops colour from inheriting them.

No breaking change: an editor that asks for colour today gets a more complete
answer, in the same shapes, for the same requests.

## Capabilities

### New Capabilities

None. Colour is already a capability the product has; this is that capability
made honest about its own completeness.

### Modified Capabilities

- `language-server`: the requirement *A program is coloured by the machine it is
  for* gains the guarantee that the colour reported covers all of what was asked
  about. It currently says which runs are reported and by which machine's reading,
  and says nothing about how much of the program is reported at all — which is
  the whole of this gap.

## Impact

The exposure is **exclusively colour**, which is worth stating precisely because
it bounds the change. Only two callers reach the lazily parsed tree at all:

- `src/lsp/semanticTokens.ts` → `tokensIn`, over a whole program or a range.
  This is the one at risk: what it asks to have parsed grows with the program.
- `src/editor/referenceRow.ts` → `tokenAt`, over one position, reached from
  `src/lsp/hover.ts`. It forces the parse only to the end of the line the cursor
  is on, so what it asks for does not grow with the program.

Every other answer the server gives — diagnostics, completion, definition,
symbols, references, highlights — reads the program through the scanners
(`collectVariables`, `findVariableUsages`, `lineNumberReferenceAt`,
`resolveLint`) rather than the tree, and is unaffected. No spec or behaviour of
theirs is touched.

Affected code: `src/editor/tokenAt.ts` (`treeCovering`, `PARSE_BUDGET_MS`),
`src/editor/tokenRuns.ts`, `src/lsp/semanticTokens.ts`, and the design note in
`openspec/changes/archive/` or `openspec/changes/colour-a-program-by-its-machine/`
that carries the withdrawn claim.

## Non-goals

- **Changing what the browser editor shows or how fast it shows it.** The IDE
  parses in the background and does not have this problem; its budget for a click
  is correct for a click and is not being retuned here.
- **Changing the click path's fallback.** `tokenAt` returning nothing when the
  parse lags is the right answer for a click and stays.
- **Making the other LSP answers complete.** They are already complete — they do
  not read the lazy tree. Nothing to fix, and saying so is part of this change
  rather than work in it.
- **Colouring a program the server could not bind to a machine.** That is
  deliberate and unchanged: no machine, no colour.
- **Semantic token deltas.** Still not implemented, still not worth the
  bookkeeping; completeness is a separate question from re-sending less.
