import { describe, expect, it } from 'vitest';
import { createPlayChannel } from './channel';
import type { PlayFrame } from './frames';
import type { PlaySocket } from './socket';

/** A player that records what it was sent, and can be told it is behind. */
function stubPlayer() {
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

const frame = (width = 4, height = 2): PlayFrame => ({
  width,
  height,
  pixels: Uint8Array.from([1, 2, 3]),
});

describe('one play channel', () => {
  it('shows a player the machine at once, however long it has been showing it', () => {
    // A channel is open from the moment its caller was given the address, and
    // whoever it hands that address to arrives later - to a machine that may
    // be drawing the same unchanging screen, every frame of which is skipped.
    const channel = createPlayChannel();
    channel.say('playing');
    channel.push(frame());
    const player = stubPlayer();
    channel.attach(player.socket);
    expect(player.kinds()).toEqual([0x02, 0x01]);
    const carried = player.sent[1]!;
    expect([carried[1], carried[2], carried[3], carried[4]]).toEqual([
      0, 4, 0, 2,
    ]);
    expect([...carried.subarray(5)]).toEqual([1, 2, 3]);
  });

  it('drops a frame rather than queueing it while a player is behind', () => {
    const channel = createPlayChannel();
    const player = stubPlayer();
    channel.attach(player.socket);
    expect(channel.free()).toBe(true);
    player.fallBehind();
    channel.push(frame());
    expect(channel.free()).toBe(false);
    player.catchUp();
    expect(channel.free()).toBe(true);
  });

  it('takes a key from a player and nothing else', () => {
    const channel = createPlayChannel();
    const keys: string[] = [];
    channel.onKey(({ key, down }) => keys.push(`${down ? '+' : '-'}${key}`));
    channel.received(Buffer.from('{"key":"A","down":true}'), false);
    // Not a key: malformed, the wrong shape, longer than any key name, or
    // framed as binary, which nothing a player sends ever is.
    channel.received(Buffer.from('not json'), false);
    channel.received(Buffer.from('{"key":"A"}'), false);
    channel.received(
      Buffer.from(`{"key":"${'A'.repeat(64)}","down":true}`),
      false,
    );
    channel.received(Buffer.from('{"key":"B","down":false}'), true);
    expect(keys).toEqual(['+A']);
  });

  it('shows no picture of a machine that has gone, and none once ended', () => {
    const channel = createPlayChannel();
    channel.say('playing');
    channel.push(frame());
    channel.say('no-machine');
    const arriving = stubPlayer();
    channel.attach(arriving.socket);
    expect(arriving.kinds()).toEqual([0x02]);

    const playing = stubPlayer();
    channel.attach(playing.socket);
    channel.end();
    expect(playing.socket.closed).toBe(true);
    const late = stubPlayer();
    channel.attach(late.socket);
    expect(late.socket.closed).toBe(true);
    expect(late.sent).toEqual([]);
  });
});
