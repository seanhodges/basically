// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What Applesoft's own `SAVE` puts on tape, and the only framing the encoder is
 * allowed to have.
 *
 * The modulation underneath is the monitor's `WRITE` and is pinned next door,
 * against the ROM that made it, by `apple2/audio/cassetteRom.test.ts` - the two
 * interpreters call the same routine. What is checked here is the layer above
 * it: `SAVE` at `$D8B0` is run on the vendored 6502 core over the memory of a
 * machine that has actually been typed a program, and every call it makes to
 * `WRITE` is caught with the range it was handed and the leader count in A.
 *
 * `WRITE` itself is turned into an immediate `RTS` at that point. Letting it
 * run would emit twenty-one seconds of leader tone a phase at a time for a
 * measurement that is finished the moment the call is made, and the phases it
 * would emit are not this file's question.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { StateMachineCpu } from '../../../emulator/6502/cpu6502.js';
import type { BusInterface } from '../../../emulator/6502/cpu6502.js';
import { ROM_BASE } from '../../apple2/addresses';
import { bootMachine, hasRom, runFrames, runUntil } from '../../bootHarness';
import type { MachineEmulator } from '../../types';
import { apple2plus } from '../index';
import { PROGRAM_BASE, TXTTAB, VARTAB } from '../addresses';
import { programEnd } from '../basicImage';
import { tokenizeProgram } from '../tokenizer';
import {
  HEADER_FLAG_BYTE,
  HEADER_RECORD_BYTES,
  SAVE_LEADER_COUNT,
  cassetteRecords,
} from './cassette';

/** Applesoft's `SAVE`, off the statement dispatch table's `$B7` entry. */
const SAVE = 0xd8b0;
/** The monitor's `WRITE`, which `SAVE` calls once per record. */
const WRITE = 0xfecd;
/** `WRITE` past its own `LDA #$40` - the entry `SAVE` never uses. */
const WRITE_BODY = 0xfecf;

/** Monitor zero page: the range `WRITE` walks, A1 to A2 inclusive. */
const A1L = 0x3c;
const A2L = 0x3e;

/** Applesoft's end-of-program pointer, which `SAVE` measures the length from. */
const PRGEND = 0x00af;
/** The byte `SAVE` writes as the third of the header record. */
const TEMPPT = 0x0052;

/** Somewhere unreachable to return to, so the run has an end. */
const SENTINEL = 0x2000;

const SOURCE = '10 PRINT 1\n20 END\n';

const rom = new Uint8Array(
  readFileSync('public/roms/apple2plus/apple2plus.rom'),
);

/** One call `SAVE` made to `WRITE`, as the routine was handed it. */
interface WriteCall {
  /** Where the range starts and ends, inclusive - `WRITE` walks A1 to A2. */
  from: number;
  to: number;
  /** The count in A, which `HEADR` turns into the leader. */
  headerCount: number;
  bytes: number[];
}

/**
 * Run `SAVE` over a machine's memory and report the calls it makes to `WRITE`.
 */
function saveCalls(ram: Uint8Array): WriteCall[] {
  const mem = new Uint8Array(0x10000);
  mem.set(ram.subarray(0, ROM_BASE));
  mem.set(rom, ROM_BASE);

  // Every address in $C0xx is a wire, and nothing here reads one for its value.
  const bus: BusInterface = {
    read: (a) => ((a &= 0xffff), a >= 0xc000 && a <= 0xc0ff ? 0xff : mem[a]!),
    write: (a, v) => {
      a &= 0xffff;
      if (a < 0xc000) mem[a] = v & 0xff;
    },
    peek: (a) => mem[a & 0xffff]!,
    poke: (a, v) => void (mem[a & 0xffff] = v & 0xff),
    readWord: (a) => bus.read(a) | (bus.read(a + 1) << 8),
  };

  const cpu = new StateMachineCpu(bus);
  cpu.reset();
  // Reset takes several cycles and lands mid-instruction; the routine can only
  // be entered at an instruction boundary.
  while (cpu.executionState !== 1) cpu.cycle();
  mem[0x01ff] = ((SENTINEL - 1) >> 8) & 0xff;
  mem[0x01fe] = (SENTINEL - 1) & 0xff;
  cpu.state.s = 0xfd;
  cpu.state.p = SAVE;

  const calls: WriteCall[] = [];
  while (cpu.state.p !== SENTINEL) {
    if (
      cpu.executionState === 1 &&
      (cpu.state.p === WRITE || cpu.state.p === WRITE_BODY)
    ) {
      const from = mem[A1L]! | (mem[A1L + 1]! << 8);
      const to = mem[A2L]! | (mem[A2L + 1]! << 8);
      calls.push({
        from,
        to,
        // Entering at `WRITE` runs its own `LDA #$40`; entering behind it keeps
        // whatever the caller put in A, which is how the sibling's `SAVE` gets
        // a shorter second leader.
        headerCount:
          cpu.state.p === WRITE ? rom[WRITE + 1 - ROM_BASE]! : cpu.state.a,
        bytes: [...mem.subarray(from, to + 1)],
      });
      // Return as `WRITE` would, without writing the tape it would write.
      const s = cpu.state.s;
      const lo = mem[0x0100 | ((s + 1) & 0xff)]!;
      const hi = mem[0x0100 | ((s + 2) & 0xff)]!;
      cpu.state.s = (s + 2) & 0xff;
      cpu.state.p = (((hi << 8) | lo) + 1) & 0xffff;
      continue;
    }
    cpu.cycle();
  }
  return calls;
}

/** Type a line at the prompt the way an owner would, and let it be read. */
async function type(m: MachineEmulator, text: string): Promise<void> {
  for (const ch of text) {
    const token =
      ch === '\n'
        ? 'Enter'
        : ch === ' '
          ? 'Space'
          : /[0-9]/.test(ch)
            ? `Digit${ch}`
            : `Key${ch}`;
    m.setKey(token, true);
    await runFrames(m, 2);
    m.setKey(token, false);
    await runFrames(m, 5);
  }
}

const describeOnRom = hasRom(apple2plus) ? describe : describe.skip;

describeOnRom(
  'apple2plus cassette framing, against the ROM that writes it',
  () => {
    it('writes the records the encoder builds, from a program typed at the prompt', async () => {
      const machine = await bootMachine(apple2plus);
      try {
        await runUntil(
          machine,
          () =>
            (machine.readScreenText()?.lines ?? []).some((l) =>
              l.startsWith(']'),
            ),
          600,
        );
        await type(machine, SOURCE);
        // The line the prompt is on is drawn before the workspace pointers
        // behind it are; a few fields settle the insertion.
        await runFrames(machine, 20);

        const ram = (machine as unknown as { mem: { mem: Uint8Array } }).mem
          .mem;
        const { program } = tokenizeProgram(SOURCE);
        expect([
          ...ram.subarray(PROGRAM_BASE, PROGRAM_BASE + program.length),
        ]).toEqual([...program]);

        // What the interpreter's own insertion code left behind, and what the
        // image builder has to agree with: the length `SAVE` writes is
        // `PRGEND - TXTTAB`, and the range it writes ends at `VARTAB`.
        const word = (address: number) =>
          ram[address]! | (ram[address + 1]! << 8);
        expect(word(TXTTAB)).toBe(PROGRAM_BASE);
        expect(word(VARTAB)).toBe(programEnd(program));
        expect(word(PRGEND)).toBe(word(VARTAB));
        expect(ram[TEMPPT]).toBe(HEADER_FLAG_BYTE);

        // `WRITE` opens with `LDA #<count>`, so the count a caller entering at
        // the front gets is the ROM's own byte rather than an assumption.
        expect(rom[WRITE - ROM_BASE]).toBe(0xa9);

        const calls = saveCalls(ram);
        expect(calls).toHaveLength(2);

        // Both records go out behind a full-length leader: `SAVE` enters `WRITE`
        // at its own `LDA #$40` twice, where the sibling's enters behind it with
        // a shorter count the second time.
        expect(calls.map((c) => c.headerCount)).toEqual([
          SAVE_LEADER_COUNT,
          SAVE_LEADER_COUNT,
        ]);

        // The header record: $0050-$0052, three bytes inclusive.
        expect(calls[0]!.from).toBe(0x0050);
        expect(calls[0]!.to).toBe(TEMPPT);
        expect(calls[0]!.bytes).toHaveLength(HEADER_RECORD_BYTES);

        // The program record: TXTTAB through VARTAB inclusive, which is one byte
        // more than the program itself.
        expect(calls[1]!.from).toBe(PROGRAM_BASE);
        expect(calls[1]!.to).toBe(programEnd(program));
        expect(calls[1]!.bytes).toHaveLength(program.length + 1);

        // And the encoder's own records, byte for byte - bar the byte past the
        // program's end, which is the machine's uninitialised RAM and zero here.
        const [header, text] = cassetteRecords(program);
        expect([...header!.bytes]).toEqual(calls[0]!.bytes);
        expect([...text!.bytes.subarray(0, program.length)]).toEqual(
          calls[1]!.bytes.slice(0, program.length),
        );
        expect(text!.bytes).toHaveLength(calls[1]!.bytes.length);
      } finally {
        machine.dispose();
      }
    });
  },
);
