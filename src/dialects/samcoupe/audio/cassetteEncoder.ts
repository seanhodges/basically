import { SPECTRUM_HEADER_BLOCK, type SamBlock } from '../samfile';

/**
 * SAM Coupé cassette encoding, as the ROM's `SABLK` writes it.
 *
 * The scheme is the Spectrum's: a square wave whose level flips on every
 * "pulse", a long leader tone to lock onto, two short sync pulses, then two
 * equal pulses per data bit - short for `0`, twice as long for `1`, MSB first.
 * The first byte of every block is its type (`0x01` header, `0xFF` data) and
 * the last is the XOR parity, both already in {@link SamBlock.bytes}.
 *
 * What differs is the timing, and it is not a round number because the ROM
 * makes it out of a `DJNZ` delay loop rather than a table. `SABLK` reads a
 * speed register (`DEVICE T<n>` sets it; the ROM's own default is `TSPEED`,
 * 112), uses it as the short-pulse count `L`, derives the long-pulse count
 * `H = 2*(L+1)+1`, and spends `13*R + 33` T-states of a 6MHz Z80 on a data
 * pulse counted with `R`. The leader loop is a different shape and costs
 * `16*R + 51` per pulse, and the two sync pulses use `(H >> 2) + 3`.
 *
 * That works out at 248µs and 497µs for the two data pulses - within 2% of the
 * Spectrum's 244µs and 489µs, so a SAM tape written at the ROM's default speed
 * plays back at very nearly Spectrum speed rather than the 50% faster the
 * machine's manual quotes for it. Nothing downstream depends on the absolute
 * figure: the ROM's loader locks onto the leader and measures every later pulse
 * against its running average, which is why a SAM reads Spectrum tapes as
 * happily as its own.
 */

/** The SAM's Z80 clock. */
const CPU_HZ = 6_000_000;
const TSTATE_MICROS = 1e6 / CPU_HZ;

/**
 * `TSPEED` - the speed a machine that has not been told otherwise saves at.
 * `DEVICE T<n>` sets another; the ROM's own note puts the useful floor at 19,
 * "about 5*ZX", and higher numbers are slower.
 */
export const DEFAULT_TAPE_SPEED = 112;

/** `L`: the delay count `SABLK` spends on a `0` bit. */
const bit0Reg = (speed: number): number => speed;
/** `H`: `INC A / ADD A,A / INC A` on the speed, and the count for a `1` bit. */
const bit1Reg = (speed: number): number => 2 * (speed + 1) + 1;
/** The leader runs at the long-bit count. */
const pilotReg = (speed: number): number => bit1Reg(speed);
/** `SRL C / SRL C / INC C * 3` off the leader count. */
const syncReg = (speed: number): number => (pilotReg(speed) >> 2) + 3;

/** T-states in one data pulse counted with `R` (SVBL's two OUT-to-OUT paths). */
const dataPulseT = (reg: number): number => 13 * reg + 33;
/** T-states in one leader or sync pulse counted with `R` (the SVHDR loop). */
const tonePulseT = (reg: number): number => 16 * reg + 51;

/**
 * Leader pulses per block. `SABLK` accumulates 3000 per turn of a loop that
 * runs until the speed count overflows a byte, which at the default speed is
 * two turns. The ROM's loader locks on after 256 consistent leader pulses, so
 * this is generous - it is about three and a half seconds of tone.
 */
const PILOT_PULSES = 6000;

/**
 * The one block type whose leader the ROM doubles. `INC B / DJNZ` on the type
 * byte falls through to `ADD HL,HL` only when the type is 0x00 - a
 * Spectrum-format header - so a SAM header (0x01) and a data block (0xFF) both
 * take the plain leader, which is not what the code's own comment predicts.
 */
const LONG_LEADER_TYPE = SPECTRUM_HEADER_BLOCK;

/** The shorter of the two data pulses on a default-speed tape, in µs. */
export const ZERO_BIT_PULSE_MICROS =
  dataPulseT(bit0Reg(DEFAULT_TAPE_SPEED)) * TSTATE_MICROS;

export interface SamTapeOptions {
  sampleRate?: number; // default 44100
  amplitude?: number; // default 0.85
  /** Leading silence before the first leader tone, in ms. */
  leadingSilenceMs?: number; // default 500
  /** Silent pause after each block (incl. a trailing pause), in ms. */
  blockPauseMs?: number; // default 1000
  /** Multiplies the leader length for temperamental hardware. */
  pilotScale?: number; // default 1
  /** The `DEVICE T<n>` speed count. Defaults to the ROM's own. */
  speed?: number; // default DEFAULT_TAPE_SPEED
}

function pilotPulses(block: SamBlock, scale: number): number {
  const base =
    block.type === LONG_LEADER_TYPE ? PILOT_PULSES * 2 : PILOT_PULSES;
  return Math.round(base * scale);
}

export function encodeSamTape(
  blocks: readonly SamBlock[],
  opts: SamTapeOptions = {},
): Float32Array {
  const sampleRate = opts.sampleRate ?? 44100;
  const amplitude = opts.amplitude ?? 0.85;
  const leadingSilenceMicros = (opts.leadingSilenceMs ?? 500) * 1000;
  const blockPauseMicros = (opts.blockPauseMs ?? 1000) * 1000;
  const pilotScale = opts.pilotScale ?? 1;

  const speed = opts.speed ?? DEFAULT_TAPE_SPEED;

  const samplesPerMicro = sampleRate / 1e6;
  const pilotT = tonePulseT(pilotReg(speed));
  const syncT = tonePulseT(syncReg(speed));
  const zeroT = dataPulseT(bit0Reg(speed));
  const oneT = dataPulseT(bit1Reg(speed));
  const bitPulseT = (bit: number) => (bit ? oneT : zeroT);

  // Measure the whole recording first so the buffer is allocated exactly once.
  let totalMicros = leadingSilenceMicros + blocks.length * blockPauseMicros;
  for (const block of blocks) {
    totalMicros += pilotPulses(block, pilotScale) * pilotT * TSTATE_MICROS;
    totalMicros += 2 * syncT * TSTATE_MICROS;
    for (const b of block.bytes) {
      for (let bit = 7; bit >= 0; bit--) {
        totalMicros += 2 * bitPulseT(b & (1 << bit)) * TSTATE_MICROS;
      }
    }
  }

  const out = new Float32Array(Math.ceil(totalMicros * samplesPerMicro) + 1);

  // Track the position in exact micros and round only at emission time, so no
  // per-pulse rounding drift builds up over a recording minutes long.
  let micros = 0;
  let level = amplitude;

  const writePulseT = (tstates: number) => {
    const start = micros;
    const end = start + tstates * TSTATE_MICROS;
    out.fill(
      level,
      Math.round(start * samplesPerMicro),
      Math.round(end * samplesPerMicro),
    );
    micros = end;
    level = -level; // every pulse flips the line - that is the square wave
  };

  micros += leadingSilenceMicros; // out is already zero-filled

  for (const block of blocks) {
    const pilot = pilotPulses(block, pilotScale);
    for (let i = 0; i < pilot; i++) writePulseT(pilotT);
    writePulseT(syncT);
    writePulseT(syncT);
    for (const b of block.bytes) {
      for (let bit = 7; bit >= 0; bit--) {
        const pulseT = bitPulseT(b & (1 << bit));
        writePulseT(pulseT);
        writePulseT(pulseT);
      }
    }
    micros += blockPauseMicros;
  }

  return out;
}
