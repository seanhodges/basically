## ADDED Requirements

### Requirement: A printed listing can be read from a photograph

The user SHALL be able to show the assistant a photograph or scan of a printed
BASIC listing, and the assistant SHALL return it as a program for the machine the
user is writing for.

What comes back SHALL be an ordinary answer in every respect: identified as a
whole listing or a fragment, offered through the same apply actions as any other
generated code, checked on the machine before it is offered, corrected when that
check fails, and continued where it ran out of room. Nothing about applying a
transcription SHALL differ from applying any other answer.

A picture showing only part of a listing SHALL be returned as a fragment, so that
a listing photographed a page at a time merges page onto page by line number.
This SHALL hold regardless of how much of the program a page happens to cover:
what decides is how much of the listing the picture shows, not how much of the
program it would change.

A photograph SHALL be attachable from where the user already is - the assistant's
own composer, a picture pasted into it, and a picture dropped on the editor - and
every route SHALL reach the same result, report a failure in the same place, and
reveal the assistant so an attached picture is never out of sight.

Attaching SHALL NOT require the assistant to have been configured. A key SHALL be
asked for when the request is sent, as it is for any other request, so that a
picture is never lost to a dialog raised at the moment it was attached.

A request carrying a photograph and no words SHALL be sent as a request to
transcribe the listing, and the conversation SHALL show that request rather than
an empty one.

A photograph SHALL be offered only where the chosen provider can be shown a
picture. Where it cannot, the user SHALL be told so rather than left with a
picture that will not be sent.

#### Scenario: A photographed listing becomes a program

- **WHEN** the user attaches a photograph of a printed BASIC listing and sends it
- **THEN** the assistant returns that listing as a program for the active machine,
  offered through the same apply actions as any other answer

#### Scenario: A listing photographed a page at a time

- **WHEN** the user sends a photograph showing part of a listing
- **THEN** what comes back is a fragment, which merges into the program by line
  number rather than replacing it

#### Scenario: A photograph with nothing typed

- **WHEN** the user attaches a photograph and sends without typing anything
- **THEN** the request is sent as a request to transcribe the listing, and the
  conversation shows that request rather than an empty one

#### Scenario: A picture dropped on the editor

- **WHEN** the user drops a picture on the editor
- **THEN** it is attached to the assistant, the assistant is revealed, and the
  program in the editor is unchanged

#### Scenario: Attaching before the assistant is configured

- **WHEN** the user attaches a photograph with no API key set
- **THEN** the photograph is attached, and the key is asked for when they send

#### Scenario: A picture the browser cannot read

- **WHEN** the user attaches a picture this browser cannot decode
- **THEN** they are told why in a way they can act on, and nothing is sent

#### Scenario: A provider that cannot be shown a picture

- **WHEN** the chosen provider cannot be shown a picture
- **THEN** attaching a photograph is not offered, and the assistant otherwise
  works exactly as before

### Requirement: The assistant is told which picture it is looking at, and how to read print

A picture carried with a request SHALL be identified to the assistant as what it
is - the machine's screen, or a photograph of a printed listing - rather than
left to be inferred. The two are read differently, and a picture whose nature is
guessed is a picture read wrongly.

A request SHALL carry at most one picture, and what it is SHALL be a single
statement, so that "a screen and a listing at once" is not something a request
can claim.

Where the picture is a printed listing, the request SHALL additionally carry what
reading print requires and the machine's own language rules cannot supply:

- that glyphs printed alike - a letter O against a zero, a one against a letter
  I, a five against an S, an eight against a B - are settled by which reading is
  valid BASIC for this machine, not by shape;
- that a character not found on a typewriter is the machine's own, written the
  way this machine spells it rather than replaced by a lookalike;
- that a listing set in narrow columns wraps, and a run of text with no line
  number of its own continues the line above it;
- that a checksum or count printed down the margin is not part of the program;
- that the listing is transcribed as printed - not modernised, tidied, renamed,
  or corrected - and that a fault visible on the page is reported rather than
  silently fixed;
- that a character the picture cannot settle is named, by line number, so the
  user can check it against the paper rather than discover it as a bug.

This guidance SHALL be carried only by the requests that need it. The machine's
language rules, which every request carries, SHALL NOT change because this
feature exists.

#### Scenario: A photograph is not mistaken for a screen

- **WHEN** a request carries a photograph of a printed listing
- **THEN** the assistant is told it is looking at a printed listing, not at the
  machine's screen

#### Scenario: A screen is still a screen

- **WHEN** a request carries the machine's screen
- **THEN** the assistant is told it is looking at the machine's screen, exactly as
  it is today

#### Scenario: A character that cannot be read

- **WHEN** the picture leaves a character genuinely unsettled
- **THEN** the answer names it by line number rather than transcribing a silent
  guess

#### Scenario: A fault printed on the page

- **WHEN** the listing as printed contains a mistake
- **THEN** it is transcribed as printed and the mistake is reported, rather than
  corrected without saying so

#### Scenario: A request carrying no picture

- **WHEN** a request carries no picture
- **THEN** it carries none of this guidance, and the machine's language rules are
  the same as on every other request

### Requirement: A report and the screen it describes are carried together

Where a reported outcome states that the machine's screen is attached, that
screen SHALL be carried by the request that carries the report. The words and the
picture SHALL travel together or wait together; a report SHALL NOT be sent
claiming a screen the request does not carry.

Where the request that would have carried them is already carrying a picture of
its own, the report and its screen SHALL both be carried by a later request
rather than the report going without its screen.

A report that describes no screen SHALL be carried as it is today, whatever
picture the request carries.

#### Scenario: A report displaced by a photograph

- **WHEN** a request carrying a photograph would otherwise have carried a report
  stating that a screen is attached
- **THEN** that report and its screen are carried by a later request, and no
  report is sent claiming a screen that is not there

#### Scenario: A report that describes no screen

- **WHEN** a request carrying a photograph would otherwise have carried a report
  that describes no screen
- **THEN** that report is carried with the photograph, as it would be with any
  other request

## MODIFIED Requirements

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

A request SHALL carry at most one picture. Where the user has attached a
photograph of a printed listing, that photograph SHALL be the picture carried,
because it is what the user is asking about. A display waiting to be carried
SHALL NOT be discarded for having been displaced: it SHALL be carried by a later
request, on the same terms as any display waiting to be carried, and the rule
that a display is carried once SHALL be unaffected.

A display SHALL be carried only where the chosen provider can be shown one, and
only where the conversation is showing one. Otherwise the request SHALL be sent
with no display and SHALL behave exactly as an ordinary request does.

The conversation SHALL record which request carried the display without showing
the picture a second time: the one already in the thread is the one the assistant
was shown. Where a request carried a photograph instead, the conversation SHALL
record that a photograph was shown, and SHALL NOT describe it as a screen.

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

#### Scenario: A photograph displaces a waiting screen

- **WHEN** the user attaches a photograph of a listing to a request while the
  conversation is showing a screen not yet carried
- **THEN** the request carries the photograph, and the screen is carried by a
  later request rather than being lost

#### Scenario: What the thread says a request carried

- **WHEN** a request carried a photograph rather than a screen
- **THEN** the thread records that a photograph was shown, and does not describe
  it as the machine's screen

#### Scenario: Nothing has been run yet

- **WHEN** the user makes a request with no screen in the conversation
- **THEN** the request is sent with no display and behaves as any ordinary
  request does

#### Scenario: A conversation restored without its pictures

- **WHEN** the user makes a request in a thread restored from storage, which
  records that a screen was shown but does not hold it
- **THEN** the request is sent with no display

### Requirement: A shown screen is not retained

A picture shown to the assistant SHALL be sent only to the provider the user
chose, and SHALL be held no longer than the request that carries it needs. A
display shown to the user SHALL be sent no further than the user's own next
request. This SHALL hold for a photograph the user attached exactly as it holds
for the machine's screen: a photograph SHALL be sent to no one but the chosen
provider, and SHALL go no further than the request that carries it.

The saved conversation SHALL record that a picture was shown without retaining
the picture itself, so restoring a thread never depends on stored image data and
never restores it. This SHALL hold however the picture came to be in the thread —
shown to the assistant, shown to the user for a human check, or attached by the
user as a photograph. What the restored thread records SHALL say which kind of
picture was shown, so a photograph is never restored as though it had been the
machine's screen.

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

#### Scenario: Reloading a conversation in which a listing was photographed

- **WHEN** the user reloads the IDE on a program whose conversation included a
  photographed listing
- **THEN** the thread still records that a photograph was shown at that point, the
  photograph itself is not restored, and it is not described as a screen
