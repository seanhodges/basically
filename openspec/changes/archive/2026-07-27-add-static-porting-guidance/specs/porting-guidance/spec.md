## ADDED Requirements

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
