/**
 * Hand-written typings for the small surface of jsbeeb (GPL-3.0-or-later,
 * © Matt Godbolt and contributors) that the BBC adapter uses, mirroring the
 * z80core.d.ts precedent for the vendored Z80 core.
 *
 * jsbeeb exposes `jsbeeb/src/*` in its exports map but ships no .d.ts; these
 * declarations cover only what bbcMachine.ts and keyboard.ts touch, verified
 * against jsbeeb 1.13.1 (pinned exactly in package.json).
 */

declare module 'jsbeeb/src/models.js' {
  export interface Model {
    name: string;
    isMaster: boolean;
    isAtom: boolean;
  }
  /**
   * Resolve a model by name/synonym, e.g. 'B' = "BBC B with 8271 (DFS 0.9)"
   * or 'Master' = "BBC Master 128 (DFS)". Returns null for an unknown name.
   */
  export function findModel(name: string): Model | null;
  /** Hidden Master used by the in-ROM BASIC tokenizer (loads master/mos3.20). */
  export const basicOnly: Model;
}

declare module 'jsbeeb/src/video.js' {
  export class Video {
    constructor(
      isMaster: boolean,
      fb32: Uint32Array,
      paint: (minx: number, miny: number, maxx: number, maxy: number) => void,
      /** `{ isAtom: true }` attaches the MC6847 VDG used by the Acorn Atom. */
      opts?: { isAtom?: boolean },
    );
    /** True while the ULA is in teletext (mode 7) operation. */
    teletextMode: boolean;
  }
}

declare module 'jsbeeb/src/soundchip.js' {
  export class FakeSoundChip {
    constructor();
  }
  /**
   * The real SN76489 synthesizer. `onBuffer` is handed a full Float32 mono
   * buffer (at {@link soundchipFreq} Hz) each time the chip fills one; the CPU's
   * VIA pokes it automatically and the scheduler is wired in `initialise`, so the
   * adapter only constructs it and drains via {@link catchUp} once per frame.
   */
  export class SoundChip {
    constructor(onBuffer: (buffer: Float32Array) => void);
    /** Internal sample rate of the emitted buffers (4 MHz / 8 = 500 kHz). */
    readonly soundchipFreq: number;
    /** Flush samples pending since the last call into the buffer / onBuffer. */
    catchUp(): void;
    reset(hard: boolean): void;
  }
  /**
   * The Acorn Atom's 1-bit speaker + sine channel, driven by the PPIA. Same
   * `onBuffer` push model as {@link SoundChip}; `cpuSpeed` tunes the
   * samples-per-cycle for the Atom's 1 MHz 6502.
   */
  export class AtomSoundChip extends SoundChip {
    constructor(
      onBuffer: (buffer: Float32Array) => void,
      opts?: { cpuSpeed?: number },
    );
  }
}

declare module 'jsbeeb/src/fake6502.js' {
  import type { Model } from 'jsbeeb/src/models.js';
  import type { Video } from 'jsbeeb/src/video.js';
  import type { FakeSoundChip, SoundChip } from 'jsbeeb/src/soundchip.js';
  import type { AtomPPIA } from 'jsbeeb/src/ppia.js';

  export interface SysVia {
    keyDown(jsKeyCode: number, shiftDown: boolean): void;
    keyUp(jsKeyCode: number): void;
    keyDownRaw(colRow: readonly [number, number]): void;
    keyUpRaw(colRow: readonly [number, number]): void;
    clearKeys(): void;
    setKeyLayout(layout: 'physical' | 'natural' | 'gaming'): void;
  }

  /**
   * The real Cpu6502 (the "fake" in the name refers to the peripherals it
   * wires up by default). Only the members the adapter uses are declared.
   */
  export interface Cpu6502 {
    /** Loads the model's OS/BASIC/DFS ROMs (via utils.loadData) and resets. */
    initialise(): Promise<void>;
    /** Run for n 2MHz cycles; false when stopped by a debug hook. */
    execute(cycles: number): boolean;
    reset(hard: boolean): void;
    /** Hold/release the reset line (BREAK key). */
    setReset(resetOn: boolean): void;
    readmem(addr: number): number;
    writemem(addr: number, value: number): void;
    readonly sysvia: SysVia;
    /** The 8255 PPIA keyboard/tape interface — present only on the Atom CPU. */
    readonly atomppia?: AtomPPIA;
  }

  export function fake6502(
    model: Model,
    opts?: { video?: Video; soundChip?: FakeSoundChip | SoundChip },
  ): Cpu6502;
}

declare module 'jsbeeb/src/basic-tokenise.js' {
  export interface Tokeniser {
    /**
     * Tokenize BBC BASIC source using the genuine ROM routine. Lines without
     * numbers are auto-numbered 10, 20… Returns the program as a binary
     * string (one charCode per byte). Throws when a tokenized line exceeds
     * 251 bytes.
     */
    tokenise(text: string): string;
  }
  /** Boots a hidden 65C12 with the Master BASIC ROM to do the tokenizing. */
  export function create(): Promise<Tokeniser>;
}

declare module 'jsbeeb/src/utils.js' {
  /** Base URL prepended to 'roms/…' requests in the browser. */
  export function setBaseUrl(url: string): void;
  /** jsbeeb package root for ROM loading when running under node (tests). */
  export function setNodeBasePath(basePath: string): void;
  /** Legacy JS keyCode constants, plus jsbeeb's left/right modifier hacks. */
  export const keyCodes: Record<string, number>;
  /** BBC keyboard matrix positions by key name: [column, row]. */
  export const BBC: Record<string, [number, number]>;
}
