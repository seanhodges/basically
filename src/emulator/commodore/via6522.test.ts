import { describe, expect, it } from 'vitest';
import { Via6522 } from './via6522';

// Register offsets exercised here.
const T1CL = 0x4;
const T1CH = 0x5;
const T1LL = 0x6;
const T1LH = 0x7;
const T2CL = 0x8;
const T2CH = 0x9;
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
