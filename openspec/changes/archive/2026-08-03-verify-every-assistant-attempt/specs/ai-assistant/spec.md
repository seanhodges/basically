## ADDED Requirements

### Requirement: Every answer carrying code is checked before it is offered

When the assistant returns a program, the IDE SHALL run and check it without the
user asking and without that program reaching the editor. What is run SHALL be
the program the reply proposes: a whole listing as it was returned, and a
fragment as it would stand once merged into the program the reply was written
against.

The user's program SHALL NOT be modified by the check, and applying SHALL remain
a separate action the user chooses after seeing an answer that has already been
run. A reply that carries no program SHALL NOT start the machine.

Where the proposed program cannot be built into something the machine can run,
that SHALL be reported to the assistant as a failure of that answer, correctable
on the same terms as a failure at runtime — never passing silently as an answer
that was never checked.

Where the kind of the returned program cannot be established, it SHALL NOT be
checked and SHALL be offered as it is — the IDE does not assume what it could not
determine, and running the wrong reading of a block is a worse answer than
running none. Where a reply returns more than one program that could be applied,
the last SHALL be the one checked.

Where the machine cannot report its runtime state, no check SHALL be attempted
and the answer SHALL be offered as it is on any other machine.

A check SHALL run in the background. It SHALL NOT take the machine's screen or
the keyboard from whatever the user is doing: on layouts where the assistant and
the machine share the same space the assistant SHALL remain the one shown, and on
every layout the keys SHALL stay where the user had them. Only an action the user
takes — applying and running an answer, or closing the assistant — SHALL bring the
machine forward. A check that goes unwatched SHALL be checked no differently from
one the user happens to be looking at.

#### Scenario: A reply that returns a whole program

- **WHEN** the assistant returns a whole listing
- **THEN** that listing is run and checked without the user asking, and the
  program in the editor is unchanged

#### Scenario: A reply that returns a fragment

- **WHEN** the assistant returns a fragment of a program
- **THEN** what is run is that fragment merged into the program it was written
  against, and the program in the editor is unchanged

#### Scenario: A reply that returns no code

- **WHEN** the assistant answers without returning a program
- **THEN** the machine is not started and no outcome is reported

#### Scenario: A proposed program that cannot be built

- **WHEN** the program the assistant returned cannot be turned into something the
  machine can run
- **THEN** the assistant is told so as a failure of that answer, on the same
  terms as a failure at runtime

#### Scenario: A program whose kind cannot be established

- **WHEN** the assistant returns a program whose stated kind and its own line
  numbers disagree, so its kind is unknown
- **THEN** it is not checked, and it is offered exactly as it is today

#### Scenario: A reply that returns more than one program

- **WHEN** the assistant returns several programs that could be applied
- **THEN** the last is the one checked

#### Scenario: Applying an answer that has already been checked

- **WHEN** the user applies and runs an answer that was already checked
- **THEN** the program runs as any program the user runs does, and the answer is
  not checked a second time

#### Scenario: A machine that cannot report its runtime state

- **WHEN** the assistant returns a program for a machine that cannot report
  whether it failed
- **THEN** no check is attempted, and the answer is offered exactly as it would
  be on any other machine

#### Scenario: An answer checked while the user reads it

- **WHEN** an answer is being checked on the machine and the assistant is what
  the user is looking at
- **THEN** the assistant stays on the screen and keeps the keyboard, and the
  check runs behind it to the same verdict it would otherwise have reached

#### Scenario: Running an answer the user chose to run

- **WHEN** the user applies an answer and runs it
- **THEN** the machine is brought forward as it is for any run the user asked for

### Requirement: What the assistant is doing is stated

While the user is waiting on the assistant, the IDE SHALL say which stage the
work is in, distinguishing at least: composing an answer, running that answer on
the machine, looking at the screen it produced, and correcting a failure.

A stage SHALL remain stated for as long as it lasts, including a stage that
continues after the answer has finished arriving — so that waiting on the machine
is never indistinguishable from nothing happening. The machine a program is being
checked on SHALL be named, since which machine it is is what decides how long it
takes and what it can be checked for.

Every stated stage SHALL be stoppable by the same action that stops any other.

#### Scenario: Waiting on the machine

- **WHEN** the assistant's answer has arrived and its program is being run and
  watched
- **THEN** the IDE says the answer is being checked on that machine, rather than
  still saying the assistant is thinking and rather than saying nothing

#### Scenario: Waiting on a judgement

- **WHEN** the assistant is being shown the screen and asked to judge its own
  program against what it stated
- **THEN** the IDE says so, distinctly from composing an answer

#### Scenario: Stopping while the machine is being watched

- **WHEN** the user stops the assistant while its answer is being checked
- **THEN** the check ends as any other stopped stage does, and no correction
  follows

### Requirement: The finished work is shown for a human check

Once the assistant has stopped working on an answer — because it was checked and
accepted, because the bound on unrequested corrections was reached, or because
the user stopped it — the IDE SHALL show the user the machine's screen as it
stood, once for that answer.

It SHALL be shown whatever the outcome was, including where correcting the
program was given up on, because an answer the assistant could not settle is
where a human look is worth most. Where several attempts were made, exactly one
screen SHALL be shown: the one the last attempt produced.

That display SHALL be shown to the user only. It SHALL NOT be sent to the
provider and SHALL NOT become part of what any later request carries.

Where no display can be captured, the answer SHALL be offered without one rather
than withheld.

#### Scenario: An answer that checked out

- **WHEN** the assistant's program runs and everything it stated holds
- **THEN** the user is shown the machine's screen as it stood, once

#### Scenario: An answer the assistant could not fix

- **WHEN** the bound on unrequested corrections is reached and the failure is
  offered as a fix for the user to accept
- **THEN** the user is still shown the machine's screen from the last attempt

#### Scenario: Several attempts on one answer

- **WHEN** an answer took more than one attempt to settle
- **THEN** exactly one screen is shown, from the last attempt, rather than one per
  attempt

#### Scenario: The screen shown to the user is not sent onward

- **WHEN** the user is shown the machine's screen at the end of an answer, and
  then makes a further request
- **THEN** that display is not sent to the provider, and the further request
  carries no more than it would have carried anyway

## MODIFIED Requirements

### Requirement: Errors flow back into the conversation

After applying generated code, new lint errors SHALL prompt an offered fix.

Where the IDE runs a program the assistant returned and the machine can report
its runtime state, the outcome of that run SHALL be reported back to the
conversation — whether the program failed, ended without failing, was still
running when the check ended, or never started. That run SHALL happen whether or
not the user has applied the code, and SHALL NOT require the user to ask for it.
A program still running when the check ends SHALL be treated as having run, not
as having failed, because a program that never returns to the machine's ready
state is the normal shape of a game or an animation.

Telling a program that has finished from one that is still going requires more
than the failure report, so where the machine can also say whether a program is
executing, the outcome SHALL distinguish the two. Where it cannot, a run that
raises no failure SHALL be reported as having run without failing. Either way no
correction follows, so which of the two is reported SHALL NOT change what the
assistant is asked to do.

A reported outcome MAY additionally carry the machine's screen, as text or as an
image or as both. Where it carries an image, that image SHALL be the machine's
screen at the machine's own resolution and SHALL NOT be enlarged, so that what
the assistant is shown is what the machine drew and the cost of showing it stays
proportional to the machine.

Which views an outcome carries SHALL NOT change what the assistant is asked to
do.

Where the machine cannot report its runtime state, no outcome SHALL be reported
and the rest of the assistant SHALL be unaffected.

#### Scenario: Runtime error after an assistant's program is run

- **WHEN** a program the assistant returned stops with a machine error report
- **THEN** that error is reported back to the conversation

#### Scenario: A program that runs without failing

- **WHEN** a program the assistant returned reaches the machine's ready state with
  no error, on a machine that can tell a finished program from a running one
- **THEN** the conversation reflects that it ran to completion, rather than
  nothing being reported

#### Scenario: A machine that cannot tell finished from still running

- **WHEN** a program the assistant returned raises no failure, on a machine that
  cannot say whether a program is executing
- **THEN** the conversation reflects that it ran without failing, and no
  correction is attempted

#### Scenario: A program still running when the check ends

- **WHEN** a program the assistant returned is still running when the check ends
- **THEN** it is treated as having run, and no failure is reported

#### Scenario: The screen is shown as the machine drew it

- **WHEN** an outcome carries the screen as an image
- **THEN** the image is the machine's own screen at its own resolution, neither
  enlarged nor otherwise resampled

#### Scenario: A screen does not change the request

- **WHEN** an outcome carries the screen as well as how the run went
- **THEN** what the assistant is asked to do is what the outcome alone would have
  asked of it

#### Scenario: A machine that cannot report its runtime state

- **WHEN** the assistant returns a program for a machine that cannot report
  whether it failed
- **THEN** no outcome is reported, and applying and running behave exactly as
  they do on any other machine

#### Scenario: Lint errors after applying

- **WHEN** applying generated code leaves the program with new lint errors
- **THEN** the assistant offers to fix them

### Requirement: A failed run is corrected without being asked

When a program the assistant returned fails with a genuine machine error, the
assistant SHALL be asked to correct it without the user having to request it.

The number of corrections attempted without asking SHALL be bounded and the same
for every machine and every provider. The bound SHALL count corrections, not the
requests made to establish whether a run failed: asking the assistant to judge
its own program against the display it produced is part of settling that run, and
SHALL NOT spend the bound by itself. Where such a request also returns a
correction, that correction SHALL spend exactly one — the same one an error
correction spends — so a run whose outcome needed judging gets no fewer, and no
more, unrequested corrections than one whose outcome did not. At most one judging
request SHALL be made per run, so leaving it out of the bound cannot make a run
cost an unbounded number of requests. Once the bound is reached the failure SHALL
be offered as a fix the user chooses to accept, rather than attempted again — so
the user is always the one who decides whether to keep going.

The bound SHALL apply to the run being corrected, and SHALL be released when the
user makes a new request, so that a long conversation does not exhaust it.

A correction in progress SHALL be visible as such, and SHALL be stoppable by the
same action that stops any other reply; a judgement in progress SHALL be visible
and stoppable on the same terms. A correction SHALL NOT begin while the program
it was written against has been changed by the user — which is the program the
assistant was answering about, not the program that was run, since a corrected
answer is written against the former.

Applying generated code SHALL remain a single action: applying without running
SHALL NOT cause the machine to start.

#### Scenario: A program that fails at runtime

- **WHEN** a program the assistant returned stops with a machine error report
- **THEN** the assistant is asked to correct that error without the user
  requesting it

#### Scenario: Corrections that keep failing

- **WHEN** the corrected program fails again, until the bound on unrequested
  corrections is reached
- **THEN** no further correction is attempted, and the failure is offered as a
  fix for the user to accept

#### Scenario: A judgement that finds nothing wrong

- **WHEN** the assistant is asked to judge its program against the display it
  produced, and judges that what it stated holds
- **THEN** none of the bound on unrequested corrections has been spent, and a
  later failure of that run still gets its full allowance

#### Scenario: A judgement that finds a failure

- **WHEN** a judging request finds that what the assistant stated does not hold
  and returns a corrected program
- **THEN** exactly one of the bounded corrections is spent — the same as for a
  runtime error, and no more for having needed a judgement

#### Scenario: One judgement per run

- **WHEN** a run is settled by asking the assistant to judge the display
- **THEN** no more than one such request is made for that run

#### Scenario: A new request releases the bound

- **WHEN** the user makes a new request after the bound has been reached, and a
  run from that request fails
- **THEN** corrections are attempted again for that run

#### Scenario: Stopping a correction

- **WHEN** the user stops a correction that is in progress
- **THEN** it ends as any other stopped reply does, and no further correction is
  attempted for that run

#### Scenario: Stopping a judgement

- **WHEN** the user stops a judgement that is in progress
- **THEN** it ends as any other stopped reply does, the run is not failed because
  of it, and no correction follows

#### Scenario: The program changed while the answer was being checked

- **WHEN** a checked answer fails after the user has edited the program that
  answer was written against
- **THEN** no correction is attempted without asking

#### Scenario: The check does not count as an edit

- **WHEN** an answer is checked without being applied, and it fails
- **THEN** the correction proceeds, because the program the answer was written
  against is unchanged — the check having run a different program does not by
  itself withhold the correction

#### Scenario: Applying without running

- **WHEN** the user applies generated code without choosing to run it
- **THEN** the machine does not start

### Requirement: Stated expectations are checked against the run

Where the assistant has stated expectations and the IDE runs the program it
returned, those expectations SHALL be checked once the run has been observed, and
the result SHALL be reported back to the conversation alongside the run's
outcome.

Expectations the machine can evaluate SHALL be evaluated from the machine.
Expectations about how the screen looks SHALL be settled by showing the assistant
the display as it stood when the run was observed and asking it to judge its own
program against what it stated; the judgement SHALL be visible in the
conversation as something the IDE asked for rather than something the user did.

An expectation that does not hold SHALL be treated as a failure of that run, and
SHALL be correctable on the same terms as a runtime error — including the bound
on corrections attempted without asking. Where an expectation about how the
screen looks does not hold, the assistant SHALL be asked to correct the program
without the user having to request it, on those same terms.

An expectation that cannot be evaluated SHALL be reported as unchecked rather
than as passed or failed. An expectation about how the screen looks SHALL be
reported as unchecked when there is no display to show or the chosen provider
cannot be shown one — never as passed, and never as a failure of the program.

#### Scenario: The program produces the wrong answer

- **WHEN** a program runs without error but a stated expectation does not hold
- **THEN** the run is reported as failed and the assistant is asked to correct it

#### Scenario: The program produces the right answer

- **WHEN** a program runs and every stated expectation holds
- **THEN** the run is reported as having succeeded

#### Scenario: The program draws the wrong thing

- **WHEN** a program runs without error, the assistant is shown the display, and
  it judges that what it stated the screen would look like does not hold
- **THEN** the run is reported as failed and the assistant is asked to correct
  the program without the user requesting it

#### Scenario: The program draws what was stated

- **WHEN** a program runs and the assistant, shown the display, judges that what
  it stated holds
- **THEN** the run is reported as having succeeded, and no correction is
  attempted

#### Scenario: An expectation that cannot be evaluated

- **WHEN** an expectation cannot be checked on the machine the program ran on
- **THEN** it is reported as unchecked, and neither passed nor failed

#### Scenario: Nothing to judge a visual expectation against

- **WHEN** the assistant stated how the screen should look but the display
  cannot be shown to the chosen provider
- **THEN** that expectation is reported as unchecked, and the run is not failed
  because of it

#### Scenario: Expectations are checked without the user applying anything

- **WHEN** the assistant returns a program that states expectations
- **THEN** those expectations are checked against the run the IDE started, with
  the program in the editor unchanged

### Requirement: A shown screen is not retained

A display shown to the assistant SHALL be sent only to the provider the user
chose, and SHALL be held no longer than the request that carries it needs. A
display shown to the user SHALL be sent to no provider at all.

The saved conversation SHALL record that a screen was shown without retaining
the display itself, so restoring a thread never depends on stored image data and
never restores it. This SHALL hold however the screen came to be in the thread —
shown to the assistant, or shown to the user for a human check.

#### Scenario: Reloading a conversation in which a screen was shown

- **WHEN** the user reloads the IDE on a program whose conversation included a
  shown screen
- **THEN** the thread still shows that a screen was shown at that point, and the
  display itself is not restored

#### Scenario: Reloading a conversation that ended with a human check

- **WHEN** the user reloads the IDE on a program whose conversation ended with the
  machine's screen shown for a human check
- **THEN** the thread still records that a screen was shown, and the display
  itself is not restored

### Requirement: The assistant states what its program should produce

When the assistant returns a program it MAY additionally state what should be
true once that program has run — the values it expects named variables to hold,
what it expects to be on the screen, and how it expects the screen to look. What
it is asked to state SHALL be limited to what can be evaluated for the chosen
machine and the chosen provider, so it never states an expectation that cannot be
evaluated: it SHALL NOT be asked to state expectations about variables on a
machine that cannot report them, and SHALL NOT be asked to state expectations
about how the screen looks where the display cannot be shown to it.

An expectation about how the screen looks SHALL be a description of what the
program is meant to have drawn — one the assistant itself can judge by being
shown the display — and is distinct from expecting particular text to appear,
which the machine reports for itself.

Expectations SHALL be optional: a reply that states none behaves exactly as a
reply does today, and no machine becomes unusable for being unable to report
them.

Expectations SHALL NOT be program text. They SHALL never be applied to the
editor, and applying generated code SHALL be unaffected by their presence.

Expectations are stated to the IDE, which checks them. They SHALL NOT be shown in
the conversation: there is nothing for the user to apply, answer or decide about
them, and every checked answer states them, so showing them would put the
checking machinery in front of every reply. What the assistant wrote for the user
— its own words and its program — SHALL be shown as it always was.

#### Scenario: A program with a computable result

- **WHEN** the assistant returns a program whose result the machine can report
- **THEN** it may also state what that result should be

#### Scenario: A program that draws something

- **WHEN** the assistant returns a program that draws, on a setup where the
  display can be shown to it
- **THEN** it may also state how the screen should look once the program has run

#### Scenario: A machine that cannot report what an expectation needs

- **WHEN** the assistant writes for a machine that cannot report its variables
- **THEN** it is not asked to state expectations about variables

#### Scenario: A provider that cannot be shown the screen

- **WHEN** the assistant writes for a setup whose provider cannot be shown the
  display
- **THEN** it is not asked to state expectations about how the screen looks

#### Scenario: Applying a reply that carries expectations

- **WHEN** the user applies generated code from a reply that also states
  expectations
- **THEN** only the program is applied, and the expectations do not appear in the
  editor

#### Scenario: A reply that states expectations

- **WHEN** the assistant returns a program and states what it should produce
- **THEN** the conversation shows the answer and its program, and not the
  expectations, which are still checked against the run

### Requirement: The assistant asks for the screen it wants to see

Alongside the code it returns, the assistant MAY name the views of the machine's
screen it wants to be shown when that program is run. Where it names one, the
outcome of running that program SHALL carry what was named and nothing further;
where it names none, the outcome SHALL carry no view of the screen.

The choice belongs to the assistant because only the assistant knows what it
wrote: no rule applied to the finished screen distinguishes a program that
printed a table from one that drew a table's border out of graphics characters.

A stated expectation that only a look can settle SHALL itself carry the screen,
without the assistant having to ask for it a second time.

So that the choice can be made well, the assistant SHALL be told which views can
be produced for the machine and the provider in front of it. Naming a view SHALL
be optional in every case: a reply that names none behaves exactly as a reply
does today, and no machine or provider becomes unusable for being unable to
produce one.

What the assistant is asked to do SHALL NOT change with the views an outcome
carries: a correction is the same correction whether or not a picture came with
it.

A view is asked of the IDE, which produces it. Like an expectation, it SHALL NOT
be shown in the conversation — the screen it asks for is what the user sees, not
the asking.

#### Scenario: A program whose output is a picture

- **WHEN** the assistant returns a drawing program and asks to be shown the
  screen as an image, and that program is applied and run
- **THEN** the outcome of that run carries the screen as an image

#### Scenario: A program whose output is text

- **WHEN** the assistant returns a program and asks for no view, and that
  program is applied and run
- **THEN** the outcome carries no view of the screen, whatever the run did

#### Scenario: An expectation that needs a look

- **WHEN** the assistant states an expectation about how the screen looks
- **THEN** the screen is shown to it when that run is checked, without it having
  asked for the view separately

#### Scenario: The views do not change the request

- **WHEN** a run fails and its outcome carries a view the assistant asked for
- **THEN** the correction asked of the assistant is the one that failure would
  have asked for regardless

#### Scenario: A reply that asks to be shown a view

- **WHEN** the assistant returns a program and names the view of the screen it
  wants to be shown
- **THEN** the conversation shows the answer and its program, and not the
  request, which the run still carries
