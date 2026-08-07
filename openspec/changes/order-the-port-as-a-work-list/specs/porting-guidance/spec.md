## MODIFIED Requirements

### Requirement: The comparison leads with what the port requires

The comparison SHALL present what the port requires the reader to do before the lists it provides
for reference, and SHALL present it in the order the work is carried out rather than by the kind of
thing each finding is. That order SHALL be:

1. what stops the program being read on the target at all — the characters the target cannot
   represent, the statement layout that must change, and line numbers the target will not accept;
2. what is mechanical — the commands that need only be renamed;
3. what must be rewritten — the commands the target has no equivalent of, the control codes that
   must be replaced, and the commands whose usage differs;
4. what changes silently — the commands that mean something else under the same name, and any other
   finding that leaves the program tokenizing cleanly and computing differently;
5. whether the result fits the target machine.

Each finding SHALL be placed in the class of work it belongs to, so that a reader working top to
bottom meets the port in the order it is done. A finding a pair does not produce SHALL be absent
rather than shown empty, and SHALL NOT leave the classes around it out of order.

How the two machines differ in language rules and hardware, and the guidance specific to this pair
and this target, SHALL be presented before the work list, being the frame the work is read inside.
Guidance that does not vary with the chosen pair SHALL NOT be placed between two sections that do.

#### Scenario: Reading the comparison top to bottom

- **WHEN** the user reads a comparison from the top
- **THEN** the language and hardware differences and the guidance for this pair and target are
  reached first, and the findings that follow run from what stops the program being read, through
  what is mechanical and what must be rewritten, to what changes silently and whether the result
  fits

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
