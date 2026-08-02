// Reference table data for the Z80 assembly page.
// Seeded from the assembler engine's mnemonic set (src/asm/z80) by
// scripts/gen-reference-scaffold.mts, then hand-enriched (typed operand syntax
// + fuller descriptions). Edit by hand; the generator skips this file once it
// exists. The instruction rows are kept in sync with z80Engine.mnemonics by
// src/reference/asm-reference.test.ts.
//
// Operand shorthand used in the syntax column (see the page prose):
//   r  = 8-bit register (A B C D E H L)      n  = 8-bit immediate
//   s  = r, n, (HL), (IX+d) or (IY+d)        nn = 16-bit immediate
//   ss = 16-bit register pair (BC DE HL SP)  d  = signed index displacement
//   cc = condition (NZ Z NC C PO PE P M)     e  = relative jump target
//   b  = bit number 0-7                      p  = restart vector
import type { ReferenceTableData } from './types';

export const z80AssemblyReference: ReferenceTableData = {
  title: 'Z80 assembly',
  machines: [
    'Sinclair ZX81',
    'Sinclair ZX80',
    'Sinclair ZX Spectrum (48K & 128K)',
    'TRS-80 Model I',
  ],
  entries: [
    {
      name: 'ADC',
      kind: 'instruction',
      syntax: 'ADC A,s / ADC HL,ss',
      description:
        'Add with carry: A ← A + s + CF, or the 16-bit HL ← HL + ss + CF. Updates the flags (the 8-bit form sets S Z H P/V N C).',
    },
    {
      name: 'ADD',
      kind: 'instruction',
      syntax: 'ADD A,s / ADD HL,ss / ADD IX,ss',
      description:
        'Add without carry: A ← A + s, or a 16-bit HL/IX/IY ← +ss. The 16-bit form affects only H, N and C.',
    },
    {
      name: 'AND',
      kind: 'instruction',
      syntax: 'AND s',
      description:
        'Bitwise AND of A with s, result in A. Sets H, clears C and N, and sets S Z and P (parity).',
    },
    {
      name: 'BIT',
      kind: 'instruction',
      syntax: 'BIT b,s',
      description:
        'Test bit b (0-7) of s and set the Z flag to its complement; the operand is left unchanged. Usually followed by a conditional jump.',
    },
    {
      name: 'CALL',
      kind: 'instruction',
      syntax: 'CALL nn / CALL cc,nn',
      description:
        'Push the return address and jump to nn. The conditional form CALL cc,nn only calls when condition cc holds.',
    },
    {
      name: 'CCF',
      kind: 'instruction',
      syntax: 'CCF',
      description:
        'Complement the carry flag (CF ← ¬CF); the previous CF is copied into H and N is cleared.',
    },
    {
      name: 'CP',
      kind: 'instruction',
      syntax: 'CP s',
      description:
        'Compare s with A by computing A − s and setting the flags, but discarding the result (A is unchanged). Z means equal; C means A < s (unsigned).',
    },
    {
      name: 'CPD',
      kind: 'instruction',
      syntax: 'CPD',
      description:
        'Compare (HL) with A, then decrement HL and BC. Sets Z on a match; P/V reflects whether BC is still non-zero.',
    },
    {
      name: 'CPDR',
      kind: 'instruction',
      syntax: 'CPDR',
      description:
        'Repeat CPD — compare and decrement HL/BC — until A matches (HL) or BC reaches 0. A block search downwards.',
    },
    {
      name: 'CPI',
      kind: 'instruction',
      syntax: 'CPI',
      description:
        'Compare (HL) with A, then increment HL and decrement BC. Sets Z on a match; P/V reflects whether BC is still non-zero.',
    },
    {
      name: 'CPIR',
      kind: 'instruction',
      syntax: 'CPIR',
      description:
        'Repeat CPI — compare and increment HL, decrement BC — until A matches (HL) or BC reaches 0. A block search upwards.',
    },
    {
      name: 'CPL',
      kind: 'instruction',
      syntax: 'CPL',
      description:
        "Complement A (one's complement, A ← ¬A). Sets H and N; the other flags are unchanged.",
    },
    {
      name: 'DAA',
      kind: 'instruction',
      syntax: 'DAA',
      description:
        'Decimal-adjust A after a BCD add or subtract, correcting the result to packed binary-coded decimal using the H and C flags.',
    },
    {
      name: 'DEC',
      kind: 'instruction',
      syntax: 'DEC r / DEC (HL) / DEC ss',
      description:
        'Decrement the 8-bit register/memory operand (sets S Z H P/V and N) or a 16-bit register pair (no flags affected).',
    },
    {
      name: 'DI',
      kind: 'instruction',
      syntax: 'DI',
      description:
        'Disable the maskable interrupt (resets both interrupt-enable flip-flops). Interrupts stay off until EI.',
    },
    {
      name: 'DJNZ',
      kind: 'instruction',
      syntax: 'DJNZ e',
      description:
        'Decrement B and, if it is now non-zero, jump relative to e (−126…+129 bytes). The standard counted-loop instruction.',
    },
    {
      name: 'EI',
      kind: 'instruction',
      syntax: 'EI',
      description:
        'Enable the maskable interrupt. Takes effect after the following instruction, so a RET/RETI can run first.',
    },
    {
      name: 'EX',
      kind: 'instruction',
      syntax: "EX DE,HL / EX AF,AF' / EX (SP),HL",
      description:
        'Exchange register pairs: DE↔HL, the AF shadow set, or the top of the stack with HL/IX/IY.',
    },
    {
      name: 'EXX',
      kind: 'instruction',
      syntax: 'EXX',
      description:
        'Exchange BC, DE and HL with their shadow registers BC′ DE′ HL′ in one instruction. AF is not affected.',
    },
    {
      name: 'HALT',
      kind: 'instruction',
      syntax: 'HALT',
      description:
        'Suspend the CPU (executing NOPs internally) until an interrupt or reset occurs. Used to synchronise with interrupts.',
    },
    {
      name: 'IM',
      kind: 'instruction',
      syntax: 'IM 0 / IM 1 / IM 2',
      description:
        'Select the interrupt mode: 0 (device supplies an instruction), 1 (RST $38), or 2 (vectored via the I register).',
    },
    {
      name: 'IN',
      kind: 'instruction',
      syntax: 'IN A,(n) / IN r,(C)',
      description:
        'Read a byte from an I/O port into a register. The (C) form uses BC as the 16-bit port address and sets flags; IN A,(n) does not.',
    },
    {
      name: 'INC',
      kind: 'instruction',
      syntax: 'INC r / INC (HL) / INC ss',
      description:
        'Increment the 8-bit register/memory operand (sets S Z H P/V, clears N) or a 16-bit register pair (no flags affected).',
    },
    {
      name: 'IND',
      kind: 'instruction',
      syntax: 'IND',
      description:
        'Input from port (C) into (HL), then decrement HL and B. One step of a downward input block.',
    },
    {
      name: 'INDR',
      kind: 'instruction',
      syntax: 'INDR',
      description:
        'Repeat IND until B reaches 0: input a block from port (C) into memory, decrementing HL each byte.',
    },
    {
      name: 'INI',
      kind: 'instruction',
      syntax: 'INI',
      description:
        'Input from port (C) into (HL), then increment HL and decrement B. One step of an upward input block.',
    },
    {
      name: 'INIR',
      kind: 'instruction',
      syntax: 'INIR',
      description:
        'Repeat INI until B reaches 0: input a block from port (C) into memory, incrementing HL each byte.',
    },
    {
      name: 'JP',
      kind: 'instruction',
      syntax: 'JP nn / JP cc,nn / JP (HL)',
      description:
        'Unconditional or conditional absolute jump to nn. JP (HL)/(IX)/(IY) jumps to the address held in the register (an indirect, computed jump).',
    },
    {
      name: 'JR',
      kind: 'instruction',
      syntax: 'JR e / JR cc,e',
      description:
        'Relative jump to e (−126…+129 bytes from the instruction). The conditional form allows only NZ, Z, NC and C.',
    },
    {
      name: 'LD',
      kind: 'instruction',
      syntax: 'LD dst,src',
      description:
        'The universal copy: load a register, register pair or memory location from another. Never affects flags (except LD A,I / LD A,R, which set S and Z).',
    },
    {
      name: 'LDD',
      kind: 'instruction',
      syntax: 'LDD',
      description:
        'Copy (HL) to (DE), then decrement HL, DE and BC. One step of a downward block move; P/V reflects whether BC is still non-zero.',
    },
    {
      name: 'LDDR',
      kind: 'instruction',
      syntax: 'LDDR',
      description:
        'Repeat LDD until BC reaches 0 — a descending block copy from HL to DE (use when the ranges overlap and the destination is above the source).',
    },
    {
      name: 'LDI',
      kind: 'instruction',
      syntax: 'LDI',
      description:
        'Copy (HL) to (DE), then increment HL and DE and decrement BC. One step of an upward block move.',
    },
    {
      name: 'LDIR',
      kind: 'instruction',
      syntax: 'LDIR',
      description:
        'Repeat LDI until BC reaches 0 — the classic ascending block copy of BC bytes from HL to DE.',
    },
    {
      name: 'NEG',
      kind: 'instruction',
      syntax: 'NEG',
      description:
        "Negate A (two's complement, A ← 0 − A). Sets the flags, including C when A was non-zero.",
    },
    {
      name: 'NOP',
      kind: 'instruction',
      syntax: 'NOP',
      description:
        'No operation — does nothing for four T-states. Used for timing padding or to blank out code.',
    },
    {
      name: 'OR',
      kind: 'instruction',
      syntax: 'OR s',
      description:
        'Bitwise OR of A with s, result in A. Clears H, C and N; sets S Z and P (parity).',
    },
    {
      name: 'OTDR',
      kind: 'instruction',
      syntax: 'OTDR',
      description:
        'Repeat OUTD until B reaches 0 — output a block from memory to port (C), decrementing HL each byte.',
    },
    {
      name: 'OTIR',
      kind: 'instruction',
      syntax: 'OTIR',
      description:
        'Repeat OUTI until B reaches 0 — output a block from memory to port (C), incrementing HL each byte.',
    },
    {
      name: 'OUT',
      kind: 'instruction',
      syntax: 'OUT (n),A / OUT (C),r',
      description:
        'Write a register to an I/O port. OUT (n),A uses an 8-bit port; OUT (C),r uses BC as the 16-bit port address.',
    },
    {
      name: 'OUTD',
      kind: 'instruction',
      syntax: 'OUTD',
      description:
        'Output (HL) to port (C), then decrement HL and B. One step of a downward output block.',
    },
    {
      name: 'OUTI',
      kind: 'instruction',
      syntax: 'OUTI',
      description:
        'Output (HL) to port (C), then increment HL and decrement B. One step of an upward output block.',
    },
    {
      name: 'POP',
      kind: 'instruction',
      syntax: 'POP ss',
      description:
        'Pop two bytes off the stack into a register pair (BC, DE, HL, AF, IX or IY); SP increases by 2.',
    },
    {
      name: 'PUSH',
      kind: 'instruction',
      syntax: 'PUSH ss',
      description:
        'Push a register pair (BC, DE, HL, AF, IX or IY) onto the stack; SP decreases by 2.',
    },
    {
      name: 'RES',
      kind: 'instruction',
      syntax: 'RES b,s',
      description:
        'Reset (clear) bit b (0-7) of the operand to 0. No flags are affected.',
    },
    {
      name: 'RET',
      kind: 'instruction',
      syntax: 'RET / RET cc',
      description:
        'Return from a subroutine by popping the address off the stack. RET cc returns only when condition cc holds.',
    },
    {
      name: 'RETI',
      kind: 'instruction',
      syntax: 'RETI',
      description:
        'Return from a maskable-interrupt handler; signals completion to Z80 peripherals (the daisy chain) as well as popping the return address.',
    },
    {
      name: 'RETN',
      kind: 'instruction',
      syntax: 'RETN',
      description:
        'Return from a non-maskable-interrupt handler, restoring the interrupt-enable state saved when the NMI was taken.',
    },
    {
      name: 'RL',
      kind: 'instruction',
      syntax: 'RL s',
      description:
        'Rotate the operand left through the carry flag (9-bit rotate: CF → bit 0, bit 7 → CF). Sets S Z P, clears H and N.',
    },
    {
      name: 'RLA',
      kind: 'instruction',
      syntax: 'RLA',
      description:
        'Rotate A left through carry — the fast, flag-light accumulator version of RL A (only H, N and C change).',
    },
    {
      name: 'RLC',
      kind: 'instruction',
      syntax: 'RLC s',
      description:
        'Rotate the operand left circularly (bit 7 → bit 0 and → CF). Sets S Z P, clears H and N.',
    },
    {
      name: 'RLCA',
      kind: 'instruction',
      syntax: 'RLCA',
      description:
        'Rotate A left circularly — the fast accumulator version of RLC A (only H, N and C change).',
    },
    {
      name: 'RLD',
      kind: 'instruction',
      syntax: 'RLD',
      description:
        'Rotate one BCD digit left across A and (HL): low nibble of (HL) → its high nibble, high nibble of (HL) → low nibble of A, low nibble of A → low nibble of (HL).',
    },
    {
      name: 'RR',
      kind: 'instruction',
      syntax: 'RR s',
      description:
        'Rotate the operand right through the carry flag (9-bit rotate: CF → bit 7, bit 0 → CF). Sets S Z P, clears H and N.',
    },
    {
      name: 'RRA',
      kind: 'instruction',
      syntax: 'RRA',
      description:
        'Rotate A right through carry — the fast accumulator version of RR A (only H, N and C change).',
    },
    {
      name: 'RRC',
      kind: 'instruction',
      syntax: 'RRC s',
      description:
        'Rotate the operand right circularly (bit 0 → bit 7 and → CF). Sets S Z P, clears H and N.',
    },
    {
      name: 'RRCA',
      kind: 'instruction',
      syntax: 'RRCA',
      description:
        'Rotate A right circularly — the fast accumulator version of RRC A (only H, N and C change).',
    },
    {
      name: 'RRD',
      kind: 'instruction',
      syntax: 'RRD',
      description:
        'Rotate one BCD digit right across A and (HL) — the mirror of RLD, shifting the nibbles the other way.',
    },
    {
      name: 'RST',
      kind: 'instruction',
      syntax: 'RST p',
      description:
        'Push the return address and call one of the eight fixed restart vectors ($00, $08, $10, $18, $20, $28, $30, $38). A one-byte call.',
    },
    {
      name: 'SBC',
      kind: 'instruction',
      syntax: 'SBC A,s / SBC HL,ss',
      description:
        'Subtract with carry (borrow): A ← A − s − CF, or the 16-bit HL ← HL − ss − CF. Sets N and the other flags.',
    },
    {
      name: 'SCF',
      kind: 'instruction',
      syntax: 'SCF',
      description:
        'Set the carry flag (CF ← 1). Clears H and N; the other flags are unchanged.',
    },
    {
      name: 'SET',
      kind: 'instruction',
      syntax: 'SET b,s',
      description:
        'Set bit b (0-7) of the operand to 1. No flags are affected.',
    },
    {
      name: 'SLA',
      kind: 'instruction',
      syntax: 'SLA s',
      description:
        'Arithmetic shift left: bit 7 → CF, 0 → bit 0 (a multiply by two). Sets S Z P, clears H and N.',
    },
    {
      name: 'SRA',
      kind: 'instruction',
      syntax: 'SRA s',
      description:
        'Arithmetic shift right: bit 0 → CF, bit 7 preserved (sign-extending) — a signed divide by two. Sets S Z P, clears H and N.',
    },
    {
      name: 'SRL',
      kind: 'instruction',
      syntax: 'SRL s',
      description:
        'Logical shift right: bit 0 → CF, 0 → bit 7 — an unsigned divide by two. Sets S Z P, clears H and N.',
    },
    {
      name: 'SUB',
      kind: 'instruction',
      syntax: 'SUB s',
      description:
        'Subtract s from A (A ← A − s), setting N and the other flags. C is set on borrow (A < s unsigned).',
    },
    {
      name: 'XOR',
      kind: 'instruction',
      syntax: 'XOR s',
      description:
        'Bitwise exclusive-OR of A with s, result in A. Clears H, C and N; sets S Z and P. XOR A is the idiomatic way to zero A.',
    },
    {
      name: 'ORG',
      kind: 'directive',
      syntax: 'ORG nn',
      description:
        "Set the assembly origin for the code that follows. It must agree with the block's own load address — the block editor fixes that from where the block sits in the listing.",
    },
    {
      name: 'DB',
      kind: 'directive',
      syntax: 'DB n[,n…]',
      description:
        'Define byte(s) — emit each comma-separated operand as a single byte at the current address. Used for data tables and text.',
    },
    {
      name: 'DW',
      kind: 'directive',
      syntax: 'DW nn[,nn…]',
      description:
        'Define word(s) — emit each operand as a little-endian 16-bit value (low byte first), the way the Z80 stores addresses.',
    },
    {
      name: 'DS',
      kind: 'directive',
      syntax: 'DS n',
      description:
        'Define storage — reserve n zero-filled bytes at the current address, advancing the location counter.',
    },
  ],
};
