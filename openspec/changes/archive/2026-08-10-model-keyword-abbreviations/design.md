## Context

Three abbreviation mechanisms exist on the real machines and two are modelled:
the Acorn dot form (BBC: resolved byte-for-byte against the ROM's lookup
order; Atom: accepted by the lint, and *kept* in the stored program, because
the Atom stores text verbatim) and the symbol aliases (`?` for `PRINT` and
friends, declared in the keyword tables of every Microsoft-family dialect).
The third — Commodore shifted-letter entry — is a documented gap. None of the
three exists as a porting fact.

`docs/contributing/architecture.md` covers the seam and the reference
boundary; the variant seam the Commodore tokenizer already shares with the PET
and VIC-20 is where the new match lives.

## Goals / Non-Goals

**Goals**

- Accept the notation the archives are written in, on the machines that
  accepted it.
- Resolve abbreviated spellings when reading a program's vocabulary, so the
  narrowing stops missing what the program plainly uses.
- Report expansion as mechanical work, warn where a spelling survives with a
  different meaning, and offer abbreviation as a fit measure where it
  genuinely shrinks the stored program.

**Non-Goals**

- Sinclair keystroke entry (no spelling to resolve).
- The Commodore lower-case display bank.
- Teaching conversions to emit abbreviated spellings by default.

## Decisions

### Impact on the Dialect seam: none new

The tokenizer change lives inside the Commodore dialect behind the existing
variant seam; no `Dialect` member is added. The abbreviated-entry fact is
reference data.

### Full spellings first; the real machine's rule second

The real Commodore tokenizer scans its reserved-word table matching characters
until a shifted letter both matches and terminates the word early. Applying
that rule verbatim to the IDE's case-folded source would change the meaning of
existing mixed-case programs wholesale. So the order is: the existing
case-blind full-keyword match first — `Print` stays `PRINT`, every existing
program tokenizes as before — and only where that fails, an abbreviation
match: one or more letters ending in a single upper-case letter preceded by a
lower-case one (`pO`, `gosU`), or the equivalent shift escape, resolved to the
**first** keyword in token order whose spelling starts with the prefix plus
the final letter. Token order is the ROM's scan order, which is what makes
`gO` mean `GOTO` and not `GOSUB` on the real machine; the colocated test
sweeps every keyword's shortest form against the machine's own table.

The one behaviour change swallowed knowingly: a mixed-case variable spelled
exactly like an abbreviation (`pO`) becomes the keyword. That is what the real
machine does with it, and the tokenizer's statement lint catches most of the
fallout; the tests name the trade so it is chosen, not discovered.

Listing back expands, because LIST on the real machines expands: the
detokenizer already emits canonical spellings and needs no change, only a
pinned round-trip test (`10 pO53280,0` lists as `10 POKE53280,0`).

### One fact, two dimensions, pinned behaviourally

The abbreviated-entry fact carries the entry style (dot / shifted-letter /
none) and the symbol spellings the machine accepts as keywords. The crosscheck
is behavioural, not prose: feed each machine's own tokenizer an abbreviated
program and require the keyword's token — or, on the Atom, feed the lint and
require no misspelling finding, the Atom storing text verbatim. A machine
authored "none" must reject the notation. The symbol list is pinned against
the alias entries the keyword tables already declare.

The Sinclair machines are authored "none" with no symbols: their keywords
arrive by keystroke, which is an entry method, not a spelling — the fact
describes what a program's *text* may contain.

### Resolution happens where the program is read

The vocabulary resolves abbreviated and symbol spellings against the **source**
machine's own tables, and the resolved keywords join the keyword list — which
also fixes today's silent under-reporting, where a Commodore program printing
only with `?` produces no `PRINT` in its vocabulary at all. Resolution by the
source's tables is what makes the Atom's `?` safe by construction: the Atom
resolves no `?` alias, because on the Atom `?` is byte indirection, and its
indirection uses are already collected as write and read sites.

The resolved spellings are also carried as pairs — spelling and keyword — so
the report can name both halves of the bridge the assistant needs.

### The finding is mechanical work; the trap rides it

Expansion is renaming's twin, so the finding sits with the mechanical class,
before the renames: each spelling with the keyword it means, reported only
when the target does not accept that spelling for that keyword. Nothing is
reported to a target that reads the spelling identically — no work, no
finding.

Where the target gives a used symbol a different meaning — `?` on the Atom —
the same finding carries the warning that the unexpanded spelling does not
fail but changes meaning. This stays out of the same-word-different-meaning
table deliberately: that table is keyed and crosschecked on alphabetic
keywords with reference rows on both sides, and a one-line authored warning in
the finding that already names the symbol says everything the table would.

The conversion hand-over carries the expansions; it never carries "the target
would also accept these spellings" — the assistant writes canonical spellings,
and the language-rules section stays silent about abbreviated entry on
purpose.

### Fit pressure can reverse the direction, on one machine kind only

Where the target stores program text verbatim, abbreviations are not entry
convenience but stored bytes — `P.` is four bytes shorter than `PRINT` on the
Atom, per use, in a budget under five kilobytes. The fact carries whether
abbreviating shrinks the stored program, pinned by tokenizing the same line
both ways and comparing sizes; on every tokenizing machine the pin proves the
opposite and the fact is false. Under the fit-pressure gate the conditional-
memory change words into the fit requirement, the comparison reports the
measure with the posed decision: abbreviate once the port runs, or shorten
the program another way. The speed remark rides only on machines whose own
reference says the interpreter re-scans text at run time; no performance
claim is made anywhere the dialect's own documentation does not back.

## Risks / Trade-offs

- **The mixed-case reinterpretation.** → Chosen and tested, as above; the
  alternative (rejecting the notation forever) is the status quo the
  Commodore reference already apologises for.
- **Token-order ties.** → The order is the machine's own table; the sweep test
  asserts the first match for every prefix a magazine would print, `gO` and
  `pO` included.
- **Resolution could misread a dot that is punctuation.** → Dot resolution
  applies only where the source machine's entry style is dot, using that
  machine's own resolution order; the Acorn tokenizer and lint already answer
  exactly this question and the vocabulary asks them rather than re-deciding.
- **The fit measure could read as advice to write obfuscated code.** → It is
  gated on pressure, phrased as a decision, and explicit that it comes after
  the port runs.

## Open Questions

- Whether the PET and VIC-20 keyword tables need their own abbreviation sweep
  fixtures or the shared table's sweep covers them — settled by reading the
  variant tables when implementation starts; the tests are written per
  machine either way.
