// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Altair8800Machine } from './altairMachine';
import { tokenizeProgram } from '../tokenizer';
import { BASIC_IMAGE_SIZE, PROGRAM_BASE, TXTTAB, VARTAB } from '../addresses';

/**
 * Unlike the other machine tests here, these cannot assert on display memory -
 * there is none - so they assert on the terminal grid the serial port has
 * written into instead.
 *
 * They come in two halves. The first half runs hand-assembled 8080 programs as
 * the machine's image: the Altair loaded BASIC into RAM from paper tape rather
 * than running firmware, so a nine-byte program is as legitimate a boot image
 * as the interpreter is, and that lets the bus, the 2SIO, the terminal and the
 * 8080 flag corrections be tested without a copyright image.
 *
 * The second half boots the real thing. `public/roms/altair8800.rom` is
 * user-supplied Microsoft-copyright code that does not ship (see
 * `public/roms/ATTRIBUTION.md`), so those cases skip cleanly when it is absent
 * and a clean checkout still runs green.
 */
const ROM_PATH = path.resolve(
  __dirname,
  '../../../../public/roms/altair8800.rom',
);
const ROM = existsSync(ROM_PATH)
  ? new Uint8Array(readFileSync(ROM_PATH))
  : null;
const withRom = ROM ? it : it.skip;

/** A hand-assembled 8080 program, loaded and run exactly as BASIC would be. */
function boot(...bytes: number[]): Altair8800Machine {
  return new Altair8800Machine({ rom: Uint8Array.from(bytes), ramKb: 64 });
}

/** Run a machine on to its HLT and return what it printed on the first row. */
function printed(machine: Altair8800Machine, frames = 4): string {
  for (let i = 0; i < frames; i++) machine.runFrame();
  return machine.readScreenRow(0);
}

/**
 * The shape every flag case below uses: run something that sets the flags, jump
 * on parity, and print `Y` from the arm an 8080 would take or `N` from the arm
 * a Z80 would.
 *
 *   <setUp>            the instruction whose P flag is in question
 *   JPO  target        taken when P is clear
 *   <fall-through arm> prints its letter, halts
 *   <target arm>       prints its letter, halts
 *
 * `takenOn8080` says which arm a real 8080 lands in, so one helper covers both
 * directions: P set where the Z80 clears it, and P clear where the Z80 sets it.
 */
function parityProbe(setUp: number[], takenOn8080: boolean): string {
  const target = setUp.length + 3 + 5; // past the jump and the fall-through arm
  const machine = boot(
    ...setUp,
    0xe2,
    target & 0xff,
    target >> 8, // JPO target
    0x3e,
    takenOn8080 ? 0x4e : 0x59, // MVI A,'N' / 'Y' - the fall-through arm
    0xd3,
    0x11, // OUT 11h
    0x76, // HLT
    0x3e,
    takenOn8080 ? 0x59 : 0x4e, // MVI A,'Y' / 'N' - the jump target
    0xd3,
    0x11, // OUT 11h
    0x76, // HLT
  );
  return printed(machine);
}

describe('altair8800 machine', () => {
  it('prints through the 2SIO once the transmitter says it is ready', () => {
    const machine = boot(
      0xdb,
      0x10, // IN  10h   - status
      0xe6,
      0x02, // ANI 02h   - TDRE, active high
      0xca,
      0x00,
      0x00, // JZ  0000h - spin while the bit is clear
      0x3e,
      0x48, // MVI A,'H'
      0xd3,
      0x11, // OUT 11h
      0x3e,
      0x49, // MVI A,'I'
      0xd3,
      0x11, // OUT 11h
      0x76, // HLT
    );
    expect(printed(machine)).toBe('HI');
  });

  it('answers the sense switches with the 88-2SIO selection', () => {
    // BASIC reads port 0xFF once at cold start and patches its own console
    // driver from the high nibble; 0 there means the 2SIO. Printed as a digit
    // so the assertion reads off the terminal like everything else.
    const machine = boot(
      0xdb,
      0xff, // IN  FFh
      0xf6,
      0x30, // ORI 30h   - make the low nibble a digit
      0xd3,
      0x11, // OUT 11h
      0x76, // HLT
    );
    expect(printed(machine)).toBe('8');
  });

  it('floats every port it has no board for', () => {
    const machine = boot(
      0xdb,
      0x20, // IN  20h   - nothing at that address
      0xe6,
      0x0f, // ANI 0Fh
      0xc6,
      0x30, // ADI 30h
      0xd3,
      0x11, // OUT 11h
      0x76, // HLT
    );
    expect(printed(machine)).toBe('?'); // (0xFF & 0x0F) + 0x30
  });

  it('echoes typed characters back through the serial port', () => {
    const machine = boot(
      0xdb,
      0x10, // IN  10h
      0xe6,
      0x01, // ANI 01h   - RDRF, active high
      0xca,
      0x00,
      0x00, // JZ  0000h
      0xdb,
      0x11, // IN  11h   - take the character
      0xd3,
      0x11, // OUT 11h   - and echo it
      0xc3,
      0x00,
      0x00, // JMP 0000h
    );

    machine.runFrame(); // nothing typed yet
    expect(machine.readScreenRow(0)).toBe('');

    for (const token of ['KeyH', 'KeyI']) {
      machine.setKey(token, true);
      machine.setKey(token, false);
    }
    machine.runFrame();
    expect(machine.readScreenRow(0)).toBe('HI');
  });

  it('delivers CTRL-C as the 0x03 that breaks a running program', () => {
    const machine = boot(
      0xdb,
      0x10, // IN  10h
      0xe6,
      0x01, // ANI 01h
      0xca,
      0x00,
      0x00, // JZ  0000h
      0xdb,
      0x11, // IN  11h
      0xfe,
      0x03, // CPI 03h
      0xc2,
      0x00,
      0x00, // JNZ 0000h - anything else, keep waiting
      0x3e,
      0x42, // MVI A,'B'
      0xd3,
      0x11, // OUT 11h
      0x76, // HLT
    );

    machine.setKey('KeyX', true); // an ordinary key is not a break
    machine.setKey('KeyX', false);
    machine.runFrame();
    expect(machine.readScreenRow(0)).toBe('');

    machine.setKey('Control', true);
    machine.setKey('KeyC', true);
    machine.setKey('KeyC', false);
    machine.setKey('Control', false);
    machine.runFrame();
    expect(machine.readScreenRow(0)).toBe('B');
  });

  it('keeps the 8080 parity flag through SBB A, which is what boots BASIC', () => {
    // The instruction pair from 8K BASIC's floating-point code. On the 8080
    // `SBB A` leaves P set - the result is 0, an even number of bits - while on
    // the Z80 that flag holds overflow, which is clear, so the JPO is taken and
    // the interpreter spins in FP forever.
    expect(
      parityProbe(
        [
          0x3e,
          0x03, // MVI A,03h
          0x9f, // SBB A
        ],
        false,
      ),
    ).toBe('Y');
  });

  it('clears P where the result is odd but the Z80 sees an overflow', () => {
    // 0x7F + 1 = 0x80: signed overflow, so the Z80 sets P/V, but a single set
    // bit, so the 8080's parity is odd and P is clear.
    expect(
      parityProbe(
        [
          0x3e,
          0x7f, // MVI A,7Fh
          0xc6,
          0x01, // ADI 01h
        ],
        true,
      ),
    ).toBe('Y');
  });

  it('takes the parity of an incremented register, not of the accumulator', () => {
    expect(
      parityProbe(
        [
          0x06,
          0x7f, // MVI B,7Fh
          0x04, // INR B     - B = 0x80: odd parity, and a Z80 overflow
        ],
        true,
      ),
    ).toBe('Y');
  });

  it('takes the parity of a compare, whose result the CPU throws away', () => {
    expect(
      parityProbe(
        [
          0x3e,
          0x80, // MVI A,80h
          0x06,
          0x01, // MVI B,01h
          0xb8, // CMP B     - 0x80-0x01 = 0x7F: odd parity, Z80 overflow
        ],
        true,
      ),
    ).toBe('Y');

    // The same compare against memory, where the operand has to be fetched back
    // off the bus rather than read out of a register.
    expect(
      parityProbe(
        [
          0x3e,
          0x80, // MVI A,80h
          0x21,
          0x00,
          0x01, // LXI H,0100h
          0x36,
          0x01, // MVI M,01h
          0xbe, // CMP M
        ],
        true,
      ),
    ).toBe('Y');
  });

  it('adjusts a DAA upwards after a subtraction, as the 8080 always did', () => {
    // 0x15 - 0x06 = 0x0F; the 8080's DAA adds 6 to the low nibble whatever came
    // before it, giving 0x15. The Z80 subtracts 6 instead - it has an N flag to
    // tell it a subtraction happened - and would leave 0x09. (The 8080's answer
    // is the useless one for BCD, which is exactly why the Z80 added N; the
    // point here is only that this machine is an 8080.)
    const machine = boot(
      0x3e,
      0x15, // MVI A,15h
      0xd6,
      0x06, // SUI 06h
      0x27, // DAA
      0x76, // HLT
    );
    machine.runFrame();
    expect(machine.processor.getState().a).toBe(0x15);
  });

  it('runs more of the program per frame at a higher speed', () => {
    function countAfterOneFrame(speed: number): number {
      const machine = boot(
        0x13, // INX D
        0xc3,
        0x00,
        0x00, // JMP 0000h
      );
      machine.setSpeed(speed);
      machine.runFrame();
      const { d, e } = machine.processor.getState();
      return (d << 8) | e;
    }

    const single = countAfterOneFrame(1);
    expect(single).toBeGreaterThan(1000);
    expect(countAfterOneFrame(2)).toBeGreaterThan(single * 1.8);
  });

  it('stops at a HLT instead of spinning out the frame', () => {
    const machine = boot(0x76); // HLT
    machine.runFrame();
    expect(machine.processor.isHalted()).toBe(true);
    expect(machine.processor.getState().cycle_counter).toBeLessThan(100);
  });

  it('resets back to the image it was built with', () => {
    const machine = boot(
      0x3e,
      0x48, // MVI A,'H'
      0xd3,
      0x11, // OUT 11h
      0x76, // HLT
    );
    expect(printed(machine)).toBe('H');

    machine.mem.write(0x0001, 0x49); // corrupt the image, as a stray POKE would
    machine.reset();
    expect(machine.readScreenRow(0)).toBe('');
    expect(machine.mem.read(0x0001)).toBe(0x48);
    expect(printed(machine)).toBe('H');
  });

  it('stays constructible with an empty ROM image', () => {
    const machine = new Altair8800Machine({
      rom: new Uint8Array(0),
      ramKb: 16,
    });
    expect(machine.hasInterpreter).toBe(false);

    // No image means nothing to run, and a terminal that says so rather than a
    // black screen or a thrown fetch error.
    machine.runFrame();
    machine.bootToReady();
    machine.loadProgram(tokenizeProgram('10 PRINT "HI"\n').program);
    expect(machine.console.contains('NO BASIC IMAGE.')).toBe(true);
    expect(machine.console.contains('roms/altair8800.rom')).toBe(true);

    machine.dispose();
  });

  withRom('boots the BASIC image and prints its sign-on banner', () => {
    expect(ROM!.length).toBe(BASIC_IMAGE_SIZE);
    const machine = new Altair8800Machine({ rom: ROM!, ramKb: 64 });

    machine.bootToReady();

    expect(machine.console.contains('ALTAIR BASIC')).toBe(true);
    expect(machine.console.contains('BYTES FREE')).toBe(true);
    expect(machine.console.contains('OK')).toBe(true);
    machine.dispose();
  });

  withRom('answers the MEMORY SIZE and TERMINAL WIDTH prompts', () => {
    const machine = new Altair8800Machine({ rom: ROM!, ramKb: 64 });
    machine.bootToReady();

    // The dialogue was answered rather than left waiting, and answering the
    // trig question `Y` put the program text where addresses.ts says it goes.
    expect(machine.console.contains('MEMORY SIZE')).toBe(true);
    expect(machine.console.contains('TERMINAL WIDTH')).toBe(true);
    expect(machine.mem.readWord(TXTTAB)).toBe(PROGRAM_BASE);
    machine.dispose();
  });

  withRom('runs an injected program and prints its output', () => {
    const machine = new Altair8800Machine({ rom: ROM!, ramKb: 64 });
    const { program, errors } = tokenizeProgram('10 PRINT "HELLO"\n20 END\n');
    expect(errors).toEqual([]);

    machine.loadProgram(program);
    for (let i = 0; i < 120; i++) machine.runFrame();

    expect(machine.mem.read(PROGRAM_BASE + 4)).toBe(0x96); // the PRINT token
    expect(machine.mem.readWord(VARTAB)).toBe(PROGRAM_BASE + program.length);
    expect(machine.console.contains('HELLO')).toBe(true);
    machine.dispose();
  });

  withRom('breaks a running program on CTRL-C', () => {
    const machine = new Altair8800Machine({ rom: ROM!, ramKb: 64 });
    const { program } = tokenizeProgram('10 GOTO 10\n');

    machine.loadProgram(program);
    for (let i = 0; i < 120; i++) machine.runFrame();
    expect(machine.console.contains('BREAK')).toBe(false);

    machine.setKey('Control', true);
    machine.setKey('KeyC', true);
    machine.setKey('KeyC', false);
    machine.setKey('Control', false);
    for (let i = 0; i < 60; i++) machine.runFrame();

    expect(machine.console.contains('BREAK')).toBe(true);
    machine.dispose();
  });
});
