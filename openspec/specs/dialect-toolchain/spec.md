# dialect-toolchain Specification

## Purpose

Guarantee a uniform text-to-bytes language toolchain for every registered
target machine: source in the editor tokenizes to authentic program bytes,
imported program bytes detokenize back to editable source, and problems are
reported inline rather than aborting. This uniform contract is what makes new
machines pluggable without changes to the rest of the IDE.
## Requirements
### Requirement: Registered dialects are the available targets

The IDE SHALL offer exactly the set of registered dialects as target machines,
and every capability in this product (editing, running, exporting, AI
assistance) SHALL work against whichever dialect is active. The set SHALL be
presented the same way wherever a machine is chosen, so that switching the
target machine describes the machines as fully as starting a project does.
Presented the same way covers how the list may be narrowed and arranged as well
as how its machines are described, and the narrowing and the arrangement SHALL
be shared: choosing one while switching the target machine SHALL be what
starting a project then finds.

Every registered dialect SHALL declare the BASIC its machine runs, naming both
the version that machine runs and the family that version belongs to, so that
the machines can be arranged and searched by either without reading it out of
prose. Machines running different versions of one BASIC SHALL declare the same
family; machines whose BASICs are not versions of one another SHALL declare
different families, whatever their makers have in common.

The family SHALL NOT stand in for the version anywhere the version is what a
reader needs: a machine that declares a family still declares the version it
runs, and the two SHALL be separately readable.

Where the user is asked what should happen to their code, the question SHALL
state what travels with it and what does not, so that neither the work kept nor
the work discarded is a surprise. It SHALL describe only what the document
actually holds.

#### Scenario: Switching target

- **WHEN** the user selects a different target machine
- **THEN** the editor language, keyboard, emulator, samples, and export
  options all reflect the newly selected dialect

#### Scenario: Switching target describes the machines

- **WHEN** the user goes to switch the target machine
- **THEN** they are offered the same set of machines, described the same way and
  narrowed and arranged the same way, as when creating a project

#### Scenario: Narrowing the list in one place narrows it in the other

- **WHEN** the user narrows or rearranges the machine list while switching the
  target machine, and then opens it again while creating a project
- **THEN** the list is narrowed and arranged as they left it

#### Scenario: Every machine names its BASIC

- **WHEN** the machines are arranged by the BASIC they run
- **THEN** every registered machine appears under the name of a family of BASIC,
  and none is left unaccounted for

#### Scenario: A machine's version is readable alongside its family

- **WHEN** the user reads a machine that runs a later version of a BASIC other
  machines in its family run earlier versions of
- **THEN** the version that machine runs is named, and is not replaced by the
  name of its family

#### Scenario: Switching target still asks about the user's program

- **WHEN** the user switches the target machine while holding code that the new
  machine cannot take as it stands
- **THEN** they are still asked what should happen to that code before the
  switch is applied

#### Scenario: The question says what comes with the code

- **WHEN** the user is asked what should happen to their code, while the
  document holds memory blocks, scratch buffers, or files a run saved
- **THEN** the question states which of those come across with the code and
  which are discarded

### Requirement: Tokenization reports errors without throwing

Tokenizing source SHALL produce the program bytes, a full loadable memory
image, and the program's byte size, together with a list of errors (each
carrying a 1-based line and 0-based column). Invalid source SHALL never abort
tokenization with an exception.

#### Scenario: One bad line among good ones

- **WHEN** the user tokenizes a program in which a single line is invalid
- **THEN** an error identifies that line and column, and the other lines are
  still processed

### Requirement: Detokenization round-trips imported programs

Importing a native program image SHALL recover editable source such that
re-tokenizing that source reproduces an equivalent program. Where the text
form cannot capture everything in the image, the import SHALL report what
was lost rather than dropping it silently.

#### Scenario: Lossless import

- **WHEN** the user imports a native program image that the text form can
  fully represent
- **THEN** re-tokenizing the recovered source yields the same program bytes

#### Scenario: Lossy import is flagged

- **WHEN** an imported image contains content the text form cannot represent
- **THEN** the user is told what could not be captured

### Requirement: Charset mapping is bidirectional

Each dialect SHALL map its machine character codes to unicode (block graphics
and escape sequences) and back, so that a program written with those
characters displays faithfully in the editor and encodes correctly on the
machine.

Where unicode provides an exact character for one of the machine's graphics
glyphs, that character SHALL be the canonical text form the dialect produces
when it renders that code. A spelling that was canonical before SHALL still be
accepted when reading a program, and SHALL encode to the same machine code, so
that no previously saved program becomes unreadable.

Where the machine shows one stored byte as either a graphics shape or a
letter depending on the display state in force when it is shown, the graphics
shape SHALL be that byte's canonical editor form. A byte's text form SHALL
NOT vary with the contents of other bytes: the editor shows one spelling, and
the program still encodes byte-exactly whichever way the machine would have
displayed it.

Where the machine draws the same graphics shape from more than one character
code, at most one of those codes SHALL use the unicode character for that
shape, so that every text form encodes back to exactly one machine code. The
remaining codes SHALL keep a text form that is distinguishable from it and
from each other, and a program using them SHALL still export and re-import
byte-exactly.

A graphics character the machine stores as one byte SHALL be one character in
the editor, including where the machine's own shape for it is undefined (the
user-defined graphics), so that editing cannot leave half of one behind.

#### Scenario: Block graphics survive the round trip

- **WHEN** the user writes a program using the dialect's block-graphic
  characters and runs it
- **THEN** the emulator screen shows the same graphics the editor showed

#### Scenario: A graphics character has one canonical form

- **WHEN** a program containing a machine graphics character that unicode can
  express exactly is rendered into the editor
- **THEN** it appears as that unicode character rather than as an escape
  sequence

#### Scenario: An older spelling still loads

- **WHEN** the user opens a program that spells a graphics character the way
  the dialect used to render it
- **THEN** the program loads, that character encodes to the same machine code
  as before, and it is shown in the canonical form

#### Scenario: A context-dependent byte keeps one spelling

- **WHEN** the user imports a program that stores a byte the machine would
  display as a letter in one display state and as a graphics shape in another
- **THEN** the editor shows the graphics shape, and exporting the program
  writes back the identical byte

#### Scenario: Two codes for one shape keep separate spellings

- **WHEN** the user imports a program using a character code that draws the
  same shape as another code on the same machine
- **THEN** it is shown in a form distinct from the other code's, and exporting
  the program writes back the identical byte rather than the other code

#### Scenario: A user-defined graphic is a single character

- **WHEN** the user inserts one of the machine's user-defined graphics and then
  deletes it with a single backspace
- **THEN** the whole graphic is removed, leaving no fragment of it in the
  program

### Requirement: Opaque binary line records are preserved

For dialects that support them, opaque binary program-line records embedded in
the source (the hidden machine-code trick from imported images) SHALL pass
through tokenization verbatim and SHALL survive editing operations such as
renumbering and AI merges untouched.

#### Scenario: Renumber around a binary record

- **WHEN** the user renumbers a program containing an opaque binary line
  record
- **THEN** the record's bytes are unchanged in the tokenized output

### Requirement: BASIC dialect variants are honoured per machine

Where registered machines run different versions of the same BASIC, each
machine's toolchain SHALL accept exactly the keywords that machine's BASIC
provides. A keyword introduced by a later version SHALL be usable on the
machines that have it and SHALL be reported as an error, at its line and
column, on the machines that do not — rather than being silently accepted,
silently dropped, or tokenized to a byte the machine cannot run. Source using
only the shared, earlier version of the language SHALL produce equivalent
program bytes on every machine in that family.

#### Scenario: A later-version keyword on a machine that has it

- **WHEN** the user writes a keyword introduced by a later version of the
  machine's BASIC, with that machine selected as the target
- **THEN** the program tokenizes without error and runs on the emulator

#### Scenario: The same keyword on an earlier machine in the family

- **WHEN** the user writes that same keyword with an earlier machine of the
  same BASIC family selected as the target
- **THEN** an error identifies the line and column, and the keyword is not
  tokenized

#### Scenario: Shared-version source is portable within the family

- **WHEN** the user writes a program using only keywords common to every
  version of that BASIC
- **THEN** tokenizing it against any machine in the family yields equivalent
  program bytes

#### Scenario: Reference documentation marks version-only keywords

- **WHEN** the user consults the language reference for a BASIC family whose
  machines run different versions
- **THEN** each keyword that only some of those machines provide is marked with
  the version that introduced it

### Requirement: The language reference is organised by BASIC family

The language reference SHALL carry one page per family of BASIC rather than one
page per machine, so that machines running versions of one BASIC are read
together. Every registered machine SHALL read from the page of the family it
declares, and every page SHALL be the page of a family some registered machine
declares — the reference SHALL offer no page no machine reads from, and leave no
machine without one.

A page SHALL be titled by the name of the family it covers, and SHALL name the
machines it covers and the version each of them runs, so that a reader arriving
at a family page can tell which of its material applies to the machine they are
using.

Where a page's material belongs to only some of its machines, it SHALL say which
— a machine SHALL NOT be offered a keyword, a control code or a hardware figure
that belongs to a relative it shares the page with.

Reorganising the reference SHALL NOT strand a reader who arrives at where a page
used to be: a moved page SHALL leave its former address reachable and pointing at
the page that replaced it.

#### Scenario: Machines running one BASIC share its page

- **WHEN** the user consults the language reference for a machine that runs a
  version of a BASIC other registered machines also run
- **THEN** one page covers that BASIC, naming each machine that runs it and the
  version each runs

#### Scenario: A BASIC that is not a version of another keeps its own page

- **WHEN** the user consults the language reference for a machine whose BASIC is
  not a version of any other registered machine's BASIC
- **THEN** that BASIC has its own page, whatever it shares with other machines
  by maker or by ancestry

#### Scenario: Every machine is reachable and no page is empty

- **WHEN** the user reads the list of BASICs the language reference covers
- **THEN** every registered machine is accounted for under one of them, and each
  page listed is read from by at least one registered machine

#### Scenario: Material only some of a page's machines have

- **WHEN** the user reads a family page covering their machine and a relative
  that has a keyword or a control code their machine does not
- **THEN** that material is marked as the relative's, rather than read as the
  page's

#### Scenario: Arriving at a page that has moved

- **WHEN** the user follows a link to the address a reference page used to have
- **THEN** they reach the page that now covers that machine's BASIC, rather than
  a missing page

### Requirement: The language reference describes arguments one way

Every BASIC reference page SHALL describe the arguments a command, function or
operator takes in one shared notation: one vocabulary of argument names, and one set
of rules for marking which arguments are optional, which alternatives are accepted,
which parts repeat, and which parts are the literal text the user types. A reader who
has learned to read one dialect's page SHALL be able to read every other dialect's
page without relearning.

Where two machines take the same argument in the same position, both pages SHALL
describe it identically, so that any visible difference between two pages is a
difference between the two BASICs rather than between the two pages.

Where a command's arguments mean materially different things — a sound channel and a
pitch, a screen coordinate and a colour, an address and the byte stored at it — each
argument SHALL be named for what it is, rather than all of them being named for their
shared type. A reader SHALL be able to tell which argument is which from the reference
entry alone, without inferring it from the description or from a hardware page.

#### Scenario: Reading the same command on two machines

- **WHEN** the user consults the reference entry for a command that two machines both
  provide, and both machines take the same arguments
- **THEN** both pages describe those arguments identically

#### Scenario: A command whose arguments mean different things

- **WHEN** the user consults the reference entry for a command taking several arguments
  of the same type but with different meanings
- **THEN** each argument is named for its meaning, and the reader can tell which
  position carries which

#### Scenario: Meeting an unfamiliar argument name

- **WHEN** the user meets an argument name they do not recognise on a reference page
- **THEN** that page states what it means, for every argument name that page uses, and
  states nothing for names it does not use

#### Scenario: Learning how the notation itself works

- **WHEN** the user wants to know what the optional, alternative, repetition and
  literal markings mean
- **THEN** that is explained once and reachable from every dialect's reference page

#### Scenario: A machine's real syntax outranks the notation

- **WHEN** a machine genuinely requires a punctuation, spacing or literal form that the
  shared notation would otherwise smooth away
- **THEN** the reference entry shows what the machine actually requires

### Requirement: Commodore shifted-letter abbreviations tokenize to the keyword

The Commodore machines' own tokenizer lets a keyword be typed as a prefix
ending in a shifted letter — `pO` for `POKE`, `gO` for `GOTO` — resolved to
the first word in the machine's reserved-word order that the prefix and
letter begin. Archive listings use this notation throughout, and a program
pasted from one must mean what it meant on the machine.

On the Commodore machines, tokenizing SHALL accept a shifted-letter
abbreviation and produce the same token the full spelling produces, resolved
in the machine's own reserved-word order. Keywords spelled in full SHALL keep
tokenizing exactly as they do today, whatever their case, so the abbreviation
reading applies only where no full spelling matches. Each machine SHALL
resolve against its own keyword table.

Listing a program back SHALL expand abbreviations to the full spelling, as
the machines' own LIST does; the abbreviation is entry notation, not stored
text.

An abbreviation inside a string, a comment, or data SHALL NOT be read as a
keyword, as full-spelling keywords are not.

#### Scenario: A magazine listing pastes correctly

- **WHEN** a program containing `pO53280,0` is tokenized for a Commodore
  machine
- **THEN** the line produces the same bytes as `POKE53280,0`

#### Scenario: Resolution follows the machine's word order

- **WHEN** an abbreviation's prefix and shifted letter begin more than one of
  the machine's keywords
- **THEN** it resolves to the first in the machine's own reserved-word order,
  as the machine itself resolves it

#### Scenario: Full spellings are unchanged

- **WHEN** a program spells its keywords in full, in any mix of case
- **THEN** it tokenizes exactly as it did before abbreviations were accepted

#### Scenario: Listing expands

- **WHEN** a program entered with abbreviations is listed back
- **THEN** every keyword appears in its full spelling

#### Scenario: An abbreviation inside a string

- **WHEN** a string literal or comment contains text shaped like an
  abbreviation
- **THEN** it is kept as text, not read as a keyword

### Requirement: The language reference notes and finds a keyword's short spellings

A reader consulting a reference page has usually arrived from a listing, and a
listing spells keywords the way they were typed. Someone reading `P.` or `?`
needs the page to answer *what is this*, which a table indexed only by canonical
spelling cannot do.

Every BASIC reference page SHALL show, against each keyword, the short spellings
the machine accepts for it — the abbreviated prefix, the symbol standing for the
whole command, or both where the machine has both. A keyword the machine has no
short spelling for SHALL show none, and a page whose machines have none SHALL
say nothing about spellings at all.

Searching a reference page SHALL match a keyword's short spellings as well as
its name, so a spelling copied out of a listing finds its row.

Where a page covers several machines, a spelling SHALL be shown only where every
machine that has the row reads it the same way; a machine-specific row SHALL
show its own machine's spelling.

Every spelling shown SHALL be one the machine's own tokenizer reads as that
keyword — the page states what the machine does, never a plausible spelling it
would reject or read as something else.

#### Scenario: Looking up a spelling read in a listing

- **WHEN** the user searches a reference page for a short spelling
- **THEN** the keyword it stands for is among the results

#### Scenario: Reading a keyword's own entry

- **WHEN** the user reads the entry for a keyword the machine lets them type
  short
- **THEN** the entry shows the short spellings alongside the canonical one

#### Scenario: A machine that abbreviates nothing

- **WHEN** the user reads a reference page for a machine whose keywords arrive
  by keystroke rather than as a spelling
- **THEN** no short spellings are shown or searched for

#### Scenario: A row belonging to one machine on a shared page

- **WHEN** a reference page covers several machines and a row exists on only one
  of them
- **THEN** the spelling shown is the one that machine reads

### Requirement: Lines a machine takes without a line number

Where a machine's own BASIC takes a command typed without a line number, and
its listings are written that way, the dialect's toolchain SHALL accept such a
line in the program text rather than reporting it as a line missing its number.
Which words may stand on an unnumbered line SHALL be exactly the ones that
machine takes that way; every other unnumbered line SHALL still be reported as
missing its line number, at that line.

An unnumbered line SHALL be accepted wherever it appears in the program, since
listings put them both before the program and after it. Unnumbered lines SHALL
contribute no program bytes and SHALL take no part in the ascending order the
numbered lines are held to.

A word accepted on an unnumbered line SHALL still be refused inside a numbered
line wherever the machine refuses it there, so that what the toolchain accepts
in each position is what the machine accepts.

Where an unnumbered line is malformed - an argument missing, out of range, or
contradicting an earlier one - the toolchain SHALL report it at its line and
column like any other error, rather than dropping the line or ignoring it.

Dialects whose machines require a line number on every line SHALL be unaffected,
and SHALL continue to report a missing line number for any unnumbered line.

#### Scenario: A listing that opens with unnumbered commands

- **WHEN** the user opens a program whose first lines hold that machine's
  unnumbered commands, followed by numbered program lines
- **THEN** the program tokenizes without error and runs

#### Scenario: An unnumbered command after the program

- **WHEN** a program ends with one of those commands on an unnumbered line
- **THEN** it is accepted, and the numbered lines above it are unaffected

#### Scenario: An unnumbered line that is not one of them

- **WHEN** an unnumbered line holds a statement the machine would only take
  inside a numbered line
- **THEN** an error identifies that line as missing its line number

#### Scenario: The same word inside a numbered line

- **WHEN** one of those commands is written inside a numbered line on a machine
  that refuses it there
- **THEN** an error identifies its line and column, as it did before

#### Scenario: A malformed unnumbered line

- **WHEN** an unnumbered command is given an argument the machine would reject
- **THEN** an error identifies that line and column, and the rest of the program
  is still processed

#### Scenario: A machine that requires line numbers

- **WHEN** the same unnumbered text is written with a machine selected whose
  BASIC requires a line number on every line
- **THEN** an error identifies that line as missing its line number

### Requirement: A declared workspace survives export and import

Where a program declares the bounds of its workspace, exporting it SHALL record
those bounds with it, and importing that image SHALL recover source that
declares them again - so that re-tokenizing what was imported rebuilds the same
workspace rather than the machine's default.

Where the user must address the machine's own memory by hand to load or save an
exported program, the instructions shown SHALL name the range that program
actually occupies, rather than the range a program that took the default would.

#### Scenario: A declared workspace round-trips

- **WHEN** the user exports a program that declares its own workspace and
  imports the result
- **THEN** the recovered source declares the same workspace, and re-tokenizing
  it reproduces the same image

#### Scenario: Transfer instructions follow the program

- **WHEN** the user is shown how to load a program that declared its own
  workspace onto real hardware
- **THEN** the memory range named is the one that program occupies

### Requirement: A workspace the program declares is honoured

Where a machine's BASIC lets a program declare the bounds of the memory its
program and variables share, and the dialect accepts that declaration in the
program text, the declared bounds SHALL be carried into the loadable image, so
that running the program gives it the workspace it asked for rather than the
machine's default.

The program's size SHALL be budgeted against the declared workspace, so that a
program is reported as too large only when it does not fit the workspace it
asked for. Bounds the machine could not hold - inverted, or outside its fitted
memory - SHALL be reported as errors at their line and column, and SHALL not be
carried into an image. Where the same bound is declared more than once, the last
declaration SHALL be the one that takes effect.

An unnumbered command that cannot change what is built SHALL be accepted and
preserved without comment. Reporting each one would be worse than silence: the
run gate refuses a program with any error against it, fatal or not, so a listing
would stop being runnable because it ends the way listings end. What each command
does on an unnumbered line SHALL instead be stated in the machine's language
reference.

#### Scenario: A program asks for a larger workspace

- **WHEN** the user runs a program that declares bounds giving it more room than
  the machine's default
- **THEN** the program runs with that larger workspace, and its size is measured
  against it

#### Scenario: A program too large for the workspace it asked for

- **WHEN** a program declares a workspace smaller than the program itself needs
- **THEN** the user is told the program does not fit the workspace it asked for

#### Scenario: Bounds the machine cannot hold

- **WHEN** a program declares bounds outside the machine's fitted memory, or a
  lower bound above its upper bound
- **THEN** an error identifies that line and column

#### Scenario: A command with nothing to change

- **WHEN** a program holds an unnumbered command that cannot affect a stored
  program
- **THEN** the line is kept as it stands and the program still builds and runs,
  with nothing reported against it

### Requirement: Letter case is declared per machine

Letter case is not one fact about a machine but several, and the registered
machines disagree on each of them independently. Every registered machine SHALL
therefore declare, as facts about its ROM rather than as a shared rule:

- whether its character generator can draw lower case at all, and whether the
  lower case it has belongs to a second character set the machine switches to at
  run time rather than being always available;
- whether its ROM's own keyword scan accepts a lower-case spelling of a keyword;
- whether its ROM tells `A` from `a` in a variable name;
- what the machine's own text encoding does with a lower-case letter — folds it
  onto the upper-case character, or preserves it as its own.

The last of these SHALL be stated for each machine rather than inferred from the
first, because the two do not agree everywhere: a machine may have lower-case
shapes and still fold, where one stored character draws either case depending on
the set in force.

Whether a lower-case keyword is read as a keyword by the IDE SHALL follow both
the ROM's keyword scan and the machine's text encoding, since a machine whose
encoding folds never presents lower case to its ROM at all. Where a dialect
chooses to accept a spelling its ROM would refuse, so that a listing written in
lower case can be read, that leniency SHALL be declared rather than assumed.

#### Scenario: A machine whose encoding folds lower case

- **WHEN** a program on a machine whose text encoding has no lower-case
  characters stores a lower-case letter
- **THEN** it is stored as the upper-case character, and a lower-case keyword in
  that program is read as the keyword

#### Scenario: A machine whose encoding preserves lower case

- **WHEN** a program on a machine whose text encoding has lower-case characters
  stores a lower-case letter
- **THEN** it is stored as the lower-case character, and listing the program
  back returns the lower case it was written in

#### Scenario: A machine with a switchable character set

- **WHEN** the declared facts are read for a machine that carries its lower case
  in a second character set selected at run time
- **THEN** the machine is declared as having lower case, and as switching
  between the sets, rather than as having none

#### Scenario: A machine with lower-case shapes whose encoding still folds

- **WHEN** the declared facts are read for a machine that can draw lower case
  but whose stored characters do not distinguish the two cases
- **THEN** it is declared as having lower case and as folding it, and the two
  facts do not contradict one another

### Requirement: A lower-case keyword is reported where it will not run

Where a machine's text encoding preserves lower case and its ROM's keyword scan
compares characters rather than folding them, a keyword spelled in lower case is
not a keyword on that machine — it is a name, and the program will not do what
its author meant. The IDE SHALL report such a spelling, naming the upper-case
spelling the machine wants.

The report SHALL NOT prevent the program being built, run or exported: it says
what the machine will make of the program, and the author decides.

Where a dialect's own reading accepts such a spelling anyway, so that a listing
written in lower case can be opened and read, it SHALL still report it. Being
lenient about what can be opened is not a claim that the machine will run it.

Machines whose encoding folds lower case, or whose ROM accepts either case, SHALL
NOT report anything: on those machines a lower-case keyword is the keyword.

#### Scenario: A lower-case keyword on a machine that refuses it

- **WHEN** a program on a machine whose ROM matches keywords by character spells
  a command in lower case
- **THEN** the editor reports it and names the upper-case spelling, and the
  program can still be built, run and exported

#### Scenario: A lower-case keyword on a machine that folds

- **WHEN** a program on a machine whose text encoding folds lower case spells a
  command in lower case
- **THEN** nothing is reported, and the command is read as the keyword

#### Scenario: A dialect that reads a spelling its machine would refuse

- **WHEN** a listing spelled in lower case is opened on a machine whose ROM
  would refuse it, and the dialect reads it as the keyword anyway
- **THEN** the spelling is still reported, so the reader learns the machine will
  not run it as written

