## 1. Where the variables are

- [ ] 1.1 Answer, for a part of a program, where each of its variables is
      written, built from the reading of the program the server already performs
      — the one that decides which spellings are one variable and which runs of
      characters are variables at all. No second scan, and no machine.
- [ ] 1.2 Report each under the name the bound machine would answer to rather
      than the spelling in the listing, using the identity the server already
      computes for a name on that machine.
- [ ] 1.3 Say, per document, whether the name is to be matched with case,
      following the bound machine's rule rather than a constant.
- [ ] 1.4 Report an array under the name the machine holds it as, not the element
      the listing writes.
- [ ] 1.5 Report nothing for a program the server declined to bind, as every
      other answer does.
- [ ] 1.6 Declare the capability, so an editor knows the server offers it.

## 2. A machine that cannot take part

- [ ] 2.1 Tell the user that a machine which cannot report what it holds cannot
      report it, in the wording already used where a caller reads the variables
      of such a machine — not a second phrasing of the same fact.
- [ ] 2.2 Leave a machine that cannot be stepped alone: it never stops on a line,
      so nothing here applies to it and nothing new should be said about it.

## 3. Tests

- [ ] 3.1 Colocated tests covering every scenario in the spec delta, over a real
      document store and real registered dialects as the existing server tests
      do.
- [ ] 3.2 Pin the reported name per machine family rather than per machine: at
      least one machine that keeps only the first characters of a name, one that
      keeps all of it, and one that tells case apart. This is the assertion the
      whole change rests on — a wrong name here is silently empty, not an error.
- [ ] 3.3 Cover a machine that cannot report what it holds.
- [ ] 3.4 Add the capability to the client-against-server check in
      `basically-editor-extensions`, which asserts the provider list the server
      advertises. This task may only be checked off against a published server or
      a toolchain checkout the test was pointed at.

## 4. The editor side

- [ ] 4.1 Confirm against a real editor that no client code is needed — that the
      editor asks for this once a server offers it, and resolves each name
      against the stopped session it already holds. If it turns out a client
      change is needed, that is a change in `basically-editor-extensions` and
      this task records what it is rather than making it here.
- [ ] 4.2 Confirm by hand, stopped on a line, on a machine that keeps only part
      of a name and on one that does not. Say in the change what was run and what
      was seen; a passing unit test does not show a value next to a name.

## 5. Documentation

- [ ] 5.1 Add this to what the language server gives, in the user guide's list of
      what an editor gets, described as what the user sees rather than as a
      protocol capability.
- [ ] 5.2 Update `docs/contributing/architecture.md` only if the shape changed.

## 6. Quality gates

- [ ] 6.1 `npm run typecheck && npm run lint && npm run format:check`.
- [ ] 6.2 `npx vitest run src/lsp/ src/editor/`.
- [ ] 6.3 `npm run docs:build` (docs/ changes in group 5).
- [ ] 6.4 No e2e run. The browser IDE is untouched, and `language-server` has no
      `e2e/` folder because its coverage is unit-level by design.
