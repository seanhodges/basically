---
title: Apple I file formats
---

# Apple I file formats

The Apple I has no program container of its own, because Integer BASIC has no
`LOAD` and no `SAVE`. A program is saved by leaving BASIC for the monitor and
dumping **two ranges of memory** through the cassette interface, and read back
by giving the monitor the same two ranges. That dump is what this machine's
native file would be, and it is described below.

The IDE does not yet write or read one: an Apple I program travels as its
listing and inside the `.zip` project bundle, which is also what carries its
[memory blocks](../file-formats#machine-code-data-blocks). For the shared editor
`.txt`, the project bundle, escape notation and the cross-machine machine-code
overview, see the [file formats overview](../file-formats). See also the
[Apple 1 Integer BASIC reference](../apple1) and its [escape codes](./escapes).

## Apple I cassette dump

The Apple Cassette Interface is a card on the expansion connector with a
256-byte program of its own at `0xC100`. Started from the monitor with `C100R`,
it takes the same address-range syntax the monitor uses, with `W` to write and
`R` to read:

```
C100R              start the cassette interface
4A.FF W            the housekeeping block
800.FFF W          the program and variable area
```

Two ranges, because a program on this machine is not one contiguous thing. The
second range is the workspace itself — variables up from LOMEM at `0x0800`, the
program text down from HIMEM at `0x0FFF` — and the first is the zero-page
housekeeping that says where in it each of those begins: LOMEM at `0x4A`, HIMEM
at `0x4C`, the bottom of the program text at `0xCA` and the top of the variables
at `0xCC`. Without the pointers the workspace is a block of bytes nobody can
find the program in.

Reading it back is the same two ranges with `R` in place of `W`, in the same
order. There is no name, no length field, no checksum and no directory: an ACI
tape is a memory range, and the person holding it is expected to know which.

## Cassette audio

The interface encodes each bit as one cycle of a square wave, with the frequency
carrying the value — about 2 kHz for a zero and about 1 kHz for a one — preceded
by a long leader of slower cycles and a shorter start bit that tells the reader
where the data begins. It is the same idea as every other cassette scheme of the
period, and unlike most of them it is implemented in a chip on a card rather
than by the processor.

The IDE does not yet encode or decode it, so there is no Apple I `.wav` export
today.
