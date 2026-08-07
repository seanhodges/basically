## Context

Everything about the comparison is already directional: `diffKeywords` buckets
what the source loses and what the target adds, `PairPortingNotes` are stored per
ordered pair, and `?from=`/`?to=` name the direction in the URL. Reversing is
therefore not a new mode — it is choosing the other ordered pair, which the page
can already do. What is missing is the affordance and the number that makes it
worth taking.

`docs/contributing/architecture.md` covers the docs/app split and the purity rule
for `src/reference/`; the count belongs on the pure side because both directions
must be counted identically and a test has to be able to say so.

## Goals / Non-Goals

**Goals**

- One action to reverse, from anywhere on the page.
- The reverse's cost shown before it is taken.
- The reversed comparison indistinguishable from choosing that pair by hand.

**Non-Goals**

- Recommending a direction, weighting the count, or showing both comparisons.

## Decisions

### Impact on the Dialect seam: none

Nothing here touches a dialect, a tokenizer or an emulator. The count is over
data the comparison already computes.

### The count is the findings, counted

```
  cost(from → to) =  commands with no equivalent
                   + commands to rename
                   + commands whose usage differs
                   + control codes to replace
                   + control codes that change meaning
                   + same-word-different-meaning warnings
                   + characters the target cannot represent
```

Deliberately unweighted. A lost capability is more work than a control code, but
any weighting would be a judgement invented to produce one number, and the
comparison would then be reporting an opinion it cannot defend. An unweighted
count is honest about what it is: how many things this direction asks you to deal
with.

It is computed from the **unnarrowed** diff, on both sides, for one reason: the
reverse direction has no program to narrow by. A vocabulary describes one BASIC —
the program is written in the source machine's language, and reading it as the
target's to count the reverse would be asking a question about a program that
does not exist yet. Counting one side narrowed and the other not would be worse
than counting neither, so both are the machine-to-machine figure, and the page
says that is what it is.

Both directions are counted by the same function, which is what makes the
comparison meaningful and what a test can pin.

### Reversing goes through the same path as choosing

The page already has `choose(field, id)`, which updates the URL, re-requests the
program vocabulary for the new source, and resets the capped lists. Reversing
calls it for both fields rather than mutating the refs, so the reversed
comparison is byte-for-byte what choosing those two machines by hand produces —
including the deep link, the narrowing re-read for the new source machine, and
the "reading your program as …" notice while that is in flight.

The one thing worth stating: after reversing, the open program is written in what
is now the *target's* language. That is exactly the situation the guide already
handles — the program is read as the machine being ported from, and the notice
says which machine that is — so the reversed page narrows to what the program
uses in the new source machine's BASIC, or says it cannot read it, both of which
are existing behaviour.

### Where the affordance sits

Between the two machine choices, where the direction is expressed, so that the
control is where the thing it acts on is. The reverse count reads as part of the
same control rather than as a section of its own: it is one number in service of
one decision, and giving it a section would put a finding about a comparison the
reader is not looking at into a page ordered by the work of the one they are.

## Risks / Trade-offs

- **The count invites reading as a difficulty score.** → It is labelled as a
  count of findings, not of effort, and the two directions' counts are the only
  thing compared with each other.
- **Reversing loses the reader's place.** → Reversal changes the pair, and
  changing the pair already resets the capped lists and re-narrows; this makes no
  new promise it then has to keep.
- **Counting the reverse costs a second full diff.** → Both diffs are pure
  functions over reference tables and are already computed per keystroke-free
  render; the reverse count is one more of the same, memoised by the same
  reactivity as the first.
