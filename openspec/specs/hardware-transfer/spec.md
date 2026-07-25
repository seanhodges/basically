# hardware-transfer Specification

## Purpose

Bridge the browser and real hardware in both directions: export programs as
native image files, cassette audio, or over a serial bridge, and import
existing programs from the same media back into editable source.

## Requirements

### Requirement: Native image export per machine

The user SHALL be able to export the current program as the machine's native
program image format(s), ready to load on real hardware or in third-party
emulators. Where a format can carry the document's memory blocks, they SHALL
be included (optionally behind an auto-loader); where it cannot, the user
SHALL be warned that blocks would be dropped.

#### Scenario: Export runs elsewhere

- **WHEN** the user exports a working program as a native image and loads it
  on the real machine or another emulator
- **THEN** the program loads and runs as it did in the IDE

### Requirement: Cassette audio out

For machines that load from tape, the user SHALL be able to play the program
as cassette audio through their speakers (for a machine's ear port) or
download it as a WAV file, with per-machine loading instructions shown.

#### Scenario: Load via audio cable

- **WHEN** the user plays the export audio into the real machine while it
  awaits tape input
- **THEN** the machine loads the program successfully

### Requirement: Cassette audio in

For machines with audio import support, the user SHALL be able to capture
cassette audio via microphone or drop a WAV recording, and recover the
program (and any blocks or extra files the tape carries) into the editor. An
unrecognisable recording SHALL produce a clear failure, not silent garbage.

#### Scenario: Recover a tape

- **WHEN** the user plays a real cassette into the microphone capture
- **THEN** the recorded program appears as editable source

### Requirement: Serial bridge transfer

The user SHALL be able to send a program to a microcontroller bridge over
WebSerial using a framed, integrity-checked protocol, so corrupted transfers
are detected rather than silently loaded.

#### Scenario: Corrupted frame

- **WHEN** a frame arrives at the bridge with a bad checksum
- **THEN** the transfer reports the failure instead of completing

### Requirement: Binary import per machine

The user SHALL be able to import the machine's native image formats
(including multi-part media such as tapes and discs) back into an editable
document, preserving what the text cannot express — machine-code blocks,
extra tape files, auto-start behaviour, or a verbatim boot disc — so the
imported program still runs from the IDE.

#### Scenario: Multi-part tape import

- **WHEN** the user imports a tape image whose program loads additional
  code files
- **THEN** running the imported document serves those loads and the program
  works
