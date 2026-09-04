## Why

Today there is no way to check what a program does except by looking at its
screen — by hand in the browser, or by reading a headless run's output and
deciding for yourself whether it looks right. Neither scales past one thing
worth checking, and neither gives a script or an agent a verdict it can act on.

This was previously proposed as an operation for the command line alone, with
its own four-line assertion vocabulary. That proposal is withdrawn and replaced
by this one, for a reason that only became visible once the callers were held to
one list: the assistant has been asserting things about its own programs all
along, in a different vocabulary, evaluated at a different moment. Adding a
second one to the command line would have meant one machine, two ways to say the
same thing, and an assertion capability belonging to one caller — which the
parity guarantee refuses.

So the question is no longer "how should the command line assert" but "what is
the one way this product says what a program should do". The two existing
vocabularies are close enough that the answer is mostly reconciliation, and one
of them contains a form nothing but a model can settle, which is the part worth
designing rather than deciding.

## What Changes

- **One expectation vocabulary**, read by the same parser both callers already
  drive with, replacing the assistant's separate one. A caller states what should
  be on screen, what should not be, whether the program should have stopped or
  still be running, and what a variable should hold.
- **A program can be checked against a written expectation from the command
  line**, passing or failing, and reporting which expectation failed, at which
  line, and what the screen actually held. A file of expectations is the same
  schedule of actions a run can already be given, with expectations mixed in —
  not a second format.
- **What a variable holds becomes assertable from the command line**, which the
  assistant could already state and the command line could not.
- **The moment an expectation is judged becomes something the caller says**
  rather than something each caller assumed. Waiting for text to appear already
  expresses "at some point during the run"; an expectation on its own expresses
  "now". The assistant's habit of sampling the screen throughout a run and
  remembering whether something was ever true is replaced by saying so.
- **The one form only the assistant can settle is declared as such.** An
  expectation about how the screen *looks* — a shape, a layout, a colour — is
  judged by showing the assistant a picture and asking it. No command line can
  evaluate that, so it is a stated asymmetry with a reason, not an accident.

## Non-goals

- **Several scenarios in one file.** A file of expectations is one linear
  script; a program with three things to check has three files, and the command
  line is a loop away from running them all.
- **A picture of the screen from a check.** A check's product is its verdict; a
  caller who wants the picture at a moment asks for it from a run.
- **Changing what the assistant does with a failed expectation.** It is asked to
  correct its program exactly as it is today; only the words it states the
  expectation in change.
- **Revisiting the operation layer or the parity guarantee.** Both are inherited
  from `share-one-interface-across-callers`, not reopened. This change is one of
  its declared asymmetries being closed.
- **Translating a program between machines.** Nothing here changes what a
  program does; it only checks what it does.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `headless-cli`: gains the guarantee that a program's behaviour can be checked
  against a written expectation and reported as a pass or a failure, including
  what a variable holds.
- `ai-assistant`: the expectations it states stop being a vocabulary of their own
  and become the one every caller writes, with the moment an expectation is
  judged stated rather than assumed, and with the one form only it can settle
  declared as the asymmetry it is.

## Impact

**Depends on `share-one-interface-across-callers`.** That change puts the
operation layer, the machine session and the parity guarantee in place, and
records this vocabulary split as a declared asymmetry. This change closes it.
Attempted first, this one would be adding a second vocabulary to the very
parser the guarantee is meant to hold to one.

**The assistant's stated expectations change spelling.** Its rules describe the
forms it may write, so those rules change, and conversations already saved were
written against the old spelling. Restoring one must not misread an old
expectation as malformed — a saved thread is a record, and the vocabulary it was
written in has to stay readable even after it stops being what is taught.

**One evaluation path instead of two.** The assistant evaluates expectations
against readings latched during a run; the command line judges them against the
machine as it stands at that point in a schedule. These become one thing, which
is the substantive work here and the place a behavioural regression would hide.

**No new dependency.** A file of expectations is the line-per-action script the
parser already reads, so nothing is added to the runtime bundle and there is no
licence to check.
