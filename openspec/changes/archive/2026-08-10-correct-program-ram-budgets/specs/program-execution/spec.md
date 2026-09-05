## ADDED Requirements

### Requirement: A machine has only the memory it shipped with

An emulated machine SHALL hold memory only where the machine it models held it.
Address space the machine could address but never populated SHALL behave as it
did on the hardware: a write there SHALL have no effect, and a read SHALL NOT
return anything the program wrote.

Where a machine was sold in several memory configurations, the IDE SHALL model
one of them and SHALL be consistent about which — the same configuration the
machine's memory map draws and its RAM budget is measured against.

#### Scenario: Writing to memory the machine does not have

- **WHEN** a running program writes a byte to an address the machine's
  configuration leaves unpopulated
- **THEN** the byte is not stored, and reading the address back does not return
  it

#### Scenario: Memory the machine does have

- **WHEN** a running program writes a byte anywhere inside the machine's fitted
  RAM
- **THEN** the byte is stored and reads back unchanged

#### Scenario: Re-running does not grow the machine

- **WHEN** the user runs a program, then runs it again
- **THEN** the machine holds memory in exactly the same places on the second run
  as on the first
