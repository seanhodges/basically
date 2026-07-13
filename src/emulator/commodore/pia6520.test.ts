import { describe, expect, it } from 'vitest';
import { Pia6520 } from './pia6520';

// Register offsets and the control-register bits the tests drive.
const PORT = 0;
const CR = 1;
const CR_DDR_TO_PORT = 0x04; // bit 2: select peripheral port (not the DDR)
const CR_C1_ENABLE = 0x01; // bit 0: CA1/CB1 interrupt enable

describe('Pia6520', () => {
  it('routes DDR then output/input bits through the port register', () => {
    const pia = new Pia6520({ portA: { read: () => 0xf0 } });
    // Select the DDR (CR bit2 = 0 at reset) and make the low nibble outputs.
    pia.write(PORT, 0x0f);
    // Now flip CR bit2 to address the peripheral port and write the output reg.
    pia.write(CR, CR_DDR_TO_PORT);
    pia.write(PORT, 0x0a);
    // Output pins read back the output register (0x0a & 0x0f); input pins read
    // the wired value (0xf0 & 0xf0).
    expect(pia.read(PORT)).toBe(0xfa);
    expect(pia.portAOut()).toBe(0x0a);
  });

  it('latches a CA1 interrupt only while enabled, and a port read clears it', () => {
    const pia = new Pia6520();
    pia.write(CR, CR_DDR_TO_PORT); // address the port; CA1 interrupt disabled
    pia.pulseCa1();
    // Flag is latched (CR bit 7) but the IRQ line stays low while disabled.
    expect(pia.read(CR) & 0x80).toBe(0x80);
    expect(pia.irqAsserted()).toBe(false);

    // Enable CA1 interrupts: now the latched flag pulls IRQ.
    pia.write(CR, CR_DDR_TO_PORT | CR_C1_ENABLE);
    expect(pia.irqAsserted()).toBe(true);

    // Reading the peripheral port acknowledges it (as the KERNAL IRQ handler does).
    pia.read(PORT);
    expect(pia.irqAsserted()).toBe(false);
    expect(pia.read(CR) & 0x80).toBe(0);
  });

  it('keeps the two sides independent (CB1 does not raise side A)', () => {
    const pia = new Pia6520();
    pia.write(CR + 2, CR_DDR_TO_PORT | CR_C1_ENABLE); // CRB
    pia.pulseCb1();
    expect(pia.irqAsserted()).toBe(true);
    pia.read(PORT + 2); // read PORTB clears CB1
    expect(pia.irqAsserted()).toBe(false);
  });

  it('treats the control-register flag bits as read-only to the CPU', () => {
    const pia = new Pia6520();
    // Try to set the flag bits directly — they must not stick.
    pia.write(CR, 0xff);
    expect(pia.read(CR) & 0xc0).toBe(0);
  });
});
