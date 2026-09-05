// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What the machine itself puts on tape, and the only thing the encoder's
 * timings are allowed to be.
 *
 * The monitor's `WRITE` routine at `$FECD` is run on the vendored 6502 core
 * against the real ROM, and every access it makes to the cassette-output
 * flip-flop at `$C020` is timed. Those gaps *are* the tape: the leader, the
 * sync bit, each bit's two phases and the trailing checksum all fall out of
 * them, so a constant in `cassetteEncoder.ts` that drifted from the ROM fails
 * here rather than on someone's tape deck.
 *
 * `SAVE` at `$F140` sets the range up and calls `WRITE` twice, entering at
 * `$FECF` the second time so the leader count in A is its own; that entry is
 * used below to keep the leaders short enough to run in a test.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { StateMachineCpu } from '../../../emulator/6502/cpu6502.js';
import type { BusInterface } from '../../../emulator/6502/cpu6502.js';
import { ROM_BASE } from '../addresses';
import {
  CHECKSUM_SEED,
  LEADER_PHASE_CYCLES,
  ONE_PHASE_CYCLES,
  SECOND_HEADER_COUNT,
  SYNC_LONG_CYCLES,
  SYNC_SHORT_CYCLES,
  ZERO_PHASE_CYCLES,
  leaderPhases,
  tapeChecksum,
  tapePhaseCycles,
} from './cassetteEncoder';

/** `WRITE` past its own `LDA #$40`, which is where `SAVE` enters it. */
const WRITE_BODY = 0xfecf;
/** The `BELL` the routine finishes at. */
const WRITE_DONE = 0xff3a;

/** Monitor zero page: the range `WRITE` walks, A1 to A2 inclusive. */
const A1L = 0x3c;
const A2L = 0x3e;

/** Somewhere in RAM to put the bytes being written. */
const BUFFER = 0x0300;

/**
 * Cycles a phase may differ from the encoder's by.
 *
 * The routine's delay loops are exact, but the branches around them are not
 * always: a `BNE` that crosses a page costs a cycle more than one that does
 * not, and the last bit of a byte leaves through `RTS` rather than round the
 * loop. So the ROM's own phases vary by a few cycles either way, which at
 * ~250 is well under 3% and no reader could measure.
 */
const PHASE_SLOP = 8;

const rom = new Uint8Array(readFileSync('public/roms/apple2/apple2.rom'));

/**
 * Run `WRITE` over `bytes` with `headerCount` in A, and return the gaps between
 * its cassette-output accesses, in CPU cycles.
 */
function tapeFromRom(headerCount: number, bytes: readonly number[]): number[] {
  const mem = new Uint8Array(0x10000);
  mem.set(rom, ROM_BASE);
  mem.set(bytes, BUFFER);
  mem[A1L] = BUFFER & 0xff;
  mem[A1L + 1] = BUFFER >> 8;
  mem[A2L] = (BUFFER + bytes.length - 1) & 0xff;
  mem[A2L + 1] = (BUFFER + bytes.length - 1) >> 8;

  let cycles = 0;
  const flips: number[] = [];
  // Every address in $C0xx is a wire; only the cassette output at $C020 - which
  // decodes on bits 6-4, so the whole of $C020-$C02F - matters here.
  const touch = (a: number): number => {
    if ((a & 0xfff0) === 0xc020) flips.push(cycles);
    return 0xff;
  };
  const bus: BusInterface = {
    read: (a) => (
      (a &= 0xffff),
      a >= 0xc000 && a <= 0xc0ff ? touch(a) : mem[a]!
    ),
    write: (a, v) => {
      a &= 0xffff;
      if (a >= 0xc000 && a <= 0xc0ff) touch(a);
      else if (a < ROM_BASE) mem[a] = v & 0xff;
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
  cpu.state.p = WRITE_BODY;
  cpu.state.s = 0xff;
  cpu.state.a = headerCount;
  // Carry set, as `SAVE`'s `SBC` loop leaves it: `HEADR` writes it out with
  // every leader phase, so it decides the leader's tone.
  cpu.state.flags |= 0x01;

  while (cpu.state.p !== WRITE_DONE) {
    cpu.cycle();
    cycles++;
  }
  return flips.slice(1).map((at, i) => at - flips[i]!);
}

/** Split a tape into its leader run and everything after it. */
function afterLeader(phases: readonly number[]): {
  leader: number[];
  rest: number[];
} {
  let n = 0;
  while (n < phases.length && phases[n]! > SYNC_SHORT_CYCLES * 1.5) n++;
  return { leader: [...phases.slice(0, n)], rest: [...phases.slice(n)] };
}

describe('apple2 cassette timings, against the ROM that made them', () => {
  it('writes the leader, sync bit and bit phases the encoder claims', () => {
    const { leader, rest } = afterLeader(tapeFromRom(1, [0x00]));

    // One tone throughout, at the phase the encoder emits. The last phase of
    // every 256 is four cycles longer - the outer loop's `ADC`/`BCS` - which is
    // inside the slop a reader works to.
    expect(leader.length).toBeGreaterThan(0);
    for (const phase of leader) {
      expect(Math.abs(phase - LEADER_PHASE_CYCLES)).toBeLessThanOrEqual(
        PHASE_SLOP,
      );
    }

    // The sync bit: one short phase, then an ordinary one.
    expect(Math.abs(rest[0]! - SYNC_SHORT_CYCLES)).toBeLessThanOrEqual(
      PHASE_SLOP,
    );
    expect(Math.abs(rest[1]! - SYNC_LONG_CYCLES)).toBeLessThanOrEqual(
      PHASE_SLOP,
    );

    // $00 then its checksum $FF: eight `0` bits then eight `1` bits, which pins
    // both phase pairs and the seed in one go.
    const bits = rest.slice(2);
    expect(bits).toHaveLength(32);
    for (let i = 0; i < 16; i += 2) {
      expect(Math.abs(bits[i]! - ZERO_PHASE_CYCLES[0])).toBeLessThanOrEqual(
        PHASE_SLOP,
      );
      expect(Math.abs(bits[i + 1]! - ZERO_PHASE_CYCLES[1])).toBeLessThanOrEqual(
        PHASE_SLOP,
      );
    }
    for (let i = 16; i < 32; i += 2) {
      expect(Math.abs(bits[i]! - ONE_PHASE_CYCLES[0])).toBeLessThanOrEqual(
        PHASE_SLOP,
      );
      expect(Math.abs(bits[i + 1]! - ONE_PHASE_CYCLES[1])).toBeLessThanOrEqual(
        PHASE_SLOP,
      );
    }
  });

  it('writes 256 leader phases per pass of HEADR, less the one the sync bit takes', () => {
    for (const count of [0, 1, 2, SECOND_HEADER_COUNT]) {
      expect(afterLeader(tapeFromRom(count, [0x00])).leader).toHaveLength(
        leaderPhases(count),
      );
    }
    // The second of `SAVE`'s two records, which is the shorter leader of the
    // pair and so the one that has to outlast `READ`'s own settling delay.
    const seconds =
      (leaderPhases(SECOND_HEADER_COUNT) * LEADER_PHASE_CYCLES) / 1_020_484;
    expect(seconds).toBeGreaterThan(4);
    expect(seconds).toBeLessThan(5);
  });

  it('seeds the checksum at $FF, whatever leader count HEADR was given', () => {
    // `HEADR` subtracts its way down to a borrow and always leaves A = $FF, and
    // both `WRITE` and `READ` take that as the seed - so a tape written behind
    // a long leader and one behind a short leader checksum identically.
    const data = [0x11, 0x22, 0x33];
    const expected = tapeChecksum(Uint8Array.from(data));
    expect(expected).toBe(CHECKSUM_SEED ^ 0x11 ^ 0x22 ^ 0x33);
    for (const count of [0, 1]) {
      const { rest } = afterLeader(tapeFromRom(count, data));
      expect(bytesOf(rest.slice(2))).toEqual([...data, expected]);
    }
  });

  it('is what the encoder emits, phase for phase', () => {
    const bytes = Uint8Array.from([0x4a, 0x00, 0xff, 0xa5]);
    const fromRom = tapeFromRom(1, [...bytes]);
    // The encoder's trailing phase has no counterpart on the machine: the ROM
    // stops flipping after the last bit and the line simply rests there, so the
    // recording needs an end for that phase to be measured against.
    const fromEncoder = tapePhaseCycles([{ bytes, headerCount: 1 }]).slice(
      0,
      -1,
    );

    expect(fromEncoder).toHaveLength(fromRom.length);
    for (let i = 0; i < fromRom.length; i++) {
      expect(Math.abs(fromEncoder[i]! - fromRom[i]!)).toBeLessThanOrEqual(
        PHASE_SLOP,
      );
    }
  });
});

/** Read phase pairs back as bytes, most significant bit first. */
function bytesOf(phases: readonly number[]): number[] {
  const split = ZERO_PHASE_CYCLES[0] + ONE_PHASE_CYCLES[0];
  const out: number[] = [];
  for (let i = 0; i + 15 < phases.length; i += 16) {
    let value = 0;
    for (let bit = 0; bit < 8; bit++) {
      const pair = phases[i + bit * 2]! + phases[i + bit * 2 + 1]!;
      value = (value << 1) | (pair > split ? 1 : 0);
    }
    out.push(value);
  }
  return out;
}
