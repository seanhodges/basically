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

#### Scenario: Dialect-correct generation

- **WHEN** the user asks for a program on a machine with restrictive syntax
  rules
- **THEN** the generated code follows that machine's rules rather than
  generic BASIC

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

After applying generated code, new lint errors SHALL prompt an offered fix;
after a run initiated from the assistant, a genuine runtime error SHALL be
offered back to the conversation as a one-click fix request.

#### Scenario: Runtime error after AI run

- **WHEN** a program applied and run from the assistant stops with a machine
  error report
- **THEN** the assistant offers to fix that specific error

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
