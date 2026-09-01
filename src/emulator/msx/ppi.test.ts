import { describe, expect, it } from 'vitest';
import { MsxPpi, type MsxPpiHost } from './ppi';

/** A host that records what the PPI drove and answers a known matrix. */
function harness(): { ppi: MsxPpi; log: string[]; slots: number[] } {
  const log: string[] = [];
  const slots: number[] = [];
  const host: MsxPpiHost = {
    selectSlots: (value) => slots.push(value),
    // Row r reads back as its own number, so a read names the row selected.
    readKeyboardRow: (row) => row,
    setTapeMotor: (on) => log.push(`motor:${on ? 'on' : 'off'}`),
    writeTapeBit: (bit) => log.push(`tape:${bit}`),
  };
  const ppi = new MsxPpi(host);
  ppi.reset();
  return { ppi, log, slots };
}

const PORT_A = 0;
const PORT_B = 1;
const PORT_C = 2;
const CONTROL = 3;

describe('MsxPpi', () => {
  it('reads back the keyboard row port C selected', () => {
    const { ppi } = harness();
    for (let row = 0; row < 11; row++) {
      ppi.write(PORT_C, row);
      expect(ppi.keyboardRow).toBe(row);
      expect(ppi.read(PORT_B), `row ${row}`).toBe(row);
    }
    // Only the low nibble selects: the bits above it are the tape, the lamp
    // and the key click, and must not move the row.
    ppi.write(PORT_C, 0xf5);
    expect(ppi.read(PORT_B)).toBe(5);
  });

  it('passes port A to the slot register and reads it back', () => {
    const { ppi, slots } = harness();
    ppi.write(PORT_A, 0xf0);
    expect(slots.at(-1)).toBe(0xf0);
    expect(ppi.read(PORT_A)).toBe(0xf0);
  });

  it('drives the tape motor and the CAPS lamp active low', () => {
    const { ppi, log } = harness();
    expect(ppi.tapeMotorOn).toBe(false);
    expect(ppi.capsLedOn).toBe(false);
    // Bit set/reset through the control register, which is how the BIOS does it.
    ppi.write(CONTROL, 0x08); // clear bit 4: motor on
    expect(ppi.tapeMotorOn).toBe(true);
    expect(log).toContain('motor:on');
    ppi.write(CONTROL, 0x09); // set bit 4: motor off
    expect(ppi.tapeMotorOn).toBe(false);
    ppi.write(CONTROL, 0x0c); // clear bit 6: lamp on
    expect(ppi.capsLedOn).toBe(true);
  });

  it('reports each cassette write bit as it is toggled', () => {
    const { ppi, log } = harness();
    ppi.write(CONTROL, 0x0b); // set bit 5
    ppi.write(CONTROL, 0x0a); // clear bit 5
    expect(log).toEqual(['tape:1', 'tape:0']);
  });

  it('leaves the row alone when a set/reset touches another bit', () => {
    const { ppi } = harness();
    ppi.write(PORT_C, 0x53); // row 3, motor off, lamp off
    ppi.write(CONTROL, 0x0f); // set bit 7 (key click)
    expect(ppi.keyboardRow).toBe(3);
    expect(ppi.read(PORT_C)).toBe(0xd3);
  });

  it('answers a write to port B and a read of the control register harmlessly', () => {
    const { ppi } = harness();
    ppi.write(PORT_C, 2);
    ppi.write(PORT_B, 0xff); // port B is an input; the write goes nowhere
    expect(ppi.read(PORT_B)).toBe(2);
    expect(ppi.read(CONTROL)).toBe(0xff); // write-only
  });
});
