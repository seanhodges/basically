import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dialects } from './registry';

const PUBLIC = path.resolve(__dirname, '../../public');

// The Commodore machines fetch their own ROM sets the moment they are
// constructed. Nothing here needs them - a frame rate is a property of the
// clock and the frame geometry, answerable before any ROM runs - but an
// unstubbed fetch logs a bringup failure per machine and buries real output.
beforeAll(() => {
  vi.stubGlobal('fetch', async (url: string) => {
    const rel = String(url).slice(String(url).indexOf('roms/'));
    const data = readFileSync(path.join(PUBLIC, rel));
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    };
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

/**
 * Every machine declares the rate its frames represent, and the run loop paces
 * to it. Before that existed the loop ran one frame per animation frame, which
 * made emulated speed a property of the user's monitor - 1.2x on a 60Hz panel,
 * 2.4x on a 120Hz one.
 *
 * The values are pinned here rather than left to a range check because each one
 * is a hardware fact, and a plausible-looking wrong one (50 where the machine is
 * really 50.08) is exactly what this is meant to catch. They are also nearly all
 * *not* 50, which is the point: a machine's frame rate is its clock divided by
 * the cycles in a frame, and those rarely divide evenly.
 *
 * A new dialect fails here until it says which it is - deliberately, since
 * shipping a machine at the wrong speed is invisible without a reference to
 * compare against.
 */
const EXPECTED_FRAME_HZ: Record<string, number> = {
  // 3.25MHz over a 312-line PAL field of 64µs lines. Neither Sinclair machine
  // has frame hardware - the ROM builds the picture - so this is the rate the
  // host renders at, chosen to keep the CPU at its true clock.
  zx81: 50.08,
  zx80: 50.08,
  // 3.5MHz / 69888 T (312 lines x 224). The classic 48K ULA frame.
  zxspectrum: 50.08,
  // 3.5469MHz / 70908 T (311 lines x 228). The 128K ULA is a line shorter.
  zxspectrum128: 50.02,
  // 2MHz / 40000. Both Acorn machines run the 6502 at 2MHz on a 50Hz field.
  bbcmicro: 50.0,
  bbcmaster: 50.0,
  // 985248Hz / 19656 (312 rows x 63). PAL VIC-II.
  commodore64: 50.12,
  // 1MHz / 20000, the 50Hz PAL editor ROM.
  pet: 50.0,
  // 1108404Hz / 22152 (312 rows x 71). PAL VIC-I.
  vic20: 50.04,
  // 1MHz / 20000.
  atom: 50.0,
  // A statement-budget backend with no raster; 50 is the throughput its
  // statements-per-frame figure was calibrated against.
  trs80: 50.0,
  // 4MHz / (256 T x 312 lines). Not a constant on this machine: the CRTC sets
  // the frame length, so this is the rate at the power-on register values.
  cpc464: 50.08,
  cpc6128: 50.08,
  // No video at all - a front panel and a serial terminal. 50 is how often the
  // host is given a chance to redraw the terminal, not a hardware figure.
  altair8800: 50.0,
  pmd85: 50.0,
};

describe('machine frame rates', () => {
  it('covers every registered dialect', () => {
    expect(Object.keys(EXPECTED_FRAME_HZ).sort()).toEqual(
      dialects.map((d) => d.id).sort(),
    );
  });

  for (const dialect of dialects) {
    it(`${dialect.id} reports its native frame rate`, () => {
      // A blank image of the right size: frameHz is a property of the machine's
      // clock and frame geometry, so it is answerable before any ROM runs.
      const machine = dialect.createEmulator({
        rom: new Uint8Array(dialect.romBytes ?? 0),
        ramKb: 16,
      });
      try {
        expect(machine.frameHz).toBeCloseTo(EXPECTED_FRAME_HZ[dialect.id]!, 2);
      } finally {
        machine.dispose();
      }
    });
  }

  it('never reports a rate that would pace the loop absurdly', () => {
    // A NaN or zero here would divide into an infinite frame period and hang
    // the run loop rather than fail visibly - the one failure mode worth a
    // separate guard. NaN is the realistic way in: `frameHz` is initialised
    // from other class fields, so declaring it above them would yield one.
    for (const dialect of dialects) {
      const machine = dialect.createEmulator({
        rom: new Uint8Array(dialect.romBytes ?? 0),
        ramKb: 16,
      });
      try {
        expect(Number.isFinite(machine.frameHz), dialect.id).toBe(true);
        expect(machine.frameHz, dialect.id).toBeGreaterThan(1);
      } finally {
        machine.dispose();
      }
    }
  });
});
