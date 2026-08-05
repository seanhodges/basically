// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { SIO_RX_READY, SIO_TX_READY } from '../addresses';
import { Altair8800Serial } from './serial';
import { Altair8800Terminal } from './terminal';

function board() {
  const terminal = new Altair8800Terminal();
  return { terminal, serial: new Altair8800Serial(terminal) };
}

/**
 * The polarity of the status bits is the detail that decides whether this
 * machine accepts a keystroke at all, so it is asserted here in the same terms
 * BASIC's patched driver uses: `IN 10 / ANI 01 / JZ back` spins while the bit
 * is clear, which means a waiting character has to read as a *set* bit.
 */
describe('altair8800 88-2SIO', () => {
  it('reports the transmitter ready and the receiver empty at rest', () => {
    const { serial } = board();
    expect(serial.readStatus() & SIO_TX_READY).toBe(SIO_TX_READY);
    expect(serial.readStatus() & SIO_RX_READY).toBe(0);
  });

  it('raises RDRF active high once a character is waiting', () => {
    const { serial } = board();
    serial.queueInput(0x41);
    expect(serial.readStatus() & SIO_RX_READY).toBe(SIO_RX_READY);
  });

  it('hands over queued characters in order, clearing RDRF on the last', () => {
    const { serial } = board();
    serial.queueText('RUN\r');
    expect(serial.pendingInput).toBe(4);

    expect(serial.readData()).toBe(0x52); // R
    expect(serial.readData()).toBe(0x55); // U
    expect(serial.readData()).toBe(0x4e); // N
    expect(serial.readStatus() & SIO_RX_READY).toBe(SIO_RX_READY);
    expect(serial.readData()).toBe(0x0d);
    expect(serial.readStatus() & SIO_RX_READY).toBe(0);
  });

  it('writes data through to the terminal', () => {
    const { serial, terminal } = board();
    for (const code of [0x4f, 0x4b]) serial.writeData(code);
    expect(terminal.readRow(0)).toBe('OK');
  });

  it('accepts and discards ACIA control writes', () => {
    const { serial, terminal } = board();
    serial.writeControl(0x03); // master reset
    serial.writeControl(0x11); // 8 bits, no parity
    expect(terminal.text().trim()).toBe('');
    expect(serial.readStatus() & SIO_TX_READY).toBe(SIO_TX_READY);
  });

  it('drops pending input when the console is cleared', () => {
    const { serial } = board();
    serial.queueText('HALF TYPED');
    serial.clearInput();
    expect(serial.pendingInput).toBe(0);
    expect(serial.readStatus() & SIO_RX_READY).toBe(0);
  });
});
