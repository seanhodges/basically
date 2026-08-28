# code-editor Specification

## Purpose

Give every dialect a first-class BASIC editing experience from one generic
editor: authentic keyword highlighting, dialect-aware completion, inline
diagnostics as you type, and line-number management — all driven by the
active dialect's own data, with no per-machine editor code.
## Requirements
### Requirement: Dialect-aware highlighting and completion

The editor SHALL highlight the active dialect's keywords and offer completion
for its keywords, the program's own variables, and common statement
constructs. For dialects whose machines ignore spacing when tokenizing, the
editor SHALL recognise keywords the same way the machine would (e.g. keywords
embedded in identifier runs).

The editor SHALL treat the items of a `DATA` statement the way the dialect's
machine does: as variables where the machine evaluates them, and as values —
never names — where it takes them literally.

The editor SHALL read a word spelled in lower case as a keyword only on the
machines that would read it as one. Where a machine would not — its encoding
preserves lower case and its ROM matches keywords by character — the word SHALL
be treated as a variable name throughout: coloured as a name, offered among the
program's variables, listed in its structure, and renamed with it. The editor
SHALL NOT colour a word as a keyword while its checks report the same word as
something else.

#### Scenario: Crunched keyword recognised

- **WHEN** the user types a statement with no spaces on a dialect whose
  machine matches keywords greedily
- **THEN** the embedded keywords are highlighted as the machine would read
  them

#### Scenario: DATA items on a machine that takes them literally

- **WHEN** a program lists unquoted words as the items of a `DATA` statement on
  a dialect whose machine READs those items literally
- **THEN** those words are not offered as variable completions and are not
  reported by the editor's variable checks

#### Scenario: DATA items on a machine that evaluates them

- **WHEN** a program names a variable inside a `DATA` statement on a dialect
  whose machine evaluates those items
- **THEN** that name is treated as a use of the variable, offered as a
  completion and checked like any other

#### Scenario: A lower-case keyword on a machine that reads it as a name

- **WHEN** a program on a machine whose ROM matches keywords by character spells
  a keyword in lower case
- **THEN** it is coloured as a variable name rather than as a keyword, and it
  appears among the program's variables and in its structure

#### Scenario: A lower-case keyword on a machine that reads it as a keyword

- **WHEN** a program on a machine whose encoding folds lower case, or whose ROM
  accepts either case, spells a keyword in lower case
- **THEN** it is coloured as the keyword, and it is not reported as a variable

### Requirement: Machine graphics characters are legible

Every character the active machine's character set can express SHALL be
displayed as its own shape wherever the IDE shows program text, rather than as a
missing-glyph box, and SHALL NOT depend on which fonts are installed on the
user's device.

Displaying a graphics character SHALL NOT change the height or alignment of the
line it appears on, and SHALL NOT dim it relative to the program text around it.

#### Scenario: Block graphics on a device without a suitable font

- **WHEN** the user opens a program containing the machine's block graphics on a
  device whose installed fonts do not cover them
- **THEN** the graphics are shown as their actual shapes

#### Scenario: A graphics character does not disturb the line

- **WHEN** a graphics character is inserted into a line of an otherwise plain
  program
- **THEN** that line keeps the same height and stays aligned with its line
  number and with the lines around it

#### Scenario: A graphics character is as readable as the code around it

- **WHEN** a program containing machine graphics characters is shown in the
  editor
- **THEN** those characters are drawn in the same weight of colour as the
  program's literals, not in the muted style the editor uses for text it does
  not recognise

### Requirement: Inline diagnostics while typing

The editor SHALL run the dialect's linter as the user types (debounced) and
display each error inline at its line and column, without a manual check step.

Where the active dialect's machine allows several statements on one line, the
linter SHALL apply its statement checks to every statement on the line, not
only the first, including a statement introduced by a conditional's `THEN`.
A statement that does not open the way the machine requires SHALL be reported
once, and reported alike wherever on the line it sits — the first statement is
not held to a different standard from the ones that follow it.

Where the active dialect's machine takes only one statement per line, a line
carrying more than one SHALL be reported, at the point the second statement
begins. A separator character appearing as ordinary text — inside a string or a
comment — SHALL NOT be reported.

A diagnostic's reported position SHALL account for any leading whitespace on
the line, so an indented line's errors are marked at the characters they
actually refer to.

A statement-shape diagnostic — a report that a statement does not open the way
the machine requires, or that a line carries more statements than the machine
allows — SHALL NOT by itself prevent the program from being built or exported,
since the machine would store such a line and object only when it runs.

#### Scenario: Error appears and clears

- **WHEN** the user types an invalid statement and then corrects it
- **THEN** an inline diagnostic appears at the offending position and
  disappears once corrected

#### Scenario: A bad statement after a separator

- **WHEN** the user writes a line whose first statement is valid but whose
  second statement, after the machine's statement separator, does not open with
  a valid statement keyword
- **THEN** an inline diagnostic marks that second statement

#### Scenario: A bad statement opening the line

- **WHEN** the first statement on a line does not open with a valid statement
  keyword
- **THEN** one inline diagnostic marks it, and the program still builds and can
  still be exported

#### Scenario: A valid multi-statement line is clean

- **WHEN** the user writes a line of several valid statements separated by the
  machine's separator, including empty statements and a trailing separator
- **THEN** no diagnostic is reported for that line

#### Scenario: Several statements on a one-statement-per-line machine

- **WHEN** the active machine takes only one statement per line and the user
  writes a line carrying several
- **THEN** one inline diagnostic marks the line where its second statement
  begins, and the program still builds and can still be exported

#### Scenario: The separator as ordinary text

- **WHEN** the active machine takes only one statement per line and the
  separator character of another machine appears inside a string or a comment
- **THEN** nothing is reported for that line

#### Scenario: An indented line marks the right characters

- **WHEN** an invalid statement appears on a line that begins with whitespace
- **THEN** the diagnostic is positioned at the offending token, not displaced
  by the width of the indent

#### Scenario: A statement-shape error still runs

- **WHEN** a program's only diagnostics are statement-shape reports
- **THEN** the program still builds a runnable image and can still be exported
  to hardware

### Requirement: The RAM budget is always visible

The IDE SHALL continuously show the tokenized program's byte size against the
machine's available program RAM, so the user can see headroom before running.

The figure it is shown against SHALL be the RAM the machine itself leaves free
for a BASIC program at its Ready prompt, on the machine as the IDE emulates it.
It SHALL NOT exceed what that machine reports free, so a program the IDE says
fits is a program the machine can hold. It MAY be smaller where the machine
spends RAM out of the program area as a program runs — a display file that grows
with the screen, for instance — so that the headroom shown is headroom a running
program still has.

#### Scenario: Growing program

- **WHEN** the user adds lines to the program
- **THEN** the byte counter updates to reflect the new tokenized size

#### Scenario: The budget matches the machine

- **WHEN** the user compares the budget shown while editing with the free figure
  the same machine reports once it is running
- **THEN** the two agree, rather than the budget promising memory the machine
  does not have

#### Scenario: Changing machine changes the budget

- **WHEN** the user switches the program to a machine with less program RAM
- **THEN** the same program is measured against the new machine's smaller figure,
  and reports as closer to full

### Requirement: Line-number management

The editor SHALL support automatic line numbering while typing and a
renumbering command that rewrites line numbers (and, where the dialect uses
them, line-number references) consistently.

Where the active dialect accepts lines without a line number, those lines SHALL
keep their text and their place: renumbering SHALL neither number them nor
reorder them among the numbered lines around them, and automatic numbering
SHALL NOT put a number on one. This SHALL NOT change what happens on a dialect
that requires a line number on every line, where an unnumbered line is still
given one.

#### Scenario: Renumber a program

- **WHEN** the user renumbers a program
- **THEN** lines are renumbered in even increments and remain in the same
  order, and the program still tokenizes cleanly

#### Scenario: Renumber around a line the dialect takes unnumbered

- **WHEN** the user renumbers a program that holds a line the active dialect
  accepts without a line number
- **THEN** that line is unchanged and still sits between the same lines it did
  before

#### Scenario: Typing on a line the dialect takes unnumbered

- **WHEN** automatic numbering is on and the user presses Enter on a line the
  active dialect accepts without a line number
- **THEN** that line keeps its text and is not given a number

#### Scenario: An unnumbered line on a machine that requires numbers

- **WHEN** automatic numbering is on and the user presses Enter on an unnumbered
  line with a dialect selected that requires a line number on every line
- **THEN** the line is numbered, as it was before

### Requirement: Opaque binary lines display as chips

On dialects that support opaque binary line records, the editor SHALL
collapse each record to a compact chip rather than exposing raw encoded text,
while keeping the record intact in the underlying document.

#### Scenario: Imported program with machine code

- **WHEN** the user imports a program containing binary line records
- **THEN** each record shows as a chip in the editor and the program still
  runs with its machine code intact

### Requirement: Display control codes show as chips

Where a dialect writes the machine's display control codes as named escapes in
program text, the editor SHALL show each one as a compact chip picturing what
the code does — including the colour it selects, where it selects one — rather
than as its name spelled out across the line.

The program text SHALL be unchanged by this: the escape still reads, exports
and tokenizes exactly as written, and a chip SHALL be one unit for cursor
movement and deletion, so a single delete removes the whole escape and no edit
can leave part of one behind.

A chip SHALL NOT change the height or alignment of the line it appears on.

An escape the dialect does not name — a raw byte written as its code — SHALL
stay visible as text, so that what it stores is never hidden.

#### Scenario: A teletext colour code in a string

- **WHEN** the user opens a program whose strings carry the machine's display
  control codes
- **THEN** each control code shows as a chip identifying it, and the line
  keeps the height and alignment of the lines around it

#### Scenario: Deleting a control code

- **WHEN** the user puts the cursor after a control-code chip and deletes once
- **THEN** the whole control code is removed from the program, leaving no part
  of the escape behind

#### Scenario: The program text is what was written

- **WHEN** the user runs or exports a program containing control-code chips
- **THEN** the machine receives exactly the bytes the escapes stand for

### Requirement: Program structure at a glance

The editor SHALL offer an outline of the program's structure (such as
procedures, subroutines, or jump targets appropriate to the dialect) that the
user can navigate from.

#### Scenario: Jump from the outline

- **WHEN** the user picks an entry in the program outline
- **THEN** the editor moves the cursor to that line

### Requirement: Find a variable's usages

The editor SHALL let the user pick a variable in the program — by clicking or
tapping it where it is written — and from there see every place that variable is
used. The usages SHALL be highlighted in the text, counted, and navigable, and
the user SHALL be able to dismiss them.

Which occurrences count SHALL follow the active machine rather than the
spelling:

- names SHALL be matched without regard to letter case on the machines whose
  ROM folds it, and with regard to it on the machines that distinguish it;
- on a machine whose ROM keeps only a limited number of a name's characters,
  names the machine cannot tell apart SHALL be reported as one variable;
- a scalar and an array of the same name SHALL be reported as different
  variables, as the machine holds them separately;
- a name that is local to a procedure SHALL be reported only within that
  procedure, and a global name spelled the same SHALL NOT include that
  procedure's local occurrences.

Keyword spellings, text inside string literals and comment text SHALL NOT be
counted as usages of a variable. A word inside a `DATA` statement SHALL be
counted only on the machines whose ROM evaluates its items, and SHALL NOT be on
the machines that take them literally.

Usages SHALL be found in the buffer the editor is showing.

The usages SHALL share the foot of the editor with find/replace rather than
stand alongside it: opening either SHALL take the other away.

#### Scenario: Seeing where a variable is used

- **WHEN** the user picks a variable that the program uses in several places
- **THEN** every one of those places is highlighted and the user is told how
  many there are

#### Scenario: Stepping between usages

- **WHEN** the user asks for the next usage
- **THEN** the editor brings that usage into view and moves the cursor to it,
  continuing from the last usage back to the first

#### Scenario: Letters that are not a variable

- **WHEN** the picked variable's letters also occur inside a keyword, inside a
  string literal, and inside a comment
- **THEN** none of those are highlighted or counted

#### Scenario: A word inside DATA

- **WHEN** the program uses the picked variable's name inside a `DATA`
  statement
- **THEN** it is highlighted only if the machine evaluates its `DATA` items,
  and not if the machine takes them literally

#### Scenario: The same name in a different case

- **WHEN** the program spells the picked variable's name in another letter case
- **THEN** it is highlighted only if the machine treats the two as one
  variable

#### Scenario: Names the machine cannot tell apart

- **WHEN** the user picks a variable on a machine whose ROM keeps only the
  first two characters of a name, and the program also uses a differently
  spelled name that collapses to the same one
- **THEN** both spellings are highlighted, because the machine holds them as a
  single variable

#### Scenario: A name that belongs to a procedure

- **WHEN** the user picks a name that is a procedure's parameter or local
  variable, and the same spelling is also used outside that procedure
- **THEN** only the occurrences inside that procedure are highlighted

#### Scenario: An array and a scalar of the same name

- **WHEN** the user picks an array element, and the program also uses a plain
  variable spelled the same
- **THEN** only the array's occurrences are highlighted

#### Scenario: Dismissing the usages

- **WHEN** the user dismisses the usages, or edits the program
- **THEN** the highlights are removed

#### Scenario: One bar at the foot of the editor

- **WHEN** the user opens find/replace while a variable's usages are shown
- **THEN** the usages, their count and any pending offer are taken away, and
  find/replace takes their place

### Requirement: Look up a keyword in the language reference

The editor SHALL let the user pick a keyword, function name or operator in the program —
by clicking or tapping it where it is written — and from there open the active machine's
language reference showing that keyword. While editing a machine-code block, the editor
SHALL offer the same for an instruction or assembler directive, opening the reference for
that block's processor.

What the editor offers SHALL follow the active machine's own reading of the program text.
Only what that machine reads as a keyword, function, operator or instruction SHALL be
offered; a line number, a number, a variable name, a processor register, text inside a
string literal and text inside a comment SHALL NOT be. Punctuation that separates the
parts of a line SHALL NOT be offered, having nothing to look up.

A keyword written in one of the machine's short spellings — the Acorns' dotted prefix,
the Commodores' shifted letter, a symbol standing for a whole command — SHALL be offered
as the keyword it stands for on that machine, and SHALL open the reference at that
keyword rather than at the spelling. The reference SHALL open at the picked keyword even
where a porting comparison is current, since the user has named what they want to read.

#### Scenario: Looking up a keyword

- **WHEN** the user picks a keyword in their program and takes up the reference offer
- **THEN** the documentation opens at the active machine's reference, showing that
  keyword

#### Scenario: Looking up an operator

- **WHEN** the user picks one of the machine's own operators
- **THEN** the reference offer is made for it, as it is for a keyword

#### Scenario: Looking up a machine-code instruction

- **WHEN** the user picks an instruction or an assembler directive while editing a
  machine-code block
- **THEN** the documentation opens at the reference for that block's processor, showing
  that instruction

#### Scenario: A keyword typed in a short spelling

- **WHEN** the user picks a keyword written in one of the machine's short spellings, as
  a listing prints it
- **THEN** the documentation opens at the keyword that spelling stands for on this
  machine

#### Scenario: Text that is not a keyword

- **WHEN** the user picks a word inside a string literal or a comment, a line number, a
  variable name, or punctuation separating the parts of a line
- **THEN** no reference offer is made

#### Scenario: A keyword lookup while a porting comparison is current

- **WHEN** a porting comparison is current for the open program and the user picks a
  keyword and takes up the reference offer
- **THEN** the documentation opens at that keyword rather than at the comparison

### Requirement: Short spellings are read as the keywords they are

Where a machine lets a program spell a keyword short, the editor SHALL read such a
spelling as that keyword throughout: it SHALL be coloured as the keyword it stands for
rather than as a name or as punctuation, and the letters that make it up SHALL NOT be
reported as a variable.

Which spellings a machine accepts, and which keyword each stands for, SHALL follow that
machine's own resolution order rather than a shared rule — a prefix takes the first
keyword its ROM scans that begins with it, and a prefix that spells a whole keyword is
that keyword rather than an abbreviation.

A short spelling SHALL be read as a keyword only in the letter case its machine's own
scan accepts. On a machine that matches keywords by character, a prefix spelled in a
case the ROM would not accept is a name, and SHALL be read as one.

#### Scenario: A dotted listing

- **WHEN** the user opens a listing on a machine that abbreviates with a trailing dot,
  and it spells a command short
- **THEN** that spelling is coloured as the command, and its leading letters are not
  reported as a variable

#### Scenario: A shifted-letter listing

- **WHEN** the user opens a listing on a machine that abbreviates with a shifted letter,
  and it spells a command short before its arguments
- **THEN** the spelling is coloured as the command and what follows it is read as the
  command's arguments, rather than the whole run being read as one name

#### Scenario: A symbol standing for a whole command

- **WHEN** the program uses a symbol the machine reads as a whole command
- **THEN** it is coloured as that command, and where the command is a comment marker the
  rest of the line is coloured as a comment

#### Scenario: A prefix that spells a whole keyword

- **WHEN** a prefix that could abbreviate a longer keyword is itself a whole keyword on
  this machine
- **THEN** it is read as the whole keyword it spells, not as the abbreviation

#### Scenario: A short spelling in a case the machine would not accept

- **WHEN** a program on a machine that matches keywords by character spells an
  abbreviation in lower case
- **THEN** it is read as a name rather than as the keyword it would abbreviate in
  upper case

### Requirement: One menu for what the picked text can answer

Where picking a token in the program can answer more than one question about it, the
editor SHALL present those offers together in one menu, opened where the token is
written. A question the picked token cannot answer SHALL NOT be offered.

The menu SHALL be dismissible by Escape while it is open, and that keypress SHALL NOT
also dismiss whatever surface stands behind the editor.

#### Scenario: The offers a variable can answer

- **WHEN** the user picks a variable
- **THEN** the menu offers to show where that variable is used, and makes no reference
  offer

#### Scenario: The offers a keyword can answer

- **WHEN** the user picks a keyword
- **THEN** the menu offers the language reference, and does not offer to show usages

#### Scenario: Dismissing the menu

- **WHEN** the menu is open and the user presses Escape
- **THEN** the menu closes, and nothing behind it is dismissed by the same keypress

### Requirement: Editing actions act on the buffer on screen

The editing actions the IDE offers outside the editor itself — undo, redo, cut,
copy, paste and find/replace — SHALL act on the buffer the user is looking at,
matching what the same actions do from the keyboard. They SHALL never act on a
buffer that is not on screen.

Where an action only makes sense for a BASIC buffer, it SHALL be unavailable
while a buffer of another kind is showing, rather than being offered and quietly
acting elsewhere.

Every editable buffer SHALL offer the same set of general editing actions, so
what the IDE can do to the text does not depend on which kind of buffer holds
it.

#### Scenario: Undo on a machine code block

- **WHEN** the user edits a code block's assembly, then invokes Undo from the
  IDE rather than the keyboard
- **THEN** the assembly reverts its last edit, and the BASIC program is
  unchanged

#### Scenario: Find on a machine code block

- **WHEN** the user invokes find/replace while a code block is showing
- **THEN** it searches that block's assembly

#### Scenario: A BASIC-only action while a block is showing

- **WHEN** a code block is showing and the user looks for an action that only
  applies to BASIC, such as renumbering
- **THEN** the action is not available to invoke

### Requirement: Disposable scratch buffers

The editor SHALL let the user create scratch buffers: additional BASIC buffers,
held alongside the program, for writing code that is not part of the program
itself. The user SHALL be able to hold several at once, choose which one the
editor shows, rename one, and close one without being asked to confirm.

A scratch buffer SHALL offer the same editing the program does — the active
dialect's highlighting, completion, inline diagnostics and line-number
management — since it holds the same kind of code.

Editing a scratch buffer SHALL NOT alter the program, and SHALL NOT mark the
document as having unsaved changes. What the document builds, runs, shares or
exports SHALL be the program, never a scratch buffer, whichever buffer the editor
is showing; a saved project carries its buffers alongside that program without
changing it. Which buffer the editor is showing SHALL be apparent to the user.

Each buffer SHALL carry its own edit history. Undo and redo SHALL only ever move
a buffer through its own edits, never bring another buffer's text into it, and
the history SHALL survive showing a different buffer and coming back. Choosing
which buffer to show SHALL NOT itself be an edit, and SHALL NOT be undoable.

Closing a scratch buffer SHALL discard it and everything attached to it.

#### Scenario: A snippet is written without touching the program

- **WHEN** the user creates a scratch buffer and types a program into it
- **THEN** the document's own source is unchanged and the document is not marked
  as having unsaved changes

#### Scenario: Several scratch buffers at once

- **WHEN** the user creates more than one scratch buffer
- **THEN** each keeps its own contents, and choosing one shows that one's
  contents in the editor

#### Scenario: A scratch buffer is edited like the program

- **WHEN** the user types an invalid statement into a scratch buffer
- **THEN** it is diagnosed inline exactly as the same statement would be in the
  program

#### Scenario: Saving while a scratch buffer is showing

- **WHEN** the user saves or shares the document while a scratch buffer is the
  one on screen
- **THEN** the program is what is shared, and what is saved is the program
  together with the scratch buffers held beside it — never the scratch buffer in
  the program's place

#### Scenario: Closing a scratch buffer

- **WHEN** the user closes a scratch buffer
- **THEN** it is discarded without a confirmation step, and the program and any
  other scratch buffers are unaffected

#### Scenario: Undo straight after switching buffers

- **WHEN** the user shows a scratch buffer and immediately undoes
- **THEN** nothing is taken from the program: the scratch buffer either undoes
  one of its own edits or has nothing left to undo, and the program keeps its
  text

#### Scenario: A buffer's history outlives showing another

- **WHEN** the user edits the program, shows a scratch buffer, then shows the
  program again and undoes
- **THEN** the program's own last edit is undone

### Requirement: Saved data files appear as tabs

A data file a running program has saved SHALL be shown in the editor as its own
tab, named as the program named it, arriving as the program writes the file
rather than on the user asking for it. Selecting the tab SHALL show the file's
bytes with their offsets, in hexadecimal and as the characters the machine's own
character set gives them — the same byte view a block's bytes are shown in,
distinguished by counting from the start of the file, since a file has no
address.

Only what the program itself wrote SHALL appear. To serve a program's own
`LOAD`, the IDE hands the machine the document's own content before a run — its
memory blocks, and any tape files imported with it — as files the program can
load by name. Those are the document being given to the machine, not output
coming back, and SHALL NOT be shown as tabs; a file the program then saves over
one of them SHALL appear like any other.

The bytes SHALL be shown read-only. A data file is neither kept with the
document nor returned to the machine, so there is nothing an edit to one could
change; it is a view onto what the program produced.

The tab SHALL offer the file for download both as its raw bytes and as text,
SHALL offer to copy it into a block of the document's memory, and SHALL let the
user discard it, from the same menu a block's tab offers its own downloads.

Saved files SHALL compete for room in the strip under the same rule as every
other tab, and SHALL in addition be held to a bounded share of the tabs shown.
A program can write files without limit, and while the strip is the machine's
way of reporting them, it is the user's way back to their own work: no amount of
saving SHALL displace every block and scratch buffer the user opened, and files
beyond what is shown SHALL remain reachable like any other overflowing tab.

#### Scenario: A tab appears as the program writes

- **WHEN** a running program saves a data file
- **THEN** a tab named after that file appears in the editor, and selecting it
  shows the bytes the program wrote

#### Scenario: What the IDE handed the machine is not shown back

- **WHEN** a program whose document has memory blocks is run, and the machine is
  given those blocks as files the program can load
- **THEN** no tab appears for them — the tabs are the files the program saved

#### Scenario: The file's bytes cannot be edited

- **WHEN** the user selects a saved data file's tab and types into the bytes
- **THEN** nothing changes, and it is clear the view is read-only

#### Scenario: The file can be downloaded from its tab

- **WHEN** the user asks, from a saved data file's tab, to download it
- **THEN** they can save it as its raw bytes or as text

#### Scenario: The file can be copied into a block from its tab

- **WHEN** the user opens the menu of a saved data file's tab
- **THEN** copying the file into a block of memory is offered there, alongside
  its downloads

#### Scenario: Many saved files do not crowd out the program

- **WHEN** a running program saves more files than the tab strip shows at once
- **THEN** the strip still shows the program's own tabs, and the files beyond
  the bound are still reachable

#### Scenario: A discarded file's tab closes

- **WHEN** the user discards a saved data file from its tab
- **THEN** the tab closes and the editor returns to the program

### Requirement: The editor's variable checks follow the machine's case rule

Whether two spellings of a name are one variable or two SHALL be decided the same
way everywhere the editor answers that question — when it reports a collision
between names the machine cannot tell apart, when it highlights a name's usages,
when it offers completions, and when it renames. On a machine that tells `A` from
`a`, no two names differing only in case SHALL be reported as colliding; on a
machine that folds them, they SHALL be treated as one name throughout.

Where the editor quotes a name back to the reader, it SHALL quote the spelling
the program uses rather than a folded form of it.

#### Scenario: Two cases of a name on a machine that distinguishes them

- **WHEN** a program on a case-sensitive machine uses two names that differ only
  in letter case
- **THEN** the editor's variable checks report no collision between them, and its
  usages view treats them as two variables

#### Scenario: Two cases of a name on a machine that folds them

- **WHEN** a program on a machine that folds letter case uses two names that
  differ only in case
- **THEN** the editor treats them as one variable in its checks and its usages
  view alike

#### Scenario: A name quoted back to the reader

- **WHEN** the editor reports something about a name the program spells in lower
  case
- **THEN** it quotes the name as the program spells it

### Requirement: Characters the machine will change are reported

A machine stores only the characters its own character set has, and where a
program uses one it does not, the IDE converts it silently — most often by
folding a lower-case letter onto its upper-case character. The program still
runs, but the listing on screen is no longer the listing the machine holds, and
typing or pasting it into the real machine would not reproduce it.

The IDE SHALL report, for the open program, that it contains characters the
target machine would change, and how many. The report SHALL name the conversion
rather than merely counting it, so the reader learns what the machine does to
their program.

The report SHALL NOT be an error: it SHALL NOT prevent the program being built,
run, exported or shared, and it SHALL NOT mark any position in the source as
faulty. Where the program contains no such character, nothing SHALL be reported
rather than a report of none.

Characters the machine cannot store at all are not this report's business —
those already fail to build and are reported where they occur.

The report SHALL count only what the reader wrote as text. A character forming
part of the notation the machine's own listings use — an escape naming a control
code, a raw byte, a graphics character, or a short keyword spelling — SHALL NOT
be counted, whatever letters that notation is spelled with.

Where a machine carries its lower case in a character set the program can switch
to, lower case SHALL NOT be counted after the program switches to that set, and
SHALL be counted again after it switches back. The switch SHALL be recognised as
the machine's own listings write it.

#### Scenario: A listing that folds

- **WHEN** a program on a machine with no lower case contains lower-case letters
- **THEN** the IDE reports that the listing contains characters the machine will
  change, and how many, and the program still runs

#### Scenario: A listing that survives unchanged

- **WHEN** every character a program uses is one the target machine stores as
  written
- **THEN** nothing is reported about changed characters

#### Scenario: A character stored as a different one

- **WHEN** a program uses a character the machine stores as another character of
  its own set
- **THEN** it is counted among the characters the machine will change

#### Scenario: Notation is not text

- **WHEN** a program uses an escape, a raw byte or a short keyword spelling whose
  notation contains lower-case letters
- **THEN** none of it is counted, because none of it is text the machine stores
  as written

#### Scenario: A program that switches to the machine's lower-case set

- **WHEN** a program switches the machine to its lower-case character set and
  then writes lower-case letters
- **THEN** those letters are not counted, and letters written after a switch back
  are counted again

### Requirement: Strict characters mode

Some readers would rather the editor hold them to what the target machine can
store than convert on their behalf. The IDE SHALL offer a Strict characters
setting that turns silent conversion into refusal, and SHALL default it off.

While it is on, every character the IDE would report as one the machine will
change SHALL instead be reported as an error at the position it occupies, and
SHALL be treated exactly as the editor treats any other error — including
preventing the program from being run or shared. Which characters those are
SHALL be decided the same way whether the setting is on or off, so that the
count the IDE reports and the errors it raises can never disagree about the same
program.

While it is off, the IDE SHALL behave exactly as it does without this setting:
the character is converted, the program builds, and only the count is reported.

The setting SHALL apply to what the reader wrote, not to how the IDE stores it:
a program refused under this setting SHALL be refused for characters visible in
the source, never for a conversion made elsewhere in the build.

#### Scenario: A converted character with the setting on

- **WHEN** Strict characters is on and a program on a machine with no lower case
  contains a lower-case letter written as text
- **THEN** it is reported as an error at that position, and the program will not
  run until it is changed

#### Scenario: The same program with the setting off

- **WHEN** Strict characters is off and the same program is open
- **THEN** nothing is reported at that position, the program builds, and the
  count of characters the machine will change is reported as before

#### Scenario: The report and the errors agree

- **WHEN** Strict characters is on for a program on any machine
- **THEN** the characters reported as errors are exactly those the IDE counts as
  characters the machine will change

#### Scenario: Notation is still not text

- **WHEN** Strict characters is on and a program uses an escape, a raw byte or a
  short keyword spelling whose notation contains lower-case letters
- **THEN** none of it is reported, because none of it is text the machine stores
  as written

### Requirement: The editor types the case the machine has

While Strict characters is on and the target machine has no lower case, text
entered into the editor SHALL arrive in upper case, by whichever route it was
entered — typed at a keyboard, tapped on the on-screen keyboard, or pasted.

This SHALL NOT alter text the reader did not enter as letters: a graphics
character chosen from a palette, and the notation of an escape or a raw byte,
SHALL be inserted as they are.

While the setting is off, or on a machine that has lower case, nothing entered
into the editor SHALL have its case changed.

#### Scenario: Typing on a machine with no lower case

- **WHEN** Strict characters is on for such a machine and the user types
  lower-case letters
- **THEN** upper-case letters appear in the source

#### Scenario: Pasting a lower-case listing

- **WHEN** Strict characters is on for such a machine and the user pastes a
  listing containing lower-case letters
- **THEN** the pasted text arrives in upper case

#### Scenario: A graphics character is not a letter

- **WHEN** Strict characters is on and the user inserts a graphics character or
  an escape whose notation is lower case
- **THEN** it is inserted unchanged

#### Scenario: A machine that has lower case

- **WHEN** Strict characters is on and the target machine can draw lower case
- **THEN** text is entered in whatever case the user wrote

### Requirement: The tab strip fits the room it has

The editor's tab strip SHALL show as many of its tabs as its own width allows,
rather than letting tabs run off the edge. The program's tab SHALL be pinned
first and SHALL always be shown: whatever else the strip is holding, the way back
to the program is never hidden.

The remaining room SHALL be given to the most recently used of the other tabs —
memory blocks, scratch buffers and saved data files alike, under one rule rather
than one rule each. A tab the user has just shown, and a tab that has just come
into being, both count as recently used, so a newly created buffer or block and a
file the running program has just saved appear without being asked for.

Tabs the width does not allow SHALL remain reachable from a single control at the
end of the strip, which SHALL say how many tabs it is holding and SHALL list them
by name. Choosing one SHALL show that tab and bring it into the strip, so the tab
being shown is always the tab marked as showing.

The tabs that are shown SHALL keep the strip's own order. Recency SHALL decide
which tabs are shown and never where a shown tab sits, so a tab does not move
under the pointer as it is used.

Which tabs were shown SHALL NOT outlive the session: it is a view of the window's
width at a moment, not part of the document, and SHALL be neither saved with the
project nor restored with it.

#### Scenario: The program's tab is never hidden

- **WHEN** the strip holds more tabs than it has room for
- **THEN** the program's tab is shown, first in the strip, and is not among the
  tabs the overflow control lists

#### Scenario: Narrowing the window moves the least recently used tab out of view

- **WHEN** the user narrows the window until the strip can no longer hold every
  tab
- **THEN** the tabs used least recently are the ones that leave the strip, the
  tab being shown stays, and the overflow control reports how many left

#### Scenario: A tab chosen from the overflow comes into view

- **WHEN** the user opens the overflow control and chooses one of the tabs it
  lists
- **THEN** the editor shows that tab, and the tab appears in the strip marked as
  showing

#### Scenario: A new tab appears without being asked for

- **WHEN** the user creates a scratch buffer or a memory code block while the
  strip is already full
- **THEN** the new tab is shown in the strip rather than starting in the overflow

#### Scenario: Widening the window brings tabs back

- **WHEN** the user widens the window again
- **THEN** tabs return to the strip until the width is used up, and the overflow
  control is gone once every tab is shown

