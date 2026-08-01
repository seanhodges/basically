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

### Requirement: Comparing two BASIC dialects

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

### Requirement: The comparison leads with what the port requires

The comparison SHALL present what the port requires the reader to do — how the two machines differ,
what is specific to this pair and this target, the commands that fail silently, and the commands
that must be rewritten — before the lists it provides for reference, being the commands whose
spelling or usage differs and the control codes. Guidance that does not vary with the chosen pair
SHALL NOT be placed between two sections that do.

#### Scenario: Reading the comparison top to bottom

- **WHEN** the user reads a comparison from the top
- **THEN** the language and hardware differences, the guidance for this pair and target, the
  same-name-different-meaning warnings and the commands to replace are reached before the commands
  whose spelling or usage differs and the control codes

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

The differences that describe memory — how memory is written, how an address is
written, and the addresses themselves — SHALL be reported together as one run
rather than interleaved with the language rules, and the addresses SHALL be
adjacent within it, so a reader needing them finds them in one place and a
reader who does not passes them in one step.

#### Scenario: Reading the differences top to bottom

- **WHEN** the user reads the language and hardware differences from the top
- **THEN** the BASIC each machine runs, how it handles numbers, and how much
  program memory it has are reached before the rules that affect only how
  individual statements are written

#### Scenario: Finding the memory addresses

- **WHEN** the comparison reports the machines' memory addresses
- **THEN** they are reported next to each other, within one run of the
  memory-related differences, rather than separated by unrelated rows

#### Scenario: The order does not depend on the pair

- **WHEN** the user changes which machines are compared
- **THEN** the differences that are reported appear in the same relative order
  as before

### Requirement: The language differences report how the machine handles numbers

The language and hardware differences SHALL report whether each dialect has floating point or is
integer-only, and where it is integer-only, the range of values it can hold.

#### Scenario: Porting to an integer-only machine

- **WHEN** the user selects a target dialect that has no floating point
- **THEN** the language differences report the target as integer-only, with the range of values it
  holds, against the source's own number handling

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

The guidance SHALL be readable in a few minutes for any dialect pair, and SHALL
NOT restate what the difference tables already show.

#### Scenario: Guidance for a distant pair

- **WHEN** the user selects two dialects with a large number of differences
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

### Requirement: Guidance covers both the general and the machine-specific

The guidance SHALL describe what any port between these BASICs involves, independently of the pair
chosen, and SHALL additionally describe what is specific to the machine being ported **to**. Every
dialect offered as a target SHALL carry its own guidance, so no valid pair produces a comparison
without it.

What any port involves does not change with the pair, so it SHALL be given a page of its own rather
than sit within the comparison, and the comparison SHALL point to it before the reader reaches the
pair-specific sections, naming it as the thing to read first by a reader new to porting.

#### Scenario: Guidance for any target

- **WHEN** the user selects any dialect as the porting target
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

### Requirement: Control codes are grouped by what they do

The comparison SHALL group the control codes a port must replace by what the codes do — colour,
cursor movement, block graphics and so on — rather than as a single alphabetical list, grouped and
ordered as the source dialect's own control-code reference categorises them, since what the
categories mean is particular to each machine. Each group SHALL state how many codes it contains,
every code SHALL be named within exactly one group, and a category from which the port loses no code
SHALL NOT be shown.

The control codes the target adds and the source never had are not work the port must do, so they
SHALL be reported only as a count, with a pointer to the target's control-code reference, and SHALL
NOT be listed code by code.

#### Scenario: Codes reported by category

- **WHEN** the user compares two dialects with control codes to replace
- **THEN** the codes are reported as groups named for what they do, in the source dialect's own
  category order, each stating its total

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

### Requirement: What the target adds and the program never used can be filtered out

What the target offers where the port loses nothing is the one part of the comparison that is not
work the port requires. The comparison SHALL leave it out by default — both the capabilities with
nothing to replace and the control codes the target adds — and SHALL offer a control that reports
it, with what is being left out stated so the control can be found. What the target offers in a
capability the port *does* lose commands from is the advice for replacing them, and SHALL NOT be
left out by this control.

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
- **THEN** the rows that do not differ, and what the target adds where the port loses nothing, are
  still absent until asked for

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
