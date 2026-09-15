## 1. One scan, asked by position

- [ ] 1.1 Turn the jump-reference walk that renumbering drives into a visitor
      over a program's references, yielding for each the keyword that introduced
      it, the span of its digits, and the line it names. Keep the skipping of
      strings, comments and binary directives, the per-position anchoring, and
      the comma continuation of a jump that names several lines exactly as they
      are.
- [ ] 1.2 Rebuild the renumbering rewrite on the visitor, consuming the spans it
      already computed rather than rebuilding the text blind. The existing
      renumbering tests are the check; no behaviour changes.
- [ ] 1.3 Rebuild the point query jump-to-definition uses on the visitor, as a
      search for the span containing a position. Its existing tests are the
      check.
- [ ] 1.4 Collapse the narrower set of jump patterns the program outline carries
      onto the visitor, so "what counts as a jump" has one answer. Check the
      outline's own tests still pass — the outline reports targets, which is a
      different question from which references name them.
- [ ] 1.5 Colocated tests for the visitor itself: each jump form, a jump naming
      several lines, and a number inside a string, a comment and a directive.

## 2. Finding what jumps to a line

- [ ] 2.1 Answer a request for a line number's uses with every place the program
      jumps to that line, from the visitor. Leave the existing answer for a
      variable exactly as it is; the two are told apart by what is under the
      cursor.
- [ ] 2.2 A position that is neither a variable nor a line reference answers
      nothing, as it does now.
- [ ] 2.3 Colocated tests covering the scenarios in the spec delta, across a
      machine that spells its jumps with an internal space and one that does not.

## 3. Renaming a variable

- [ ] 3.1 Build the rename from the uses already reported for the variable under
      the cursor, so the set changed and the set reported can never differ.
      Preserve each use's type marker rather than writing a bare name over it.
- [ ] 3.2 Refuse a new name the bound machine reads as a keyword, checked against
      that machine's declared keywords — including on a machine that matches a
      keyword anywhere within a run of characters, and on a machine that tells a
      keyword's case from a name's.
- [ ] 3.3 Refuse a new name the machine would store as a variable the program
      already has, carrying the kind of variable as well as the name so that a
      scalar and an array of the same name are not treated as colliding.
- [ ] 3.4 Refuse a rename that would make the program report a problem it did not
      report before, by reading the rewritten program back the same way the
      program's own problems are read, and give the machine's own message as the
      reason.
- [ ] 3.5 Refuse a use the machine reads as part of a longer run of characters
      rather than rewriting what surrounds it.
- [ ] 3.6 Refuse a rename onto a name a procedure declares as its own where that
      would capture a variable, and the reverse.
- [ ] 3.7 Tell the user where other spellings the machine cannot tell apart were
      changed with the one they asked about.
- [ ] 3.8 Declare the rename in the server's capabilities, including that it
      answers whether a position can be renamed before offering to.

## 4. Tests

- [ ] 4.1 Colocated tests for rename covering every scenario in the spec delta,
      over a real document store and real registered dialects as the existing
      server tests do — no mocks.
- [ ] 4.2 Cover the machine axis deliberately: a machine that keeps only the
      first characters of a name, a machine that tells case apart, a machine that
      ignores spaces between a name and a keyword, and a machine that has
      procedures with names of their own.
- [ ] 4.3 Add both new capabilities to the client-against-server check in
      `basically-editor-extensions`, which asserts the provider list the server
      advertises. This task may only be checked off against a published server or
      a toolchain checkout the test was pointed at.

## 5. Documentation

- [ ] 5.1 Add both motions to what the language server gives, in the user guide's
      list of what an editor gets.
- [ ] 5.2 Update `docs/contributing/architecture.md` only if the shape changed —
      a new answer served from existing helpers is a row, not a section, and may
      warrant nothing at all.

## 6. Quality gates

- [ ] 6.1 `npm run typecheck && npm run lint && npm run format:check`.
- [ ] 6.2 `npx vitest run src/lsp/ src/editor/` — the server's answers and the
      scan they are built on. The renumbering tests under `src/editor/` are the
      gate on task group 1 and must be green before anything in group 2 or 3 is
      considered done.
- [ ] 6.3 `npm run docs:build` (docs/ changes in group 5).
- [ ] 6.4 No e2e run. This change is not app-visible: the browser IDE is
      untouched, and `language-server` has no `e2e/` folder because its coverage
      is unit-level by design.
