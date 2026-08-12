# Tasks

## 1. Record the program's own numbers

- [x] 1.1 Have the multi-statement scan record the BASIC line number, skipping
      a code line that carries none.
- [x] 1.2 Have the statement walk the empty-loop finding reads do the same, so
      a loop is named by the line its `FOR` is numbered, and an unnumbered line
      cannot pair its `FOR` with a later `NEXT`.
- [x] 1.3 Correct the field documentation on both sides of the wire, which
      described editor lines and justified them by what a reader searches a
      listing for.

## 2. Correct the labels

- [x] 2.1 Drop "Editor" from the statement-layout and delay-loop labels in the
      guide.
- [x] 2.2 Drop it from the same two findings in the report handed to the
      assistant.

## 3. Pin it

- [x] 3.1 Invert the test that asserted the editor line was reported.
- [x] 3.2 Add a regression for the reported case: `30 PRINT:PRINT` on the third
      line of the editor is named 30, not 3.
- [x] 3.3 Update the port-report and guide-message expectations to the
      program's own numbers.

## 4. Quality gates

- [x] 4.1 `npm run typecheck`
- [x] 4.2 `npm test`
- [x] 4.3 `npm run lint`
- [x] 4.4 `npm run format:check`
- [x] 4.5 `npm run e2e:chromium -- e2e/porting-guidance`
