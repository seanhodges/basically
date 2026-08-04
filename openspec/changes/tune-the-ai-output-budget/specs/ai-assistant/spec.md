## MODIFIED Requirements

### Requirement: Bring-your-own-key, multiple providers

The assistant SHALL work with the user's own API key against any of the
supported AI providers, streaming replies as they generate. Keys SHALL be
stored locally in the browser only and sent to no one but the chosen
provider. The assistant SHALL be entirely optional: every other IDE
capability works without a key.

Each provider SHALL keep its own settings - its key, its output budget, and its
reasoning effort where the provider supports one - so that a user who switches
between providers does not lose what they configured for either. Settings for a
provider SHALL be retained when another provider is selected.

#### Scenario: No key configured

- **WHEN** the user opens the assistant without a configured key
- **THEN** they are directed to settings, and the rest of the IDE remains
  fully functional

#### Scenario: Switching providers and back

- **WHEN** the user tunes one provider's settings, switches to another provider,
  and later switches back
- **THEN** each provider still shows the settings configured for it, and neither
  has been overwritten by the other

### Requirement: An incomplete or declined reply is not offered as finished code

A reply cut short before the assistant finished SHALL be identified as incomplete
and SHALL NOT be offered for applying as though it were a finished answer. A
request the assistant declines SHALL be reported as declined, and SHALL NOT be
retried as though no reply had been received.

The reason a reply was cut short SHALL be reported, distinguishing a reply the
user stopped, a reply lost to a failed connection, and a reply that reached the
output limit. A reply that produced no text because it reached the output limit
SHALL be reported as having run out of room, and SHALL NOT be retried as though
the assistant had answered in the wrong format.

#### Scenario: The reply is cut short

- **WHEN** the assistant's reply stops before it has finished writing
- **THEN** the code it produced is marked as incomplete and cannot be applied as
  a finished answer

#### Scenario: The assistant declines the request

- **WHEN** the assistant declines to answer
- **THEN** the user is told the request was declined, rather than being told no
  response was received

#### Scenario: The user stopped it themselves

- **WHEN** the user stops a reply while it is arriving
- **THEN** the reply is reported as one they stopped, rather than as one that ran
  out of room

#### Scenario: The reply reached the output limit

- **WHEN** a reply stops because it reached the output limit
- **THEN** the user is told the answer ran out of room, and is pointed at the
  setting that governs it

#### Scenario: The whole budget went to reasoning

- **WHEN** a reply reaches the output limit having produced no text at all
- **THEN** it is reported as having run out of room, and no further request is
  spent asking the assistant to correct its formatting

## ADDED Requirements

### Requirement: The output budget is the user's to tune, not the machine's

How long an answer may be SHALL NOT depend on which target machine is selected -
it is a property of the model and of the user's preference. The assistant SHALL
apply one default output budget and one default reasoning effort across every
machine, each chosen so that a whole program of the size the assistant is asked to
write completes without being cut off.

The user SHALL be able to override both for a provider. A provider SHALL declare
the largest output it accepts and whether it supports a reasoning effort setting.
A request SHALL be kept within what the selected provider accepts, and a setting
the selected provider cannot honour SHALL NOT be offered to the user.

#### Scenario: The same budget on every machine

- **WHEN** the user asks the assistant for a program on any supported machine
- **THEN** the same output budget applies, and changing machine does not change it

#### Scenario: Overriding the budget

- **WHEN** the user sets a different output budget or reasoning effort for the
  selected provider
- **THEN** subsequent requests to that provider use the value they set, and
  clearing it restores the default

#### Scenario: A provider that cannot honour a setting

- **WHEN** the selected provider does not support a reasoning effort setting
- **THEN** no such setting is offered for that provider

#### Scenario: A budget beyond what the provider accepts

- **WHEN** the configured output budget exceeds what the selected provider accepts
- **THEN** the request is kept within the provider's limit rather than being
  rejected by it

### Requirement: A reply that ran out of room can be continued

A reply cut off by the output limit SHALL be resumable: the user SHALL be able to
have the assistant carry on from what it had written, rather than only being able
to ask for the whole answer again. The text already produced SHALL be preserved
and joined with what follows, so that the continued answer is treated as one
answer.

Once continued to completion, the joined answer SHALL be handled exactly as any
other finished answer - checked before it is offered, and flagged as possibly
stale if the user has edited their program since the answer began.

#### Scenario: Continuing a cut-off answer

- **WHEN** the user asks to continue a reply that ran out of room
- **THEN** the assistant carries on from the text it had already written, and the
  result is presented as a single answer rather than two fragments

#### Scenario: The continued answer is checked like any other

- **WHEN** a continued reply finishes and carries a program
- **THEN** that program is checked before it is offered, on the same terms as a
  program from a reply that was never cut off

#### Scenario: The user edited while it was cut off

- **WHEN** the user edits their program between a reply being cut off and being
  continued
- **THEN** the continued answer is flagged as possibly stale, as any other answer
  written against a program that has since changed would be
