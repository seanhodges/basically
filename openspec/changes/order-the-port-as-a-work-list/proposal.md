## Why

The comparison presents its findings as several lists shown at once, with no
signal about sequence and none about which are mechanical. A reader who has
decided to do the port has to work out for themselves that renaming five commands
is an afternoon's search-and-replace while the graphics group is a rewrite, and
that a character the target cannot represent stops the program being typed in at
all before either matters.

The findings do have a natural order, and it is the order the work happens in:

1. what stops the program being read on the target at all,
2. what is mechanical,
3. what must be rewritten,
4. what changes silently,
5. whether the result fits.

The page currently interleaves these. The same-word-different-meaning warnings —
the definition of a silent failure — are shown before the commands that must be
rewritten; the renames, which are the cheapest work on the page, are shown after
them under a heading shared with the usage differences.

## What Changes

- **The findings are ordered as a work list**, in the five classes above, so that
  reading the page top to bottom is reading the port in the order it is carried
  out.
- **Each finding is placed by its class rather than by its data type.** A
  character the target cannot represent, a statement layout that must be split
  and a line number the target will not accept are one class — they stop the
  program being read — and are read together.
- **The existing ordering requirements are extended, not competed with.** The
  order of the language and hardware difference *rows* is a separate requirement
  and is untouched; so is the rule that guidance which does not vary with the
  pair is not interleaved with guidance that does.
- **Nothing is added or removed from what is reported.** This change is about
  sequence.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: one requirement modified — *The comparison leads with what
  the port requires* — restating the order as the five classes of work rather
  than as a list of sections, so that a finding added later has a stated place.

## Non-goals

- **Adding findings.** Findings that other changes introduce — the fit report,
  the line-number check, the colliding variable names, the truncated arithmetic —
  are named here only so they have a class to land in. This change reports
  nothing new.
- **Re-ordering the language and hardware difference rows.** That order is its
  own requirement, justified by what each row turns on, and stays as it is.
- **Moving the memory layout or the guidance prose.** Both keep their place: the
  guidance frames the port before the work list starts, and the memory layout is
  a picture rather than a work item.
- **Collapsing sections.** The commands whose spelling differs and the commands
  whose usage differs remain reported together, as their own requirement demands;
  they simply sit in the class the work belongs to.
- **A checklist, or progress tracking.** The page reports; it does not keep state
  about what the reader has done.

## Impact

Affected code:

- `docs/.vitepress/theme/components/DialectCompare.vue` — section order, the
  `pageSections` "on this page" row that mirrors it, and the headings that
  introduce each class of work.
- `e2e/porting-guidance/` — the existing order assertions move with it; one
  assertion that the classes appear in the stated sequence.

No `src/` changes, no dependency changes, no storage or share-format changes.
Ordering is a property of the page, not of the pure comparison — `compare.ts`
returns findings, the page decides where they read.
