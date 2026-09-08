## ADDED Requirements

### Requirement: The toolchain can be embedded in another program

The toolchain SHALL be obtainable as a library another program can call directly,
so that reaching what it does requires neither a copy of the product's source nor
starting a command and reading what it writes. An installation of the library
SHALL need no build step before its first use, and SHALL carry no ROM image.

Every operation the toolchain declares SHALL be reachable from a program that
embeds the library, on the same terms as from any other caller: an operation
deliberately withheld SHALL be declared together with its reason, and an absence
declared of another caller SHALL NOT be carried over on that caller's reason.

The embedding program SHALL say where ROMs are read from. The library SHALL NOT
search for them, so that what it reads is what the program that loaded it meant
rather than whatever happens to sit near where it was installed.

What the library offers SHALL be stated, so that a program can tell what it may
depend on from what merely happens to be reachable.

#### Scenario: Calling the toolchain from another program

- **WHEN** a program with no checkout of the product installs the library and asks
  it to describe the available machines
- **THEN** every registered machine is reported, with no build step having been run
  and no command having been started

#### Scenario: An operation reached by embedding

- **WHEN** a program that embeds the library asks for an operation the toolchain
  declares
- **THEN** that operation is performed and answers as it does for every other
  caller, or its absence is one already declared with a reason that describes a
  program embedding a library

#### Scenario: Running a machine on ROMs the embedder holds

- **WHEN** a program that embeds the library tells it where its ROMs are read from,
  and asks it to run a program on a machine whose ROM is there
- **THEN** the program runs on that machine's real ROM

#### Scenario: Reading ROMs without being told where they are

- **WHEN** a program that embeds the library asks it to run a machine that needs a
  ROM, having said nothing about where ROMs are read from
- **THEN** the library reports that it has no ROM for that machine, rather than
  searching the embedding program's own surroundings for one

## MODIFIED Requirements

### Requirement: Output can be read by a program as well as a person

Every operation that reports something SHALL be able to report it as structured
data on request, carrying the same facts as the readable form and more where the
readable form summarises. Standard output SHALL carry only what was asked for — the
screen, the structured data, the problems found — so that it can be consumed
directly; every figure, timing, notice and progress remark SHALL go to standard
error.

#### Scenario: Consuming an operation's output

- **WHEN** a caller asks an operation for structured data and reads standard output
- **THEN** standard output holds only that data, and nothing the operation reports
  about how the work went is mixed into it

### Requirement: Exit codes separate the caller's mistake from the program's

An operation SHALL report success or failure through its exit code, and SHALL
distinguish three outcomes: it worked; the caller asked for something impossible —
an unknown machine, an unreadable file, an option that does not exist; or the BASIC
program itself is at fault. A caller SHALL be able to tell a bad invocation from a
bad program without reading any output.

#### Scenario: Checking a program that cannot run

- **WHEN** the user checks or builds a program that has a fatal problem
- **THEN** the operation fails with the outcome reserved for a program at fault,
  which is distinct from the one it uses for a bad invocation

## REMOVED Requirements

### Requirement: The tool can serve an editor instead of finishing

**Reason**: The command line no longer has an operation that serves rather than
finishes. Serving an editor is not a piece of work a command line does, and it is
being given a name of its own; carrying it here made a language server something a
user reached by installing a command line.

**Migration**: The server itself is unchanged and still answers everything it
answered before. Until it is published under its own name, it is reached by
embedding the library and handing it the streams to speak over — the requirement
in `language-server` says so. No command replaces the removed operation, and the
command line's help no longer offers one.
