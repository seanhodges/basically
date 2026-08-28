import { beforeEach, describe, expect, it } from 'vitest';
import { KB_CTRL, KB_SHIFT, Pokey } from './pokey';
import type { SerialDevice } from './sio';

/** Write-side register offsets. */
const AUDF1 = 0x00;
const AUDCTL = 0x08;
const STIMER = 0x09;
const SEROUT = 0x0d;
const IRQEN = 0x0e;
const SKCTL = 0x0f;

/** Read-side register offsets. */
const KBCODE = 0x09;
const SERIN = 0x0d;
const RANDOM = 0x0a;
const IRQST = 0x0e;
const SKSTAT = 0x0f;

/** One scanline's worth of cycles, which is how the machine ticks the chip. */
const LINE = 114;

describe('POKEY', () => {
  let pokey: Pokey;
  let irq: boolean;

  beforeEach(() => {
    irq = false;
    pokey = new Pokey((asserted) => {
      irq = asserted;
    });
    pokey.write(SKCTL, 0x03); // the OS's setting: keyboard scan and debounce on
  });

  describe('the keyboard', () => {
    it('raises one interrupt for a key, not one per scan', () => {
      pokey.write(IRQEN, 0x40);
      pokey.setKeyState(0x2f, false, false); // Q
      expect(irq).toBe(true);
      expect(pokey.read(KBCODE)).toBe(0x2f);
      expect(pokey.read(IRQST) & 0x40).toBe(0);

      // The OS reads the key and acknowledges by clearing and re-enabling.
      pokey.write(IRQEN, 0x00);
      pokey.write(IRQEN, 0x40);
      expect(irq).toBe(false);

      // Holding the same key does not raise another: repeating is the OS's job.
      pokey.setKeyState(0x2f, false, false);
      expect(irq).toBe(false);

      // A different key does.
      pokey.setKeyState(0x28, false, false); // R
      expect(irq).toBe(true);
      expect(pokey.read(KBCODE)).toBe(0x28);
    });

    it('carries shift and control above the key position', () => {
      pokey.write(IRQEN, 0x40);
      pokey.setKeyState(0x2f | KB_SHIFT, true, false);
      expect(pokey.read(KBCODE)).toBe(0x2f | KB_SHIFT);
      // Shift is on its own line as well, reported active-low in SKSTAT.
      expect(pokey.read(SKSTAT) & 0x08).toBe(0);

      // Adding control to a held key is not a new key.
      pokey.write(IRQEN, 0);
      pokey.write(IRQEN, 0x40);
      pokey.setKeyState(0x2f | KB_SHIFT | KB_CTRL, true, false);
      expect(irq).toBe(false);
    });

    it('reports whether any key is down', () => {
      expect(pokey.read(SKSTAT) & 0x04).toBe(0x04);
      pokey.setKeyState(0x21, false, false);
      expect(pokey.read(SKSTAT) & 0x04).toBe(0);
      pokey.setKeyState(-1, false, false);
      expect(pokey.read(SKSTAT) & 0x04).toBe(0x04);
    });

    it('gives BREAK its own interrupt', () => {
      pokey.write(IRQEN, 0x80);
      pokey.setKeyState(-1, false, true);
      expect(irq).toBe(true);
      expect(pokey.read(IRQST) & 0x80).toBe(0);
    });

    it('does not interrupt at all when the OS has not asked to be', () => {
      pokey.setKeyState(0x2f, false, false);
      expect(irq).toBe(false);
      // The code is still there to be read; only the interrupt was suppressed.
      expect(pokey.read(KBCODE)).toBe(0x2f);
    });
  });

  describe('the timers', () => {
    it('interrupts on the period AUDF asks for', () => {
      // Timer 1 on the 64 kHz clock: AUDF + 1 ticks of 28 cycles each.
      pokey.write(AUDF1, 9);
      pokey.write(IRQEN, 0x01);
      pokey.write(STIMER, 0);
      const period = 10 * 28;

      let elapsed = 0;
      while (elapsed < period - LINE) {
        pokey.tick(LINE);
        elapsed += LINE;
      }
      expect(irq).toBe(false);
      pokey.tick(LINE);
      expect(irq).toBe(true);
      expect(pokey.read(IRQST) & 0x01).toBe(0);
    });

    it('runs fifteen times slower on the slow clock', () => {
      pokey.write(AUDCTL, 0x01); // the 15 kHz clock
      pokey.write(AUDF1, 9);
      pokey.write(IRQEN, 0x01);
      pokey.write(STIMER, 0);
      for (let i = 0; i < 9; i++) pokey.tick(LINE);
      expect(irq).toBe(false);
      pokey.tick(LINE);
      expect(irq).toBe(true);
    });

    it('gives the low half of a joined pair no interrupt of its own', () => {
      pokey.write(AUDCTL, 0x10); // join timers 1 and 2
      pokey.write(AUDF1, 0);
      pokey.write(AUDF1 + 2, 0);
      pokey.write(IRQEN, 0x01); // timer 1, which is now the low half
      pokey.write(STIMER, 0);
      for (let i = 0; i < 40; i++) pokey.tick(LINE);
      expect(irq).toBe(false);
    });
  });

  describe('the noise source', () => {
    it('is held in reset while the chip is stopped', () => {
      pokey.write(SKCTL, 0x00);
      expect(pokey.read(RANDOM)).toBe(0xff);
    });

    it('moves on as time passes', () => {
      const seen = new Set<number>();
      for (let i = 0; i < 40; i++) {
        pokey.tick(LINE);
        seen.add(pokey.read(RANDOM));
      }
      expect(seen.size).toBeGreaterThan(20);
    });
  });

  describe('the serial port', () => {
    it('reports the byte gone once it has had time to go', () => {
      // The OS writes a byte and waits to be told the shift register is free.
      pokey.write(IRQEN, 0x10);
      pokey.write(SEROUT, 0x41);
      expect(irq).toBe(false);
      for (let i = 0; i < 4; i++) pokey.tick(LINE);
      expect(irq).toBe(false);
      for (let i = 0; i < 8; i++) pokey.tick(LINE);
      expect(irq).toBe(true);
      expect(pokey.read(IRQST) & 0x10).toBe(0);
    });

    it('tells a late listener the transmission has already finished', () => {
      // Enabling the interrupt after the byte has gone still reports it: the
      // shift register being empty is a state, not an edge, and SIO would
      // otherwise wait for ever on a transmission it had already completed.
      pokey.write(SEROUT, 0x41);
      for (let i = 0; i < 16; i++) pokey.tick(LINE);
      pokey.write(IRQEN, 0x08);
      pokey.tick(LINE);
      expect(irq).toBe(true);
    });

    it('never reports anything arriving with nothing on the bus', () => {
      // A POKEY built with no device has nothing that can answer, so the input
      // interrupt cannot fire however long the OS waits for it.
      pokey.write(IRQEN, 0x20);
      for (let i = 0; i < 200; i++) pokey.tick(LINE);
      expect(pokey.read(IRQST) & 0x20).toBe(0x20);
    });

    it('hands a device what the machine sent, and the machine what it said', () => {
      const sent: number[] = [];
      const commands: boolean[] = [];
      let waiting: number[] = [];
      const device: SerialDevice = {
        send: (byte) => sent.push(byte),
        setCommand: (asserted) => commands.push(asserted),
        poll: () => waiting.shift() ?? null,
      };
      const wired = new Pokey((asserted) => {
        irq = asserted;
      }, device);
      wired.write(SKCTL, 0x03);

      wired.write(SEROUT, 0x31);
      expect(sent).toEqual([0x31]);

      wired.write(IRQEN, 0x20);
      waiting = [0x41];
      wired.tick(LINE);
      expect(wired.read(SERIN)).toBe(0x41);
      expect(irq).toBe(true);
      expect(wired.read(IRQST) & 0x20).toBe(0);

      // The byte already in the register is not a second arrival: acknowledging
      // and re-enabling leaves the interrupt clear until another one lands.
      wired.write(IRQEN, 0x00);
      wired.write(IRQEN, 0x20);
      expect(irq).toBe(false);
      wired.tick(LINE);
      expect(irq).toBe(false);
      expect(wired.read(SERIN)).toBe(0x41);
      // The command line is the PIA's, and is only passed through.
      expect(commands).toEqual([]);
    });
  });
});
