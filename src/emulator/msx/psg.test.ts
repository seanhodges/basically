import { describe, expect, it } from 'vitest';
import { MSX_PSG_CLOCK, MsxPsg, type MsxPsgHost } from './psg';

function harness(joysticks: [number, number], tape = 1): MsxPsg {
  const host: MsxPsgHost = {
    readJoystick: (port) => joysticks[port]!,
    readTapeBit: () => tape,
  };
  const psg = new MsxPsg(host);
  psg.reset();
  return psg;
}

const PORT_A = 14;
const PORT_B = 15;

describe('MsxPsg', () => {
  it('is clocked at half the MSX CPU clock', () => {
    expect(MSX_PSG_CLOCK * 2).toBe(3_579_545);
  });

  it('latches a register and reads back what was written to it', () => {
    const psg = harness([0x3f, 0x3f]);
    psg.selectRegister(7);
    psg.write(0xb8);
    expect(psg.read()).toBe(0xb8);
    psg.selectRegister(8);
    psg.write(0x0f);
    expect(psg.read()).toBe(0x0f);
  });

  it('samples the joystick port register 15 selects, not the last write', () => {
    const psg = harness([0b110110, 0b101101]);
    psg.selectRegister(PORT_B);
    psg.write(0x00); // pin 8 low: port 0
    psg.selectRegister(PORT_A);
    psg.write(0xff); // a write to an input port changes nothing it reads
    expect(psg.read() & 0x3f).toBe(0b110110);
    psg.selectRegister(PORT_B);
    psg.write(0x40); // pin 8 high: port 1
    psg.selectRegister(PORT_A);
    expect(psg.read() & 0x3f).toBe(0b101101);
  });

  it('carries the cassette input on register 14 bit 7', () => {
    const idle = harness([0x3f, 0x3f], 1);
    idle.selectRegister(PORT_A);
    expect(idle.read() & 0x80).toBe(0x80);
    const playing = harness([0x3f, 0x3f], 0);
    playing.selectRegister(PORT_A);
    expect(playing.read() & 0x80).toBe(0);
  });

  it('renders nothing while every channel is silent', () => {
    const psg = harness([0x3f, 0x3f]);
    expect(psg.render().length).toBe(0);
    psg.selectRegister(8);
    psg.write(0x0f); // channel A at full volume
    expect(psg.render().length).toBeGreaterThan(0);
  });
});
