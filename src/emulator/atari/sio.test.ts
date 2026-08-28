import { beforeEach, describe, expect, it } from 'vitest';
import { AtariSerialBus, sioChecksum } from './sio';

/** A byte time at the peripheral bus's 19200 baud, in CPU cycles. */
const BYTE_CYCLES = 924;

/** The status request the OS's boot sends: D1:, command `S`, no arguments. */
const STATUS_COMMAND = [0x31, 0x53, 0x00, 0x00];

describe('the serial bus', () => {
  let bus: AtariSerialBus;

  beforeEach(() => {
    bus = new AtariSerialBus();
  });

  /** Clock a command frame out with COMMAND held, as the OS does. */
  const command = (frame: readonly number[]) => {
    bus.setCommand(true);
    for (const byte of frame) bus.send(byte);
    bus.send(sioChecksum(frame));
    bus.setCommand(false);
  };

  /** Every byte the device answers with, in order. */
  const answer = (): number[] => {
    const bytes: number[] = [];
    for (let i = 0; i < 40; i++) {
      const byte = bus.poll(BYTE_CYCLES);
      if (byte !== null) bytes.push(byte);
    }
    return bytes;
  };

  it('sums a frame with the carry added back in', () => {
    expect(sioChecksum([0x31, 0x53, 0x00, 0x00])).toBe(0x84);
    // 0xFF + 0xFF overflows twice over, and both carries come back round.
    expect(sioChecksum([0xff, 0xff])).toBe(0xff);
    expect(sioChecksum([])).toBe(0);
  });

  it('answers a drive with an error and its status frame', () => {
    command(STATUS_COMMAND);
    const reply = answer();
    // Acknowledged, then the job could not be done, then the status frame and
    // its own checksum - which the OS reads whether the job went well or not.
    expect(reply[0]).toBe(0x41); // 'A'
    expect(reply[1]).toBe(0x45); // 'E'
    expect(reply).toHaveLength(7);
    expect(reply.at(-1)).toBe(sioChecksum(reply.slice(2, -1)));
    // The floppy controller's NOT READY bit is what no disk looks like.
    expect(reply[3]! & 0x80).toBe(0x80);
  });

  it('takes a byte time between one byte and the next', () => {
    command(STATUS_COMMAND);
    expect(bus.poll(BYTE_CYCLES - 1)).toBeNull();
    expect(bus.poll(1)).toBe(0x41);
    expect(bus.poll(BYTE_CYCLES - 1)).toBeNull();
    expect(bus.poll(1)).toBe(0x45);
  });

  it('says nothing at all when nothing is addressed', () => {
    // The cassette recorder, a printer, a modem: none of them is plugged in.
    for (const device of [0x60, 0x40, 0x50]) {
      command([device, 0x53, 0x00, 0x00]);
      expect(answer()).toEqual([]);
    }
  });

  it('ignores a frame that is not five bytes', () => {
    bus.setCommand(true);
    bus.send(0x31);
    bus.send(0x53);
    bus.setCommand(false);
    expect(answer()).toEqual([]);
  });

  it('ignores bytes clocked out with COMMAND released', () => {
    // Those are a data frame or a program driving the port, not a command.
    for (const byte of STATUS_COMMAND) bus.send(byte);
    bus.send(sioChecksum(STATUS_COMMAND));
    expect(answer()).toEqual([]);
  });

  it('bounds a frame by the COMMAND line rather than by a byte count', () => {
    // A byte clocked out while COMMAND is still low is part of the same frame,
    // however many have gone before it - so this one is six bytes long and is
    // not a command at all.
    bus.setCommand(true);
    bus.send(0x00);
    for (const byte of STATUS_COMMAND) bus.send(byte);
    bus.setCommand(false);
    expect(answer()).toEqual([]);

    // Letting COMMAND go and pulling it down again starts a clean one.
    command(STATUS_COMMAND);
    expect(answer()).toHaveLength(7);
  });

  it('forgets everything on a reset', () => {
    command(STATUS_COMMAND);
    bus.reset();
    expect(answer()).toEqual([]);
  });
});
