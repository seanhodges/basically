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

### Requirement: Generated code lands in the editor safely

The user SHALL be able to apply a generated code block by replacing the whole
program or by merging line by line (matching line numbers replace, new lines
insert in order). Applying code SHALL preserve opaque binary line records
untouched.

#### Scenario: Merge into existing program

- **WHEN** the user merges a generated fragment whose line numbers overlap
  the program
- **THEN** overlapping lines are replaced, new lines are inserted in order,
  and all other lines are unchanged

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
