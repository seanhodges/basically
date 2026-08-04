# ai-assistant Specification

## Purpose

An optional AI pair-programmer that knows the active machine's BASIC rules:
the user brings their own API key, chats about the current program, and lands
generated code back into the editor safely — with lint and runtime errors
feeding the loop.

## Requirements

### Requirement: Bring-your-own-key, multiple providers

The assistant SHALL work with the user's own API key against any of the
supported AI providers, streaming replies as they generate. Keys SHALL be
stored locally in the browser only and sent to no one but the chosen
provider. The assistant SHALL be entirely optional: every other IDE
capability works without a key.

#### Scenario: No key configured

- **WHEN** the user opens the assistant without a configured key
- **THEN** they are directed to settings, and the rest of the IDE remains
  fully functional

### Requirement: The assistant knows the machine and the program

Each request SHALL carry the active dialect's language rules and the current
program (with its outstanding lint errors), so generated code targets the
machine the user is writing for.

The language rules carried SHALL be the machine's own, complete definition: every
command, function and operator the machine accepts, with its usage and its
behaviour; the machine's line-numbering, statement, assignment, variable-naming
and number-handling rules; the printable characters its character set cannot represent,
where it cannot represent them all; how it spells the control codes its character set
holds; its screen, colour and sound capabilities; and, where
the machine lacks a capability another machine has, what to do on this machine
instead.

A machine that represents printable ASCII in full SHALL carry no statement about
characters it lacks, rather than a statement that it lacks none.

These SHALL come from the same source as the guidance the IDE shows the user, so
that what the assistant is told and what the user is shown about a machine cannot
disagree.

Every machine SHALL be described to the same standard, so that the completeness
of what the assistant knows does not vary by machine.

#### Scenario: Dialect-correct generation

- **WHEN** the user asks for a program on a machine with restrictive syntax
  rules
- **THEN** the generated code follows that machine's rules rather than
  generic BASIC

#### Scenario: A command outside the machine's common repertoire

- **WHEN** the user asks for something needing a command the machine has but
  which is rarely used
- **THEN** the assistant can use it, because the machine's full command set was
  carried with the request

#### Scenario: A capability the machine does not have

- **WHEN** the user asks for something the machine has no command for
- **THEN** the assistant applies the approach documented for that machine rather
  than inventing a command or using another machine's

#### Scenario: A character the machine cannot represent

- **WHEN** the user asks for text containing a character the machine's character set
  has no glyph for
- **THEN** the assistant writes text the machine can represent, rather than producing
  a program that fails to be read and correcting it afterwards

#### Scenario: Writing a control code

- **WHEN** the user asks for something needing an embedded control code
- **THEN** the assistant spells it as this machine spells it, because the machine's
  control-code spellings were carried with the request

#### Scenario: The assistant and the guidance agree

- **WHEN** the assistant states a language rule for a machine and the IDE's own
  guidance states the same rule
- **THEN** the two agree, because both are drawn from one source

### Requirement: The assistant returns the smallest correct edit

When the user asks for a change to an existing program and the change affects
notably fewer lines than the program contains, the assistant SHALL return only
the affected lines rather than the whole program. It SHALL return a complete
listing when writing a new program, and when the change rewrites most of an
existing one.

The rules governing this SHALL be the same for every machine, so that the choice
between a fragment and a whole listing does not vary by which machine is
selected.

#### Scenario: A small change to a long program

- **WHEN** the user asks for a change affecting a few lines of a long program
- **THEN** the assistant returns just those lines as a fragment

#### Scenario: A new program

- **WHEN** the user asks for a program to be written from scratch
- **THEN** the assistant returns a complete listing

#### Scenario: Consistency across machines

- **WHEN** the same kind of request is made on any two registered machines
- **THEN** the assistant applies the same rule in choosing between a fragment and
  a complete listing

### Requirement: Generated code lands in the editor safely

Every generated code block SHALL be identified as either a whole program listing
or a partial fragment. The assistant SHALL state which it has returned, and the
IDE SHALL check that statement against the block's own line numbers; where the
two disagree, or where no statement was made and the line numbers are
inconclusive, the block SHALL be treated as of unknown kind rather than assumed.

The apply actions offered for a block SHALL match its kind: a fragment SHALL
offer merging line by line (matching line numbers replace, new lines insert in
order, and a line given as a bare line number is deleted), and a whole listing
SHALL offer replacing the program. Each SHALL also be offered as an apply-and-run
action. A block of unknown kind SHALL offer both, identified as a choice the user
must make. Applying SHALL remain a single action with no confirmation step, and
SHALL be reversible through the editor's normal undo.

Before a fragment is merged, the user SHALL be able to see which lines it adds,
changes and removes, shown against the current program. What is shown SHALL match
what merging actually does.

Because a fragment describes a change to the program as it stood when the reply
arrived, the IDE SHALL warn — without preventing the merge — when the program has
changed since.

Applying code SHALL preserve opaque binary line records untouched: they SHALL
never be deleted by a fragment and SHALL never be presented as changes.

#### Scenario: Merge into existing program

- **WHEN** the user merges a generated fragment whose line numbers overlap
  the program
- **THEN** overlapping lines are replaced, new lines are inserted in order,
  and all other lines are unchanged

#### Scenario: A fragment offers only merging

- **WHEN** the assistant returns a partial fragment for an existing program
- **THEN** the actions offered apply it by merging, and replacing the whole
  program with the fragment is not offered

#### Scenario: A whole listing offers only replacing

- **WHEN** the assistant returns a complete program listing
- **THEN** the actions offered replace the program, and merging the listing into
  the existing program is not offered

#### Scenario: The kind cannot be established

- **WHEN** what the assistant says about a block conflicts with the block's own
  line numbers, or nothing was said and the line numbers are inconclusive
- **THEN** both applying by merging and replacing the whole program are offered,
  identified as a choice for the user rather than a recommendation

#### Scenario: Seeing what a fragment changes

- **WHEN** the assistant returns a partial fragment
- **THEN** the lines it adds, changes and removes are shown against the current
  program before it is applied, and applying it produces exactly that result

#### Scenario: Deleting a line from a fragment

- **WHEN** a merged fragment contains a bare line number that exists in the
  program
- **THEN** that line is removed from the program and every other line is unchanged

#### Scenario: A bare line number in a whole listing

- **WHEN** a complete program listing contains a bare line number
- **THEN** no line is deleted as a result

#### Scenario: The program changed since the reply arrived

- **WHEN** the user merges a fragment after editing the program that the fragment
  was written against
- **THEN** they are warned that it may no longer apply cleanly, and can still
  choose to merge

### Requirement: An incomplete or declined reply is not offered as finished code

A reply cut short before the assistant finished SHALL be identified as incomplete
and SHALL NOT be offered for applying as though it were a finished answer. A
request the assistant declines SHALL be reported as declined, and SHALL NOT be
retried as though no reply had been received.

#### Scenario: The reply is cut short

- **WHEN** the assistant's reply stops before it has finished writing
- **THEN** the code it produced is marked as incomplete and cannot be applied as
  a finished answer

#### Scenario: The assistant declines the request

- **WHEN** the assistant declines to answer
- **THEN** the user is told the request was declined, rather than being told no
  response was received

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

That display SHALL NOT be sent on any request the IDE makes of its own accord. It
is what the user's own next request carries, and nothing else sends it.

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

#### Scenario: The screen shown to the user is not sent by the IDE

- **WHEN** the user is shown the machine's screen at the end of an answer and the
  IDE goes on to ask the assistant for something without being asked to
- **THEN** that request carries no more than it would have carried anyway

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

### Requirement: The conversation resets with the program

The chat thread SHALL persist across reloads while the user keeps working on
the same program, and SHALL clear when a different program becomes active or
when the user clears it deliberately.

#### Scenario: Open a different file

- **WHEN** the user opens a different program
- **THEN** the previous conversation no longer applies and the thread starts
  fresh

#### Scenario: Reloading on the same program

- **WHEN** the user reloads the IDE while still working on the same program
- **THEN** the conversation is still there, in the order it was held

### Requirement: The assistant keeps working while it is out of sight

Putting the assistant away SHALL NOT cancel its work. Closing it, moving to
another view, or leaving the page in the background SHALL leave a request, a
check, and an unrequested correction all running, and coming back SHALL show
the work as it now stands rather than as it was left. Only the user stopping
it, clearing the conversation, or a different program becoming active SHALL
end work that is in flight.

#### Scenario: Closing the assistant while an answer is arriving

- **WHEN** the user closes the assistant while an answer is still arriving and
  opens it again afterwards
- **THEN** the answer arrived in full and is there waiting

#### Scenario: Looking away while a check runs

- **WHEN** a check is running and the user moves to another view or leaves the
  page in the background
- **THEN** the check still reaches its verdict

### Requirement: An answer the page interrupted is offered again

An answer still arriving when the page goes away SHALL be restored marked as
cut short, and SHALL be distinguishable from one the user stopped on purpose.
This SHALL hold whether or not the answer had begun any code, so an answer
interrupted mid-sentence never reads as a finished one.

Because a stream cannot be picked up where it left off, the assistant SHALL
offer to put the same request again rather than claiming to resume it. What
was already said stays in the thread as the record of what happened.

#### Scenario: Reloading while an answer is arriving

- **WHEN** the user reloads the IDE while an answer is still arriving
- **THEN** the part that had arrived is still there, marked as cut short, with
  the offer to ask again

#### Scenario: An answer interrupted before any code

- **WHEN** the answer that was interrupted had not yet begun any code
- **THEN** it is still marked as cut short

#### Scenario: Asking again

- **WHEN** the user takes the offer to ask again
- **THEN** the same request is put afresh, and the cut-short answer remains in
  the thread above it

#### Scenario: An answer the user stopped

- **WHEN** the user stops an answer themselves and later reloads
- **THEN** it is not offered as interrupted, because nothing interrupted it

### Requirement: Leaving while an answer is arriving is confirmed first

While an answer is still arriving, the IDE SHALL have the browser confirm before
the page is left, so an answer is not lost to a reload the user did not mean.
It SHALL ask only while an answer is actually arriving: once the answer is in,
what remains is a check whose verdict is worth less than the interruption, and
leaving SHALL pass without comment.

This makes an interrupted answer rarer; it does not make it impossible. A page
the browser never gets to unload — a tab reclaimed by the OS, a crash — still
reaches `An answer the page interrupted is offered again`, which continues to
hold.

#### Scenario: Reloading while an answer is arriving

- **WHEN** the user reloads the IDE while an answer is still arriving
- **THEN** the browser asks them to confirm before the page is left

#### Scenario: Reloading with nothing arriving

- **WHEN** the user reloads the IDE with the answer already in
- **THEN** they are not asked anything

### Requirement: The user can clear the conversation

The user SHALL be able to clear the conversation at any time by sending
`/clear`, without having to change program to do it. Clearing SHALL end
whatever is in flight and remove the thread and everything remembered along
with it, leaving nothing to be restored on the next reload.

Because it is the way out of a conversation that has gone wrong, it SHALL work
while the assistant is busy and when no API key is set. It SHALL NOT be sent
to the provider, and SHALL leave the program in the editor untouched.

#### Scenario: Clearing a conversation

- **WHEN** the user sends `/clear`
- **THEN** the thread is empty, and it is still empty after a reload

#### Scenario: Clearing while the assistant is busy

- **WHEN** the user sends `/clear` while an answer is arriving
- **THEN** the answer stops arriving and the thread is empty

#### Scenario: The command is not a question

- **WHEN** the user sends `/clear`
- **THEN** nothing is asked of the provider and the program in the editor is
  unchanged

### Requirement: The user can put the assistant away

The user SHALL be able to close the assistant by sending `/hide`, with the
same effect as its toolbar control. The conversation and any work in flight
SHALL be left untouched, so bringing the assistant back shows it where it now
stands. Like clearing, it SHALL NOT be sent to the provider.

#### Scenario: Hiding the assistant

- **WHEN** the user sends `/hide`
- **THEN** the assistant closes and the machine takes the space it had

#### Scenario: Coming back to a preserved conversation

- **WHEN** the user sends `/hide` while an answer is arriving and opens the
  assistant again
- **THEN** the conversation is as it was, with the answer having continued to
  arrive meanwhile

### Requirement: A project can begin from a description

Creating a project SHALL accept a plain-English description of the wanted
program as its starting point. The IDE SHALL create the project on the chosen
machine and put the description to the assistant as the opening request, with
the assistant revealed so the answer is visible as it arrives.

Because the assistant requires the user's own API key, this starting point SHALL
be offered only when a key is set. Without one it SHALL be presented as
unavailable rather than hidden or silently failing, noting that the assistant
must be configured in settings before the option becomes available.

#### Scenario: Describing a program to start from

- **WHEN** the user creates a project by describing the program they want
- **THEN** the project is created on the chosen machine and the assistant begins
  answering that description for that machine

#### Scenario: The description option with no API key set

- **WHEN** the user is creating a project and the assistant has not been
  configured with an API key
- **THEN** the description option is shown as unavailable, noting that the
  assistant must be configured in settings first, and the other starting points
  remain usable

### Requirement: The screen the user was shown goes with their next request

Where the conversation is showing the user the machine's screen from an answer,
that same display SHALL be carried to the assistant with the user's next request,
so a question about what a program produced is answered against the picture the
user is looking at.

What is carried SHALL be the display already in the conversation. The IDE SHALL
NOT capture the machine again to answer a request, so what the assistant is shown
and what the user is looking at can never be two different pictures.

A display SHALL be carried once. A later request SHALL NOT carry a display the
assistant has already been shown, which stays on the turn that carried it.

A display SHALL be carried only where the chosen provider can be shown one, and
only where the conversation is showing one. Otherwise the request SHALL be sent
with no display and SHALL behave exactly as an ordinary request does.

The conversation SHALL record which request carried the display without showing
the picture a second time: the one already in the thread is the one the assistant
was shown.

#### Scenario: Asking about what the program produced

- **WHEN** the user is shown the machine's screen at the end of an answer and
  then makes a further request
- **THEN** that display is sent with the request, and the thread records that the
  request carried it

#### Scenario: One picture, taken once, shown once

- **WHEN** a request carries the screen the conversation is already showing
- **THEN** no further capture of the machine is taken, and no second copy of the
  picture appears in the thread

#### Scenario: Asking again

- **WHEN** the user makes a further request after one that already carried the
  screen, with no newer screen in the conversation
- **THEN** the later request carries no display of its own

#### Scenario: Nothing has been run yet

- **WHEN** the user makes a request with no screen in the conversation
- **THEN** the request is sent with no display and behaves as any ordinary
  request does

#### Scenario: A conversation restored without its pictures

- **WHEN** the user makes a request in a thread restored from storage, which
  records that a screen was shown but does not hold it
- **THEN** the request is sent with no display

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

### Requirement: A view that cannot be produced is reported as such

Where the assistant names a view that cannot be produced — one this IDE has no
way to produce, or the screen image where the chosen provider cannot be shown an
image, or where there is no display to capture — the outcome SHALL report that
view as unavailable rather than silently carrying a different one or none
without saying so.

Naming an unavailable view SHALL NOT fail the run, SHALL NOT prompt a
correction, and SHALL leave everything else about the outcome unchanged.

#### Scenario: Asking for the image on a provider that cannot be shown one

- **WHEN** the assistant asks for the screen as an image and the chosen provider
  cannot be shown one
- **THEN** the outcome reports that view as unavailable, and the run is reported
  exactly as it otherwise would be

#### Scenario: Asking for a view that does not exist

- **WHEN** the assistant names a view this IDE cannot produce at all
- **THEN** the outcome reports that view as unavailable rather than answering
  with a different one

### Requirement: A failure says when the screen could have been seen

Where a run initiated from the assistant fails, a display could have been shown
to it, and it did not ask for one, the correction request SHALL say that the
screen can be shown if seeing it would help — so that a picture it did not
foresee needing is one turn away rather than out of reach.

#### Scenario: A failure the assistant did not expect to need a picture for

- **WHEN** a run fails, the chosen provider can be shown an image, and the
  assistant asked for no view
- **THEN** the correction request tells it the screen can be shown if that would
  help, and carries no image itself

### Requirement: Being shown the screen is a stated capability

Whether the assistant can be shown the machine's display SHALL be a stated
property of the chosen provider rather than something discovered by attempting
it. Where a provider cannot be shown one, the IDE SHALL NOT send a display to it;
every other part of the assistant SHALL behave identically on such a provider.

#### Scenario: Switching to a provider that cannot be shown a screen

- **WHEN** the user selects a provider that does not accept images
- **THEN** no display is sent on any request, and the assistant otherwise works
  exactly as before

### Requirement: A shown screen is not retained

A display shown to the assistant SHALL be sent only to the provider the user
chose, and SHALL be held no longer than the request that carries it needs. A
display shown to the user SHALL be sent no further than the user's own next
request.

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

### Requirement: The assistant can drive the program it wrote

Alongside the code it returns, the assistant MAY ask to be given the machine once
that program has been run and observed. Where it asks, and where the chosen
provider can be given it, the IDE SHALL let the assistant act on the running
machine and see what happened, repeatedly, before it reports on its own program.

What it can do SHALL be what a person at that machine could do: type text, press
the machine's own keys, work the joystick, wait, and look at the screen. Keys
SHALL be named as that machine names them, and the assistant SHALL be told which
names that machine has, so it cannot ask for a key the machine does not have.
Joystick directions and fire SHALL reach the program the way the machine's own
controller does, whether that machine has a joystick port or maps it to keys.

Waiting SHALL be expressible as waiting for text to appear on screen, not only as
waiting a fixed length of machine time, so that driving does not depend on
guessing how long a machine takes.

Between the assistant's actions the machine SHALL be held still, so that what it
acts on is the screen it was last shown rather than one that ran on while it was
deciding.

Driving SHALL be bounded — in how many times the assistant may act and in how
much machine time it may spend — and reaching that bound SHALL end the driving
and let the assistant report, rather than failing the answer.

Asking to drive SHALL be optional. A reply that does not ask behaves exactly as a
reply does today, and no machine becomes unusable for not being driven.

#### Scenario: A program that waits for input

- **WHEN** the assistant returns a program that asks the user a question, asks to
  drive it, and that program is run
- **THEN** it can type an answer and press the machine's enter key, and what it
  is shown afterwards is the screen the program reached, not the question

#### Scenario: A program behind a title screen

- **WHEN** the assistant returns a program that waits for a keypress before it
  starts, and asks to drive it
- **THEN** it can wait for that prompt to appear, press a key, and see the
  program running rather than its title screen

#### Scenario: A program driven with the joystick

- **WHEN** the assistant drives a program with the joystick on a machine with no
  joystick port
- **THEN** the input reaches the program as that machine's mapped keys, exactly
  as the on-screen controller would deliver it

#### Scenario: A reply that does not ask to drive

- **WHEN** the assistant returns a program and asks for no driving
- **THEN** the machine is not driven, and the answer is checked exactly as it is
  today

#### Scenario: Driving runs out of its bound

- **WHEN** the assistant keeps acting until the bound on driving is reached
- **THEN** driving ends, the assistant is told so, and it reports on its program
  rather than the answer failing

### Requirement: The assistant can be shown the screen as text

The characters on the machine's screen SHALL be something the assistant can be
shown, as well as the screen as a picture. It SHALL be the screen as it stood at
the moment the run was observed — the same moment the picture is taken — rather
than a separate reading of a machine that has moved on.

The assistant SHALL be told that text is the answer for a program whose output is
words and the picture for what only a picture can settle, so that it asks for the
cheaper and exact one where that is enough.

Unlike the picture, being shown the screen as text SHALL NOT depend on the chosen
provider, because it is text like every other part of a request.

Where the characters cannot be determined, that view SHALL be reported as
unavailable, on the same terms as any other view that cannot be produced.

#### Scenario: A program whose output is text

- **WHEN** the assistant returns a program that prints its result and asks to be
  shown the screen as text
- **THEN** the outcome of that run carries the characters on screen

#### Scenario: The text and the picture describe the same moment

- **WHEN** the assistant is shown both the screen as text and the screen as a
  picture for one run
- **THEN** both are of the machine as it stood when that run was observed

#### Scenario: A provider that cannot be shown a picture

- **WHEN** the assistant writes for a provider that cannot be shown images and
  asks to be shown the screen as text
- **THEN** it is shown the text, and only the picture is reported as unavailable

### Requirement: Being able to drive the machine is a stated capability

Whether the assistant can be given the machine SHALL be a stated property of the
chosen provider rather than something discovered by attempting it. Where a
provider cannot be given it, the IDE SHALL NOT present driving as available and
SHALL NOT ask the assistant to drive; every other part of the assistant SHALL
behave identically on such a provider.

#### Scenario: Switching to a provider that cannot be given the machine

- **WHEN** the user selects a provider that cannot be given the machine
- **THEN** driving is not offered, no request asks for it, and the assistant
  otherwise works exactly as before

### Requirement: Driving that fails is not the program failing

Where the driving itself does not work out — waiting for text that never appears,
naming a key the machine does not have, or a machine that never came up to be
driven — the IDE SHALL report that to the assistant as what it is, and SHALL NOT
treat it as the program being wrong.

Such a failure SHALL NOT fail the run and SHALL NOT prompt an unrequested
correction. Where driving was meant to reach the state an expectation describes
and did not, that expectation SHALL be reported as unchecked rather than as
failed — the same terms as an expectation nothing could evaluate.

#### Scenario: Waiting for text that never appears

- **WHEN** the assistant waits for text that the program never displays
- **THEN** it is told the wait ran out, and the run is not reported as failed
  because of it

#### Scenario: A key the machine does not have

- **WHEN** the assistant asks to press a key this machine's keyboard does not
  have
- **THEN** it is told so and can act again, and the program is not reported as
  wrong

#### Scenario: An expectation the driving never reached

- **WHEN** driving fails before the program reaches the state a stated
  expectation describes
- **THEN** that expectation is reported as unchecked, and no correction is
  attempted

### Requirement: Input the assistant sent is stated

Where the assistant drove the machine and that driving actually sent input, the
conversation SHALL say what was sent, so that a screen the user could not
otherwise account for is explained by what produced it.

Where the assistant only waited or only looked, nothing SHALL be stated: nothing
happened that the user could not have seen for themselves.

What is stated SHALL be what was done to the machine, not the assistant's asking
or the IDE's mechanics — those remain out of the conversation, as every other
part of the checking machinery already is.

#### Scenario: An answer whose screen was reached by typing

- **WHEN** the assistant drove a program by typing an answer into it and the
  finished work is shown
- **THEN** the conversation states that input was sent and what it was

#### Scenario: An answer the assistant only watched

- **WHEN** the assistant asked to drive, then only waited and looked without
  sending any input
- **THEN** nothing is stated about driving, and the answer reads as it would have
  without it
