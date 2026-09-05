## ADDED Requirements

### Requirement: Saved data files appear as tabs

A data file a running program has saved SHALL be shown in the editor as its own
tab, named as the program named it, arriving as the program writes the file
rather than on the user asking for it. Selecting the tab SHALL show the file's
bytes with their offsets, in hexadecimal and as the characters the machine's own
character set gives them — the same byte view a block's bytes are shown in,
distinguished by counting from the start of the file, since a file has no
address.

The bytes SHALL be shown read-only. A data file is neither kept with the
document nor returned to the machine, so there is nothing an edit to one could
change; it is a view onto what the program produced.

The tab SHALL offer the file for download both as its raw bytes and as text, and
SHALL let the user discard it, from the same menu a block's tab offers its own
downloads.

Where a program has saved more files than the tab strip can show without
crowding out the program itself, the strip SHALL show a bounded number of them
and the rest SHALL remain reachable, so no program can take the strip over by
writing files.

#### Scenario: A tab appears as the program writes

- **WHEN** a running program saves a data file
- **THEN** a tab named after that file appears in the editor, and selecting it
  shows the bytes the program wrote

#### Scenario: The file's bytes cannot be edited

- **WHEN** the user selects a saved data file's tab and types into the bytes
- **THEN** nothing changes, and it is clear the view is read-only

#### Scenario: The file can be downloaded from its tab

- **WHEN** the user asks, from a saved data file's tab, to download it
- **THEN** they can save it as its raw bytes or as text

#### Scenario: Many saved files do not crowd out the program

- **WHEN** a running program saves more files than the tab strip shows at once
- **THEN** the strip still shows the program's own tabs, and the files beyond
  the bound are still reachable

#### Scenario: A discarded file's tab closes

- **WHEN** the user discards a saved data file from its tab
- **THEN** the tab closes and the editor returns to the program
