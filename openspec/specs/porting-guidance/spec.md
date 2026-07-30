# porting-guidance Specification

## Purpose

Help a user move a BASIC program from one machine to another: pick a dialect to
port **from** and a dialect to port **to**, and get a brief, shareable, no-setup
comparison of what the move involves — which commands change, which behave
differently, and how the two machines differ in language rules and hardware —
with general and target-specific guidance always present. Inside the IDE, where
the user's own program is at hand, additionally offer to carry the port out with
the AI assistant.

## Requirements

### Requirement: Comparing two BASIC dialects

The user SHALL be able to choose a dialect to port **from** and a dialect to
port **to**, and be told what moving a program between them involves: which
commands the target lacks, which the target adds, which behave differently, and
how the two machines differ in language rules and hardware. A chosen comparison
SHALL be shareable as a link that reopens the same pair.

#### Scenario: Choosing a pair

- **WHEN** the user chooses a source dialect and a different target dialect
- **THEN** the differences between those two dialects are reported

#### Scenario: The same dialect on both sides

- **WHEN** the user chooses the same dialect as both source and target
- **THEN** no differences are reported, and the user is asked to pick two
  different dialects

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

The guidance SHALL describe what any port between these BASICs involves,
independently of the pair chosen, and SHALL additionally describe what is
specific to the machine being ported **to**. Every dialect offered as a target
SHALL carry its own guidance, so no valid pair produces a comparison without it.

#### Scenario: Guidance for any target

- **WHEN** the user selects any dialect as the porting target
- **THEN** both the general guidance and guidance specific to that target are
  shown

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

### Requirement: Long difference lists are capped, with more available

Where a difference list that reports a detailed row per entry (a category of
commands or control codes the comparison reports) has more entries than fit
comfortably on screen, the comparison SHALL render only an initial portion of it
by default and SHALL offer a way to reveal the remaining entries. The count shown
alongside the list's heading or summary SHALL always reflect every entry in the
list, not only the portion currently visible. A list short enough to fit already
SHALL render in full, with no such control shown.

The commands a port must replace are exempt: they are grouped by capability and
named compactly rather than given a row each, so every one of them is shown.

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
