## ADDED Requirements

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
