# sharing-player Specification

## Purpose

Let anyone play a shared program from a short link: publishing mints a small
URL whose path names the machine with one of its own BASIC keywords, and
visitors get an emulator-only player — no editor, no setup — with a path back
to the code.

## Requirements

### Requirement: Publish mints a short link

The user SHALL be able to publish the current program (source plus memory
blocks) and receive a short URL of the form /<verb>/<id>, where the verb is a
real keyword from the target machine's own BASIC and the id is a short
unambiguous code.

#### Scenario: Publish a program

- **WHEN** the user publishes a working program
- **THEN** they receive a short link that identifies the machine by one of
  its own keywords

### Requirement: The player boots straight into the program

Opening a share link SHALL boot the machine's emulator and run the shared
program directly, presenting only the player surface (screen, virtual input)
with no editor or IDE chrome. A "See the Code" action SHALL hand the program
over to the full IDE for editing.

#### Scenario: Visitor plays then edits

- **WHEN** a visitor opens a share link and later chooses "See the Code"
- **THEN** the program runs immediately in the player, and the IDE then opens
  with the same program in the editor

### Requirement: Invalid links fall back to the IDE

Any URL that is not exactly a known verb plus a valid share id SHALL fall
through to the normal IDE rather than a broken player.

#### Scenario: Mistyped id

- **WHEN** someone opens a share URL with an invalid id
- **THEN** they land in the IDE (with the share reported as not found where
  applicable), not an error page

### Requirement: Compatibility across dialects is declared

Publishing SHALL determine which other dialects can syntactically open the
program, and record that with the share, so a shared program can be offered
to compatible machines and not to incompatible ones.

#### Scenario: Cross-dialect open

- **WHEN** a program valid on a related machine is shared
- **THEN** the share records that machine as compatible

### Requirement: Graceful degradation without a share service

In a deployment with no share service configured, publishing SHALL clearly
report that sharing is unavailable — and every other IDE capability SHALL be
unaffected. Share-service failures (not found, expired, too large, rate
limited, offline) SHALL surface as distinct, user-readable outcomes.

#### Scenario: Unconfigured deployment

- **WHEN** the user attempts to publish in a build with no share service
- **THEN** they are told sharing is not configured, and nothing else breaks

#### Scenario: Build not authorised to publish

- **WHEN** the share service refuses this build's publish request
- **THEN** the user is told this build cannot create share links and that
  retrying will not help, distinctly from a network or server failure
