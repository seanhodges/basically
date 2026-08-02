// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Keyboard input for the Altair (Stage 2) - a queue, not a matrix.
 *
 * Every other machine here scans a key matrix: the ROM strobes rows and reads
 * columns, so the emulator models which keys are physically *held*. The Altair
 * has no keyboard at all. Characters arrive over the serial line already
 * encoded as ASCII, one per keystroke, so this adapter turns key tokens and DOM
 * key events into bytes and hands them to {@link Altair8800Serial}'s input
 * queue. Nothing is ever "held down".
 *
 * That difference is worth preserving in the virtual keyboard's tokens too:
 * `setKey` receives DOM-code-style tokens from the ASR-33 layout (Stage 3), and
 * this module maps them - with the SHIFT layer and the CTRL combinations the
 * teletype offered - to the single byte the machine would have received.
 * CTRL-C (0x03) matters most: it is how a running Altair BASIC program is
 * interrupted.
 */
export class Altair8800Keyboard {
  /** Translate a virtual-keyboard token press into a queued ASCII byte. */
  setToken(_token: string, _down: boolean): void {
    throw new Error('altair8800: not implemented');
  }

  /** Translate a physical DOM key event; returns true when consumed. */
  handleEvent(_e: KeyboardEvent, _down: boolean): boolean {
    throw new Error('altair8800: not implemented');
  }

  /** Drop any modifier state (stop, blur, unmount). */
  releaseAll(): void {
    throw new Error('altair8800: not implemented');
  }
}
