import { describe, expect, it } from 'vitest';
// @ts-expect-error — vendored ESM core typed by the sibling cpu6502.d.ts
import { StateMachineCpu, ExecutionState, Flags } from './cpu6502.js';
import type { BusInterface } from './cpu6502.js';

// Sanity checks that the vendored 6502 core (6502ts/6502.ts, cycle-exact
// StateMachineCpu) builds and runs inside this repo, driving the core directly
// through a flat RAM bus rather than through a machine. Each case targets a
// capability the previous (instruction-counted) core lacked and the PET/VIC-20
// machines depend on. See LICENSE-6502.md.

function makeBus(mem: Uint8Array): BusInterface {
  return {
    read: (a) => mem[a & 0xffff],
    write: (a, v) => {
      mem[a & 0xffff] = v & 0xff;
    },
    peek: (a) => mem[a & 0xffff],
    poke: (a, v) => {
      mem[a & 0xffff] = v & 0xff;
    },
    readWord: (a) => mem[a & 0xffff] | (mem[(a + 1) & 0xffff] << 8),
  };
}

// Advance past the 7-cycle reset/boot sequence to the first instruction fetch.
function boot(cpu: StateMachineCpu): void {
  cpu.reset();
  while (cpu.executionState !== ExecutionState.fetch) cpu.cycle();
}

// Run exactly one instruction: cycle until the next fetch boundary.
function step(cpu: StateMachineCpu): void {
  do {
    cpu.cycle();
  } while (cpu.executionState !== ExecutionState.fetch);
}

describe('vendored 6502 core (6502ts/6502.ts)', () => {
  it('loads the reset vector and runs LDA #imm / STA zp via the bus', () => {
    const mem = new Uint8Array(0x10000);
    // program at 0x0200: LDA #$42 ; STA $10
    [0xa9, 0x42, 0x85, 0x10].forEach((b, i) => (mem[0x0200 + i] = b));
    // reset vector (0xFFFC/D, little-endian) -> 0x0200
    mem[0xfffc] = 0x00;
    mem[0xfffd] = 0x02;

    const cpu = new StateMachineCpu(makeBus(mem));
    boot(cpu);
    expect(cpu.state.p).toBe(0x0200); // reset vector loaded
    step(cpu); // LDA #$42
    step(cpu); // STA $10

    expect(cpu.state.a).toBe(0x42);
    expect(mem[0x10]).toBe(0x42);
    expect(cpu.state.p).toBe(0x0204);
  });

  it('sets the zero flag and supports DEX/branch control flow', () => {
    const mem = new Uint8Array(0x10000);
    // LDX #$02 ; (loop) DEX ; BNE loop  -> X decrements to 0, zero flag set
    [0xa2, 0x02, 0xca, 0xd0, 0xfd].forEach((b, i) => (mem[0x0200 + i] = b));
    mem[0xfffc] = 0x00;
    mem[0xfffd] = 0x02;

    const cpu = new StateMachineCpu(makeBus(mem));
    boot(cpu);
    step(cpu); // LDX #$02
    for (let i = 0; i < 4; i++) step(cpu); // drain DEX/BNE loop

    expect(cpu.state.x).toBe(0x00);
    expect(cpu.state.flags & Flags.z).toBe(Flags.z);
  });

  // The previous core did not implement JMP (indirect).
  it('executes JMP (indirect)', () => {
    const mem = new Uint8Array(0x10000);
    mem[0xfffc] = 0x00;
    mem[0xfffd] = 0x02;
    mem[0x00f0] = 0x34; // pointer at $00F0 -> $1234
    mem[0x00f1] = 0x12;
    [0x6c, 0xf0, 0x00].forEach((b, i) => (mem[0x0200 + i] = b)); // JMP ($00F0)

    const cpu = new StateMachineCpu(makeBus(mem));
    boot(cpu);
    step(cpu);

    expect(cpu.state.p).toBe(0x1234);
  });

  // The previous core had no decimal (BCD) mode.
  it('performs decimal-mode ADC (BCD)', () => {
    const mem = new Uint8Array(0x10000);
    mem[0xfffc] = 0x00;
    mem[0xfffd] = 0x02;
    // SED ; CLC ; LDA #$19 ; ADC #$01 ; CLD  -> 19 + 01 = 20 in BCD
    [0xf8, 0x18, 0xa9, 0x19, 0x69, 0x01, 0xd8].forEach((b, i) => (mem[0x0200 + i] = b));

    const cpu = new StateMachineCpu(makeBus(mem));
    boot(cpu);
    for (let i = 0; i < 5; i++) step(cpu);

    expect(cpu.state.a).toBe(0x20);
    expect(cpu.state.flags & Flags.d).toBe(0); // CLD cleared decimal mode
  });

  // The PET/VIC-20 machines drive a jiffy IRQ; the previous core lacked RTI.
  it('services an IRQ and returns via RTI', () => {
    const mem = new Uint8Array(0x10000);
    mem[0xfffc] = 0x00; // reset vector -> $0200
    mem[0xfffd] = 0x02;
    mem[0xfffe] = 0x00; // IRQ vector -> $0300
    mem[0xffff] = 0x03;
    // main @ $0200: CLI ; (loop) JMP loop  -> sits at $0201 with IRQ enabled
    [0x58, 0x4c, 0x01, 0x02].forEach((b, i) => (mem[0x0200 + i] = b));
    // handler @ $0300: LDA #$AA ; STA $20 ; RTI
    [0xa9, 0xaa, 0x85, 0x20, 0x40].forEach((b, i) => (mem[0x0300 + i] = b));

    const cpu = new StateMachineCpu(makeBus(mem));
    boot(cpu);
    step(cpu); // CLI (PC now parked at the $0201 self-loop)

    cpu.setInterrupt(true); // assert the (level-sensitive) IRQ line
    let guard = 0;
    while (cpu.state.p < 0x0300 && guard++ < 8) step(cpu); // vector into the handler
    cpu.setInterrupt(false); // deassert so it doesn't immediately re-fire after RTI

    expect(cpu.state.p).toBe(0x0300); // entered the handler
    step(cpu); // LDA #$AA
    step(cpu); // STA $20
    step(cpu); // RTI

    expect(mem[0x20]).toBe(0xaa); // handler ran
    expect(cpu.state.p).toBe(0x0201); // returned to the interrupted address
  });
});
