## MODIFIED Requirements

### Requirement: The user can supply their own machine ROM

For a machine whose emulation runs the ROM image the IDE gives it, the user
SHALL be able to install a ROM image of their own in place of the bundled one,
and SHALL be able to return to the bundled image at any time.

An image SHALL be accepted whatever its size. Where its size differs from the
size that machine's ROM area holds, the image SHALL be fitted to that area —
a smaller image padded as unprogrammed ROM, a larger one used from its leading
bytes — and the IDE SHALL report which happened alongside the size of the file
itself, so a user who supplied one half of a two-bank image can see that is what
happened. The IDE SHALL NOT state a size an image is required to have.

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

#### Scenario: A file of any size is accepted and fitted

- **WHEN** the user offers a file whose size differs from the machine's ROM size
- **THEN** the image is installed and the IDE reports the file's own size and
  that it was padded, or trimmed, to fit the machine

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
