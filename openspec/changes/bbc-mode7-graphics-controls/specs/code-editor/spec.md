## ADDED Requirements

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
