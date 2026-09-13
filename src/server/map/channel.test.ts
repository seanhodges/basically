import { describe, expect, it } from 'vitest';
import { createMapChannel } from './channel';
import type { MapLayout } from './link';
import type { MapActivity } from '../../dialects/headless/activityTap';
import type { PlaySocket } from '../play/socket';

/**
 * One map's channel, with nothing bound.
 *
 * A watcher is something that can be written to and closed, which is the whole
 * of what the channel knows about one - so everything it does is testable
 * without a listener, a socket or a machine.
 */
function stubWatcher() {
  const sent: Uint8Array[] = [];
  let taking = true;
  let drained: (() => void) | null = null;
  const socket: PlaySocket & { closed: boolean } = {
    closed: false,
    send: (payload) => {
      sent.push(payload);
      return taking;
    },
    ondrain: (run) => {
      drained = run;
    },
    close: () => {
      socket.closed = true;
    },
  };
  return {
    socket,
    sent,
    kinds: () => sent.map((message) => message[0]),
    fallBehind: () => {
      taking = false;
    },
    catchUp: () => {
      taking = true;
      drained?.();
    },
  };
}

const layout: MapLayout = {
  machine: 'ZX81',
  addressSpace: 0x10000,
  addressUnit: 'byte',
  bands: [{ label: 'ROM', kind: 'rom', start: 0, end: 0x1fff }],
  reports: true,
};

const activity = (cells = [1, 2, 3]): MapActivity => ({
  addressesPerCell: 16,
  cells: Uint8Array.from(cells),
});

/** The JSON a layout message carries. */
function layoutOf(message: Uint8Array): MapLayout | null {
  return JSON.parse(new TextDecoder().decode(message.subarray(1)));
}

describe('one map channel', () => {
  it('catches a watcher up on arrival, whenever it arrives', () => {
    // A map is open from the moment its caller was given the address, and
    // whoever it hands that address to arrives later - in the middle of a long
    // request, or an hour after the machine last did anything.
    const channel = createMapChannel();
    channel.say('working');
    channel.show(layout);
    channel.push(activity());
    const watcher = stubWatcher();
    channel.attach(watcher.socket);
    expect(watcher.kinds()).toEqual([0x03, 0x01, 0x02]);
    expect(new TextDecoder().decode(watcher.sent[0]!.subarray(1))).toBe(
      'working',
    );
    expect(layoutOf(watcher.sent[1]!)).toEqual(layout);
    const sample = watcher.sent[2]!;
    expect((sample[1]! << 8) | sample[2]!).toBe(16);
    expect([...sample.subarray(3)]).toEqual([1, 2, 3]);
  });

  it('says which machine it is showing, and whether it can report what it touches', () => {
    const channel = createMapChannel();
    const watcher = stubWatcher();
    channel.attach(watcher.socket);
    channel.show({ ...layout, reports: false });
    // Not an unmarked layout: a machine that cannot say and a program that
    // touched nothing are different facts, told apart here rather than left
    // for a watcher to guess from an empty picture.
    expect(layoutOf(watcher.sent.at(-1)!)?.reports).toBe(false);
  });

  it('drops a sample rather than queueing it when a watcher is behind', () => {
    const channel = createMapChannel();
    const watcher = stubWatcher();
    channel.attach(watcher.socket);
    channel.show(layout);
    watcher.fallBehind();
    channel.push(activity());
    expect(channel.free()).toBe(false);
    watcher.catchUp();
    expect(channel.free()).toBe(true);
    // Nothing was lost by the drop: what a skipped drain covered turns up in
    // the next one, because a machine reports everything since the last.
    channel.push(activity([4, 5, 6]));
    expect([...watcher.sent.at(-1)!.subarray(3)]).toEqual([4, 5, 6]);
  });

  it('says there is no machine when the machine is let go', () => {
    const channel = createMapChannel();
    const watcher = stubWatcher();
    channel.attach(watcher.socket);
    channel.show(layout);
    channel.say('idle');
    channel.push(activity());
    channel.say('no-machine');
    channel.show(null);
    expect(layoutOf(watcher.sent.at(-1)!)).toBeNull();
    // A watcher arriving now is not shown the machine that has gone.
    const later = stubWatcher();
    channel.attach(later.socket);
    expect(later.kinds()).toEqual([0x03, 0x01]);
    expect(new TextDecoder().decode(later.sent[0]!.subarray(1))).toBe(
      'no-machine',
    );
    expect(layoutOf(later.sent[1]!)).toBeNull();
  });

  it('does not draw one machine’s activity over another’s layout', () => {
    const channel = createMapChannel();
    channel.show(layout);
    channel.push(activity());
    channel.show({ ...layout, machine: 'ZX Spectrum' });
    const watcher = stubWatcher();
    channel.attach(watcher.socket);
    expect(watcher.kinds()).toEqual([0x03, 0x01]);
  });

  it('says a state once, however often it is told', () => {
    const channel = createMapChannel();
    const watcher = stubWatcher();
    channel.attach(watcher.socket);
    channel.say('working');
    channel.say('working');
    expect(watcher.kinds().filter((kind) => kind === 0x03).length).toBe(2);
  });

  it('writes nothing more once it has ended, and closes whoever was watching', () => {
    const channel = createMapChannel();
    const watcher = stubWatcher();
    channel.attach(watcher.socket);
    channel.show(layout);
    const written = watcher.sent.length;
    channel.end();
    expect(watcher.socket.closed).toBe(true);
    channel.show(layout);
    channel.push(activity());
    channel.say('idle');
    expect(watcher.sent.length).toBe(written);
    // One arriving at an ended map is closed rather than caught up.
    const later = stubWatcher();
    channel.attach(later.socket);
    expect(later.socket.closed).toBe(true);
    expect(later.sent).toEqual([]);
    expect(channel.watchers).toBe(0);
  });
});
