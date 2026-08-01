## Context

The porting guide lives in the VitePress docs site
(`docs/reference/compare.md` → `DialectCompare.vue`), which diffs two static
hand-authored tables. The IDE hosts that site in an iframe and already exchanges
same-origin messages with it (`docs-ready`, `docs-navigate`, `compare-convert`).
The program being edited lives on the app side; the tables live on the docs
side; neither knows about the other. See `docs/contributing/architecture.md` for
the overall layering.

Two existing cross-checks make the join cheap and safe:

- `docs/reference/data/keyword-crosscheck.test.ts` pins each dialect's keyword
  table to its reference rows **per machine**, so a keyword name means the same
  thing on both sides of the seam and drift fails a test.
- `docs/reference/data/escapes/escape-crosscheck.test.ts` pins every escape row
  to the dialect charset byte-by-byte, and each row already declares the byte
  values it claims.

One hard constraint shapes everything: `src/` must never import from `docs/`
(`tsconfig.app.json` includes only `src`), and the docs *runtime* must never
reach the dialect registry, which pulls in every emulator core. Only plain data
may cross.

**Dialect / MachineEmulator seam:** the emulator seam is untouched. The
`Dialect` seam gains one optional descriptive flag (whether the dialect's ROM
tokenizer matches keywords greedily across spaces) — a fact four dialects
already state privately, hoisted so that a consumer outside the editor can read
it. No machine-specific code moves, and nothing bypasses the seam.

## Goals / Non-Goals

**Goals:**

- Report only the differences the open program is actually subject to, without
  ever hiding a difference silently.
- Keep the docs side pure: no `src/` import, no dialect code, all filtering
  testable as functions over the already-computed diff.
- Leave a standalone visit to the docs site indistinguishable from today.

**Non-Goals:**

- Narrowing the fact table or the prose guidance (they are program-independent).
- Narrowing what the target adds (already governed by its own control).
- Byte-exact keyword extraction. See the trade-off below.

## Decisions

### Handshake, not a one-way push

The guide requests the program's vocabulary when it mounts; the IDE replies, and
re-pushes when the program or machine changes while the drawer is open.

*Alternative — push only, on `docs-ready`:* rejected because the docs frame is
client-routed and long-lived. The reader may reach the guide many navigations
after the frame loaded, by which time a single push has long since been sent to
a page that did not exist yet.

*Alternative — pull only, once on mount:* rejected because the program is edited
while the drawer is open, and the guide would silently go stale.

The reply is only ever sent in response to a request, so a drawer sitting on a
reference page costs nothing.

### Keywords cross as names; escapes cross as bytes

Keyword names are already identical on both sides and cross-checked, so a bare
list of spellings is enough.

Escapes deliberately do **not** cross as spellings. A spelling match would have
to reconcile aliases (`{wht}` against the canonical `{white}`), operand-carrying
forms (a program's `{INK 2}` against the table's `{INK n}`) and raw-byte escapes.
Byte values have none of those problems, and every escape row already declares
the bytes it claims — including a catch-all row for bytes no other row names.
For an operand-carrying escape only the first byte identifies the code, which is
the same rule those rows are authored under.

### Filter the diff's output, never its input

The narrowing applies to the *buckets* `diffKeywords` returns, not to the table
handed to it.

This is the load-bearing decision. Narrowing the source table first would be a
smaller diff and is wrong: every keyword the program did not use would vanish
from the source side and reappear as "newly available on the target", inverting
the meaning of the entire gains half of the page. Computing the full diff and
then narrowing `mustReplace`, `renamed` and `behaviourChanged` — while
`newlyAvailable` and the unchanged count pass through untouched — keeps every
other number on the page meaning what it says.

### The narrowing is tied to the machine being ported from

A vocabulary describes one language. The moment the reader points the comparison
at a different source machine, those keyword names no longer refer to the
language on screen, so the narrowing switches itself off and its control
disappears rather than filtering by a vocabulary that does not apply.

The same fact makes opening on the program's machine the right default: it is
the one selection under which the narrowing is meaningful. A link that names a
source machine still wins — a shared comparison must resolve to the comparison
it named.

### Text scan over a tokenize round-trip

The analyser blanks string contents and comment tails, then walks the remaining
code with the editor's own longest-match keyword index — the same matching the
highlighter and the variable scanner use, so the guide agrees with what the
editor shows.

*Alternative — tokenize then detokenize then scan:* would additionally resolve
abbreviated entry, at the cost of a full tokenize per edit and a dependency on
detokenization being lossless. Rejected for now, but the analyser's signature is
deliberately narrow enough that swapping the body later changes nothing else.

Matching greedily across spaces is correct for the dialects whose ROM tokenizer
does so and wrong for the rest, where it would find keywords inside ordinary
variable names. Hence the one new flag on the `Dialect` seam.

### One page-level control, phrased as a show

The narrowing governs five sections, so it gets one control near the summary
rather than a copy in each. It is labelled with what turning it on reveals and
starts off, which is what the capability already requires of every control it
offers. A sentence stating how many differences are held back sits with the
narrowed sections, so the control can be found by a reader who has not noticed
it.

## Risks / Trade-offs

- **Under-reporting is the dangerous direction** — a difference the analyser
  misses is a difference the reader never sees. → The held-back count is always
  visible and the full comparison is one tick away; the analyser is a single
  function whose body can be replaced without touching the seam, the wire
  format, or the docs side.
- **Abbreviated entry is not resolved** by a text scan, so a program written
  with abbreviations under-reports. → Same mitigation; the abbreviating dialects
  are a minority and abbreviations are rare in IDE-authored source.
- **Greedy matching over-reports** on a dialect that does not crunch (finding a
  keyword inside a variable name). → Avoided outright by reading the new seam
  flag rather than guessing; over-reporting would in any case be the safe
  direction.
- **An empty or unparsable program** would narrow the comparison to nothing. →
  An empty vocabulary is treated as no vocabulary: the guide reports everything,
  exactly as a standalone visit does.
- **The two sides agree by string literal**, as the existing convert hand-off
  already does — a field renamed on one side silently does nothing. → The same
  mitigation that hand-off uses: a shared field-name tuple, a contract unit test,
  and an end-to-end scenario that only passes if a real message crosses.
