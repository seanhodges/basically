## Context

The porting comparison is one Vue component,
`docs/.vitepress/theme/components/DialectCompare.vue`, rendering a run of
`<section class="cmp-section">` blocks. Each decides its own visibility with a
`v-if` over the data it renders. When the IDE hands the page a readable open
program, `narrowingBy` becomes that program's vocabulary and most of those
computeds narrow to what the program actually uses.

Three of the visibility conditions admit content that is not work:

- `v-if="capabilities.length"` — `capabilities` includes gain-only groups
  (`!s.entries.length`), the capability areas the target adds. `gainingCount`
  counts them. A program needing no rewrites leaves the section standing with
  "0 commands to rewrite or remove".
- `v-if="escReplaceSections.length || escapeAdded || escapeRechecked.length"` —
  `escapeAdded` is `escapeDiff.newlyAvailable.length`, again additions. It
  alone keeps the section up, and the section then prints "No {source} control
  code needs replacing."
- `v-if="visibleFactRows.length || factRows.length"` — the `|| factRows.length`
  arm keeps "Language & hardware" up when every fact row is unchanged and the
  `showUnchanged` filter has hidden them all.

The remaining sections gate on a length or on a computed that already returns
`null` off the narrowed program. Four of those — `statementLayout`,
`lineNumbers`, `positionCheck`, `programFit` — return whatever their
`…ForProgram` helper builds, and whether that helper can return an all-clear
object rather than `null` decides whether they belong in this change too. That
is an audit, not a design question, and it is a task.

`showAdditions` is a single `ref(false)` shared by the capabilities and escape
sections, with a checkbox rendered inside each. That sharing is what makes
hiding awkward: the filter is a page-wide state reached only through two
section-local doors.

No `src/` code is involved. This is presentation over data the component
already has, so the **Dialect / MachineEmulator seam is untouched** — no
dialect gains a method, and nothing machine-specific enters the component. See
`docs/contributing/architecture.md` for the seam itself.

## Goals / Non-Goals

**Goals:**

- A narrowed comparison shows only sections with something to port.
- One rule, applied to every section, rather than a per-section patch — a
  section added later should inherit the behaviour by construction.
- The additions filter keeps working and stays discoverable when the sections
  that used to host it are hidden.

**Non-Goals:**

- Changing grouping, ordering, tinting, capping or copy within a section.
- Changing the unnarrowed comparison.
- Changing which findings narrowing produces.

## Decisions

### The rule: a section renders when it has something the reader must act on or be told

Not "when it has data". The distinction the page already draws, in the comment
above `showAdditions`, is between work and news: what the target adds and the
program never used is "news rather than work". That comment is the rule this
change makes structural. A section is shown when it holds at least one finding
that is work; content that is only news does not hold a section open.

Rechecks count as work. "Same spelling, different meaning" and "Same word,
different meaning" change nothing in the program's text, which is exactly why
the reader has to be told — there is nothing to search for. The existing
comment on the escape rechecks says so. Treating them as news because no edit
follows would hide the findings most easily missed.

**Alternative rejected — hide on a zero count in the heading.** It fixes the
two headings the report names and nothing else, and it leaves the rule
implicit in whichever expression each heading happens to interpolate.

**Alternative rejected — render sections and let CSS collapse the empty ones.**
The empty-state paragraphs are real content; there is nothing for `:empty` to
catch, and the headings would survive.

### Visibility is computed against what the section would actually render

Because `showAdditions` is page state, "has something to show" depends on it. A
section holding only additions is hidden while the filter is off and appears
when it is on. Deriving each section's visibility from the same list the
template iterates (`capabilityList.visible`, `escapeSectionList.visible`) —
rather than from a separate hand-written condition — keeps the two from
drifting: the section is shown exactly when its own rendered content is
non-empty, plus whatever work-bearing extras sit outside that list
(`escapeRechecked`).

**Alternative rejected — freeze visibility on the unfiltered data.** Then
turning the filter on could reveal nothing, because the section holding the
additions stayed hidden.

### The additions filter is stated once, for the page

Hiding an additions-only section takes its checkbox with it. When every section
that holds additions is additions-only, the filter becomes unreachable and the
baseline requirement that additions *can* be filtered out — that is, seen —
stops holding. So the checkbox and the "N … are hidden" disclosure move up to
the page, next to the narrowing notice, stated once for however many sections
they govern.

This also removes a duplication the page carries today: two checkboxes bound to
one ref, which a reader can meet twice and reasonably read as two filters.

**Alternative rejected — keep the checkbox in-section and hide the section
anyway.** Simplest diff, but it silently drops a shipped guarantee in the
common case, and the disclosure line ("N capability areas … are hidden") would
disappear precisely when it is the only remaining sign the content exists.

**Alternative rejected — keep an additions-only section visible but collapsed
to its checkbox.** That is the empty heading the change exists to remove,
wearing a control.

### Scope: the narrowed state only

Unnarrowed, the page is the full machine-to-machine reference, where a section
with no differences is itself the answer and the reader has not asked about any
program. `notice.kind === 'narrowed'` is the existing, already-rendered
condition for "we are filtering for your program", so the rule keys off that
rather than off `narrowingBy` being merely set — the two differ while a program
is still being read.

## Risks / Trade-offs

- **A section disappears that the reader expected to find, and they cannot tell
  whether it is empty or broken.** → The summary line already states the
  all-clear in words ("Nothing in your program has to be rewritten."), and the
  narrowing notice says the page is filtered. Between them the page still
  accounts for what is missing, so no per-section tombstone is needed.
- **Deriving visibility from the truncated `…List.visible` catches the cap, not
  the content** — a section capped to zero visible entries would read as
  nothing to port. → `useTruncatedList` caps to a positive count and exposes
  `hasMore`/`remaining`; visibility must consider the full filtered list, not
  the truncated window. Called out as a task and worth a unit test.
- **Moving the filter to page level changes a UI the e2e specs assert on.** →
  The `porting-guidance` e2e folder is in scope for the change and updated with
  it, not after.
- **The audit finds a fifth and sixth section needing the rule and the change
  grows.** → Accepted; the rule is uniform, so each extra section is a
  condition, not a new decision.
