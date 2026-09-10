## 1. Give the budget to the caller

- [ ] 1.1 `treeCovering` takes the parse budget as an argument instead of reading
      one constant, so a caller states its own need. Keep its contract otherwise:
      a tree parsed at least as far as asked, or the lazily-parsed one.
- [ ] 1.2 The click path passes the interactive budget it has today, unchanged.
      Its header comment already explains why a click is bounded and what its
      fallback costs — keep that reasoning attached to the number rather than
      leaving it stranded in the shared helper.
- [ ] 1.3 The colour path asks for a complete parse. Say in a comment why that is
      affordable where it is not for a click: the request is one the editor is not
      waiting on, and the parse is linear in the program's length.

## 2. Colour that reaches the end

- [ ] 2.1 `tokensIn` reports every token of the range asked about, for a program
      of any length. No caller of it needs to know a budget exists.
- [ ] 2.2 Check whether the whole-program and the range answers can now share one
      path, since neither is truncated. Do not force it — a range that parses only
      what it needs is still worth keeping if it falls out naturally.

## 3. Tests

- [ ] 3.1 Colocated test: a listing far longer than the old budget could cover is
      coloured to its last line. Size it against the failure being fixed — the old
      fallback covered a fixed few kilobytes, so a listing of tens of kilobytes
      distinguishes a complete answer from that cliff — and assert the *last* line
      specifically, since that is what was lost.
- [ ] 3.2 Colocated test: asking twice about an unchanged program yields the same
      answer both times. This is the one that pins the correction — the previous
      behaviour returned the same short answer every time, so the test must fail
      on a truncating implementation rather than passing on the repetition alone.
- [ ] 3.3 Colocated test: a range at the end of a long program is reported in
      full, on the same terms as one at the start.
- [ ] 3.4 The existing test that proves the walk reaches past the lazily-parsed
      region keeps asserting its own premise. Do not widen it into the new cases;
      it answers a different question and should stay answering it.
- [ ] 3.5 The click path's tests are unchanged, and must stay passing untouched —
      that they need no edit is the evidence its behaviour was not disturbed.

## 4. Correct the withdrawn claim

- [ ] 4.1 The design note shipped with `colour-a-program-by-its-machine` says a
      budget that runs out "resolves itself on the next request". It does not.
      Correct that passage where it stands, rather than leaving a false statement
      for the next reader to reason from. If that change has been archived by the
      time this is implemented, correct it in the archive.
- [ ] 4.2 Check whether `docs/guide/language-server.md` or
      `docs/contributing/architecture.md` repeat the claim or imply a bound on how
      much of a program is coloured; correct them if so, and leave them alone if
      not. Run `npm run docs:build` only if either is touched.

## 5. Gate

- [ ] 5.1 `npm run typecheck && npm run lint && npm run format:check`
- [ ] 5.2 `npx vitest run src/editor/ src/lsp/`
- [ ] 5.3 `npm test` — the shared editor plumbing is touched, and the last change
      to this exact helper went green locally and red on a CI shard.
- [ ] 5.4 `npm run e2e:chromium -- e2e/code-editor` — the click path shares the
      helper being changed, so the browser editor's own use of it is proven rather
      than assumed, even though nothing there is meant to change.
- [ ] 5.5 `npm run docs:build`, only if 4.2 touched anything under `docs/`.
- [ ] 5.6 Drive the built server end to end: open a listing far longer than the
      old budget covered, ask for its colour, and confirm the last line comes back
      coloured — the same check by hand that 3.1 makes automatic.
