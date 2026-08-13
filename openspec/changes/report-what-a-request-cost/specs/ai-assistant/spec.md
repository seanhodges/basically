## ADDED Requirements

### Requirement: What an answer cost is stated

Each answer SHALL state what its request cost: how much of the request was newly
processed, how much was served from the provider's cache, and how much the answer
itself came to.

A figure the chosen provider does not report SHALL be shown as unavailable, and
SHALL NOT be shown as zero — a provider that reports nothing about caching has
not reported that nothing was cached.

An answer whose request took several exchanges with the provider before it was
finished SHALL state what the whole answer cost, not what its last exchange cost.

An answer that did not finish SHALL still state what it spent, where the provider
reports it. This SHALL hold whether the user stopped it, the output budget cut it
short, or it failed.

The conversation SHALL state its running total alongside the individual answers,
and a conversation restored after the page reloads SHALL state the total it had
reached rather than starting again from nothing.

The statement SHALL be secondary to the answer it describes: available without
being asked for, and never in the way of reading the reply.

#### Scenario: A second request in the same conversation

- **WHEN** the user sends a second request in a conversation
- **THEN** the answer states that most of the request was served from the
  provider's cache rather than newly processed

#### Scenario: A provider that reports nothing about caching

- **WHEN** the answer came from a provider that reports no cache figures
- **THEN** those figures are stated as unavailable, and what the request and the
  answer came to is still stated

#### Scenario: An answer that used the machine before replying

- **WHEN** the assistant drove or looked at the machine before finishing its
  answer, taking several exchanges with the provider
- **THEN** the stated cost covers every exchange the answer took

#### Scenario: An answer the user stopped

- **WHEN** the user stops an answer while it is arriving
- **THEN** what that answer spent before it stopped is still stated

#### Scenario: The cost of a session

- **WHEN** a conversation has run for several answers
- **THEN** its running total is available without the user adding the answers up

#### Scenario: A conversation restored after a reload

- **WHEN** the user reloads the page on a conversation that had already run
- **THEN** the restored conversation states the total it had reached
