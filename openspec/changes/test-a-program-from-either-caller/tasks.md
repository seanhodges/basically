## 1. The one expectation vocabulary

- [x] 1.1 Extend the shared schedule parser with the expectation forms: text on
      screen, text not on screen, the program stopped, the program running, a
      variable holding a value, and the form only the assistant can settle. Give
      the action union an expectation variant carrying which form and what it
      names.
- [x] 1.2 Make an expectation a step that costs no frames: text is matched a row
      at a time with spaces collapsed exactly as waiting for text does, the
      program state is read through the machine session, and a variable is read
      the same way. A failed expectation stops the script and is reported as a
      failed action already is.
- [x] 1.3 Report an expectation nobody present can settle as unevaluated rather
      than as passed, failed, or unreadable, and carry that third outcome through
      the report shape.
- [x] 1.4 Colocated parser and runner tests: each form parses; a passing
      expectation costs no frames and the script continues; a failing one stops
      the script and names itself; an unevaluable one is neither pass nor fail.

## 2. Checking a program from the command line

- [ ] 2.1 Declare the check as an operation in the shared layer, taking the
      program, the machine and the file of expectations, and returning a verdict:
      every step with its description and outcome, the failing step's line and
      detail where there is one, and the screen as it stood.
- [ ] 2.2 Refuse a machine whose ROM is absent as the caller's mistake before
      anything boots, and refuse an unreadable file or an unparsable line the same
      way, distinct from the outcome reserved for a program at fault.
- [ ] 2.3 Give the operation its command line route and help text, referencing
      the vocabulary table the schedule already documents rather than repeating
      it.
- [ ] 2.4 Colocated tests on a machine whose ROM is present: a file that holds
      passes; one naming text never printed fails at that line with the screen
      attached; one with an unreadable line is refused before booting; a variable
      expectation is judged.
- [ ] 2.5 Remove the exemption recorded against checking a program, and confirm
      the parity test fails if it is left behind.

## 3. The assistant on the same vocabulary

- [ ] 3.1 Move the assistant's stated expectations onto the shared vocabulary,
      keeping the earlier spellings accepted so a restored conversation is never
      read as malformed, and teaching only the current ones.
- [ ] 3.2 Replace the sampling that remembered whether something was ever true
      with the wait that says so, and update the rules the assistant is given to
      say when an expectation is judged and how to express a transient one.
- [ ] 3.3 Keep the form only the assistant can settle working exactly as it does
      today, and record it in the parity table as available to the assistant
      alone, with the reason.
- [ ] 3.4 Tests: an expectation about text that is printed and then cleared holds
      when preceded by a wait and does not when it is not; a conversation saved in
      the earlier vocabulary restores with its expectations intact; the same file
      run through both callers reaches the same verdict.

## 4. Documentation

- [ ] 4.1 Update the commands section of `CLAUDE.md` with one example of checking
      a program, noting that it needs a ROM.
- [ ] 4.2 Update `docs/contributing/architecture.md`: the check joins the
      operations, and the sentence about the shared driving vocabulary extends to
      say expectations are part of it. No machine lists, no counts.

## 5. Quality gates

- [ ] 5.1 `npx vitest run src/app/ src/ops/ src/cli/ src/ai/` — the grown
      vocabulary, the new operation, and the assistant paths that consume both.
- [ ] 5.2 `npm run typecheck`, `npm run lint`, `npm run format:check`
- [ ] 5.3 `npm run docs:build`, because `docs/contributing/architecture.md`
      changes.
- [ ] 5.4 `npx openspec validate --specs`
- [ ] 5.5 `npm run e2e:chromium -- e2e/ai-assistant`, because what the assistant
      states and how a failed expectation is reported are visible in the panel.
- [ ] 5.6 By hand, with the bundle rebuilt: a file whose actions and expectations
      all hold exits 0; one naming text never printed exits with the program-at-
      fault outcome, naming the failing line; one with a bad line is refused
      before any boot; the structured verdict says the same as the readable one;
      and with the ROM directory moved aside the check is refused for the missing
      ROM.
