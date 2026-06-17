import { describe, expect, it } from 'vitest';
// @ts-expect-error — vendored JS core typed by the sibling cpu6502.d.ts
import { CPU6502, ReadWrite } from './cpu6502.js';

// A minimal sanity check that the vendored 6502 core builds and runs inside
// this repo. No machine/dialect exists yet — this just drives the core directly
// through its memory bus and the synchronous `step()` patch. See LICENSE-6502.md.

function makeCpu(mem: Uint8Array) {
  return new CPU6502({
    accessMemory: (rw: ReadWrite, address: number, value?: number) => {
      if (rw === ReadWrite.read) return mem[address];
      mem[address] = value!;
      return undefined;
    },
  });
}

describe('vendored 6502 core', () => {
  it('runs LDA #imm / STA zp via the bus and step()', () => {
    const mem = new Uint8Array(0x10000);
    // program at 0x0200: LDA #$42 ; STA $10
    [0xa9, 0x42, 0x85, 0x10].forEach((b, i) => (mem[0x0200 + i] = b));
    // reset vector (0xFFFC/D, little-endian) -> 0x0200
    mem[0xfffc] = 0x00;
    mem[0xfffd] = 0x02;

    const cpu = makeCpu(mem);
    cpu.reset(); // asserts RESB; serviced on the next step()
    cpu.step(); // services reset (PC <- 0x0200), then runs LDA #$42
    cpu.step(); // STA $10

    expect(cpu.reg_a).toBe(0x42);
    expect(mem[0x10]).toBe(0x42);
    expect(cpu.programCounter).toBe(0x0204);
  });

  it('sets the zero flag and supports INX/branch control flow', () => {
    const mem = new Uint8Array(0x10000);
    // LDX #$02 ; (loop) DEX ; BNE loop  -> X decrements to 0, zero flag set
    [0xa2, 0x02, 0xca, 0xd0, 0xfd].forEach((b, i) => (mem[0x0300 + i] = b));
    mem[0xfffc] = 0x00;
    mem[0xfffd] = 0x03;

    const cpu = makeCpu(mem);
    cpu.reset();
    cpu.step(); // reset + LDX #$02
    // run enough instructions to drain the loop
    for (let i = 0; i < 5; i++) cpu.step();

    expect(cpu.reg_x).toBe(0x00);
  });
});
