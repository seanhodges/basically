## ADDED Requirements

### Requirement: The toolchain can be obtained without a checkout

The toolchain SHALL be installable as a published package, under the product's
own name, so that reaching it does not require a copy of the product's source or
knowledge of how it is built. An installation SHALL carry both the command line
and the host, and SHALL need no build step before its first use.

The command line and the host of one installation SHALL find each other, so that
a machine is held between commands exactly as it is when the toolchain is run
from a checkout. An installation SHALL never reach a host built from different
source than its own.

The published toolchain SHALL carry no ROM image.

A published version SHALL correspond to exactly one build of the toolchain: two
installations of the same version are the same program, and a build that differs
from the published one SHALL be reachable as a version of its own. A published
version SHALL record which build it carries, so that what is installed can be
told apart from what is merely named the same.

#### Scenario: Running the toolchain on a machine that has never seen the source

- **WHEN** a user with no checkout of the product installs the toolchain and asks
  for the available machines
- **THEN** every registered machine is reported, with no build step having been
  run and no further setup asked of the user

#### Scenario: A machine held between commands on an installation

- **WHEN** a user runs a program on an installed toolchain, and then acts on that
  machine in a further command
- **THEN** the second command reaches the machine the first left running, as it
  would from a checkout

#### Scenario: Two installations of one version

- **WHEN** the toolchain is installed twice at the same published version, by the
  same user on one computer
- **THEN** both are the same build, and a command from either reaches the host the
  other started

#### Scenario: A build that is not the published one

- **WHEN** the toolchain is built and the result differs in any way from the build
  the published version carries
- **THEN** it is published as a version of its own rather than replacing what is
  there, because the two cannot serve each other

#### Scenario: Serving an editor or an agent from an installation

- **WHEN** an editor or an agent starts the installed toolchain as its language
  server or its Model Context Protocol server
- **THEN** it is served and answered exactly as it is when the toolchain is run
  from a checkout

## MODIFIED Requirements

### Requirement: Every registered machine can be listed

The user SHALL be able to ask which machines are available and receive every
registered machine, each with the name and short description the product uses for
it elsewhere, and whether this installation can run it — so that a caller can tell
what it is able to run before trying to run it.

Whether a machine can be run SHALL be answered from where that machine's ROM
actually comes from, not from whether the product carries an image for it. A
machine that needs no ROM, and a machine whose ROM comes from the emulator behind
it rather than from the product's own images, SHALL both be reported as runnable
on an installation carrying no ROMs.

#### Scenario: Listing the machines

- **WHEN** the user asks for the available machines
- **THEN** every registered machine is reported with its identifier, its name, its
  description, and whether this installation can run it

#### Scenario: A machine that carries its own ROM

- **WHEN** the user lists machines on an installation with no ROMs present, and a
  registered machine's ROM comes from the emulator behind it rather than from the
  product's own images
- **THEN** that machine is reported as runnable, and running a program on it
  succeeds

#### Scenario: A machine that needs no ROM at all

- **WHEN** the user lists machines on an installation with no ROMs present, and a
  registered machine runs without any ROM image
- **THEN** that machine is reported as runnable, and running a program on it
  succeeds

### Requirement: Only running a machine requires its ROM

Describing machines, describing one machine, checking a program and building a
program SHALL all work without any ROM being present, so that an installation
carrying no ROMs is still useful for everything but running. Running a machine
SHALL let the user say where ROMs are read from, rather than only ever reading them
from where the product was installed.

Where ROMs are read from SHALL be sayable once for the installation, so that a
user who keeps ROMs of their own need not repeat it on every run. An option given
on a single run SHALL take precedence over what was said for the installation, and
both SHALL take precedence over any images the product was installed with.

#### Scenario: Working without ROMs

- **WHEN** the user lists machines, describes one, checks a program or builds a
  program on an installation with no ROMs present
- **THEN** each operation succeeds, and reports no ROM as missing because none was
  needed

#### Scenario: Saying where ROMs are once

- **WHEN** the user has said where this installation reads ROMs from, and then runs
  a program on a machine whose ROM is there, without naming that place again
- **THEN** the program runs on that machine's real ROM

#### Scenario: Overriding what the installation was told

- **WHEN** the user has said where this installation reads ROMs from, and then runs
  a program naming a different place to read them from
- **THEN** the place named on the run is used
