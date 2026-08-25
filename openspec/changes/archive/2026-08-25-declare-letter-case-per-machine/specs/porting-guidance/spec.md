## MODIFIED Requirements

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

Machines also differ in whether they tell `A` from `a`. A difference in letter
case SHALL count as a difference in name where the source machine distinguishes
it, so two names the source keeps apart are reported as colliding on a target
that folds them — the same silent failure as a truncated name, and reported the
same way. Where the source machine folds case, two spellings of one name were
never two variables, and nothing SHALL be reported about them.

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

#### Scenario: Two cases of a name moving to a machine that folds them

- **WHEN** a program written for a machine that tells `A` from `a` uses two names
  differing only in letter case, and is compared against a target that folds case
- **THEN** the comparison reports the two names as colliding on the target

#### Scenario: Two cases of a name moving off a machine that folds them

- **WHEN** a program written for a machine that folds letter case uses two
  spellings of one name differing only in case
- **THEN** nothing is reported about them, whichever target is compared
