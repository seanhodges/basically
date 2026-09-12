## 1. The report

- [ ] 1.1 Give the report a shape in `src/lsp/`: the document and the version it
      is about, and either the bound machine's id and name with the source it
      came from, or that binding was declined. Built from the `MachineBinding`
      `bindMachine` already returns, not from a second reading of the program.
- [ ] 1.2 Declare in the server's capabilities that it makes this report, so an
      editor can find out before one arrives.

## 2. Where it is published

- [ ] 2.1 Publish it wherever diagnostics are published — on open, on change,
      and for each document `rebindAllDocuments` returns when the configured
      machine moves — so the report and the diagnostics can never disagree.
- [ ] 2.2 Leave the diagnostic on an unbindable program exactly as it is. The
      remedy is said once.

## 3. Tests

- [ ] 3.1 Colocated tests for the report's shape: a declared machine, a
      configured one, an inferred one, and a decline.
- [ ] 3.2 A test that the report follows a change of configured machine for
      every open program.
- [ ] 3.3 A test that the version reported is the version bound.

## 4. Say what changed

- [ ] 4.1 The language-server guide under `docs/`, where what an editor gets
      from this server is described.

## 5. Quality gates

- [ ] 5.1 `npm run typecheck`
- [ ] 5.2 `npm test`
- [ ] 5.3 `npm run lint`
- [ ] 5.4 `npm run format:check`
- [ ] 5.5 `npm run docs:build` — required, since `docs/` changes in 4.1.
- [ ] 5.6 No e2e run applies: nothing here is visible in the browser IDE. The
      client this serves lives in `basically-editor-extensions`, and checking it
      against an unreleased server is what
      `BASICALLY_SERVER_PATH=… npm test` is for there.
