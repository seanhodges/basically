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
and number-handling rules; its screen, colour and sound capabilities; and, where
the machine lacks a capability another machine has, what to do on this machine
instead.

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

### Requirement: Errors flow back into the conversation

After applying generated code, new lint errors SHALL prompt an offered fix.

Where a run is initiated from the assistant and the machine can report its
runtime state, the outcome of that run SHALL be reported back to the
conversation — whether the program failed, ended without failing, was still
running when the check ended, or never started. A program still running when the
check ends SHALL be treated as having run, not as having failed, because a
program that never returns to the machine's ready state is the normal shape of a
game or an animation.

Telling a program that has finished from one that is still going requires more
than the failure report, so where the machine can also say whether a program is
executing, the outcome SHALL distinguish the two. Where it cannot, a run that
raises no failure SHALL be reported as having run without failing. Either way no
correction follows, so which of the two is reported SHALL NOT change what the
assistant is asked to do.

Where the machine cannot report its runtime state, no outcome SHALL be reported
and the rest of the assistant SHALL be unaffected.

#### Scenario: Runtime error after AI run

- **WHEN** a program applied and run from the assistant stops with a machine
  error report
- **THEN** that error is reported back to the conversation

#### Scenario: A program that runs without failing

- **WHEN** a program applied and run from the assistant reaches the machine's
  ready state with no error, on a machine that can tell a finished program from
  a running one
- **THEN** the conversation reflects that it ran to completion, rather than
  nothing being reported

#### Scenario: A machine that cannot tell finished from still running

- **WHEN** a program applied and run from the assistant raises no failure, on a
  machine that cannot say whether a program is executing
- **THEN** the conversation reflects that it ran without failing, and no
  correction is attempted

#### Scenario: A program still running when the check ends

- **WHEN** a program applied and run from the assistant is still running when the
  check ends
- **THEN** it is treated as having run, and no failure is reported

#### Scenario: A machine that cannot report its runtime state

- **WHEN** a program is applied and run from the assistant on a machine that
  cannot report whether it failed
- **THEN** no outcome is reported, and applying and running behave exactly as
  they do on any other machine

#### Scenario: Lint errors after applying

- **WHEN** applying generated code leaves the program with new lint errors
- **THEN** the assistant offers to fix them

### Requirement: A failed run is corrected without being asked

When a run initiated from the assistant fails with a genuine machine error, the
assistant SHALL be asked to correct it without the user having to request it.

The number of corrections attempted without asking SHALL be bounded and the same
for every machine and every provider. Once that bound is reached the failure
SHALL be offered as a fix the user chooses to accept, rather than attempted
again — so the user is always the one who decides whether to keep going.

The bound SHALL apply to the run being corrected, and SHALL be released when the
user makes a new request, so that a long conversation does not exhaust it.

A correction in progress SHALL be visible as such, and SHALL be stoppable by the
same action that stops any other reply. A correction SHALL NOT begin while the
program it was written against has been changed by the user.

Applying generated code SHALL remain a single action: code that is applied
without being run SHALL NOT cause the machine to start.

#### Scenario: A program that fails at runtime

- **WHEN** a program applied and run from the assistant stops with a machine
  error report
- **THEN** the assistant is asked to correct that error without the user
  requesting it

#### Scenario: Corrections that keep failing

- **WHEN** the corrected program fails again, until the bound on unrequested
  corrections is reached
- **THEN** no further correction is attempted, and the failure is offered as a
  fix for the user to accept

#### Scenario: A new request releases the bound

- **WHEN** the user makes a new request after the bound has been reached, and a
  run from that request fails
- **THEN** corrections are attempted again for that run

#### Scenario: Stopping a correction

- **WHEN** the user stops a correction that is in progress
- **THEN** it ends as any other stopped reply does, and no further correction is
  attempted for that run

#### Scenario: The program changed while the run was being checked

- **WHEN** a run fails after the user has edited the program it was written
  against
- **THEN** no correction is attempted without asking

#### Scenario: Applying without running

- **WHEN** the user applies generated code without choosing to run it
- **THEN** the machine does not start, and no run outcome is reported

### Requirement: The assistant states what its program should produce

When the assistant returns a program it MAY additionally state what should be
true once that program has run — the values it expects named variables to hold,
and what it expects to be on the screen. What it is asked to state SHALL be
limited to what the chosen machine can report, so it never states an expectation
that cannot be evaluated.

Expectations SHALL be optional: a reply that states none behaves exactly as a
reply does today, and no machine becomes unusable for being unable to report
them.

Expectations SHALL NOT be program text. They SHALL never be applied to the
editor, and applying generated code SHALL be unaffected by their presence.

#### Scenario: A program with a computable result

- **WHEN** the assistant returns a program whose result the machine can report
- **THEN** it may also state what that result should be

#### Scenario: A machine that cannot report what an expectation needs

- **WHEN** the assistant writes for a machine that cannot report its variables
- **THEN** it is not asked to state expectations about variables

#### Scenario: Applying a reply that carries expectations

- **WHEN** the user applies generated code from a reply that also states
  expectations
- **THEN** only the program is applied, and the expectations do not appear in the
  editor

### Requirement: Stated expectations are checked against the run

Where the assistant has stated expectations and a run is initiated from the
assistant, those expectations SHALL be checked against the machine once the run
has been observed, and the result SHALL be reported back to the conversation
alongside the run's outcome.

An expectation that does not hold SHALL be treated as a failure of that run, and
SHALL be correctable on the same terms as a runtime error — including the bound
on corrections attempted without asking.

An expectation the machine cannot evaluate SHALL be reported as unchecked rather
than as passed or failed.

#### Scenario: The program produces the wrong answer

- **WHEN** a program runs without error but a stated expectation does not hold
- **THEN** the run is reported as failed and the assistant is asked to correct it

#### Scenario: The program produces the right answer

- **WHEN** a program runs and every stated expectation holds
- **THEN** the run is reported as having succeeded

#### Scenario: An expectation that cannot be evaluated

- **WHEN** an expectation cannot be checked on the machine the program ran on
- **THEN** it is reported as unchecked, and neither passed nor failed

### Requirement: The conversation resets with the program

The chat thread SHALL persist across reloads while the user keeps working on
the same program, and SHALL clear when a different program becomes active.

#### Scenario: Open a different file

- **WHEN** the user opens a different program
- **THEN** the previous conversation no longer applies and the thread starts
  fresh

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
