## ADDED Requirements

### Requirement: The assistant can time the program it is working on

The assistant SHALL be able to time a run of the program, so that a claim about
a program's speed can be a measurement rather than an assertion.

A timing given to the assistant SHALL carry how it ended alongside its duration,
in one answer, so the assistant never holds a duration without knowing whether
it describes a program that finished, one that failed, or one that was still
running. It SHALL be the same accounting the user is shown, so the two are never
reading different numbers for one run.

Where the machine cannot observe a program finishing, the assistant SHALL be
told that rather than being given a duration that appears to be a completion
time.

The assistant SHALL be told that taking a timing costs a run of the program, so
it takes one when the answer depends on it rather than by reflex.

#### Scenario: Measuring an optimisation

- **WHEN** the assistant rewrites a program to be faster and times both versions
- **THEN** it holds a duration and an ending for each, and can report the
  difference as a measurement

#### Scenario: A timing that did not end in a finish

- **WHEN** the assistant times a program that was still running when the timing
  ended
- **THEN** it is told the program was still running, alongside the duration

#### Scenario: A machine that cannot observe a finish

- **WHEN** the assistant times a program on a machine that cannot determine
  whether a program is still running
- **THEN** it is told the machine cannot observe the program finishing, rather
  than being given a duration presented as a completion time

### Requirement: Being able to time a run is a stated capability

Whether the assistant can time a run SHALL be a stated property of the machine,
resolved from what that machine can determine, rather than discovered by trying.

What the assistant is offered SHALL NOT change during a conversation according
to whether a machine happens to be running at that moment, on the same terms as
every other tool it is given.

#### Scenario: What may be asked for does not change mid-conversation

- **WHEN** a machine starts or stops during a conversation
- **THEN** whether the assistant is offered timing stays as it was for the rest
  of that conversation
