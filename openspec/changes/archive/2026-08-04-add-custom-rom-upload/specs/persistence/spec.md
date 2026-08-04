## ADDED Requirements

### Requirement: The user can supply their own machine ROM

For a machine whose emulation runs the ROM image the IDE gives it, the user
SHALL be able to install a ROM image of their own in place of the bundled one,
and SHALL be able to return to the bundled image at any time.

An image SHALL be accepted only when its size exactly matches the size that
machine's ROM requires. A refusal SHALL state both the size of the file offered
and the size the machine requires, so a user who supplied one half of a
two-bank image can see that is what happened.

An installed image SHALL persist across sessions, SHALL apply wherever that
machine runs in that browser — including the standalone player — and SHALL
never leave the browser. It SHALL NOT be carried in a published share link: a
recipient runs the bundled image unless they have installed one themselves.

A machine whose emulation loads its own ROM set, and would therefore ignore a
supplied image, SHALL say so rather than offer a replacement that would have no
effect.

When an installed image cannot be stored, the user SHALL be told, and SHALL NOT
be left believing it was kept.

#### Scenario: A supplied ROM survives a reload

- **WHEN** the user installs their own ROM image for a machine and reopens the
  IDE
- **THEN** that machine still runs the image they supplied

#### Scenario: A wrong-sized file is refused by name

- **WHEN** the user offers a file whose size differs from the machine's ROM size
- **THEN** the file is not installed, and they are told both its size and the
  size that machine requires

#### Scenario: The bundled ROM can be restored

- **WHEN** the user restores the bundled ROM for a machine they had supplied
  their own image for
- **THEN** that machine runs the bundled image again, and the IDE reports that
  it is in use

#### Scenario: A machine that loads its own ROM set offers no replacement

- **WHEN** the user looks at the ROM setting for a machine whose emulation
  resolves its own ROM images
- **THEN** they are told it cannot be replaced, and are offered no control that
  would appear to replace it

#### Scenario: A ROM that cannot be stored says so

- **WHEN** an image the user supplies cannot be stored in the browser
- **THEN** they are told it was not kept, rather than the IDE reporting success

## MODIFIED Requirements

### Requirement: Works offline

Once installed, the IDE SHALL launch and operate offline: previously used
machines (including their ROMs) remain runnable, and only inherently
networked features (AI, sharing) require connectivity.

A ROM image the user supplied themselves SHALL be available offline from the
moment it is installed, without that machine having been run while connected.

#### Scenario: Offline relaunch

- **WHEN** the user launches the installed app without a network connection
- **THEN** they can edit and run programs on machines they have used before

#### Scenario: Offline on a machine whose ROM the user supplied

- **WHEN** the user installs their own ROM image for a machine they have never
  run, and then launches the app without a network connection
- **THEN** that machine runs
