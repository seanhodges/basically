// Reference table data for the 6502 assembly page.
// Seeded from the assembler engine's mnemonic set (src/asm/m6502) by
// scripts/gen-reference-scaffold.mts, then hand-enriched (typed operand syntax
// + fuller descriptions). Edit by hand; the generator skips this file once it
// exists. The instruction rows are kept in sync with m6502Engine.mnemonics by
// src/reference/asm-reference.test.ts.
//
// Operand shorthand used in the syntax column (see the page prose for the full
// addressing-mode list):
//   #n     = 8-bit immediate            $nn      = zero page
//   $nnnn  = absolute (16-bit)          ,X / ,Y  = indexed
//   ($nn,X) / ($nn),Y = indirect        A        = accumulator
//   label  = relative branch target
import type { ReferenceTableData } from './types';

export const m6502AssemblyReference: ReferenceTableData = {
  title: '6502 assembly',
  machines: [
    'Commodore 64',
    'Commodore VIC-20',
    'Commodore PET',
    'BBC Micro',
    'BBC Master',
    'Acorn Atom',
    'Apple I',
  ],
  entries: [
    {
      name: 'ADC',
      kind: 'instruction',
      syntax: 'ADC #n / ADC $nn / ADC $nnnn,X …',
      description:
        'Add memory to the accumulator with carry: A ← A + M + C. Sets N V Z C. There is no add-without-carry, so clear carry (CLC) before the first ADC.',
    },
    {
      name: 'AND',
      kind: 'instruction',
      syntax: 'AND #n / AND $nn …',
      description:
        'Bitwise AND of memory into the accumulator (A ← A & M). Sets N and Z.',
    },
    {
      name: 'ASL',
      kind: 'instruction',
      syntax: 'ASL A / ASL $nn …',
      description:
        'Arithmetic shift left of A or memory: bit 7 → carry, 0 → bit 0 (a multiply by two). Sets N Z C.',
    },
    {
      name: 'BCC',
      kind: 'instruction',
      syntax: 'BCC label',
      description:
        'Branch if carry clear (C = 0). Relative, −128…+127 bytes from the next instruction.',
    },
    {
      name: 'BCS',
      kind: 'instruction',
      syntax: 'BCS label',
      description:
        'Branch if carry set (C = 1). Common after a compare to test "greater or equal" (unsigned).',
    },
    {
      name: 'BEQ',
      kind: 'instruction',
      syntax: 'BEQ label',
      description: 'Branch if equal — taken when the zero flag is set (Z = 1).',
    },
    {
      name: 'BIT',
      kind: 'instruction',
      syntax: 'BIT $nn / BIT $nnnn',
      description:
        'Test bits: AND A with memory to set Z, and copy memory bits 7 and 6 into N and V. A and the memory are left unchanged.',
    },
    {
      name: 'BMI',
      kind: 'instruction',
      syntax: 'BMI label',
      description:
        'Branch if minus — taken when the negative flag is set (N = 1).',
    },
    {
      name: 'BNE',
      kind: 'instruction',
      syntax: 'BNE label',
      description:
        'Branch if not equal — taken when the zero flag is clear (Z = 0).',
    },
    {
      name: 'BPL',
      kind: 'instruction',
      syntax: 'BPL label',
      description:
        'Branch if plus — taken when the negative flag is clear (N = 0).',
    },
    {
      name: 'BRK',
      kind: 'instruction',
      syntax: 'BRK',
      description:
        'Force a software interrupt: push PC and status, set the interrupt-disable flag and vector through $FFFE. A one-byte instruction that skips the following byte.',
    },
    {
      name: 'BVC',
      kind: 'instruction',
      syntax: 'BVC label',
      description: 'Branch if overflow clear (V = 0).',
    },
    {
      name: 'BVS',
      kind: 'instruction',
      syntax: 'BVS label',
      description: 'Branch if overflow set (V = 1).',
    },
    {
      name: 'CLC',
      kind: 'instruction',
      syntax: 'CLC',
      description:
        'Clear the carry flag. Do this before the first ADC of a multi-byte addition.',
    },
    {
      name: 'CLD',
      kind: 'instruction',
      syntax: 'CLD',
      description:
        'Clear the decimal-mode flag, returning ADC/SBC to binary arithmetic.',
    },
    {
      name: 'CLI',
      kind: 'instruction',
      syntax: 'CLI',
      description:
        'Clear the interrupt-disable flag, allowing maskable IRQs to be serviced.',
    },
    {
      name: 'CLV',
      kind: 'instruction',
      syntax: 'CLV',
      description: 'Clear the overflow flag (V ← 0).',
    },
    {
      name: 'CMP',
      kind: 'instruction',
      syntax: 'CMP #n / CMP $nn …',
      description:
        'Compare the accumulator with memory by computing A − M and setting N Z C (A is unchanged). C set means A ≥ M (unsigned); Z means equal.',
    },
    {
      name: 'CPX',
      kind: 'instruction',
      syntax: 'CPX #n / CPX $nn / CPX $nnnn',
      description:
        'Compare the X register with memory (X − M), setting N Z C. X is unchanged.',
    },
    {
      name: 'CPY',
      kind: 'instruction',
      syntax: 'CPY #n / CPY $nn / CPY $nnnn',
      description:
        'Compare the Y register with memory (Y − M), setting N Z C. Y is unchanged.',
    },
    {
      name: 'DEC',
      kind: 'instruction',
      syntax: 'DEC $nn / DEC $nnnn,X …',
      description:
        'Decrement a memory location by one (M ← M − 1). Sets N and Z. The NMOS 6502 has no DEC A.',
    },
    {
      name: 'DEX',
      kind: 'instruction',
      syntax: 'DEX',
      description: 'Decrement the X register by one. Sets N and Z.',
    },
    {
      name: 'DEY',
      kind: 'instruction',
      syntax: 'DEY',
      description: 'Decrement the Y register by one. Sets N and Z.',
    },
    {
      name: 'EOR',
      kind: 'instruction',
      syntax: 'EOR #n / EOR $nn …',
      description:
        'Bitwise exclusive-OR of memory into the accumulator (A ← A ^ M). Sets N and Z.',
    },
    {
      name: 'INC',
      kind: 'instruction',
      syntax: 'INC $nn / INC $nnnn,X …',
      description:
        'Increment a memory location by one (M ← M + 1). Sets N and Z. The NMOS 6502 has no INC A.',
    },
    {
      name: 'INX',
      kind: 'instruction',
      syntax: 'INX',
      description: 'Increment the X register by one. Sets N and Z.',
    },
    {
      name: 'INY',
      kind: 'instruction',
      syntax: 'INY',
      description: 'Increment the Y register by one. Sets N and Z.',
    },
    {
      name: 'JMP',
      kind: 'instruction',
      syntax: 'JMP $nnnn / JMP ($nnnn)',
      description:
        'Unconditional jump. The indirect form JMP ($nnnn) reads the target from memory (mind the NMOS page-boundary bug when the pointer ends in $FF).',
    },
    {
      name: 'JSR',
      kind: 'instruction',
      syntax: 'JSR $nnnn',
      description:
        'Jump to a subroutine: push the return address (minus one) and jump. Paired with RTS.',
    },
    {
      name: 'LDA',
      kind: 'instruction',
      syntax: 'LDA #n / LDA $nn …',
      description:
        'Load the accumulator from memory (or an immediate). Sets N and Z.',
    },
    {
      name: 'LDX',
      kind: 'instruction',
      syntax: 'LDX #n / LDX $nn …',
      description:
        'Load the X register from memory (or an immediate). Sets N and Z.',
    },
    {
      name: 'LDY',
      kind: 'instruction',
      syntax: 'LDY #n / LDY $nn …',
      description:
        'Load the Y register from memory (or an immediate). Sets N and Z.',
    },
    {
      name: 'LSR',
      kind: 'instruction',
      syntax: 'LSR A / LSR $nn …',
      description:
        'Logical shift right of A or memory: bit 0 → carry, 0 → bit 7 (an unsigned divide by two). N is always cleared; sets Z and C.',
    },
    {
      name: 'NOP',
      kind: 'instruction',
      syntax: 'NOP',
      description:
        'No operation — two cycles, no effect. Used for timing or to patch out code.',
    },
    {
      name: 'ORA',
      kind: 'instruction',
      syntax: 'ORA #n / ORA $nn …',
      description:
        'Bitwise OR of memory into the accumulator (A ← A | M). Sets N and Z.',
    },
    {
      name: 'PHA',
      kind: 'instruction',
      syntax: 'PHA',
      description:
        'Push the accumulator onto the stack; the stack pointer decreases.',
    },
    {
      name: 'PHP',
      kind: 'instruction',
      syntax: 'PHP',
      description: 'Push the processor status (flags) onto the stack.',
    },
    {
      name: 'PLA',
      kind: 'instruction',
      syntax: 'PLA',
      description: 'Pull the accumulator from the stack. Sets N and Z.',
    },
    {
      name: 'PLP',
      kind: 'instruction',
      syntax: 'PLP',
      description: 'Pull the processor status (flags) from the stack.',
    },
    {
      name: 'ROL',
      kind: 'instruction',
      syntax: 'ROL A / ROL $nn …',
      description:
        'Rotate A or memory left through carry (9-bit rotate: C → bit 0, bit 7 → C). Sets N Z C.',
    },
    {
      name: 'ROR',
      kind: 'instruction',
      syntax: 'ROR A / ROR $nn …',
      description:
        'Rotate A or memory right through carry (9-bit rotate: C → bit 7, bit 0 → C). Sets N Z C.',
    },
    {
      name: 'RTI',
      kind: 'instruction',
      syntax: 'RTI',
      description:
        'Return from an interrupt: pull the status and the program counter back off the stack.',
    },
    {
      name: 'RTS',
      kind: 'instruction',
      syntax: 'RTS',
      description:
        'Return from a subroutine: pull the return address and continue after the JSR.',
    },
    {
      name: 'SBC',
      kind: 'instruction',
      syntax: 'SBC #n / SBC $nn …',
      description:
        'Subtract memory from the accumulator with borrow: A ← A − M − (1 − C). Set carry (SEC) before the first subtract. Sets N V Z C.',
    },
    {
      name: 'SEC',
      kind: 'instruction',
      syntax: 'SEC',
      description:
        'Set the carry flag. Do this before the first SBC of a multi-byte subtraction.',
    },
    {
      name: 'SED',
      kind: 'instruction',
      syntax: 'SED',
      description:
        'Set decimal mode, so ADC and SBC do packed binary-coded-decimal arithmetic.',
    },
    {
      name: 'SEI',
      kind: 'instruction',
      syntax: 'SEI',
      description: 'Set the interrupt-disable flag, masking further IRQs.',
    },
    {
      name: 'STA',
      kind: 'instruction',
      syntax: 'STA $nn / STA $nnnn,X …',
      description:
        'Store the accumulator to memory. No flags are affected, and there is no immediate mode.',
    },
    {
      name: 'STX',
      kind: 'instruction',
      syntax: 'STX $nn / STX $nnnn …',
      description: 'Store the X register to memory. No flags are affected.',
    },
    {
      name: 'STY',
      kind: 'instruction',
      syntax: 'STY $nn / STY $nnnn …',
      description: 'Store the Y register to memory. No flags are affected.',
    },
    {
      name: 'TAX',
      kind: 'instruction',
      syntax: 'TAX',
      description: 'Transfer the accumulator to X. Sets N and Z.',
    },
    {
      name: 'TAY',
      kind: 'instruction',
      syntax: 'TAY',
      description: 'Transfer the accumulator to Y. Sets N and Z.',
    },
    {
      name: 'TSX',
      kind: 'instruction',
      syntax: 'TSX',
      description: 'Transfer the stack pointer to X. Sets N and Z.',
    },
    {
      name: 'TXA',
      kind: 'instruction',
      syntax: 'TXA',
      description: 'Transfer X to the accumulator. Sets N and Z.',
    },
    {
      name: 'TXS',
      kind: 'instruction',
      syntax: 'TXS',
      description: 'Transfer X to the stack pointer. No flags are affected.',
    },
    {
      name: 'TYA',
      kind: 'instruction',
      syntax: 'TYA',
      description: 'Transfer Y to the accumulator. Sets N and Z.',
    },
    {
      name: 'ORG',
      kind: 'directive',
      syntax: 'ORG $nnnn',
      description:
        "Set the assembly origin for the code that follows. It must agree with the block's own load address — the block editor fixes that from where the block sits.",
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
        'Define word(s) — emit each operand as a little-endian 16-bit value (low byte first), the way the 6502 stores addresses.',
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
