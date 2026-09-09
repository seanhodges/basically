# headless-cli Specification

## Purpose

Reach the toolchain outside the browser, under one name and one grammar of
named operations: describe the registered machines, check a program's problems
without running it, build it into the file its machine loads, and run it and
report its screen — with predictable streams and exit codes so a script or an
agent can consume the result directly, and with only running a machine ever
requiring its ROM.
## Requirements
### Requirement: The command line is named for the product and organised by operation

The toolchain SHALL be reachable outside the browser under the product's own name
rather than the name of one of its jobs, and SHALL organise its work as named
operations, each doing one thing and each describing itself. Asking for help with
no operation named SHALL list the operations; naming an operation that does not
exist SHALL say so rather than guess at one.

#### Scenario: Asking what the tool can do

- **WHEN** the user invokes the command line with no operation, or asks it for help
- **THEN** it names every operation it offers and what each is for

### Requirement: Every caller of this toolchain offers what the others offer

Every operation any caller of this toolchain can perform on a program or a
machine SHALL be reachable from every other caller. No caller SHALL gain a
capability another silently lacks.

Parity is of capability, not of invocation. How a caller reaches an operation
MAY differ, because their circumstances differ. Where a caller can hold a
machine between one request and the next, what is asked of that machine SHALL be
reachable as an operation in its own right; where it cannot, the same capability
SHALL be reachable as an option on a run or as an action within one. A caller
that gains the ability to hold a machine SHALL gain those operations, and SHALL
keep offering the one-shot spelling too, so that what was written against it
goes on working. What SHALL be equal is what can be asked, not how it is spelled.

Where a caller deliberately lacks an operation, that absence SHALL be declared
together with the reason for it, so that an asymmetry is a decision on record
rather than something discovered by trying. A declared absence SHALL stop being
declared once it stops being true, so the record cannot decay into a list of
things nobody rechecked.

A reason SHALL be particular to the caller it is claimed of. An absence which
holds because of the circumstances one caller works in SHALL NOT be carried over
to a caller those circumstances do not describe, so that adding a caller widens
what is offered rather than inheriting what was withheld.

A host that serves a caller SHALL NOT itself be a caller: it offers no operation
of its own and declares no absence of its own, and every operation reaches it
only as one of the callers it serves.

#### Scenario: An operation one caller gains

- **WHEN** an operation becomes available to one caller
- **THEN** the same capability is reachable from every other caller, whether as
  an operation of its own, as an option on running a program, or as an action
  within a run

#### Scenario: A caller that is added

- **WHEN** a new caller of the toolchain is added
- **THEN** every operation is reachable from it, or is declared as one it
  deliberately lacks, with the reason stated

#### Scenario: An absence that does not travel

- **WHEN** an operation is declared absent from one caller, and another caller is
  added whose circumstances that reason does not describe
- **THEN** the operation is reachable from the new caller, and the existing
  absence stands only where its reason holds

#### Scenario: An asymmetry that is intended

- **WHEN** an operation is deliberately not offered to one of the callers
- **THEN** that absence is declared, and the reason for it is stated

#### Scenario: An asymmetry that stops being true

- **WHEN** an operation previously declared unavailable to a caller becomes
  available to it
- **THEN** it is no longer declared as unavailable

#### Scenario: A caller that gains a machine it can hold

- **WHEN** a caller that could hold no machine between requests becomes able to
- **THEN** every operation that acts on a machine is reachable from it as an
  operation of its own, and the option that spelled the same capability on a
  single run still works

#### Scenario: A host is not a surface

- **WHEN** the toolchain is served to its callers from a shared host
- **THEN** the host offers no operation of its own and declares no absence of its
  own, and parity is judged of the callers it serves

### Requirement: A program is named as a file, and a pipe still works

Every operation that reads a program SHALL take the path of a file holding it. A
path of `-`, or no path at all, SHALL mean the program arrives on standard input,
so a program can be piped in without being written to disk first. An operation on
a program SHALL name the machine it is for; naming no machine, or a machine that is
not registered, SHALL be reported as the caller's mistake.

Naming the machine SHALL NOT be required where the program itself declares one.
Naming one anyway SHALL be honoured and SHALL take precedence over the
declaration, so that a caller can deliberately read a program as a machine other
than the one it was written for. Naming a machine that is not registered SHALL
remain the caller's mistake whether or not the program declares one.

#### Scenario: Piping a program in

- **WHEN** the user pipes a listing to an operation and names a machine, without
  giving a file path
- **THEN** the operation reads the piped listing and works on it as if it had been
  named as a file

#### Scenario: A program that says what it is for

- **WHEN** the user checks or builds a program that declares its machine, naming
  no machine on the command line
- **THEN** the operation works on it as that machine's program, rather than being
  refused for naming no machine

#### Scenario: Overriding what the program says

- **WHEN** the user names a machine for a program that declares a different one
- **THEN** the operation reads it as the machine the user named

### Requirement: Every registered machine can be listed

The user SHALL be able to ask which machines are available and receive every
registered machine, each with the name and short description the product uses for
it elsewhere, and whether the machine's ROM is present — so that a caller can tell
what it is able to run before trying to run it.

#### Scenario: Listing the machines

- **WHEN** the user asks for the available machines
- **THEN** every registered machine is reported with its identifier, its name, its
  description, and whether its ROM is present

### Requirement: A machine can be described in full

The user SHALL be able to ask about one machine and receive what a person or a
program needs in order to write BASIC for it without opening the IDE: how much
memory a program may occupy, the rules that machine's BASIC imposes on the text of
a program, the keywords it understands, and the formats it can be built to and
imported from. The description SHALL be derived from what the machine actually
declares, never from a list maintained beside it.

#### Scenario: Describing a machine

- **WHEN** the user asks about a registered machine
- **THEN** the reply states the program memory budget, the machine's BASIC rules,
  its keywords, and the formats it builds to and imports from

### Requirement: A program can be checked without running it

The user SHALL be able to have a program checked for problems without an emulator
being booted and without any ROM being required, and SHALL receive every problem
found, each placed at the line and column it occurs on and marked as either fatal —
the program cannot be built or run — or advisory. Advisory problems alone SHALL NOT
make the check fail.

#### Scenario: Checking a program with an advisory problem only

- **WHEN** the user checks a program whose only problems are advisory
- **THEN** the problems are reported, and the check succeeds

### Requirement: A program can be built into a file the machine loads

The user SHALL be able to turn a program into the transfer format its machine
really loads, and to say where the result is written. The format SHALL be chosen by
the caller naming it, or inferred from the name of the file being written, and
SHALL fall back to the machine's usual format when neither settles it. Where a
format is more than one file, every file produced SHALL be written and every path
written SHALL be reported. A program with a fatal problem SHALL NOT be built.

#### Scenario: Building to a named file

- **WHEN** the user builds a program for a machine, naming an output file whose
  extension belongs to one of that machine's formats
- **THEN** the program is written in that format, and every path written is
  reported

### Requirement: A program can be run and its screen reported

The user SHALL be able to run a program on its machine and receive what the screen
shows, as text, as a picture, or as both in one run. The user SHALL be able to say
how many frames to run, or to let the run end when the program does, with a cap on
the wait. Where the run's ROM is missing, that SHALL be reported as a condition of
the run rather than ending it.

#### Scenario: Asking for the screen both ways

- **WHEN** the user runs a program asking for both the screen's text and a picture
  of it
- **THEN** the picture is written where the user asked and the screen's text is
  reported, from the same run

### Requirement: A run can be measured from the command line

Where a run's time and memory went SHALL be reportable outside the browser, on
the same terms the IDE reports it: the costliest lines of the program as shares
of the run, those shares summed over the program's routines, and what the run
did to the machine's BASIC memory. How long a run took SHALL be reportable
alongside how that run ended, because a duration whose ending is unknown says
nothing — the seconds a program ran before it was stopped are not the time it
takes. What a variable holds at the end of a run SHALL be reportable in the same
way.

Every figure SHALL be in the emulated machine's own terms, so what is reported
does not depend on the computer the run happened on or on how fast it was
emulated.

A machine that cannot report which line it is executing, cannot account for its
memory, or cannot report its variables SHALL say so plainly rather than
reporting nothing, since nothing reads as a program that took no time, used no
memory, or held no variables.

#### Scenario: Asking where a run's time went

- **WHEN** a program is run from the command line and its measurements are asked
  for
- **THEN** the costliest lines are reported as shares of the run, summed over
  its routines as well

#### Scenario: Asking how long a run took

- **WHEN** a run's timing is asked for
- **THEN** the duration is reported in the machine's own time, together with how
  that run ended

#### Scenario: A machine that cannot be measured

- **WHEN** measurements are asked of a machine that cannot report which line it
  is executing
- **THEN** it is stated that runs on that machine are not measured, rather than
  an empty measurement being reported

#### Scenario: The same run measured on a faster computer

- **WHEN** the same program is run on computers of differing speed, or at
  differing emulation speeds
- **THEN** the measurements reported are the same

### Requirement: A program's behaviour can be checked against a written expectation

The user SHALL be able to run a program against a written expectation — the same
actions a schedule may hold, together with expectations that named text is on the
screen, that named text is not on the screen, that the program has stopped, that
it is still running, or that a named variable holds a named value — and receive a
pass or a failure.

The check SHALL pass only when every action is carried out and every expectation
holds. It SHALL fail at the first that does not, and SHALL report which
expectation or action it was, by its line, what was expected, and what the screen
actually held at that moment. A failure SHALL count as the program's failure,
distinct from an expectation the tool cannot read, which SHALL be the caller's
mistake and refused before the machine is started.

An expectation that could not be evaluated SHALL be reported as unevaluated
rather than as passed or as failed, and SHALL NOT be folded into the verdict as
though it had held. An expectation whose form only the assistant can settle SHALL
be reported this way rather than refused, so that one file of expectations can be
written for either caller.

The verdict SHALL be available as structured data on request.

#### Scenario: An expectation that holds

- **WHEN** the user checks a program against a file whose every action succeeds
  and whose every expectation holds
- **THEN** the check passes

#### Scenario: An expectation that does not hold

- **WHEN** the user checks a program against an expectation that names text the
  program never prints
- **THEN** the check fails, reporting that expectation by its line and the text
  expected, shows the screen as it stood, and exits with the outcome reserved for
  a program at fault

#### Scenario: An expectation about a variable

- **WHEN** the user checks a program against an expectation naming a variable and
  the value it should hold
- **THEN** the check reports whether that variable holds that value

#### Scenario: An expectation nothing here can settle

- **WHEN** a file of expectations contains one that only the assistant can judge
- **THEN** it is reported as unevaluated, and the check neither passes nor fails
  on account of it

#### Scenario: A file that cannot be read

- **WHEN** the user checks a program against a file holding a line the parser
  cannot understand
- **THEN** it is refused as the caller's mistake before any machine is started

#### Scenario: A verdict read by a program

- **WHEN** a caller asks for the verdict as structured data
- **THEN** standard output holds the verdict, every step and how it went, the
  failing step where there was one, and the screen, and nothing else

### Requirement: The tool can serve an editor instead of finishing

One of the tool's operations SHALL start a language server rather than do a piece
of work and finish: it SHALL hold its streams open, serve the editor that started
it, and end when that editor disconnects or the user stops it. Asking what the
tool can do SHALL list it among the operations, and asking about it SHALL say how
an editor is expected to start it.

Being told which machine a program is for SHALL work for this operation as it does
for the others — the caller MAY name one, and it stands as the default for the
editor's session — but naming no machine SHALL NOT be the caller's mistake here,
because an editor can say which machine it wants after the server has started.

#### Scenario: Starting a server

- **WHEN** the user starts the operation that serves an editor
- **THEN** the tool serves the editor over its standard streams and keeps running
  until the editor disconnects

#### Scenario: Starting a server without naming a machine

- **WHEN** the user starts that operation and names no machine
- **THEN** the server starts, rather than being refused the way an operation on a
  program would be

### Requirement: Output can be read by a program as well as a person

Every operation that reports something SHALL be able to report it as structured
data on request, carrying the same facts as the readable form and more where the
readable form summarises. Standard output SHALL carry only what was asked for — the
screen, the structured data, the problems found — so that it can be consumed
directly; every figure, timing, notice and progress remark SHALL go to standard
error.

An operation that serves rather than reports SHALL hold to the same rule from the
other end: its standard output belongs to the conversation it is having, so
nothing about how the work is going SHALL be written there either. What such an
operation has to say about itself SHALL go to standard error, or to whatever
reporting channel the thing it is serving provides.

#### Scenario: Consuming an operation's output

- **WHEN** a caller asks an operation for structured data and reads standard output
- **THEN** standard output holds only that data, and nothing the operation reports
  about how the work went is mixed into it

#### Scenario: An operation that serves rather than reports

- **WHEN** an operation that serves something is running and the tool has a notice
  to give
- **THEN** the notice does not appear on standard output, and what is being served
  is not disturbed by it

### Requirement: Exit codes separate the caller's mistake from the program's

An operation SHALL report success or failure through its exit code, and SHALL
distinguish three outcomes: it worked; the caller asked for something impossible —
an unknown machine, an unreadable file, an option that does not exist; or the BASIC
program itself is at fault. A caller SHALL be able to tell a bad invocation from a
bad program without reading any output.

An operation that serves until it is disconnected has no verdict on a program to
report, so this SHALL apply to it only as far as it can: asking for something
impossible when starting it SHALL still be the caller's mistake, and a server that
served and was disconnected SHALL report that it worked. No BASIC program's faults
SHALL be reported through the exit code of such an operation, because it reports
them to what it is serving instead.

#### Scenario: Checking a program that cannot run

- **WHEN** the user checks or builds a program that has a fatal problem
- **THEN** the operation fails with the outcome reserved for a program at fault,
  which is distinct from the one it uses for a bad invocation

#### Scenario: A server that is disconnected

- **WHEN** a server is started, serves an editor, and the editor disconnects
- **THEN** the tool reports that it worked, whatever problems the programs it
  served turned out to have

#### Scenario: A server that cannot be started

- **WHEN** the user starts a server naming a machine that is not registered
- **THEN** it fails with the outcome reserved for the caller's mistake, and no
  server is started

### Requirement: Only running a machine requires its ROM

Describing machines, describing one machine, checking a program and building a
program SHALL all work without any ROM being present, so that an installation
carrying no ROMs is still useful for everything but running. Running a machine
SHALL let the user say where ROMs are read from, rather than only ever reading them
from where the product was installed.

Where the user has said where ROMs are read from, or the installation already
carries them, the tool SHALL read them from there and SHALL obtain nothing.
Otherwise it SHALL be able to obtain a machine's ROM from where the product
publishes them, keep what it obtained for later runs, and prefer what it has
kept over what the installation carries.

#### Scenario: Working without ROMs

- **WHEN** the user lists machines, describes one, checks a program or builds a
  program on an installation with no ROMs present
- **THEN** each operation succeeds, and reports no ROM as missing because none was
  needed

#### Scenario: An installation that already carries the ROM

- **WHEN** the user runs a machine on an installation that carries its ROM, or
  says where ROMs are read from
- **THEN** the run reads that ROM, nothing is obtained, and the user is asked
  nothing

#### Scenario: A ROM obtained once is kept

- **WHEN** the user runs a machine whose ROM was obtained by an earlier run
- **THEN** the run uses what was kept, and obtains nothing again

### Requirement: A run can be told what to press and when

The user SHALL be able to give a run a schedule of actions to carry out once the
program is loaded: press named keys, together where a chord is wanted; hold a
joystick control; let the program run for a number of frames; run until named
text is on the screen, with a cap on the wait; and run until the program stops,
with a cap on the wait. The actions SHALL be carried out in order, and the run
SHALL end when the schedule ends, so that the screen reported is the one the
last action left; the user SHALL be able to ask for a number of further frames
after it. A schedule the tool cannot read SHALL be reported as the caller's
mistake, naming the line, before any machine is started. An action that cannot
be carried out — text that never appears, a program that never stops — SHALL end
the schedule there, and the run SHALL report which action failed and why, still
report the screen as it stood, and count as the program's failure.

#### Scenario: Getting past a prompt

- **WHEN** the user runs a program that waits for a keypress, with a schedule
  that waits for the prompt, presses a key, and waits for the text the program
  then prints
- **THEN** the screen reported holds that text, and the run succeeds

#### Scenario: A wait that runs out

- **WHEN** a schedule waits for text the program never prints
- **THEN** the run reports that action as the one that failed and why, reports
  the screen as it stood when the wait ran out, and fails with the outcome
  reserved for a program at fault

#### Scenario: A schedule that cannot be read

- **WHEN** the user gives a schedule containing a line that is not an action
- **THEN** the run is refused as the caller's mistake, naming the line, and no
  machine is started

### Requirement: Keys are named the same way on every machine

A schedule SHALL name keys in a vocabulary that does not depend on the machine.
Every letter, every digit, space, enter and shift SHALL be written the same way
for every registered machine. The keys only some machines have — delete, escape,
ctrl, tab, the cursor keys and the function keys — SHALL be written the same way
wherever they exist, and SHALL simply not be offered by a machine that has none,
rather than being mapped onto some other key it does have.

A name SHALL resolve to the key that performs it, not to the key its machine's
keyboard hardware happens to give that name, so that a machine whose key
positions and key meanings disagree still presses what the caller asked for.
Where machines name one key differently from one another, the common names SHALL
be accepted as one. A machine's own key names SHALL also be accepted. A name a
machine has no key for SHALL be refused, naming the machine and the key.
Describing a machine SHALL list the names it answers to, so that a caller can
find out what a machine has without guessing.

#### Scenario: One schedule, two machines

- **WHEN** the user runs the same schedule, naming a letter, a digit, space and
  enter, on two different registered machines
- **THEN** each machine presses its own key for each name, and neither refuses
  any of them

#### Scenario: A key the machine does not have

- **WHEN** a schedule presses a key the machine's keyboard has no equivalent of
- **THEN** the action fails, naming the machine and the key, and no other key is
  pressed in its place

#### Scenario: A machine whose key positions and key meanings disagree

- **WHEN** a schedule presses a letter on a machine whose keyboard hardware names
  that key's position after a different letter
- **THEN** the key that types the named letter is pressed, not the one the
  hardware names after it

#### Scenario: Finding out what may be pressed

- **WHEN** the user asks for a machine's description
- **THEN** it lists the key names that machine answers to

### Requirement: Every action a schedule accepts is described to every caller

The actions a schedule of input accepts SHALL be described identically to
whoever writes one. An action the schedule accepts but describes to nobody SHALL
NOT exist, and neither SHALL an action described to one caller and refused when
the other writes it — including how one action is separated from the next.

A caller that writes an action it was told about SHALL have it carried out
rather than refused.

#### Scenario: An action the schedule accepts

- **WHEN** a schedule accepts an action
- **THEN** that action is described to every caller that may write one

#### Scenario: A schedule written by one caller, read for the other

- **WHEN** a schedule written for one caller is given to the other, separators
  and all
- **THEN** it means the same thing and is carried out the same way

### Requirement: Driving a machine requires its ROM

A run given a schedule SHALL require the machine's ROM to be present, and SHALL
refuse a machine whose ROM is absent as the caller's mistake before any action is
taken. A run given no schedule SHALL keep reporting a missing ROM as a condition
of the run rather than refusing.

Refusing SHALL say what the user can do about it, naming the ways a ROM is
obtained and agreed to, so the refusal is not a dead end.

#### Scenario: Driving without the ROM

- **WHEN** the user runs a program with a schedule on a machine whose ROM is not
  present
- **THEN** the run is refused as the caller's mistake, saying the ROM is missing
  and how one is obtained, and no action is carried out

### Requirement: Checking a program requires its ROM

Checking a program SHALL require the machine's ROM to be present, and SHALL
refuse a machine whose ROM is absent as the caller's mistake before any action is
taken — a verdict from a machine that ran nothing would say nothing about the
program.

Refusing SHALL say what the user can do about it, naming the ways a ROM is
obtained and agreed to, so the refusal is not a dead end.

#### Scenario: Checking without the ROM

- **WHEN** the user checks a program on a machine whose ROM is not present
- **THEN** the check is refused as the caller's mistake, saying the ROM is
  missing and how one is obtained, and no action is carried out

### Requirement: A machine's binary program file can be read back as BASIC

The user SHALL be able to turn a machine's own program file back into the BASIC
it holds, outside the browser. The machine SHALL be inferred from the file where
its format identifies it, and named by the caller where it does not; where more
than one registered machine could claim the same file, the operation SHALL
decline rather than guess, naming every machine that could. Anything the
conversion could not carry over — a warning the machine's own detokenizer
raises, a part of the file that is not BASIC, an auto-start line — SHALL be
reported rather than dropped silently.

#### Scenario: Converting a named binary file

- **WHEN** the user converts a file whose format belongs to exactly one
  registered machine, naming no machine
- **THEN** the file is read as that machine's BASIC and the source is returned

#### Scenario: A file more than one machine could claim

- **WHEN** the user converts a file whose format more than one registered
  machine can produce, naming no machine
- **THEN** the operation declines and names every machine the file could belong
  to, rather than choosing one

#### Scenario: Reporting what a conversion could not carry

- **WHEN** a converted file holds a warning its machine's detokenizer raises, a
  block that is not BASIC, or an auto-start line
- **THEN** the source is returned alongside a report of everything the
  conversion could not carry, rather than the source alone

### Requirement: The command line can hold a machine between commands

The command line SHALL be able to leave the machine a run booted still running
when the command that started it has ended, and a later command SHALL be able to
act on that machine. What one command does to the machine SHALL be what the next
command sees.

The user SHALL be able to say that a run is to leave its machine up, to ask which
machine is being held, and to let a held machine go. A machine SHALL be let go
when the user says so, and SHALL NOT be left running indefinitely with nothing
attending to it.

The machine SHALL advance only when a command asks it to. A command that acts on
the machine SHALL spend the time it needs; a command that only reads the machine
SHALL spend none, so that reading the screen never changes it. Every measurement
SHALL be in the emulated machine's own time and SHALL NOT vary with how long the
user took between commands.

A command that needs a machine when none is being held SHALL say so and say how
to start one, rather than failing without explanation.

#### Scenario: Acting and then looking

- **WHEN** the user runs a program that waits at a prompt so that its machine is
  left up, presses a key in a later command, and reads the screen in a third
- **THEN** the screen read is the one that keypress left, not the one the program
  started at

#### Scenario: Reading without disturbing

- **WHEN** the user reads a held machine's screen twice with nothing in between
- **THEN** the same screen is reported both times

#### Scenario: A pause between commands

- **WHEN** a long time passes between two commands acting on a held machine
- **THEN** the machine is where the earlier command left it, and the run's
  measurements are the same as if the commands had come one after another

#### Scenario: Letting a machine go

- **WHEN** the user asks for the held machine to be let go
- **THEN** it is let go, and a later command reports that no machine is being
  held

#### Scenario: Acting before a machine is up

- **WHEN** the user asks for something that needs a machine while none is held
- **THEN** it is reported that no machine is being held and how to start one

### Requirement: A run that holds no machine still works as it did

A run that is not asked to leave its machine up SHALL behave exactly as it does
when no machine can be held: it boots, reports, and lets the machine go when it
ends. Every option that asks a single run to drive, measure or picture a machine
SHALL keep working and SHALL keep meaning what it means today, so that what a
user or a script has already written goes on working unchanged.

#### Scenario: A one-shot run

- **WHEN** the user runs a program without asking for its machine to be kept
- **THEN** the run reports what it reports today and leaves no machine held
  afterwards

#### Scenario: A schedule on a single run

- **WHEN** the user runs a program with a schedule of keys, asking for the
  screen, a picture and the run's measurements, without asking for its machine to
  be kept
- **THEN** each is reported as it is today, and no machine is left held

### Requirement: Obtaining a ROM is agreed to first

The tool SHALL NOT obtain any ROM image until the user has agreed to it, and
SHALL ask only where it would otherwise have no ROM to run — never on an
installation that already carries one, never for an operation that needs none,
and never where the tool has nowhere to obtain one from. Asking SHALL say what would be obtained, where it would be kept, and where
the terms those images travel on are set out, so the user is agreeing to
something they can read first.

The agreement SHALL be remembered, and SHALL cover every later machine and every
later run rather than being asked again for each. Declining SHALL NOT be an
error: the run SHALL carry on exactly as it does on an installation with no ROM,
so a user who says no is no worse off than before they were asked.

#### Scenario: Asked before the first ROM is obtained

- **WHEN** the user runs a machine whose ROM the installation does not carry and
  has not been agreed to before
- **THEN** the user is asked before anything is obtained, and is told what would
  be obtained, where it would be kept, and where the terms are set out

#### Scenario: Agreeing once covers later runs

- **WHEN** the user has agreed, and later runs a different machine whose ROM is
  not yet held
- **THEN** that ROM is obtained without asking again

#### Scenario: Declining leaves the run as it was

- **WHEN** the user is asked and declines
- **THEN** nothing is obtained, and the run behaves exactly as it does with no
  ROM present — reporting the missing ROM as a condition of the run, or refusing
  where a schedule or a check required it

#### Scenario: An installation with nowhere to obtain images from

- **WHEN** the tool was built without being told where the set is published, and
  the user runs a machine whose ROM the installation does not carry
- **THEN** the user is not asked, nothing is obtained, and the run behaves as it
  does when the question was declined

#### Scenario: Asking for images with nowhere to obtain them from

- **WHEN** the tool was built without being told where the set is published, and
  the user asks for the ROMs to be obtained
- **THEN** the tool says it has no publisher and how one is named, rather than
  reporting a download that failed

### Requirement: A caller with no terminal is never left waiting

A caller that cannot be asked — a program driving the tool, a scheduled build,
an editor or agent served over a protocol — SHALL NOT be blocked on a question
it has no way to answer. The user SHALL be able to agree in advance, both as a
setting the tool is started with and as an action of its own that records the
agreement and returns.

Where no agreement has been given and there is no one to ask, the tool SHALL
say so promptly and SHALL treat it as the caller's mistake rather than waiting,
naming both ways of agreeing in advance.

#### Scenario: Agreed in advance

- **WHEN** a caller that cannot be asked runs a machine whose ROM is not held,
  having agreed in advance
- **THEN** the ROM is obtained without any question, and the run proceeds

#### Scenario: Nobody to ask

- **WHEN** a caller that cannot be asked runs a machine whose ROM is not held,
  with no agreement given
- **THEN** the tool does not wait, and says how to agree in advance

### Requirement: An obtained ROM set is kept current

Once the user has agreed, the tool SHALL keep what it obtained current without
asking again, so that a machine added after the user agreed brings its ROM with
it and an image the publisher withdraws stops being kept. It SHALL check for
changes no more than occasionally rather than on every run, and the user SHALL
be able to ask for a check at any time rather than waiting for the next one.

Keeping current SHALL NOT be able to fail a command: where the check cannot be
made or cannot be trusted, the tool SHALL carry on with what it already holds
and SHALL say nothing about it in the command's own answer.

#### Scenario: A machine added later

- **WHEN** a machine the tool did not previously know about is registered, and
  the tool next checks for changes
- **THEN** its ROM is obtained without the user being asked again

#### Scenario: Not waiting for the next check

- **WHEN** the user asks for the ROMs to be obtained rather than waiting for the
  next check
- **THEN** the publisher is asked at once, and anything new is obtained

#### Scenario: A withdrawn image

- **WHEN** the publisher withdraws an image and the tool next checks
- **THEN** the tool stops keeping that image

#### Scenario: Checking when the publisher cannot be reached

- **WHEN** the tool would check for changes but cannot reach the publisher
- **THEN** the command runs on what is already held, succeeds or fails on its own
  terms, and reports nothing about the check

#### Scenario: An image that is not what it should be

- **WHEN** an obtained image does not match what the publisher says it should be
- **THEN** it is not kept, and nothing already held is disturbed

### Requirement: The user can ask about, obtain and discard ROMs directly

The user SHALL be able to ask where the tool is reading ROMs from and why, where
the published set would be obtained from or that this build names nowhere, which
machines it holds an image for, and when it last checked for changes; to agree
and to obtain the set in one deliberate action rather than as a side effect of a
run; and to discard everything it has obtained.

#### Scenario: Asking where ROMs come from

- **WHEN** the user asks about ROMs
- **THEN** the tool reports which source it would read from and why that one,
  what it holds, and when it last checked

#### Scenario: Obtaining deliberately

- **WHEN** the user asks for the ROMs to be obtained
- **THEN** the tool asks for agreement if it does not have it, checks for changes
  whether or not one was due, and obtains what is missing or changed

#### Scenario: Discarding

- **WHEN** the user asks for what was obtained to be discarded
- **THEN** the tool holds no obtained images afterwards, and a later run asks
  before obtaining them again only if the agreement was discarded too

