import { describe, expect, it } from 'vitest';
import { Via6522 } from './via6522';

// Register offsets exercised here.
const T1CL = 0x4;
const T1CH = 0x5;
const T1LL = 0x6;
const T1LH = 0x7;
const T2CL = 0x8;
const T2CH = 0x9;
const SR = 0xa;
const ACR = 0xb;
const IFR = 0xd;
const IER = 0xe;

const IRQ_T1 = 0x40;
const IRQ_T2 = 0x20;

describe('Via6522', () => {
  it('reads back a port through its DDR', () => {
    const via = new Via6522({ portB: { read: () => 0xf0 } });
    via.write(0x2, 0x0f); // DDRB: low nibble outputs
    via.write(0x0, 0x0a); // ORB
    expect(via.read(0x0)).toBe(0xfa); // outputs from ORB, inputs from the pin
  });

  it('counts Timer 1 down to an interrupt in one-shot mode', () => {
    const via = new Via6522();
    via.write(IER, 0x80 | IRQ_T1); // enable T1 interrupt
    via.write(T1CL, 0x03); // latch low
    via.write(T1CH, 0x00); // latch high + load counter (=3) + start
    expect(via.irqAsserted()).toBe(false);
    // Counter runs 3,2,1,0,then underflows past 0 on the 4th tick.
    for (let i = 0; i < 4; i++) via.tick();
    expect(via.read(IFR) & IRQ_T1).toBe(IRQ_T1);
    expect(via.irqAsserted()).toBe(true);
    // One-shot: it stays fired and does not re-trigger.
    via.tick();
    via.write(IFR, IRQ_T1); // acknowledge by writing a 1 to the flag
    expect(via.irqAsserted()).toBe(false);
  });

  it('reloads Timer 1 from its latch in free-run mode', () => {
    const via = new Via6522();
    via.write(ACR, 0x40); // T1 free-run (continuous)
    via.write(IER, 0x80 | IRQ_T1);
    via.write(T1LL, 0x01);
    via.write(T1CH, 0x00); // load counter = 1, start
    via.tick(); // 1 -> 0
    via.tick(); // 0 -> underflow, reload from latch (1)
    expect(via.read(IFR) & IRQ_T1).toBe(IRQ_T1);
    via.write(IFR, IRQ_T1); // clear
    // It keeps running: another underflow arrives after the reload.
    via.tick();
    via.tick();
    expect(via.read(IFR) & IRQ_T1).toBe(IRQ_T1);
  });

  it('clears the Timer 2 flag when the counter low byte is read', () => {
    const via = new Via6522();
    via.write(IER, 0x80 | IRQ_T2);
    via.write(T2CL, 0x01); // low latch
    via.write(T2CH, 0x00); // load + start (=1)
    via.tick(); // 1 -> 0
    via.tick(); // underflow
    expect(via.read(IFR) & IRQ_T2).toBe(IRQ_T2);
    via.read(T2CL); // reading T2 counter-low acknowledges the flag
    expect(via.read(IFR) & IRQ_T2).toBe(0);
  });

  it('exposes each port output register masked to its output pins', () => {
    const via = new Via6522();
    via.write(0x2, 0xff); // DDRB: all outputs (VIC-20 keyboard column drive)
    via.write(0x0, 0x7f); // ORB
    expect(via.portBOut()).toBe(0x7f);
    via.write(0x3, 0x0f); // DDRA: low nibble outputs
    via.write(0x1, 0xaa); // ORA
    expect(via.portAOut()).toBe(0x0a); // only the output pins show through
  });

  it('sets the master IFR bit while any enabled flag is pending', () => {
    const via = new Via6522();
    via.write(IER, 0x80 | IRQ_T1);
    via.write(T1CL, 0x01);
    via.write(T1CH, 0x00); // load = 1, start
    via.tick(); // 1 -> 0
    via.tick(); // underflow, sets T1 flag
    // Bit 7 (IRQ_ANY) is a read-only summary of enabled+pending flags.
    expect(via.read(IFR) & 0x80).toBe(0x80);
    via.write(IFR, IRQ_T1); // acknowledge
    expect(via.read(IFR) & 0x80).toBe(0);
  });

  it('exposes the shift register and its free-run-out mode (CB2 sound)', () => {
    const via = new Via6522();
    // The PET sound recipe: POKE 59466,15 puts the $0F pattern in the SR.
    via.write(SR, 0x0f);
    expect(via.shiftRegister()).toBe(0x0f);
    expect(via.read(SR)).toBe(0x0f);
    // POKE 59467,16 selects ACR shift mode 100 (free-run out at T2 rate).
    expect(via.shiftFreeRunningOut()).toBe(false);
    via.write(ACR, 0x10);
    expect(via.shiftFreeRunningOut()).toBe(true);
    // Other shift modes (or T1 free-run alone) don't count.
    via.write(ACR, 0x40 | 0x08);
    expect(via.shiftFreeRunningOut()).toBe(false);
  });

  it('exposes the Timer 2 low-order latch (CB2 sound rate)', () => {
    const via = new Via6522();
    via.write(T2CL, 100); // POKE 59464,100 — latch only, counter untouched
    expect(via.t2LowLatch()).toBe(100);
    // Loading T2's high byte starts the counter but keeps the latch value.
    via.write(T2CH, 0x02);
    via.tick();
    expect(via.t2LowLatch()).toBe(100);
  });

  it('gates the IRQ output through the enable register', () => {
    const via = new Via6522();
    via.write(T1LH, 0x00);
    via.write(T1CL, 0x01);
    via.write(T1CH, 0x00);
    via.tick();
    via.tick();
    // Flag is set but not enabled — no IRQ.
    expect(via.read(IFR) & IRQ_T1).toBe(IRQ_T1);
    expect(via.irqAsserted()).toBe(false);
    via.write(IER, 0x80 | IRQ_T1);
    expect(via.irqAsserted()).toBe(true);
  });
});
