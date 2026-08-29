## MODIFIED Requirements

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
change; it is a view onto what the program produced. Because that is true of the
file for as long as it is open, the editor SHALL mark it read-only throughout
rather than reporting it in answer to an edit: an attempted edit SHALL simply
leave the bytes as they are, and the mark SHALL still be there afterwards to say
why.

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
- **THEN** nothing changes, and the file is marked read-only before the user
  types, while they type, and after

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
