## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: The user can show the assistant the screen

**Reason**: The picture is already in the conversation. Attaching by hand meant a
button press, a second capture of the same machine and a second thumbnail of the
same screen — and, because the two captures were taken at different moments, the
user could end up asking about one picture while the assistant was shown another.

**Migration**: Nothing to attach and nothing to remove: the display the
conversation is already showing is what the next request carries, once, and only
where the provider can be shown one. The case the button covered that this does
not — a screen with no checked answer behind it — is one assistant request away
from existing, since every answer is run and checked before it is offered.
