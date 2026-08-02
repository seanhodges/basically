## ADDED Requirements

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

## REMOVED Requirements

### Requirement: A failed run shows the assistant the screen

**Reason**: Replaced by the assistant naming the views it wants. Sending the
screen with every failure was the IDE inferring that a failure means pixels
matter, which is precisely the judgement it cannot make: it sent a picture of a
text adventure's crash and sent none for a drawing program that ran cleanly and
drew the wrong thing.

**Migration**: An assistant that wants the screen on a failing run asks for it
with the code it returns, which is honoured whether or not the run fails. A
failure where nothing was asked for now says the screen can be shown if it would
help, so the picture is one turn away. Nothing the user does changes: attaching
the screen to a request is untouched.
