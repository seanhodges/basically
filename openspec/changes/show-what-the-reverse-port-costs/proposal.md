## Why

Direction is the dominant variable in what a port costs, and the page never says
so. Counting the findings each direction produces for the same two machines:

```
  CPC 6128 → Altair 8800     166        Altair 8800 → CPC 6128      24
  CPC 6128 → ZX80            209        ZX80 → CPC 6128             41
  PET → Altair 8800          132        Altair 8800 → PET           26
  BBC Micro → ZX81           143        ZX81 → BBC Micro            67
  CPC 6128 → CPC 464          13        CPC 464 → CPC 6128           1
```

`PairPortingNotes` is directional by design and the whole comparison is built
around an ordered pair, so the asymmetry is baked into the data — it is simply
never shown. A reader who has chosen a direction has no way to see what the other
one costs without re-choosing both machines, and for many people this is a
genuine choice: prototyping on the constrained machine and expanding outward is
between five and nine times less work than the reverse, and the page gives them
nothing to decide on.

## What Changes

- **The pair can be reversed in one action**, from wherever the reader is on the
  page, without re-choosing both machines.
- **What the reverse costs is shown before the reader commits to it**, as a count
  of the findings the reverse direction produces against the count this one does,
  so the choice is informed rather than a click into the dark.
- **The reversed comparison is the same comparison**, in the other direction:
  shareable as its own link, narrowed to the open program on the same terms, and
  identical to what choosing those two machines by hand would produce.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: one requirement added — *The comparison can be reversed,
  and says what the reverse costs* — describing the affordance and what it must
  report before it is taken.

## Non-goals

- **Recommending a direction.** The page reports both counts; which port to do is
  the reader's call, and depends on things the guide cannot see.
- **Showing both directions at once.** Two full comparisons on one page is two
  pages; the reverse is offered as a count and a way to get there.
- **A cost model.** The count is the findings the comparison already produces,
  counted. Weighting a lost capability against a control code would be a judgement
  invented for one number.
- **Reversing anything but the pair.** The reader's other choices — what is
  revealed, what is narrowed — are theirs, and are not reset by a reversal beyond
  what changing the pair already resets.

## Impact

Affected code:

- `src/reference/compare.ts` + `compare.test.ts` — a pure count of what a
  direction costs, over the buckets the comparison already produces, so both
  directions are counted the same way.
- `docs/.vitepress/theme/components/DialectCompare.vue` — the reverse affordance,
  the reverse count, and reversing through the same path that choosing a machine
  takes, so the URL, the narrowing and the capped lists behave as they already do
  when the pair changes.
- `e2e/porting-guidance/choose-machine.spec.ts` — the reversal and what it lands
  on.

No `src/` changes beyond the pure count. No dependency changes, no storage or
share-format changes; the reversed pair is expressible in the existing link
format because it is an ordinary pair.
