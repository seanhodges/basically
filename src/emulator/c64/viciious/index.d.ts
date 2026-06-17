// Hand-written types for the vendored viciious C64 core (plain JS, no types
// upstream). Mirrors the precedent set by `../../z80/z80core.d.ts` and
// `../../6502/cpu6502.d.ts`: the emulator ships as JS kept out of the strict
// typechecker, and this declaration file describes only the surface the
// adapter (`../c64Machine.ts`) actually uses. See LICENSE-VICIIOUS.md for
// attribution and the list of vendored files.

/** A C64 hardware device: every target component exposes these. */
export interface Device {
  tick(): void;
  reset(): void;
}

/** CPU register/state object returned by `cpu.getState()` (subset used here). */
export interface CpuState {
  /** Program counter (16-bit). Polled to detect KERNAL-ready during boot. */
  pc: number;
  a: number;
  x: number;
  y: number;
  s: number;
  p: number;
}

export interface Cpu extends Device {
  getState(): CpuState;
}

/** The address/data bus: RAM + MMIO with the processor-port bank switching. */
export interface Wires {
  reset(): void;
  /** Read a byte (0–255) through the current memory map. */
  cpuRead(address: number): number;
  /** Write a byte through the current memory map. */
  cpuWrite(address: number, value: number): void;
}

export interface Runloop {
  reset(): void;
  /** Poke a short string into the KERNAL keyboard buffer (e.g. "RUN\r"). */
  type(text: string): void;
}

/**
 * Host video sink. The VIC calls {@link setPixel} for every pixel of the PAL
 * frame (including blanking, which the host discards); {@link blit} marks the
 * frame boundary. The adapter supplies its own implementation writing into an
 * RGBA buffer it later paints to the canvas.
 */
export interface VideoHost {
  reset(): void;
  setPixel(x: number, y: number, r: number, g: number, b: number): void;
  blit(): void;
}

/** Host keyboard sink: receives a setter that pushes the 8-byte matrix to CIA1. */
export interface KeyboardHost {
  setSetKeyMatrix(setMatrix: (matrix: number[]) => void): void;
  cursorsToKeys: boolean;
  naturalMapping: boolean;
}

export interface AudioHost {
  reset(): void;
  setVoiceVolume(): void;
  onRegWrite(): void;
}

export interface JoystickHost {
  setSetJoystick1(): void;
  setSetJoystick2(): void;
}

/** `attach` function for one component; called once by {@link bringup}. */
export type Attach<T> = (c64: T) => void;

export interface BringupConfig {
  host: {
    audio: Attach<C64>;
    video: Attach<C64>;
    keyboard: Attach<C64>;
    joystick: Attach<C64>;
  };
  target: {
    wires: Attach<C64>;
    ram: Attach<C64>;
    vic: Attach<C64>;
    sid: Attach<C64>;
    cpu: Attach<C64>;
    cias: Attach<C64>;
    tape: Attach<C64>;
    basic: number[] | Uint8Array;
    kernal: number[] | Uint8Array;
    character: number[] | Uint8Array;
  };
  attachments: Attach<C64>[];
}

/** The assembled machine returned by {@link bringup}. */
export interface C64 {
  hooks: Record<string, ((...args: unknown[]) => void) | undefined>;
  rom: { basic: unknown; kernal: unknown; character: unknown };
  wires: Wires;
  cpu: Cpu;
  vic: Device & { showStatic?(): void };
  sid: Device;
  cias: Device;
  tape: Device;
  ram: Device;
  runloop: Runloop;
  video: VideoHost;
  keyboard: KeyboardHost;
  audio: AudioHost;
  joystick: JoystickHost;
}

export function bringup(config: BringupConfig): C64;

/** Inject a PRG (2-byte LE load address + body) and fix BASIC's pointers. */
export function loadPrg(c64: C64, bytes: Uint8Array): void;

/** A loop in the KERNAL that waits for a key — reached once BASIC is ready. */
export const AWAIT_KEYBOARD_PC: number;
/** Warm-start address that prints the READY. prompt. */
export const READY_PC: number;
/** Clear-screen routine address. */
export const CLEAR_SCREEN_PC: number;
