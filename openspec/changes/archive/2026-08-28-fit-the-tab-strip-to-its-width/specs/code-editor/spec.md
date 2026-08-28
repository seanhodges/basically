## ADDED Requirements

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

## MODIFIED Requirements

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
