## 1. State where a keyword's entry is published

- [ ] 1.1 Put the rule for a keyword's reference topic beside `referencePageOf`
      in `src/dialects/referencePage.ts`, taking the same `{ id, docsReference }`
      shape and importing nothing, together with the public docs base that makes
      the address absolute for a reader outside the browser.
- [ ] 1.2 Have `referenceTopic` in `src/app/docsTopic.ts` call through to it, so
      the IDE's click-menu row keeps the behaviour it has today and the rule is
      stated once.
- [ ] 1.3 Cover the new leaf in `src/dialects/referencePage.test.ts`: the topic
      names the page the machine reads from (including a machine that shares a
      page with others), and the keyword it is opened at is carried through
      exactly as written.

## 2. Explain a keyword with the way to read it in full

- [ ] 2.1 End the reference-backed explanation in `src/lsp/hover.ts` with a link
      to that keyword's entry, at the bound machine's own page. Leave the
      fallback explanation — for a keyword the reference has no entry for —
      without one.
- [ ] 2.2 Extend `src/lsp/hover.test.ts`: a keyword the reference covers offers
      the route, naming that machine's page and the keyword; a short spelling
      offers the route for the keyword it stands for, not for the spelling; a
      keyword the reference does not cover is still explained and offers none.

## 3. Complete the variables the program has in scope

- [ ] 3.1 Build completions in `src/lsp/completion.ts` from every autocomplete
      source the document's own editor state carries, rather than from the
      dialect's keyword source alone.
- [ ] 3.2 Carry each source's own replaced range on the items it produced, in
      place of the single range shared by every item today.
- [ ] 3.3 Extend `src/lsp/completion.test.ts`: names in scope are offered
      alongside keywords and marked as variables; a name local to a procedure is
      not offered from outside it, on a machine that has procedures; nothing is
      offered for a name inside a string literal.
- [ ] 3.4 Note on the existing crunched-anchor test why it still holds now that
      more than one source answers — the source blanks the word under the cursor
      before it scans, so a lone name finds no names and stands down.

## 4. Keep the map current

- [ ] 4.1 Check `docs/contributing/architecture.md` against what moved: a new
      leaf under `src/dialects/` that both the app and the server read. Update
      the row or table that names it only if the shape it describes has changed,
      and write nothing that would drift on its own.

## 5. Quality gates

- [ ] 5.1 `npx vitest run src/lsp/ src/dialects/referencePage.test.ts src/app/`
      — the suites this change reaches. The full suite is CI's job.
- [ ] 5.2 `npm run typecheck`
- [ ] 5.3 `npm run lint`
- [ ] 5.4 `npm run format:check` (or `npm run format` to fix, then re-check)
- [ ] 5.5 Drive the real server the way an editor does, rather than only the unit
      seam: from a checkout of `basically-editor-extensions`,
      `BASICALLY_SERVER_PATH=<this checkout>/scripts/basically npm test`. Leave
      unchecked with a note if that checkout or npm registry access is not
      available here — the client's own gates are that repository's to run.

No e2e task: `language-server` has no browser surface and no `e2e/` folder, as
`headless-cli` and `mcp-server` do not.
