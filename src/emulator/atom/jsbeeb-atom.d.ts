/**
 * Hand-written typings for the Atom-only corner of jsbeeb (GPL-3.0-or-later,
 * © Matt Godbolt and contributors) that the Atom adapter uses, alongside the
 * shared declarations in ../bbc/jsbeeb.d.ts. Covers only what atomMachine.ts and
 * keyboard.ts touch, verified against the pinned jsbeeb version.
 */

declare module 'jsbeeb/src/ppia.js' {
  /** One Atom key-matrix position: `[portA row select, portB column bit]`. */
  type ColRow = readonly [number, number];

  /**
   * The Acorn Atom's 8255 PPIA — owns the key matrix, speaker and cassette
   * ports. The key methods mirror the BBC SysVia surface so the same typing-via-
   * matrix approach works.
   */
  export class AtomPPIA {
    /** Select the host-key → matrix mapping (we use 'natural'). */
    setKeyLayout(layout: 'physical' | 'natural' | 'gaming'): void;
    /** Host key down/up, resolved against the current shift state. */
    keyDown(jsKeyCode: number, shiftDown: boolean): void;
    keyUp(jsKeyCode: number): void;
    /** Press/release/toggle a raw matrix cell directly. */
    keyDownRaw(colRow: ColRow): void;
    keyUpRaw(colRow: ColRow): void;
    keyToggleRaw(colRow: ColRow): void;
    /** Release every held key. */
    clearKeys(): void;
  }
}

declare module 'jsbeeb/src/utils_atom.js' {
  /** Atom key-matrix positions by key name: `[row, col]`. */
  export const ATOM: Record<string, readonly [number, number]>;
  /**
   * Expand an ASCII string into the matrix-press sequence that types it,
   * inserting SHIFT / caps-LOCK toggle keys as needed.
   */
  export function stringToATOMKeys(str: string): readonly [number, number][];
}
