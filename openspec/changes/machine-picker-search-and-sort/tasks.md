## 1. The BASIC name joins the seam

- [x] 1.1 `Dialect` gains `basicDialect: string` - the BASIC the machine runs,
      named as that machine's own documentation names it. Document it beside
      `manufacturer` and `year`, including that the machine's `blurb` names the
      same BASIC and that a test holds the two together.
- [x] 1.2 Every registered dialect declares it, copying the name the porting
      guide already states for that machine. The two machines that inherit
      theirs through the guide's `extends` chain get their own explicit string.
- [x] 1.3 The porting facts keep their own copy of the name - the comparison
      table's rows are accessors over the facts alone, and the facts are the
      dataset that restates registry facts on purpose - but the two places that
      compose a machine's description for the assistant read the machine
      instead. One of them looks the facts up by id with a defensive branch for
      a machine that has no entry; reading the declaration makes it total and
      deletes the branch. Both must keep composing byte-identical text, which
      prompt prefix caching depends on.
- [x] 1.4 Invert the facts crosscheck: "basicDialect is the BASIC the dialect
      blurb names" - a substring of prose - becomes an equality against what the
      machine declares. Separately, the registry-driven suite that already
      checks each machine describes itself for the picker gains the assertion
      that its description names the BASIC it declares.
- [x] 1.5 The docs' machine list carries the field too, pinned to the registry by
      the existing machines crosscheck alongside `name`, `manufacturer`, `year`
      and `blurb`.

## 2. The picker's decisions

- [x] 2.1 `MachineLike` gains `basicDialect`. Both suppliers - the registry's
      dialects and the docs' machine list - already satisfy it structurally
      after task 1; confirm the assignment still type-checks rather than
      asserting it at runtime.
- [x] 2.2 An ordered table of the four arrangements, each with the id stored and
      the label shown, so the control, the persistence validator and the tests
      read one list.
- [x] 2.3 A group becomes a heading and its machines, where a null heading is the
      ungrouped arrangement. Update the two existing readers of the old field
      name: the Settings ROM machine list and the docs machines crosscheck.
- [x] 2.4 One name comparator, a module-level collator with numeric ordering, so
      a machine numbered 664 precedes one numbered 6128. Built once, not per
      comparison, and commented with why a plain string compare does not do.
- [x] 2.5 A filter: case-insensitive substring over name, manufacturer and BASIC
      name; empty text matches everything. Follow the house rules the docs'
      reference-table filter states.
- [x] 2.6 One grouping entry point taking the machines and the arrangement:
      manufacturer and BASIC grouped under an alphabetical heading, year grouped
      under the release year oldest first, model ungrouped; machines ordered by
      name everywhere but year, where they are oldest first. Headings derived
      from the machines in hand, so no empty heading can exist.
- [x] 2.7 Tests, registry-driven, one `it` per behaviour looping the machines
      rather than a case per row: every machine appears exactly once in every
      arrangement; headings ordered correctly in each; model is a single
      null-headed group; year heads only years that hold a machine, oldest
      first; every other arrangement orders its rows by name. Pin the numeric
      collation on the real CPC names. Replace the existing "orders each
      manufacturer machines oldest first" case. For the filter: each of the
      three matched fields, case-insensitivity, empty text returning everything,
      unmatched text returning nothing.
- [x] 2.8 Add any new picker module to the import-graph guard's docs-importable
      list, and confirm the guard still passes - nothing here may reach the
      registry or an emulator.

## 3. The dialog

- [x] 3.1 The dialog takes the narrowing text and the arrangement as props with
      change callbacks, as it already takes the selected machine. It reads its
      groups from the new entry point and renders a null heading as rows with no
      heading above them.
- [x] 3.2 A search field and an arrangement control above the list. Both labelled
      to the project's convention - a short imperative phrase in sentence case,
      no trailing period - and the search field uses the platform's search input
      so it carries a clear affordance for a remembered value.
- [x] 3.3 Enter in the search field does nothing: in the New-project dialog the
      picker renders inside the form that creates the project, which is why
      every button in it already declares its type.
- [x] 3.4 Focus the search field when the list opens, and scroll the chosen
      machine into view where the narrowing has left it showing. Escape keeps
      its current meaning and closes the list.
- [x] 3.5 A no-matches state naming the text that matched nothing, with a control
      that clears it and returns the whole list.
- [x] 3.6 Leave every existing hook the e2e suite drives untouched: the dialog's
      accessible name, the per-machine row attribute, and the trigger's.

## 4. Remembering it

- [x] 4.1 Two settings accessors following the file's existing pattern - a key in
      the map and a get/set pair - for the narrowing text and the arrangement.
      The arrangement getter validates against the table from task 2.2 and falls
      back to grouping by manufacturer, so a stale stored value cannot produce a
      list with no order.
- [x] 4.2 The store holds both beside the picker's open state, seeded from
      settings at initialisation and written through on change, so the toolbar's
      picker and the New-project picker share one narrowing and one arrangement.
- [x] 4.3 Both IDE hosts pass the store's pair to the dialog.
- [x] 4.4 Settings tests: both accessors round-trip, and the arrangement getter
      rejects an unknown stored value.

## 5. The docs host

- [x] 5.1 The porting guide's picker holds the narrowing and the arrangement in
      local state, shared by its two fields and persisted nowhere.
- [x] 5.2 The host's stylesheet gains rules for the two new controls, which
      render in documentation prose and would otherwise inherit the site's form
      styling. Check the clear control is still covered by the existing
      button rule.

## 6. Documentation

- [x] 6.1 The getting-started guide's step 3 is the only user-facing prose about
      the picker: it now says the list can be searched and arranged, and that it
      reopens as it was left. Its screenshot and the screenshot's alt text both
      described the old chrome, so both were updated - the image regenerated
      with `npm run e2e:docs-screenshots`. Sidebar untouched.

      Capturing it caught a real fault: opening the list scrolls the chosen
      machine into view, which pushed the newly focused search field off the top
      of the panel. The controls row is sticky as a result.

## 7. Quality gates

- [x] 7.1 `npx vitest run src/components/ src/storage/ src/reference/ src/dialects/`
- [x] 7.2 `npm run typecheck && npm run lint && npm run format:check`
- [x] 7.3 `npm test` - the seam gains a field, so the registry-driven suites that
      assert facts about every dialect are all in reach of this change.
- [x] 7.4 `npm run e2e:chromium -- e2e/project-setup e2e/persistence
    e2e/porting-guidance e2e/shell-navigation`. 59 pass at one worker, the
      number CI runs. The new coverage went into the two folders that own it
      rather than one: narrowing and rearranging the rendered list is a new test
      in `e2e/project-setup/`, and reopening the list as it was left after a
      real reload is a new test in `e2e/persistence/`, beside the machine test
      it is modelled on. A shared `openMachinePicker` fixture was needed - every
      existing helper closes the picker again.

      The porting guide's keyboard test asserted that opening the list focuses
      the machine already chosen; it now asserts the search field, which is this
      change's specified behaviour.

      At two workers this container intermittently fails `openApp`'s first-paint
      assertion in the porting-guidance and persistence specs. Reproduced the
      same way on the unmodified tree, so it is the dev server's cold compile
      racing a 5s timeout, not this change.

- [x] 7.5 `npm run docs:build` - the porting guide renders the changed dialog.
- [x] 7.6 `npx openspec validate --specs`
