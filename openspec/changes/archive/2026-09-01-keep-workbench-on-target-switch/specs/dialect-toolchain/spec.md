## MODIFIED Requirements

### Requirement: Registered dialects are the available targets

The IDE SHALL offer exactly the set of registered dialects as target machines,
and every capability in this product (editing, running, exporting, AI
assistance) SHALL work against whichever dialect is active. The set SHALL be
presented the same way wherever a machine is chosen, so that switching the
target machine describes the machines as fully as starting a project does.

Where the user is asked what should happen to their code, the question SHALL
state what travels with it and what does not, so that neither the work kept nor
the work discarded is a surprise. It SHALL describe only what the document
actually holds.

#### Scenario: Switching target

- **WHEN** the user selects a different target machine
- **THEN** the editor language, keyboard, emulator, samples, and export
  options all reflect the newly selected dialect

#### Scenario: Switching target describes the machines

- **WHEN** the user goes to switch the target machine
- **THEN** they are offered the same grouped and described set of machines as
  when creating a project

#### Scenario: Switching target still asks about the user's program

- **WHEN** the user switches the target machine while holding code that the new
  machine cannot take as it stands
- **THEN** they are still asked what should happen to that code before the
  switch is applied

#### Scenario: The question says what comes with the code

- **WHEN** the user is asked what should happen to their code, while the
  document holds memory blocks, scratch buffers, or files a run saved
- **THEN** the question states which of those come across with the code and
  which are discarded
