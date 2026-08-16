# porting-guidance Specification

## Purpose

Help a user move a BASIC program from one machine to another: pick a machine to
port **from** and a machine to port **to**, and get a brief, shareable, no-setup
comparison of what the move involves — which commands change, which behave
differently, and how the two machines differ in language rules and hardware —
with guidance for the target machine always present and the general primer a
link away. Inside the IDE, where the user's own program is at hand,
additionally offer to carry the port out with the AI assistant.

## Requirements

### Requirement: Comparing two machines

The user SHALL be able to choose a machine to port **from** and a machine to
port **to**, and be told what moving a program between them involves: which
commands the target lacks, which the target adds, which behave differently, and
how the two machines differ in language rules and hardware. Every machine the
IDE supports SHALL be offered on both sides, including machines that share a
BASIC with a close relative, and machines SHALL be the only thing offered. A
chosen comparison SHALL be shareable as a link that reopens the same pair.

Each machine SHALL be identified by one name that means only that machine, so a
shared link cannot be ambiguous about which machine it names.

#### Scenario: Choosing a pair

- **WHEN** the user chooses a source machine and a different target machine
- **THEN** the differences between those two machines are reported

#### Scenario: The same machine on both sides

- **WHEN** the user chooses the same machine as both source and target
- **THEN** no differences are reported, and the user is asked to pick two
  different machines

#### Scenario: Two machines that share a BASIC

- **WHEN** the user chooses two machines from the same family, differing only in
  their BASIC version
- **THEN** both are selectable in their own right, and the comparison reports
  what that BASIC version changes rather than reporting no difference

#### Scenario: A shared link names one machine unambiguously

- **WHEN** a comparison is shared as a link and reopened
- **THEN** each side resolves to exactly the machine that was chosen

### Requirement: Choosing a machine distinguishes it from its relatives

Machines that share a BASIC often have names that prefix or echo one another,
and those are exactly the pairs whose comparisons differ most — in free memory,
in the commands available, and in which machine a port is carried out for. The
choice of machine SHALL therefore identify each one by more than its name, so
that a reader can tell two machines of the same family apart while choosing,
rather than only on reading the comparison that follows.

The machine currently chosen SHALL remain identifiable without reopening the
list.

#### Scenario: Telling two machines of a family apart

- **WHEN** the user is choosing between two machines whose names prefix or echo
  one another
- **THEN** each is identified by more than its name, so which is which is
  apparent before the comparison is drawn

#### Scenario: Seeing what is currently chosen

- **WHEN** the user has chosen a machine and is not looking at the list of
  machines
- **THEN** the machine chosen is still identified

#### Scenario: Choosing without a pointer

- **WHEN** the user operates the choice of machine by keyboard alone
- **THEN** each machine can be reached and chosen, and each is named
  unambiguously

#### Scenario: Which choice is being made

- **WHEN** the user is presented with the choice of machine to port from and the
  choice of machine to port to
- **THEN** each states which of the two it is

### Requirement: A command is reported only for machines that have it

Machines that share a BASIC do not always share every command: a later BASIC
version in the same family may add commands its relatives lack. A command
present on only some machines of a family SHALL NOT be reported as a command the
program may use, nor as gained or lost, for a machine that does not have it.
A command SHALL be reported as gained when the target has it and the source does
not, whether or not a relative of the source has it.

#### Scenario: A command only a relative of the source has

- **WHEN** the source machine's family includes a command that the source itself
  does not have
- **THEN** that command is not reported among the commands the port must deal
  with

#### Scenario: A command only a relative of the target has

- **WHEN** the target machine's family includes a command that the target itself
  does not have
- **THEN** that command is not reported as something the target adds

#### Scenario: A command a later BASIC version genuinely adds

- **WHEN** the target has a command the source lacks, because the target runs a
  later BASIC version in the same family
- **THEN** that command is reported as one the target adds

### Requirement: Hardware figures describe the machine chosen

Machines that share a BASIC can differ widely in hardware — free memory in
particular can differ by an order of magnitude between relatives. Every hardware
and language-rule figure the comparison reports SHALL describe the machine the
user selected, not a representative relative.

#### Scenario: A machine whose relatives differ in memory

- **WHEN** the user selects a machine whose family includes relatives with
  different amounts of free program memory
- **THEN** the free-memory figure reported is that machine's own

#### Scenario: Screen and sound differences within a family

- **WHEN** the user selects a machine whose display or sound hardware differs
  from its relatives'
- **THEN** the screen and sound described are that machine's own

### Requirement: Carrying out the port targets the machine chosen

Where the comparison offers to carry the port out, it SHALL convert the program
for the machine the user selected as the target.

Carrying the port out SHALL additionally hand the assistant what the comparison
worked out for this program: the machine being ported from and the BASIC it runs,
the language rules that differ between the two machines, the commands the program uses
that the target lacks together with any advice written for them, the commands to
rename, the commands whose behaviour differs, the commands that mean something
different under the same name, the control codes that must change, the control codes
that keep their spelling and change meaning, the characters the target cannot
represent, how the program's statement layout must change, and the guidance specific to
this pair and this target.

What is handed over SHALL be narrowed to the program being converted, as the
comparison's own report is, so it describes this port rather than the two
machines in general. The language rules are the exception, and SHALL be handed over as
the rules that *differ* between the two machines: a rule holds whatever commands a
program uses, so narrowing it would drop the rule the port most needs.

Where a finding poses a decision — a choice the comparison cannot settle from
the program's text — the decision SHALL be handed over with the finding, and
the assistant SHALL be told to settle each one from what the program itself
does. Where the program's behaviour cannot settle it either, the assistant
SHALL say which reading it chose, so the choice is visible rather than buried
in the converted code.

#### Scenario: Converting to a specific machine

- **WHEN** the user selects a machine as the target and asks for the port to be
  carried out
- **THEN** the program is converted for that machine, and the IDE continues on
  that machine

#### Scenario: Converting to a machine that shares a BASIC with a relative

- **WHEN** the user selects a machine whose BASIC a close relative also runs,
  and asks for the port to be carried out
- **THEN** the program is converted for the machine selected, not for its
  relative

#### Scenario: The port is carried out with the differences reported

- **WHEN** the user asks for the port to be carried out
- **THEN** the assistant is given the differences the comparison reported for
  this program, rather than only the name of the target machine

#### Scenario: Differences the program does not touch

- **WHEN** the comparison has reported differences for commands the program does
  not use
- **THEN** those are not handed over, because they are not work this port
  requires

#### Scenario: A language rule the program must be restructured for

- **WHEN** the two machines differ in how a line is laid out, how assignment is
  written, or how numbers are held
- **THEN** the assistant is given that difference, and where the program itself is
  subject to it, the lines that must change

#### Scenario: A posed decision is settled from the program

- **WHEN** a finding handed to the assistant poses a decision, and the program's
  own behaviour settles it
- **THEN** the assistant carries the port out under that reading, without asking

#### Scenario: A posed decision the program cannot settle

- **WHEN** a finding handed to the assistant poses a decision the program's
  behaviour does not settle
- **THEN** the assistant says which reading it chose, alongside the converted
  program

### Requirement: The comparison leads with what the port requires

The comparison SHALL present what the port requires the reader to do before the lists it provides
for reference, and SHALL present it in the order the work is carried out rather than by the kind of
thing each finding is. That order SHALL be:

1. what stops the program being read on the target at all — the characters the target cannot
   represent, the statement layout that must change, and line numbers the target will not accept;
2. what is mechanical — the commands that need only be renamed;
3. what must be rewritten — the commands the target has no equivalent of, the control codes that
   must be replaced, the commands whose usage differs, and the addresses the program writes to,
   against the two machines' memory layouts;
4. what changes silently — the commands that mean something else under the same name, and any other
   finding that leaves the program tokenizing cleanly and computing differently;
5. whether the result fits the target machine.

Each finding SHALL be placed in the class of work it belongs to, so that a reader working top to
bottom meets the port in the order it is done. A finding a pair does not produce SHALL be absent
rather than shown empty, and SHALL NOT leave the classes around it out of order.

How the two machines differ in language rules and hardware, and the guidance specific to this pair
and this target, SHALL be presented before the work list, being the frame the work is read inside.
Nothing else SHALL be placed there: a finding that shows the reader something to change belongs to
the class of work that change is, however it is drawn. Guidance that does not vary with the chosen
pair SHALL NOT be placed between two sections that do.

#### Scenario: Reading the comparison top to bottom

- **WHEN** the user reads a comparison from the top
- **THEN** the language and hardware differences and the guidance for this pair and target are
  reached first, and the findings that follow run from what stops the program being read, through
  what is mechanical and what must be rewritten, to what changes silently and whether the result
  fits

#### Scenario: Where the program's writes have to be re-aimed

- **WHEN** the comparison shows the two machines' memory layouts
- **THEN** they are reached with the rest of the rewriting work rather than ahead of it, the
  addresses being something the port has to change

#### Scenario: Mechanical work before rewrites

- **WHEN** a port both renames commands and loses commands the target has no equivalent of
- **THEN** the renames are reported before the commands that must be rewritten

#### Scenario: Silent differences after the rewrites

- **WHEN** a port reports commands that mean something different under the same name
- **THEN** they are reported after the commands that must be rewritten, not before them

#### Scenario: A class this pair produces nothing for

- **WHEN** a pair produces no finding in one of the classes
- **THEN** that class is absent, and the classes around it are still in order

#### Scenario: Guidance that does not depend on the pair

- **WHEN** the comparison presents guidance that is the same whichever pair is chosen
- **THEN** that guidance is not interleaved with the sections that describe the chosen pair

### Requirement: The comparison names the BASIC each machine runs

The language and hardware differences SHALL name the BASIC each of the two
chosen machines runs, as its own version is named, and SHALL report it before
every other language or hardware difference.

The name SHALL be that of the machine chosen, not of the family it belongs to:
machines that share a reference for their BASIC do not always run the same
version of it, and that version is what a difference in the commands available
follows from. Two machines that genuinely run the same BASIC SHALL be named the
same, so a reader can tell a port between two BASICs from a port between two
versions of one.

#### Scenario: Two machines running different versions of one BASIC

- **WHEN** the user compares two machines of the same family whose BASIC
  versions differ
- **THEN** each is named with the version it runs, ahead of the other language
  and hardware differences

#### Scenario: Two machines running the same BASIC

- **WHEN** the user compares two machines that run the same BASIC
- **THEN** both are named with that same BASIC, and the comparison reports no
  difference in the BASIC they run

#### Scenario: The BASIC a machine runs is named consistently

- **WHEN** the user reads the name of a machine's BASIC while choosing it and
  again in the comparison
- **THEN** the two agree

### Requirement: The language and hardware differences are ordered by what the port turns on

The language and hardware differences SHALL be reported in a fixed order that
does not vary with the pair chosen, running from the differences that decide how
much of the program must change to those that affect only a program that reads
or writes memory directly.

The differences that describe memory — how memory is written and how an address
is written — SHALL be reported together as one run rather than interleaved with
the language rules, so a reader needing them finds them in one place and a
reader who does not passes them in one step.

The addresses themselves SHALL NOT be reported among these differences. Where a
machine's memory layout is described, that layout reports its addresses, and
reporting them here as well would give one difference twice under two forms —
once as a pair of numbers and once as the picture that explains them. The run
therefore ends at how an address is written, and the layouts follow it.

#### Scenario: Reading the differences top to bottom

- **WHEN** the user reads the language and hardware differences from the top
- **THEN** the BASIC each machine runs, how it handles numbers, and how much
  program memory it has are reached before the rules that affect only how
  individual statements are written

#### Scenario: Finding the memory addresses

- **WHEN** the user looks for where the screen and the BASIC program live on
  each machine
- **THEN** they are found in the machines' memory layouts, and are not also
  reported among the language and hardware differences

#### Scenario: The order does not depend on the pair

- **WHEN** the user changes which machines are compared
- **THEN** the differences that are reported appear in the same relative order
  as before

### Requirement: The comparison shows both machines' memory layouts

The comparison SHALL report where things live in each machine's memory by
showing both machines' memory layouts together, drawn against one shared
address scale so that a position in one is the same address as that position in
the other. It SHALL NOT report the two layouts at scales the reader has to
reconcile.

The controls over how the layouts are read — how far in they are zoomed, how
much detail they resolve into, and whether addresses read as hexadecimal or as
plain numbers — SHALL govern both layouts at once, so that the two are never
read at different settings.

Each region SHALL be named where it is drawn, so that what a colour means is
read off the layout itself and the comparison's key to its own colours is
neither extended nor contradicted by it.

#### Scenario: Reading the two layouts

- **WHEN** the user opens a comparison between two machines whose memory layouts
  the IDE describes
- **THEN** both layouts are reported against one shared address scale, and a
  given address is found at the same position in each

#### Scenario: Changing how the layouts are read

- **WHEN** the user changes how far the layouts are zoomed, how much detail they
  show, or how addresses are written
- **THEN** the change applies to both layouts, which stay readable at the same
  setting as each other

#### Scenario: Naming what is drawn

- **WHEN** the user reads a region of either layout
- **THEN** that region is named where it is drawn, rather than identified only
  by its colour

### Requirement: A machine with no described layout reports no layout

A memory layout the IDE cannot describe SHALL NOT be reported partially or
guessed at. Where either of the two chosen machines has no described memory
layout, the comparison SHALL report no memory layouts at all, and the section
SHALL be absent rather than shown with one side empty.

#### Scenario: One machine has no described layout

- **WHEN** the user chooses a machine whose memory layout the IDE does not
  describe, on either side of the comparison
- **THEN** no memory layouts are reported, and the section is absent rather than
  half-populated

#### Scenario: Both machines have a described layout

- **WHEN** both chosen machines have a described memory layout
- **THEN** both are reported

### Requirement: The memory layouts are narrowed to the program's own writes and reads

Where the comparison is shown inside the IDE, and the user's own program is
therefore at hand, the memory layouts SHALL mark the addresses that program
writes to and the addresses it reads. On the machine being ported **from**
these are the program's own writes and reads; on the machine being ported
**to** they are where those same addresses land, which is what tells a reader
that an access aimed at one machine's system variables reaches another
machine's program text.

The addresses SHALL be read from the program as the language being ported
**from** reads it, as the rest of the narrowing is. An address the comparison
can only approximate SHALL be marked as approximate rather than presented as
exact.

Where the comparison is read on its own, outside the IDE, or where there is no
program to narrow to, the layouts SHALL be reported without marks and everything
else about them SHALL be unaffected.

#### Scenario: A program that writes to memory

- **WHEN** a user reads the comparison inside the IDE with a program open that
  writes to memory
- **THEN** both layouts mark the addresses that program writes to, and the
  target's layout names what sits at those addresses on the machine being ported
  to

#### Scenario: A program that reads memory

- **WHEN** a user reads the comparison inside the IDE with a program open that
  reads memory directly
- **THEN** both layouts mark the addresses that program reads, alongside any
  writes, and the target's layout names what sits there on the machine being
  ported to

#### Scenario: An address that can only be approximated

- **WHEN** the program computes an access address the comparison cannot resolve
  exactly
- **THEN** the address is marked as approximate rather than reported as exact

#### Scenario: Reading the layouts with no program

- **WHEN** a user reads the comparison outside the IDE, or inside it with
  nothing written
- **THEN** both layouts are reported without marks, and are otherwise unchanged

### Requirement: The layouts stay comparable where there is no room for both

Two layouts side by side need width the reader does not always have. Where there
is not enough room to show both at once, the comparison SHALL offer them one at
a time, each reachable by a control naming the machine it shows, the machine
being ported from first and shown first.

Moving between them SHALL preserve how far they are zoomed, how much detail they
show, how addresses are written, and which part of the address space is in view,
so that moving from one to the other compares the same addresses on the two
machines rather than presenting two unrelated pictures.

#### Scenario: Not enough room for both

- **WHEN** the user reads the comparison where there is not enough width to show
  both layouts at once
- **THEN** the layouts are offered one at a time, each reachable by a control
  naming its machine, with the machine being ported from shown first

#### Scenario: Moving between the two layouts

- **WHEN** the user has zoomed in on part of the address space and moves to the
  other machine's layout
- **THEN** that layout is shown at the same zoom, the same level of detail, the
  same address notation, and the same part of the address space

#### Scenario: Reaching the layouts without a pointer

- **WHEN** the user moves between the layouts by keyboard alone
- **THEN** each can be reached and shown, and each is named by its machine

### Requirement: The language differences report how the machine handles numbers

The language and hardware differences SHALL report whether each machine has floating point or is
integer-only, and where it is integer-only, the range of values it can hold.

Where the target machine has no fractions and the reader's own program is at hand, the comparison
SHALL additionally report whether that program performs arithmetic the target would truncate — a
division, or a fractional value — so that a reader is told which of their calculations must be
rescaled rather than only that the machine cannot hold fractions. Where the program performs no such
arithmetic, or the target has fractions, nothing SHALL be reported beyond the difference itself.

Where the target machine's main number path is integer-only but the machine offers real numbers
through a separate system of its own — a floating-point extension with its own variables — the
truncation report SHALL pose the choice rather than choose: fractions the program depends on belong
in that system, fractions incidental to it are rescaled. Which the program's fractions are is not
decidable from its text, and the comparison SHALL NOT silently assume either answer.

Where both machines are integer-only and the target holds a narrower range of values than the
source, the comparison SHALL report both ranges whenever the reader's own program is at hand, so
that arithmetic written against the wider range is checked against the narrower one. Values in the
program's own text that the target cannot hold SHALL be named, and the report SHALL pose the
decision the named values force: rescale them to fit, or restructure the arithmetic so its results
stay inside the range. Where the target's range is at least the source's, or either machine has
fractions, nothing SHALL be reported about integer ranges beyond the difference itself.

#### Scenario: Porting to an integer-only machine

- **WHEN** the user selects a target machine that has no floating point
- **THEN** the language differences report the target as integer-only, with the range of values it
  holds, against the source's own number handling

#### Scenario: A program that divides, ported to an integer-only machine

- **WHEN** the target machine has no fractions and the open program divides or carries a fractional
  value
- **THEN** the comparison reports that this arithmetic is truncated on the target and must be
  rescaled, naming the range the target holds

#### Scenario: A program with no fractional arithmetic

- **WHEN** the target machine has no fractions and the open program performs no division and carries
  no fractional value
- **THEN** the difference in number handling is still reported and nothing is reported about the
  program's arithmetic

#### Scenario: A target that has fractions

- **WHEN** the target machine has floating point
- **THEN** nothing is reported about the program's arithmetic being truncated

#### Scenario: A target whose reals live in a separate system

- **WHEN** the target machine's main number path is integer-only, the machine offers reals through
  a separate system of its own, and the open program divides or carries a fractional value
- **THEN** the truncation report poses the choice — essential fractions into that system,
  incidental ones rescaled — rather than advising rescaling alone

#### Scenario: A 32-bit integer program moving to a 16-bit integer machine

- **WHEN** both machines are integer-only, the target holds a narrower range, and the open
  program's text carries a value beyond the target's range
- **THEN** the comparison reports both ranges, names that value as one the target cannot hold, and
  poses the decision between rescaling and restructuring

#### Scenario: A narrower target and a program whose values all fit

- **WHEN** both machines are integer-only, the target holds a narrower range, and no value in the
  open program's text exceeds it
- **THEN** the comparison still reports both ranges with the decision to check the arithmetic,
  since results can exceed a range no literal exceeds

#### Scenario: Integer ranges with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** each machine's number handling is reported among the language differences, and nothing
  is reported about values or arithmetic to check

### Requirement: Equivalent spellings are reported as renames

Where two dialects provide the same command under different spellings, the
comparison SHALL report it as a rename to carry out. It SHALL NOT report the
command as missing from the target, nor report the target's spelling as newly
gained.

#### Scenario: A command the target spells differently

- **WHEN** the user compares a dialect against a target that provides the same
  command under a different spelling
- **THEN** the comparison names both spellings as a rename, and the command
  appears in neither the missing nor the newly-gained list

#### Scenario: Genuinely absent commands still reported

- **WHEN** the target provides no equivalent of a source command under any
  spelling
- **THEN** the command is reported as one to replace or drop

### Requirement: Differing spellings and differing usage are reported together

The commands both dialects provide under different spellings and the commands they provide with
different usage SHALL be reported together, as one account of the commands that exist on both
machines but are not written the same way. A command that only changes spelling SHALL be reported
compactly — its two spellings — rather than as a detailed entry.

#### Scenario: A pair with both renames and usage differences

- **WHEN** the comparison reports commands to rename and commands whose usage differs
- **THEN** both are reported together rather than in two separate parts of the comparison

#### Scenario: A command that only changes spelling

- **WHEN** a command exists on both dialects under different spellings and is otherwise the same
- **THEN** it is reported as its two spellings, without a detailed entry of its own

### Requirement: Differences in usage notation are not reported as behaviour changes

Where a command exists on both dialects and the two references describe its usage equivalently —
differing only in how each names its placeholders — the comparison SHALL NOT report the command as
behaving differently. A difference in what the command accepts, in whether its arguments are
parenthesised, or in what category of keyword it is, SHALL still be reported.

#### Scenario: The same usage written with different placeholder names

- **WHEN** the user compares two dialects whose references describe a shared command's usage the
  same way apart from the names given to its placeholders
- **THEN** the command is not reported as behaving differently

#### Scenario: A real difference in usage

- **WHEN** a shared command takes a different number of arguments, differs in whether its arguments
  are parenthesised, or is a command on one dialect and a function on the other
- **THEN** the command is reported as behaving differently

### Requirement: A reported behaviour change says what changed

Where the comparison reports that a shared command behaves differently, it SHALL state what changed
about it, rather than only presenting each dialect's usage for the reader to compare.

#### Scenario: A command reported as changed

- **WHEN** the comparison reports a shared command as behaving differently
- **THEN** it names the nature of the change alongside each dialect's usage

### Requirement: Commands that mean different things are warned about

Where both dialects provide a command of the same name but it means something
materially different on each, the comparison SHALL warn about it and state what
it means on each side. This SHALL happen even when the command's category and
usage are identical on both, because such a command otherwise appears in none of
the difference lists while silently changing what a program computes.

#### Scenario: Same name, different meaning

- **WHEN** the user compares two dialects that both provide a command of the
  same name, with the same category and usage, but different meanings
- **THEN** the comparison warns about that command and gives its meaning on each
  dialect

#### Scenario: Same name, same meaning

- **WHEN** both dialects provide a command of the same name and it means the
  same thing on each
- **THEN** no warning is given for it

### Requirement: Operators are not reported as missing commands

The comparison SHALL NOT report an operator as a command the target dialect
lacks or newly provides. Operator differences that affect a port SHALL be
reported among the language-rule differences instead.

#### Scenario: Arithmetic is never "missing"

- **WHEN** the user compares any two dialects
- **THEN** no arithmetic, comparison or punctuation operator appears in the list
  of commands to replace or of commands newly available

#### Scenario: A real operator difference is still reported

- **WHEN** two dialects spell an operator differently
- **THEN** the difference appears among the language-rule differences

### Requirement: Guidance is brief

The guidance SHALL be readable in a few minutes for any machine pair, and SHALL
NOT restate what the difference tables already show.

#### Scenario: Guidance for a distant pair

- **WHEN** the user selects two machines with a large number of differences
- **THEN** the guidance stays brief rather than growing with the size of the
  difference lists

### Requirement: Porting guidance needs no configuration

Guidance on how to carry out a port SHALL be available to every user of the
comparison, without an API key, without any assistant being configured, and
without a network connection once the comparison has been opened. It SHALL be
available wherever the comparison itself is available, not only inside the IDE.

#### Scenario: Reader with no assistant configured

- **WHEN** a user opens the comparison having configured no AI assistant
- **THEN** the porting guidance is present in full

#### Scenario: Offline

- **WHEN** a user reopens a previously loaded comparison with no network
  connection
- **THEN** the porting guidance is still present

### Requirement: Carrying out the port is offered only where there is a program

Where the comparison is shown inside the IDE, and the user's own program is
therefore at hand, the comparison SHALL additionally offer to convert that
program to the target dialect using the AI assistant. Where the comparison is
read on its own, outside the IDE, that offer SHALL be absent and every other
part of the comparison SHALL be unaffected — the assistant is an extra for the
user who has a program to convert, never a condition of the guidance.

Accepting the offer SHALL switch the IDE to the target machine keeping the
current program, and ask the assistant to translate it: preserving behaviour
where the target machine allows, and reporting what could not be ported.
Accepting it with no assistant configured SHALL take the user to configure one,
rather than appearing to do nothing.

Accepting it with nothing written, or with a program that cannot be read as a
program in the language being ported from, SHALL NOT convert. The user SHALL be
told what the problem is, and the machine and the program SHALL be left as they
were. A port carried out for a program the comparison could not read is
guesswork wearing the authority of the comparison's findings, which is worse
than declining the work and saying so.

#### Scenario: Converting the open program

- **WHEN** a user reading the comparison inside the IDE, with an assistant
  configured, asks for their program to be converted to the target dialect
- **THEN** the IDE switches to the target machine with the program kept, and the
  assistant is asked to translate it to that dialect

#### Scenario: Reading the comparison outside the IDE

- **WHEN** a user opens the comparison on its own, outside the IDE
- **THEN** no offer to convert a program is made, and the rest of the comparison
  and its guidance are unchanged

#### Scenario: Asking to convert with no assistant configured

- **WHEN** a user inside the IDE asks for their program to be converted, having
  configured no assistant
- **THEN** they are taken to configure one, and the machine and program are left
  as they were

#### Scenario: Asking to convert with nothing written

- **WHEN** a user inside the IDE asks for their program to be converted with
  nothing written in the editor
- **THEN** no conversion is attempted, they are told there is no program to
  convert, and the machine and program are left as they were

#### Scenario: Asking to convert a program that cannot be read

- **WHEN** a user inside the IDE asks for their program to be converted, and the
  program has errors that prevent it being read as a program at all in the
  language being ported from
- **THEN** no conversion is attempted, they are told the program cannot be read,
  and the machine and program are left as they were

### Requirement: Guidance covers both the general and the machine-specific

The guidance SHALL describe what any port between these BASICs involves, independently of the pair
chosen, and SHALL additionally describe what is specific to the machine being ported **to**. Every
machine offered as a target SHALL carry its own guidance, so no valid pair produces a comparison
without it.

What any port involves does not change with the pair, so it SHALL be given a page of its own rather
than sit within the comparison, and the comparison SHALL point to it before the reader reaches the
pair-specific sections, naming it as the thing to read first by a reader new to porting.

#### Scenario: Guidance for any target

- **WHEN** the user selects any machine as the porting target
- **THEN** the guidance specific to that target is shown, and what any port involves is one link
  away, offered before the pair-specific sections

#### Scenario: Reading what any port involves

- **WHEN** the user follows that link
- **THEN** what any port between these BASICs involves is given in full

### Requirement: The pair's guidance is not restated by the target's

The guidance written for the chosen pair and the guidance written for the target machine are shown
under one heading, the pair's first. Where the pair's guidance already makes every point one of the
target's own bullets makes, that bullet SHALL NOT also be shown. A bullet whose points the pair's
guidance makes only some of SHALL still be shown.

#### Scenario: A point made by both

- **WHEN** the guidance for the chosen pair makes every point one of the target's own bullets makes
- **THEN** that point is read once, in the terms specific to this pair

#### Scenario: A point only the target's guidance makes

- **WHEN** one of the target's bullets makes a point the pair's guidance does not
- **THEN** that bullet is still shown

### Requirement: How colour attaches to the display is reported in the guidance

Machines attach colour to the display in incompatible ways — to each pixel, to
each character cell, or by screen mode — and the commands that draw are often
spelled the same on both. A routine ported between two such machines needs no
change to any command and looks wrong when it runs, so no list of commands can
carry this difference.

Where the target machine attaches colour to its display differently from the
source, the guidance SHALL say so, and SHALL say what it means for a program
being ported rather than only naming the model. Where the two machines attach
colour alike, or the target has no colour, nothing SHALL be added.

#### Scenario: Porting to a machine with per-cell colour

- **WHEN** the user compares a machine that colours each pixel against a target
  that colours each character cell
- **THEN** the guidance says so, and says what it means for a routine that draws in
  more than one colour

#### Scenario: Porting to a machine whose colour depends on the screen mode

- **WHEN** the target machine's available colours depend on the screen mode chosen
- **THEN** the guidance says so, and names the choice the port has to make

#### Scenario: Two machines with the same display model

- **WHEN** the two machines attach colour to the display the same way
- **THEN** nothing is added to the guidance about it

### Requirement: Per-command advice sits with the command

Where advice exists for handling a particular command on the target machine,
that advice SHALL be shown against that command in the list of differences,
rather than only in a separate section. Commands without such advice SHALL
still be listed with the information the comparison already reports.

#### Scenario: A command with target-specific advice

- **WHEN** the comparison lists a command the target handles differently and
  advice for it exists
- **THEN** the advice is shown against that command

#### Scenario: A command with no advice written

- **WHEN** the comparison lists a command for which no advice exists
- **THEN** the command is still listed, with the information the comparison
  reports for it

### Requirement: Differences are grouped by what they do

The comparison SHALL group the commands a port must replace by the capability
they provide — control flow, data, numbers, strings, text and screen, graphics,
colour, sound, input, storage, memory and hardware, program editing, and error
handling — rather than presenting them as a single alphabetical list. Groups
SHALL be ordered so that capabilities the target machine does not provide at all
are reported before capabilities it does provide, and every command SHALL appear
in exactly one group. Each group SHALL state how many commands it contains.

A group SHALL name its commands compactly, as a single run of names, rather than
as one detailed row per command — the advice a reader acts on is written per
capability, not per command, so repeating a description against every lost
command makes the guide longer without making it clearer. Every command in a
group SHALL be named, with nothing hidden behind a control to reveal more. A
capability from which the port loses no command SHALL NOT be shown at all.

#### Scenario: A port that loses a whole capability

- **WHEN** the user compares a source dialect against a target that provides no
  equivalent of an entire capability the source has
- **THEN** that capability is reported as a group, before capabilities the target
  does provide, and the commands lost from it are named within it

#### Scenario: Grouping loses nothing

- **WHEN** the comparison groups the commands to replace
- **THEN** every command that would otherwise have been listed ungrouped appears
  in exactly one group, and each group states its own total

#### Scenario: A capability the port does not touch

- **WHEN** the source dialect loses no command belonging to a given capability
- **THEN** no group is shown for that capability

#### Scenario: A group with many commands

- **WHEN** a port loses a large number of commands from one capability
- **THEN** every one of them is named in that group as a compact run of names,
  and no control to reveal further commands is present

### Requirement: What the port loses and gains in a capability is reported together

Where the comparison reports the commands a port must replace in a capability and the commands the
target adds in that same capability, it SHALL report them together, as one account of that
capability, rather than in two separate places. A capability the target adds commands to but from
which the port loses nothing SHALL be reported after the capabilities that lose commands.

#### Scenario: A capability that both loses and gains commands

- **WHEN** a port loses commands from a capability and the target provides commands in that
  capability the source does not
- **THEN** both are reported together in that capability's own account, not in two separate parts of
  the comparison

#### Scenario: A capability that only gains

- **WHEN** the target adds commands in a capability the port loses nothing from
- **THEN** that capability is reported after the capabilities the port loses commands from

### Requirement: Colour and sound the program leans on are posed as decisions

A program uses colour and sound two ways: as decoration, which a port can
drop, and as information — the colour that tells the player's piece from the
wall, the beep that says the key registered — which a port must re-encode or
the program stops working in a way no listing shows. Which of the two a given
program is doing is not decidable from its text, and the target's written
advice for the lost capability is only half an answer until it is decided.

Where the open program uses colour and the target machine has no colour, the
account that reports the lost colour commands SHALL pose the decision: where
the colour decorated, drop it; where it told things apart, re-encode it by
the means the target's own advice names. Sound SHALL be treated the same way
where the program uses sound and the target has none.

The decision SHALL be posed only where the program actually uses the
capability, riding the narrowing the accounts already have, and SHALL add
nothing where the target provides the capability or the program does not use
it. Where there is no program, the accounts report as they do today and no
decision is posed.

#### Scenario: A colour-using program moving to a monochrome machine

- **WHEN** the open program uses colour commands and the target machine has
  no colour
- **THEN** the lost-colour account poses the decoration-or-information
  decision, with the re-encoding means the target's advice already names

#### Scenario: A sound-using program moving to a silent machine

- **WHEN** the open program uses sound commands and the target machine has no
  sound
- **THEN** the lost-sound account poses the same decision for each effect —
  drop it, or re-encode the cue

#### Scenario: A program that never uses the capability

- **WHEN** the target machine lacks colour or sound but the open program uses
  no such command
- **THEN** no account of that capability is reported, as the narrowing
  already provides

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** the lost-capability accounts read as they do today, with no
  decision posed

### Requirement: Control codes are grouped by what they do

The comparison SHALL group the control codes a port must replace by what the codes do — colour,
cursor movement, block graphics and so on — rather than as a single alphabetical list, grouped as the
source dialect's own control-code reference categorises them, since what the categories mean is
particular to each machine. Each group SHALL state how many codes it contains, every code SHALL be
named within exactly one group, and a category from which the port loses no code SHALL NOT be shown.

Control codes are not equal work: a machine may express a whole class of them under its own
spellings, express the class only partly, or have no way to express it at all. Each group SHALL
therefore state which of those three the target machine offers for that class of code, and where the
target cannot express the class fully, SHALL say what to do instead. That advice SHALL be given once
per group, not against each code, since what a reader acts on is the same for every code in the
class.

The groups SHALL be ordered by that same verdict, worst-placed first, as the capability groups are:
the classes the target cannot express at all, then those it expresses only partly, then those it has
under its own spellings — so the heaviest work is met rather than found by scanning. Groups the
verdict cannot separate, including any the target has no advice for, SHALL keep the source dialect's
own category order.

The control codes the target adds and the source never had are not work the port must do, so they
SHALL be reported only as a count, with a pointer to the target's control-code reference, and SHALL
NOT be listed code by code.

#### Scenario: Codes reported by category

- **WHEN** the user compares two dialects with control codes to replace
- **THEN** the codes are reported as groups named for what they do, each stating its total

#### Scenario: The heaviest class of work first

- **WHEN** a port loses control codes of a class the target cannot express at all and codes of a
  class it carries under its own spellings
- **THEN** the class it cannot express is reported first, whichever order the source dialect's own
  reference lists the two categories in

#### Scenario: Classes the verdict cannot separate

- **WHEN** two groups of control codes carry the same verdict for the target, or no verdict at all
- **THEN** they keep the source dialect's own category order relative to each other

#### Scenario: A class the target cannot express at all

- **WHEN** a group of control codes belongs to a class the target machine has no way to express
- **THEN** the group states that, and says what to do instead

#### Scenario: A class the target expresses under its own spellings

- **WHEN** a group of control codes belongs to a class the target machine expresses fully under its
  own spellings
- **THEN** the group states that, so the reader can tell mechanical replacement from a rewrite

#### Scenario: Advice is given once per group

- **WHEN** a group contains many control codes of one class
- **THEN** the advice for that class is given once for the group, not repeated against each code

#### Scenario: Grouping loses no control code

- **WHEN** the comparison groups the control codes
- **THEN** every code that would otherwise have been listed ungrouped appears in exactly one group

#### Scenario: A category the port does not touch

- **WHEN** the port loses no code belonging to a given category
- **THEN** no group is shown for that category

#### Scenario: Codes the target adds

- **WHEN** the target dialect has control codes the source dialect does not
- **THEN** they are reported as a count, with a pointer to the target's control-code reference,
  rather than listed individually

### Requirement: The characters the target cannot represent are reported

A machine's character set covers only part of printable ASCII, and a character it has
no glyph for cannot appear anywhere in a program — not in a string, a comment or a
variable name. The comparison SHALL report, for the target machine, the printable
characters it cannot represent, so that a reader learns the restriction before writing
against it rather than from an error afterwards.

Where the reader's own program is at hand, this SHALL be narrowed to the characters
that program actually contains, so it names the work this port requires rather than the
machine's whole shortfall. Where there is no program to narrow to, the target's full
set SHALL be reported.

A machine that represents printable ASCII in full SHALL report nothing, rather than
reporting an empty list.

Control codes and graphics characters SHALL NOT be reported here; they are reported as
control codes, and reporting a block graphic among the characters to replace would
describe the same difference twice under two names.

#### Scenario: A program using a character the target lacks

- **WHEN** a user compares two machines with a program open that uses a character the
  target machine cannot represent
- **THEN** that character is reported as one the port must replace

#### Scenario: A program the target can represent in full

- **WHEN** the program uses only characters the target machine has
- **THEN** no characters are reported, and the section is absent rather than empty

#### Scenario: Reading the comparison with no program

- **WHEN** a user compares two machines with no program to narrow to
- **THEN** every printable character the target cannot represent is reported

#### Scenario: A target with no restriction

- **WHEN** the target machine represents printable ASCII in full
- **THEN** nothing is reported about characters, whatever the program contains

### Requirement: The program's line numbers are checked against the target's range

Machines differ in which line numbers a BASIC program may use, from a few thousand
to tens of thousands, and at both ends of the range: a machine whose lowest line
number is 1 will not accept a program that opens at line 0.

Where the reader's own program is at hand, the comparison SHALL report a line
number the target machine would not accept, naming the target's range and which
end of it the program falls outside. Where every line number the program uses lies
within the target's range, nothing SHALL be reported.

The comparison SHALL report the target's valid range of line numbers among the
language and hardware differences whether or not a program is open, as it does the
other language rules.

#### Scenario: A program numbered beyond the target's ceiling

- **WHEN** a user compares two machines with a program open whose highest line
  number is above the highest the target machine accepts
- **THEN** the comparison reports that the program must be renumbered, naming the
  target's range and the program's highest line number

#### Scenario: A program numbered below the target's floor

- **WHEN** the program uses a line number below the lowest the target machine
  accepts
- **THEN** the comparison reports it, naming the target's range

#### Scenario: A program whose numbers fit

- **WHEN** every line number the program uses lies within the target machine's
  range
- **THEN** nothing is reported about line numbers beyond the range itself among the
  language and hardware differences

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** the target's range of line numbers is still reported among the language
  and hardware differences, and nothing is reported about a program's own numbers

### Requirement: How the program's statement layout must change is reported

Machines differ in whether several statements fit on one line and in what separates
them. Where the reader's own program is at hand, the comparison SHALL report how that
program's statement layout must change: which of its lines carry more than one
statement, and whether each such line must be split into several lines or merely
re-separated with the target's own separator.

Splitting is the one change a port makes that creates lines the program did not
have. Where the target takes one statement per line, the comparison SHALL therefore
report how many lines the program becomes, and SHALL report it as an overflow where
the target's range of line numbers cannot hold that many lines however they are
renumbered.

The program's lines SHALL be counted as the language being ported **from** reads them,
so a separator character used as ordinary text on the source machine is not mistaken
for a statement break.

Where the program has no line carrying more than one statement, or the two machines
separate statements alike, nothing SHALL be reported.

#### Scenario: Porting to a machine that takes one statement per line

- **WHEN** the program has lines carrying several statements and the target machine
  takes only one statement per line
- **THEN** the comparison reports how many of the program's lines must be split,
  which, and how many lines the program becomes

#### Scenario: Splitting overflows the target's line numbers

- **WHEN** splitting the program's multi-statement lines would produce more lines
  than the target machine's range of line numbers can hold
- **THEN** the comparison reports that the split cannot be renumbered to fit,
  naming the projected number of lines and the target's range

#### Scenario: Splitting that still fits

- **WHEN** splitting produces more lines than the program had, and the target
  machine's range of line numbers holds them
- **THEN** the projected number of lines is reported and no overflow is reported

#### Scenario: Porting to a machine that separates statements differently

- **WHEN** the program has lines carrying several statements and the target machine
  separates statements with a different character
- **THEN** the comparison reports which lines are affected and what the separator
  becomes, and reports no projected line count, the program's lines being unchanged
  in number

#### Scenario: A program with nothing to restructure

- **WHEN** every line of the program carries a single statement
- **THEN** nothing is reported about statement layout, whatever the two machines allow

#### Scenario: The separator as ordinary text

- **WHEN** the machine being ported from has no statement separator, and the program
  uses that character as ordinary text
- **THEN** those lines are not reported as carrying several statements

### Requirement: Whether the program fits the target machine is reported

Machines differ in how much memory a BASIC program may occupy, by more than an
order of magnitude between some relatives, and a program that fits the machine it
was written for may not load at all on the machine it is going to. This is the one
failure a port can hit while requiring no other change whatever: two machines can
run the same BASIC, share every command, and differ only in room.

Where the reader's own program is at hand, the comparison SHALL therefore report
the size that program takes on the **target** machine against the program memory
that machine has free, and SHALL say whether it fits, is close to the limit, or
has no room. Both figures SHALL be reported, so that a reader told it does not fit
is also told by how much.

The size SHALL be measured as the target machine stores the program, not as the
source machine does: machines encode the same program text into different numbers
of bytes, so a size carried over from the machine being ported from would describe
the wrong machine.

Where the program uses something the target cannot express, the size SHALL still be
reported, measured from what the target can store and stated as a lower bound. What
the target cannot express is reported by the comparison's other findings and is not
itself a failure to fit.

A size known only as a lower bound SHALL NOT be reported as fitting, however far
under the machine's memory it falls: what could not be measured is precisely what
would add to it. It SHALL be reported as being at least that size. A lower bound
that already exceeds the machine's memory SHALL be reported as not fitting, that
conclusion being safe in the direction the doubt runs.

Where the target machine could store none of the program at all, nothing SHALL be
reported about fit.

The point at which the comparison calls the program close to the limit, and the
point at which it calls it too large, SHALL be the same points at which the editor
reports a program as close to or over its budget, so that one proportion of a
machine's memory means one thing wherever the user meets it.

Where the fit report calls the program close to the limit or over it, the
comparison MAY additionally report target-side measures that would make room —
each a fact pinned to the target machine, never an invitation to rewrite the
program. First among them is conditionally free memory: where the target holds
memory that hardware claims only for an optional feature, and the program's own
text proves the feature unused, the comparison SHALL report that memory with its
size and the condition that frees it, and SHALL pose the decision — place data
and machine code there, or shorten the program. Where the condition is not met,
or cannot be decided from the program's text, or the program is comfortably
inside the budget, nothing SHALL be reported about such memory: a measure the
program does not qualify for is not a measure, and a program under no pressure
has no use for one. Doubt SHALL run toward not reporting the memory, as the
lower-bound rule already runs it.

Where there is no program to size — the comparison read on its own, nothing open,
or a program that cannot be read — nothing SHALL be reported about fit.

#### Scenario: A program too large for the target

- **WHEN** a user compares two machines with a program open that would take more
  memory on the target machine than that machine has free
- **THEN** the comparison reports that the program will not fit, giving both the
  size it takes on the target and the memory that machine has free

#### Scenario: A program that fits with room to spare

- **WHEN** the program takes well under the target machine's free program memory
- **THEN** the comparison reports that it fits, giving both figures

#### Scenario: A program close to the target's limit

- **WHEN** the program takes most of the target machine's free program memory,
  without exceeding it
- **THEN** the comparison reports it as close to the limit, at the same proportion
  of the budget at which the editor reports a program as close to its own

#### Scenario: Two machines running the same BASIC with different memory

- **WHEN** the source and target machines run the same BASIC, so no command,
  control code or language rule differs between them, and the target has far less
  program memory
- **THEN** the comparison still reports that the program does not fit, rather than
  reporting a port with no work in it

#### Scenario: A machine whose relatives differ in memory

- **WHEN** the target machine's family includes relatives with different amounts of
  free program memory
- **THEN** the fit is reported against the selected machine's own memory

#### Scenario: A program the target cannot fully express

- **WHEN** the program uses commands or characters the target machine has no way to
  store
- **THEN** a size is still reported, measured from what the target can store and
  stated as a lower bound, rather than the fit being left unreported

#### Scenario: A lower bound that has not yet reached the limit

- **WHEN** the size is known only as a lower bound and falls under the target
  machine's free program memory
- **THEN** it is reported as the program being at least that size, and is not
  reported as fitting

#### Scenario: A lower bound that already exceeds the limit

- **WHEN** the size is known only as a lower bound and already exceeds the target
  machine's free program memory
- **THEN** it is reported as not fitting, the doubt running only towards a larger
  program

#### Scenario: A program the target can store none of

- **WHEN** the target machine could store no part of the program
- **THEN** nothing is reported about fit

#### Scenario: A pressed program that stays in text mode

- **WHEN** the fit report calls the program close to the target's limit or over
  it, the target holds memory claimed only by a graphics feature, and every
  screen mode the program selects leaves that feature unused
- **THEN** the comparison reports that memory with its size and the condition
  that frees it, and poses the decision between placing data there and
  shortening the program

#### Scenario: A pressed program that uses the feature

- **WHEN** the fit report calls the program close to the limit or over it, and
  the program selects a mode, computes a mode, or writes an address that means
  the feature's memory cannot be proven free
- **THEN** nothing is reported about that memory

#### Scenario: A program under no fit pressure

- **WHEN** the program fits the target with room to spare
- **THEN** nothing is reported about conditionally free memory, however clearly
  the program would qualify

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or inside the IDE with nothing
  open or with a program that cannot be read
- **THEN** nothing is reported about whether the program fits, and asking to see
  every difference does not produce a fit report

### Requirement: The program's positions are checked against the target's screen

Text screens run from 22 columns to 80 among the machines, and a program's
layout is written in positions aimed at one of them. A position beyond the
target's screen ports without an error and lands off the edge or wrapped; a
position given as a single offset from the screen's start encodes the source
machine's width itself, so the same number is a different place on the
target. No command list carries any of this: the commands port, the numbers
are wrong.

Where the reader's own program is at hand, the comparison SHALL check the
positions the program states as constants — row-and-column arguments, single
offsets, and position control codes — against the columns and rows of the
screen the target machine boots into, and SHALL name the positions the
target's screen does not contain. Where the program positions by single
offset and the two screens differ in width, the comparison SHALL say the
offsets encode the source's width and must be recomputed for the target's,
whether or not any offset is out of bounds.

The comparison SHALL pose the decision the positions force — reflow the
layout for the target's screen, or clip what falls outside — once, not per
position.

A position the program computes SHALL NOT be judged: doubt reports nothing,
and the posed decision covers what the text does not fix. Where the program
selects screen modes other than the boot mode, the comparison SHALL say its
check describes the boot screen rather than judge a geometry it cannot know.

Where every stated position fits and the screens' widths agree, or where
there is no program, nothing SHALL be reported about positions.

#### Scenario: A position beyond the target's screen

- **WHEN** the open program prints at a constant position that lies beyond
  the columns or rows of the target machine's boot screen
- **THEN** the comparison names the position and what the target's screen
  holds, and poses the reflow-or-clip decision once

#### Scenario: Offsets that encode the width

- **WHEN** the open program positions by single offset and the two machines'
  boot screens differ in width
- **THEN** the comparison reports that the offsets encode the source's width
  and must be recomputed for the target's

#### Scenario: A layout that fits

- **WHEN** every constant position in the open program lies within the target
  machine's boot screen, and the machines' widths agree
- **THEN** nothing is reported about positions

#### Scenario: A computed position

- **WHEN** the open program computes a position rather than stating it
- **THEN** that position is not reported as out of bounds

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** nothing is reported about positions

### Requirement: Loops that only pass time are reported with the machines' measured speeds

An empty counting loop is a delay tuned to the speed of the machine it was
written on — the count *is* the source machine's speed, written into the
program. Ported verbatim to a machine that runs BASIC several times faster or
slower, every pause changes by that factor and a playable program stops being
one. Nothing fails, nothing tokenizes differently, and no command changes.

Each machine SHALL carry a speed measured by running the same counting loop
in this product's own emulators, and the comparison SHALL quote any ratio as
measured there, never as a fact about the original hardware.

Where the reader's own program contains empty counting loops and the two
machines' measured speeds differ materially, the comparison SHALL report that
the program's delays are tuned to the source machine's speed, quote the
measured ratio, and pose the decision: retune the counts, or move the delays
onto the target machine's own clock — which the report SHALL name, each
machine having its own idiom for waiting.

A loop with a body SHALL NOT be called a delay: only loops that do nothing
but count are reported, and a program with none produces nothing. Where the
measured speeds are close, nothing SHALL be reported however many delay
loops the program has. Where there is no program, nothing SHALL be reported
about delays.

#### Scenario: Delay loops moving to a much faster machine

- **WHEN** the open program contains empty counting loops and the target
  machine's measured speed is several times the source's
- **THEN** the comparison reports the delays as tuned to the source, quotes
  the measured ratio as this product's emulators', names the target's own way
  of waiting, and poses the retune-or-reclock decision

#### Scenario: A program with no empty loops

- **WHEN** the open program contains no empty counting loops
- **THEN** nothing is reported about delays, whatever the machines' speeds

#### Scenario: Two machines of similar speed

- **WHEN** the two machines' measured speeds are close
- **THEN** nothing is reported about delays

#### Scenario: The ratio is the emulators' own

- **WHEN** the comparison quotes a speed ratio
- **THEN** the ratio is stated as measured in this product's emulators, not
  as a fact about the original hardware

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** nothing is reported about delays

### Requirement: Variable names that collide on the target are reported

Machines differ in how much of a variable name they keep: some keep every
character, some keep the first two, some keep one. A program moving to a machine
that keeps fewer characters than it was written for can have two of its variables
silently become one — nothing fails to tokenize, nothing is reported by any
difference list, and the program computes the wrong answer.

Where the reader's own program is at hand, the comparison SHALL report the
variable names in that program that the target machine would treat as the same
variable, naming the names that collide and what the target reduces them to.
Names that remain distinct on the target SHALL NOT be reported.

Whether a name's type marker distinguishes it SHALL be decided as the target
machine decides it, so two names the target keeps apart are not reported as
colliding.

Where the target keeps at least as much of a name as the source, nothing SHALL be
reported. Where there is no program, nothing SHALL be reported: which names
collide is a fact about a program, not about a pair of machines.

#### Scenario: Two names the target cannot tell apart

- **WHEN** a user compares two machines with a program open that uses two variable
  names which the target machine reduces to the same name
- **THEN** the comparison reports both names together with what the target reduces
  them to

#### Scenario: Names that stay distinct

- **WHEN** the program's variable names remain distinct under the target machine's
  rule
- **THEN** nothing is reported about variable names

#### Scenario: Names distinguished by their type marker

- **WHEN** two of the program's names would collide but for a type marker the
  target machine treats as part of the name
- **THEN** they are not reported as colliding

#### Scenario: A target that keeps more of a name

- **WHEN** the target machine keeps at least as many characters of a name as the
  source machine does
- **THEN** nothing is reported about variable names

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** the target's variable-naming rule is still reported among the language
  and hardware differences, and no collisions are reported

### Requirement: Type markers the target does not have are reported

A variable's type marker is a promise about what the variable holds — integer,
single precision, double precision — and machines differ in which markers they
recognise. A program moving to a machine without one of its markers can fail
two ways, neither of which stops it tokenizing: the marker may be accepted in
the program's text and rejected the moment the line runs, or the type it named
may quietly cease to exist, so values keep flowing with less precision than the
program was written against.

Where the reader's own program is at hand and its variables carry a type marker
the target machine's naming rule does not recognise, the comparison SHALL
report each such marker with what it meant and the names that carry it, and
SHALL say the type must be given up along with the marker's spelling — not only
that the names change.

Where the target machine accepts the marker's spelling and fails when the line
runs, the comparison SHALL warn in exactly those terms, since a port that loads
cleanly and fails later is worse than one that fails at once. Where the marker
named a precision the target does not hold, the comparison SHALL say the values
lose precision silently and that arithmetic depending on the extra digits needs
checking.

Markers the program never uses SHALL NOT be reported, and a marker every
machine shares SHALL never be reported. Where there is no program, nothing
SHALL be reported: which markers a program leans on is a fact about a program,
not about a pair of machines.

#### Scenario: An integer marker the target rejects at run time

- **WHEN** the open program's variables carry an integer type marker, and the
  target machine accepts that spelling but fails when the line runs
- **THEN** the comparison reports the marker, the names carrying it, and that
  the failure comes at run time rather than at entry

#### Scenario: A precision the target does not hold

- **WHEN** the open program's variables carry a double-precision marker and the
  target machine holds single precision only
- **THEN** the comparison reports that those values lose precision silently,
  and that arithmetic depending on the extra digits must be checked

#### Scenario: A marker the program never uses

- **WHEN** the target machine lacks a type marker the source machine has, but
  no variable in the open program carries it
- **THEN** nothing is reported about that marker

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** nothing is reported about type markers

### Requirement: Control codes that keep their spelling and change meaning are reported

Two machines can spell a control code alike and store different bytes for it, which
ports silently wrong: nothing in the program's text changes, and the program behaves
differently. The comparison SHALL report such codes as differences the port must
re-check, distinctly from the codes the target does not have at all, saying what the
code stores on each machine.

These SHALL be narrowed to the codes the open program uses, as the codes that must be
replaced already are.

#### Scenario: A code that means something else on the target

- **WHEN** the program uses a control code the target machine spells the same way but
  stores differently
- **THEN** the comparison reports it as a code to re-check, naming what it stores on
  each machine

#### Scenario: A code that survives unchanged

- **WHEN** the program uses a control code that both machines spell and store alike
- **THEN** it is not reported as a difference

### Requirement: What the target adds and the program never used can be filtered out

What the target offers where the port loses nothing is the one part of the comparison that is not
work the port requires. The comparison SHALL leave it out by default — both the capabilities with
nothing to replace and the control codes the target adds — and SHALL offer a control that reports
it, with what is being left out stated so the control can be found. What the target offers in a
capability the port *does* lose commands from is the advice for replacing them, and SHALL NOT be
left out by this control.

The control and the statement of what it is holding back SHALL be offered once for the comparison,
covering every section they govern, and SHALL be reachable whatever those sections are currently
reporting. A control offered only from inside the sections it filters is a control that goes away
with them, at exactly the point where nothing else on the page reports that the filtered content
exists.

#### Scenario: The default view

- **WHEN** the user opens a comparison
- **THEN** the capabilities the target only adds to and the control codes it adds are absent, and
  the comparison states how many capability areas are being left out

#### Scenario: Asking to see them

- **WHEN** the user turns the control on
- **THEN** the capabilities the target only adds to, and the control codes it adds, are reported

#### Scenario: Advice for a capability that loses commands is never hidden

- **WHEN** the control is off and the port loses commands from a capability the target also adds to
- **THEN** what the target offers in that capability is still reported with the commands lost from
  it

#### Scenario: Every section the control governs is holding nothing else

- **WHEN** the control is off and every section it governs has nothing to report but what the
  target adds
- **THEN** the control and the statement of what it is holding back are still offered, and turning
  it on reports the additions

### Requirement: The comparison narrows to the program the user has open

Where the comparison is shown inside the IDE, and the user's own program is therefore at hand, the
comparison SHALL report only the differences that program is subject to: the commands it must
rewrite, the commands it must rename, the commands whose usage differs, the same-word-different-
meaning warnings, the control codes it must replace, the control codes that keep their spelling and
change meaning, the characters the target cannot represent, and the lines whose statement layout
must change SHALL each be limited to the commands, codes, characters and lines the program actually
contains. A capability, a group of control codes, or a whole section
left with nothing to report SHALL be absent rather than empty.

Some findings exist only because there is a program to make them about — how that
program's statement layout must change, and whether it fits the target machine's
program memory. Where there is no program, those findings SHALL be absent rather
than reported in general terms, and the control that reveals every difference SHALL
NOT produce them: there is no unnarrowed form of a statement about the reader's own
program.

What the target machine adds, the language and hardware differences, and the guidance prose SHALL
NOT be narrowed: the first is already about what the program did not use, and the other two state
rules that hold for any program whatever commands it uses.

Where the comparison is read on its own, outside the IDE, no narrowing SHALL take place and every
difference SHALL be reported — narrowing is an extra for the user who has a program, never a
condition of the guidance.

#### Scenario: Reading the comparison with a program open

- **WHEN** a user reads the comparison inside the IDE with a program open
- **THEN** the commands to rewrite, rename and re-check, the same-word-different-meaning warnings,
  the control codes to replace and to re-check, and the characters to replace name only commands,
  codes and characters the program contains

#### Scenario: A capability the program does not draw on

- **WHEN** the port would lose commands from a capability, but the program uses none of them
- **THEN** that capability is not reported among the ones the port must deal with

#### Scenario: What is never narrowed

- **WHEN** the comparison is narrowed to the open program
- **THEN** the language and hardware differences, the guidance prose, and what the target machine
  adds are reported in full, exactly as they are without a program

#### Scenario: A finding that needs a program

- **WHEN** a user asks to see every difference for a pair, with no program open
- **THEN** the findings that describe the reader's own program — its statement
  layout and whether it fits the target — remain absent

#### Scenario: Reading the comparison outside the IDE

- **WHEN** a user opens the comparison on its own, outside the IDE
- **THEN** every difference is reported and no narrowing control is offered

#### Scenario: An empty program

- **WHEN** a user reads the comparison inside the IDE with nothing written in the editor
- **THEN** every difference is reported, as it is for a reader with no program at all

### Requirement: A section with nothing to port is not shown

Narrowing the comparison to the open program is a promise that what remains is
the work that program needs. A section that has narrowed down to nothing breaks
the promise while appearing to keep it: it costs a heading to read and a count
to interpret before it says that nothing is being asked, and a page of those
reads like the comparison that was never narrowed at all.

Where the comparison is narrowed to the user's program, a section with nothing
in it for the reader SHALL NOT be shown — not as a heading, not as a count of
zero, not as a sentence reporting its own emptiness.

What holds a section open is content the reader must act on or be told about.
Content that only reports what the target adds where the port loses nothing
SHALL NOT hold a section open, being news rather than work; the comparison
already leaves it out by default. Content the reader must be told about SHALL
hold a section open even where nothing in the program's text changes, because
a difference that leaves the program looking correct is the one the reader
cannot find unaided.

Where the comparison is not narrowed to a program it is the whole comparison of
the two machines, and every section that has anything to report SHALL still be
shown: the reader has asked about the machines rather than about a program, and
a section reporting no difference is then an answer.

#### Scenario: A program with no commands to rewrite

- **WHEN** the comparison is narrowed to a program that uses no command the
  target makes the user rewrite or remove
- **THEN** the section reporting commands to rewrite is absent, rather than
  present reporting none

#### Scenario: A program with no control codes to replace

- **WHEN** the comparison is narrowed to a program with no control code the
  target cannot express, and the target adds control codes the program never
  used
- **THEN** the section reporting control codes is absent, rather than present
  reporting that no code needs replacing

#### Scenario: A difference the program's text does not show

- **WHEN** the comparison is narrowed to a program that has nothing to replace
  in a section, but uses something that keeps its spelling on the target and
  means something else
- **THEN** the section is shown, reporting what changed meaning

#### Scenario: The comparison is not narrowed

- **WHEN** no program is open, or the open program cannot be read as the source
  machine's BASIC
- **THEN** every section with something to report is shown, as it is for a
  comparison of the two machines

#### Scenario: Asking to see what the target adds

- **WHEN** a section holds nothing but what the target adds and the program
  never used, and the user turns on the control that reports those
- **THEN** the section is shown, reporting them

### Requirement: The program's lines are named as its listing numbers them

A finding that names a line of the reader's own program is naming it so that
the reader can find it, and what they have in front of them is a listing —
whose lines are numbered by the program, not counted by the editor. The two
numberings agree only for a program written from its lowest line in steps of
one with nothing blank between; for every other program an editor count names a
line that exists and is the wrong one, which reads as an answer rather than as
a mistake.

Wherever the comparison names a line of the program being ported, it SHALL name
it by the line number the program itself carries, in every place a line is
named — the narrowed findings and the same findings handed to the assistant
alike, since one program discussed in two numberings is a program the reader
has to reconcile.

A line carrying no number of its own SHALL NOT be named: there is nothing in
the listing to match it against, and the machines refuse such a program in any
case.

#### Scenario: A program not numbered from one in steps of one

- **WHEN** the comparison reports a finding against a line of a program whose
  line numbers do not match its position in the editor
- **THEN** the line is named by the number the program carries, which is the
  number its listing shows

#### Scenario: The same finding handed to the assistant

- **WHEN** the same finding is carried into a request to convert the program
- **THEN** it names the line by the same number the comparison named it by

### Requirement: The program is read as the language being ported from

A program's vocabulary is what a *particular* BASIC finds in its text, so the comparison SHALL
decide which commands and control codes the program uses by reading it as the language of the
machine being ported **from**, not as the language of whichever machine the IDE currently has
selected.

This is what lets a program keep its narrowing after it has been moved to a machine that cannot run
it: the text is unchanged, and the comparison is about the language it was written in. Changing the
machine being ported from SHALL re-read the program in that machine's language rather than abandon
the narrowing.

#### Scenario: A program kept on a machine that cannot run it

- **WHEN** the user keeps their program while switching to a machine whose BASIC will not run it,
  and reads the comparison from the machine they left to the machine they chose
- **THEN** the comparison is narrowed to what the program uses, and does not report the program as
  unreadable

#### Scenario: Changing the machine being ported from

- **WHEN** the user selects a different source machine
- **THEN** the comparison narrows to the commands and codes the program's text contains in that
  machine's language

### Requirement: A program that cannot be read is treated as no program

Where the open program has errors that prevent it being read as a program at all in the language
being ported from, the comparison SHALL report every difference, as it does for a reader with no
program. Findings that do not prevent it being read — advice about what a real machine would refuse
at the keyboard, or about variables — SHALL NOT suppress the narrowing, so that ordinary
half-finished editing does not repeatedly discard it.

#### Scenario: A program that cannot be read

- **WHEN** the open program has an error that prevents it being read as a program
- **THEN** every difference is reported, and the comparison says the program cannot be read yet

#### Scenario: A program with findings that still reads

- **WHEN** the open program has findings that do not prevent it being read as a program
- **THEN** the comparison stays narrowed to what the program uses

#### Scenario: Fixing the program

- **WHEN** the user corrects an error that prevented the program being read
- **THEN** the comparison narrows to the program again

### Requirement: The comparison says whether it is narrowed, and why not

The comparison SHALL always state where it stands with respect to the open program, so that a
reader can tell a narrowed comparison from a full one without counting rows.

Where it is narrowed it SHALL say so, stating both how much of the program it recognised and how
many differences it is holding back, and SHALL offer a control that reports them. Where it is not
narrowed but could be, it SHALL say what would narrow it — that the program should be opened in the
IDE, that there is nothing open, or that the open program cannot be read yet.

Stating what is held back is what keeps the narrowing honest: a difference the comparison failed to
recognise is never silently lost, because the count reveals it and the control reaches it.

#### Scenario: Read outside the IDE

- **WHEN** a user opens the comparison on its own
- **THEN** it says that opening the program in the IDE narrows it to what that program uses

#### Scenario: Inside the IDE with nothing open

- **WHEN** a user reads the comparison inside the IDE with nothing written in the editor
- **THEN** it says that opening a program narrows it to what that program uses

#### Scenario: Inside the IDE with a program that cannot be read

- **WHEN** a user reads the comparison inside the IDE with a program that cannot be read
- **THEN** it says the program cannot be read yet, and points at the errors flagged in the editor

#### Scenario: Narrowed

- **WHEN** the comparison is narrowed to the open program
- **THEN** it says how much of the program it recognised, states how many differences are being
  held back, and offers a control that reports them

#### Scenario: Asking to see everything

- **WHEN** the user turns that control on
- **THEN** every difference for the chosen pair is reported

#### Scenario: A program that uses everything

- **WHEN** the program's vocabulary covers every difference the comparison would report
- **THEN** nothing is stated as held back, and no control to reveal more is shown

### Requirement: Keeping a program on a new machine offers the comparison

Switching to a machine that will not run the open program asks the user whether to keep that
program. Keeping it is the moment a port begins, so the IDE SHALL then offer the comparison for
exactly that port — from the machine left to the machine chosen — narrowed to the program that was
kept. How it is offered depends on how much of the screen the documentation would take; see "The
comparison is offered, not imposed, where it would cover the work".

Starting a new program instead SHALL NOT offer it, there being no program to port; neither SHALL
cancelling, nor switching to a machine that runs the program as it stands and so never asks.

#### Scenario: Keeping the program

- **WHEN** the user switches to a machine that will not run their program and chooses to keep it
- **THEN** the comparison offered is from the machine they left to the machine they chose, narrowed
  to that program

#### Scenario: Starting a new program instead

- **WHEN** the user switches machine and chooses to start a new program
- **THEN** no comparison is offered

#### Scenario: Cancelling the switch

- **WHEN** the user cancels the switch
- **THEN** the machine is unchanged and no comparison is offered

#### Scenario: Switching to a machine that runs the program

- **WHEN** the user switches to a machine that runs the program as it stands, and so is not asked
  whether to keep it
- **THEN** no comparison is offered

### Requirement: The comparison is offered, not imposed, where it would cover the work

Where the documentation would take the whole screen, opening it unbidden would bury the very
program the user has just chosen to port. The IDE SHALL therefore not open it, and SHALL instead
show a brief indication of how to open it; opening the documentation without naming a topic while
that comparison is still current SHALL land on it rather than on the usual topic. Where the user
opens the documentation *on* something — asking to read a particular keyword, instruction or page —
they have named what they want, and the documentation SHALL show that instead.

Where the documentation would take only part of the screen, and so leaves the program in view, the
IDE SHALL open it on the comparison straight away and SHALL NOT show any indication.

Acting on the indication SHALL open the comparison. Any other interaction SHALL dismiss it
immediately, and it SHALL disappear on its own shortly after appearing, so it never stands between
the user and their program.

#### Scenario: Documentation would take the whole screen

- **WHEN** the user keeps their program while switching machine, and the documentation would cover
  the whole screen
- **THEN** the documentation does not open, and a brief indication of how to open it is shown

#### Scenario: Opening the documentation afterwards

- **WHEN** the user opens the documentation without naming a topic while that comparison is still
  current
- **THEN** it opens on that comparison rather than on the topic it would otherwise show

#### Scenario: Opening the documentation on a named topic

- **WHEN** the user opens the documentation on a particular keyword or instruction while that
  comparison is still current
- **THEN** it opens on what they named, and the comparison is still there to be opened afterwards

#### Scenario: Acting on the indication

- **WHEN** the user acts on the indication
- **THEN** the documentation opens on the comparison

#### Scenario: Dismissing the indication

- **WHEN** the user interacts with anything other than the indication
- **THEN** it disappears immediately, and the comparison is still there to be opened

#### Scenario: Leaving the indication alone

- **WHEN** the user does nothing
- **THEN** the indication disappears on its own, and the comparison is still there to be opened

#### Scenario: Documentation would take only part of the screen

- **WHEN** the user keeps their program while switching machine, and the documentation would leave
  the program in view
- **THEN** the documentation opens on the comparison, and no indication is shown

### Requirement: A comparison belongs to the program it was opened for

A comparison narrowed to one program says nothing true about another, so it SHALL NOT outlive the
program it was offered for. WHEN a different program is loaded, a comparison waiting to be opened
SHALL be forgotten, and documentation already showing that comparison SHALL be closed.
Documentation showing anything else SHALL be left as it is — the user's place in the reference is
not the IDE's to take away.

Editing the open program SHALL NOT count as loading a different one, including applying an
assistant's rewrite of it: that is the same program, still being ported.

#### Scenario: A different program is loaded

- **WHEN** the user starts, opens or imports a different program
- **THEN** a comparison waiting to be opened is forgotten, and opening the documentation shows the
  topic it would otherwise show

#### Scenario: The comparison is on screen when it happens

- **WHEN** a different program is loaded while the documentation is showing that comparison
- **THEN** the documentation closes

#### Scenario: The documentation is showing something else

- **WHEN** a different program is loaded while the documentation is showing anything other than
  that comparison
- **THEN** the documentation stays open, where the user left it

#### Scenario: Editing the program it belongs to

- **WHEN** the user edits the open program, or applies an assistant's rewrite of it
- **THEN** the comparison is still current

### Requirement: The comparison opens on the machine the program is written for

Where the comparison is opened inside the IDE and nothing names the machines to compare, it SHALL
open comparing *from* the machine the open program is written for — the one selection under which
the narrowing means anything. A link that names the machines SHALL still resolve to the comparison
it names, so a shared comparison reads the same for everyone.

#### Scenario: Opening the comparison from the IDE

- **WHEN** a user with a program open opens the comparison, following nothing that names machines
- **THEN** the source machine is the one the program is written for

#### Scenario: Following a link that names the machines

- **WHEN** a user inside the IDE opens a link naming both machines to compare
- **THEN** the comparison shows that pair, whatever machine the open program is written for

### Requirement: The comparison explains its colour coding

Where the comparison distinguishes what it reports by colour, it SHALL give a key to what those
colours mean, placed ahead of the sections that use them and laid out as one horizontal run rather
than as a list, so it costs a glance. The key SHALL name only the colours the chosen pair actually
puts on the page.

#### Scenario: Reading a comparison that colours what it reports

- **WHEN** the user opens a comparison whose sections distinguish what they report by colour
- **THEN** a key to those colours is present ahead of those sections, as a single horizontal run

#### Scenario: A colour this pair does not use

- **WHEN** the comparison reports nothing in one of its colours — because the pair has nothing of
  that kind, or because the reader has not asked to see it
- **THEN** the key does not explain that colour, and explains it once it is on the page

### Requirement: Controls over what is reported are phrased as showing

Every control the comparison offers over how much it reports SHALL be labelled with what turning it
on reveals, never with what turning it on removes, so that a control turned on always means more is
reported. Which controls start on SHALL be decided by what the comparison should open on, and is
unaffected by that phrasing.

#### Scenario: Reading the controls

- **WHEN** the user reads any control the comparison offers over what it reports
- **THEN** it is labelled as showing something, and turning it on adds to what is reported

#### Scenario: What the comparison opens on

- **WHEN** the user opens a comparison
- **THEN** the rows that do not differ, what the target adds where the port loses nothing, and the
  differences that fall outside an open program's vocabulary are still absent until asked for

### Requirement: Long difference lists are capped, with more available

Where a difference list that reports a detailed row per entry (a category of commands the comparison
reports) has more entries than fit comfortably on screen, the comparison SHALL render only an
initial portion of it by default and SHALL offer a way to reveal the remaining entries. The count
shown alongside the list's heading or summary SHALL always reflect every entry in the list, not only
the portion currently visible. A list short enough to fit already SHALL render in full, with no such
control shown.

The commands a port must replace, the commands it need only rename, and the control codes it must
replace are exempt: they are named compactly — grouped by capability, grouped by what the code does,
or given as a run of spellings — rather than given a row each, so every one of them is shown.

#### Scenario: A short list needs no control

- **WHEN** a difference list has few enough entries to render in full by
  default
- **THEN** every entry is shown, and no control to reveal more is present

#### Scenario: A long list is capped by default

- **WHEN** a difference list has more entries than the default visible
  portion
- **THEN** only the initial portion is shown, together with a control stating
  how many further entries exist

#### Scenario: Revealing the rest

- **WHEN** the user activates the control to reveal more of a capped list
- **THEN** the remaining entries of that list are shown, and the control is no
  longer present

#### Scenario: Counts reflect the whole list

- **WHEN** a difference list is capped
- **THEN** any count reported for that list (in its heading or in the
  comparison's summary) reflects every entry, not only the visible portion

#### Scenario: Choosing a new pair resets capped lists

- **WHEN** the user changes which dialects are being compared, having
  previously revealed a capped list in full
- **THEN** the new comparison's difference lists are shown capped again

#### Scenario: The grouped commands to replace are never capped

- **WHEN** a port loses more commands than would fit as detailed rows
- **THEN** every lost command is still named within its capability group, and no
  control to reveal more is shown for those groups

#### Scenario: The grouped control codes are never capped

- **WHEN** a port loses more control codes than would fit as detailed rows
- **THEN** every one of them is still named within its category group, and no control to reveal
  more is shown for those groups

#### Scenario: The commands to rename are never capped

- **WHEN** a port renames more commands than would fit as detailed rows
- **THEN** every rename is still named in the compact run, and no control to reveal more is shown
  for it

### Requirement: Where the program's writes land on the target is reported

A program that writes directly to memory carries addresses chosen for one machine.
On another machine those addresses reach whatever that machine keeps there, and the
program's text does not change at all — so no list of commands, control codes or
language rules can report it.

Where the reader's own program is at hand and both machines' memory layouts are
described, the comparison SHALL report what each address the program writes to
reaches on the target machine, and what that means for the write. It SHALL
distinguish an address that reaches the same kind of thing at a different place,
one that reaches something else, one that reaches read-only memory and so has no
effect at all, and one the target's address space does not contain.

An address that reaches something else SHALL be reported with both what the
program aimed at and what it would reach, since either alone leaves the reader to
guess the other.

An address the comparison could only approximate SHALL carry that doubt into its
verdict, reported as an estimate rather than as a conclusion.

Where either machine has no described memory layout, or there is no program, no
verdicts SHALL be reported.

#### Scenario: A write that reaches something else on the target

- **WHEN** the open program writes to an address that holds one kind of thing on
  the source machine and a different kind on the target
- **THEN** the comparison reports the write, naming what it aimed at and what it
  would reach on the target

#### Scenario: A write into read-only memory

- **WHEN** the open program writes to an address that is read-only memory on the
  target machine
- **THEN** the comparison reports that the write has no effect there, distinctly
  from a write that reaches something else

#### Scenario: A write the target's memory does not contain

- **WHEN** the open program writes to an address beyond the target machine's
  address space
- **THEN** the comparison reports that the target has no such address

#### Scenario: A write that reaches the same kind of thing

- **WHEN** the open program writes to an address that holds the same kind of thing
  on both machines, at different addresses
- **THEN** the comparison reports it as an address to change rather than reporting
  nothing

#### Scenario: An address that could only be approximated

- **WHEN** the comparison could not resolve a write address exactly
- **THEN** its verdict is reported as an estimate

#### Scenario: A machine with no described layout

- **WHEN** either machine's memory layout is not described
- **THEN** no verdicts are reported, as no layouts are

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** no verdicts are reported

### Requirement: Where the program's reads land on the target is reported

A program that reads memory directly carries addresses chosen for one machine
as surely as a program that writes: the keyboard matrix, the frame clock, the
system variables all live somewhere particular. On another machine those
addresses hold something else, and the read does not fail — it returns
numbers that mean nothing, which is quieter than a write's damage and no less
a porting fact.

Where the reader's own program is at hand and both machines' memory layouts
are described, the comparison SHALL report what each address the program reads
reaches on the target machine. It SHALL distinguish an address that reaches
the same kind of thing at a different place, one that reaches something else —
named on both sides, since either alone leaves the reader to guess — and one
the target's address space does not contain.

Where a read lands on a region the machine's layout names — the keyboard, a
clock, the system variables — the report SHALL name that region on both
machines, so that what the program was really asking for is visible and the
target's own way of asking it can be found.

An address the comparison could only approximate SHALL carry that doubt into
its verdict, reported as an estimate rather than a conclusion.

Where either machine has no described memory layout, or there is no program,
no verdicts SHALL be reported.

#### Scenario: A read that reaches something else on the target

- **WHEN** the open program reads an address that holds one kind of thing on
  the source machine and a different kind on the target
- **THEN** the comparison reports the read, naming what it asked for and what
  it would reach on the target

#### Scenario: A read of the keyboard

- **WHEN** the open program reads an address the source machine's layout names
  as keyboard hardware
- **THEN** the report names the keyboard on the source side, and names what
  the same address holds on the target

#### Scenario: A read the target's memory does not contain

- **WHEN** the open program reads an address beyond the target machine's
  address space
- **THEN** the comparison reports that the target has no such address

#### Scenario: An address that could only be approximated

- **WHEN** the comparison could not resolve a read address exactly
- **THEN** its verdict is reported as an estimate

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** no read verdicts are reported

### Requirement: Machine code the program calls is reported as work to re-achieve

A machine-code routine is the one part of a program no substitution can port:
it is processor code for the source machine, reached through a call command or
carried as an attached block, and on the target it is at best absent and at
worst noise. The commands that call it are not the finding — the routine is,
and the only question that moves the port forward is what the routine was
*for*, because a sound effect, a scroll, or a speed-up is re-achieved with the
target's own means, not translated.

Where the reader's own program calls machine code or carries code blocks, the
comparison SHALL gather the call targets and the blocks — each block with its
name, address and size, and a call that lands inside a block reported as a
call into that block — into one finding among the work that must be
rewritten. The finding SHALL state that these are the source machine's
processor code and that no substitution carries them, and SHALL pose the
decision for each routine: establish what it does, and do that with the
target's means.

The comparison SHALL NOT report the call commands themselves as commands the
target lacks where the real difference is the routine: a run-a-routine command
the target spells differently is a rename, and a call that returns a value on
one machine while running code on the other is a same-word-different-meaning
warning.

Where the pair's guidance already says how machine code is carried between
these two machines, the finding SHALL point to it rather than restate it.

Where the program calls no machine code and carries no blocks, nothing SHALL
be reported. Where there is no program, nothing SHALL be reported.

#### Scenario: A program that calls a routine in an attached block

- **WHEN** the open program carries a code block and calls an address inside
  it
- **THEN** the comparison reports the block by name with its address and size,
  the call as a call into it, and poses the decision to establish what the
  routine does and re-achieve it on the target

#### Scenario: A call to an address outside any block

- **WHEN** the open program calls an address it carries no block for
- **THEN** the call is still reported as machine code the port must
  re-achieve, with what the source machine's layout says lives at that address

#### Scenario: Call commands that differ only in spelling

- **WHEN** both machines run routines with commands that differ only in
  spelling, and the open program uses the source's
- **THEN** the spelling change is reported among the renames, and the
  machine-code finding carries the routine question — the command is not
  reported as one the target lacks

#### Scenario: A program with no machine code

- **WHEN** the open program calls no machine code and carries no code blocks
- **THEN** nothing is reported about machine code

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** nothing is reported about machine code

### Requirement: Abbreviated spellings are resolved and reported

Machines that let a program spell keywords short — a dotted prefix, a shifted
letter, a symbol standing for a whole command — were typed that way, and
archive listings carry those spellings. A spelling is part of the program's
text: a target that does not accept it will not read the line, and a target
that reads it as something else changes the program silently. The keyword the
spelling stands for is meanwhile real work the port must account for.

The comparison SHALL read abbreviated and symbol spellings as the machine
being ported **from** reads them, so a program that prints only with an
abbreviation is a program that prints: the resolved commands SHALL take part
in the narrowing exactly as commands spelled in full do.

Where the reader's own program contains spellings the target machine does not
accept, the comparison SHALL report each with the command it stands for, as
mechanical work to expand, among the renames rather than among the rewrites —
the command survives; only its spelling changes. A spelling the target reads
as the same command SHALL NOT be reported: there is no work in it.

Where the target machine gives one of the program's spellings a different
meaning of its own, the comparison SHALL warn that the unexpanded spelling
does not fail on the target but changes meaning, in the same finding, since
the expansion is what removes the trap.

Where the target machine keeps short spellings in the stored program, so that
abbreviating genuinely shrinks it, and the fit report has the program close to
the limit or over it, the comparison SHALL report the target's own short
spellings among the measures that would make room, posing the decision — 
abbreviate once the port runs, or shorten the program another way. On a
machine whose stored program is the same size however keywords are spelled,
no such measure SHALL ever be reported.

Where there is no program, nothing SHALL be reported about spellings: which
abbreviations a program uses is a fact about a program, not about a pair of
machines.

#### Scenario: A dotted program moving to a machine without dot entry

- **WHEN** the open program spells commands with the source machine's dot
  abbreviations and the target machine accepts no such spelling
- **THEN** the comparison reports each spelling with the command it stands
  for, as expansions among the mechanical work

#### Scenario: A symbol the target reads as its own operator

- **WHEN** the open program uses a symbol spelling for a command, and the
  target machine reads that symbol as an operator of its own
- **THEN** the comparison warns that the unexpanded symbol does not fail on
  the target but changes meaning

#### Scenario: A spelling both machines read alike

- **WHEN** the open program uses a spelling the target machine reads as the
  same command the source does
- **THEN** nothing is reported about that spelling

#### Scenario: An abbreviated program is narrowed correctly

- **WHEN** the open program uses a command only through an abbreviated
  spelling, and the target lacks that command
- **THEN** the command is reported among the commands the program uses that
  the target does not have, exactly as if it were spelled in full

#### Scenario: A pressed port to a machine whose spellings save room

- **WHEN** the fit report has the program close to the target's limit or over
  it, and the target machine stores short spellings as fewer bytes
- **THEN** the comparison reports the target's short spellings among the
  measures that would make room, with the decision posed

#### Scenario: A machine where spelling changes nothing

- **WHEN** the target machine stores a program at the same size however its
  keywords are spelled
- **THEN** short spellings are never reported as a measure, whatever the fit

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** nothing is reported about abbreviated spellings
