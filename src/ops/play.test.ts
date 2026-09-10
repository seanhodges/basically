import { describe, expect, it } from 'vitest';
import { CallRefused, runOperation, WITHOUT_A_MACHINE } from '../server/ops';
import { OPERATIONS } from './registry';
import { pureContext, stubSession } from './testSupport';
import {
  CANNOT_BE_PLAYED,
  CANNOT_PLAY,
  playOp,
  type PlayOutcome,
} from './play';
import type { OpContext, PlayOpened, PlayProjection } from './types';

/** A channel that opens once and hands the same address back afterwards. */
function stubChannel(address: string | null = 'http://127.0.0.1:1/p/abc/'): {
  channel: PlayProjection;
  opens: number;
} {
  const record = { opens: 0, channel: null as unknown as PlayProjection };
  let open = false;
  record.channel = {
    open: (): Promise<PlayOpened> => {
      record.opens++;
      const already = open;
      open = true;
      return Promise.resolve({
        address,
        problem: address === null ? 'nothing to play on' : null,
        already,
        endedView: false,
      });
    },
    playing: () => open,
  };
  return record;
}

const PICTURED = stubSession({
  capture: () => ({ width: 2, height: 1, png: 'AA==' }),
});

/** Dispatch a call the way a host does, so the refusals are the real ones. */
function call(operation: string, ctx: OpContext, input: unknown = {}) {
  return runOperation(
    operation,
    input,
    { context: () => ctx, heldMachine: () => ({ name: 'ZX81', token: 1 }) },
    (op) => op.cli !== undefined,
  );
}

describe('asking for a machine to be played', () => {
  it('answers with the address, as JSON a caller can read back', async () => {
    const { channel } = stubChannel();
    const outcome = (await playOp.run(
      {},
      pureContext({ session: PICTURED, play: channel }),
    )) as PlayOutcome;
    expect(outcome).toEqual({
      address: 'http://127.0.0.1:1/p/abc/',
      already: false,
      endedView: false,
      problem: null,
    });
    expect(JSON.parse(JSON.stringify(outcome))).toEqual(outcome);
    expect(playOp.failed!(outcome)).toBe(false);
    // Said as its own claim rather than by reference to a view's: what this
    // address admits is acting on the machine, not watching it.
    expect(playOp.describe(outcome)).toContain('http://127.0.0.1:1/p/abc/');
    expect(playOp.describe(outcome)).toContain('type at the machine');
  });

  it('hands back the channel already open rather than opening a second', async () => {
    const record = stubChannel();
    const ctx = pureContext({ session: PICTURED, play: record.channel });
    const first = (await playOp.run({}, ctx)) as PlayOutcome;
    const again = (await playOp.run({}, ctx)) as PlayOutcome;
    expect(first.already).toBe(false);
    expect(again.already).toBe(true);
    expect(again.address).toBe(first.address);
    expect(record.opens).toBe(2);
  });

  it('says so rather than giving an address to a caller that cannot serve one', async () => {
    const outcome = (await playOp.run(
      {},
      pureContext({ session: PICTURED }),
    )) as PlayOutcome;
    expect(outcome.problem).toBe(CANNOT_PLAY);
    expect(playOp.failed!(outcome)).toBe(true);
  });

  it('refuses a machine there is no picturing rather than showing nothing', async () => {
    const { channel } = stubChannel();
    const outcome = (await playOp.run(
      {},
      pureContext({
        session: stubSession({ capture: () => null }),
        play: channel,
      }),
    )) as PlayOutcome;
    expect(outcome.problem).toBe(CANNOT_BE_PLAYED);
    expect(outcome.address).toBeNull();
  });

  it('says no machine is up on the same terms as any request needing one', async () => {
    const { channel } = stubChannel();
    await expect(
      call('play', pureContext({ session: null, play: channel })),
    ).rejects.toThrow(WITHOUT_A_MACHINE);
  });
});

describe('what a machine being played costs the requests about it', () => {
  it('refuses a measurement, naming the reason and how to stop', async () => {
    const { channel } = stubChannel();
    const ctx = pureContext({ session: PICTURED, play: channel });
    await playOp.run({}, ctx);
    for (const operation of ['profile', 'time', 'variables', 'drive']) {
      const refused = await call(operation, ctx, { script: 'PRESS A' }).catch(
        (error: unknown) => error,
      );
      expect(refused, operation).toBeInstanceOf(CallRefused);
      expect((refused as CallRefused).message, operation).toContain(
        'being played',
      );
      expect((refused as CallRefused).message, operation).toContain(
        'basically play --stop',
      );
    }
  });

  it('answers a read, and two of them may differ without that being a fault', async () => {
    // Reading spends none of the machine's frames, so it is answered - having
    // caught a machine that is moving.
    let line = 0;
    const moving = stubSession({
      capture: () => ({ width: 2, height: 1, png: 'AA==' }),
      readText: () => ({ cols: 8, rows: 1, lines: [`FRAME ${line++}`] }),
    });
    const { channel } = stubChannel();
    const ctx = pureContext({ session: moving, play: channel });
    await playOp.run({}, ctx);
    const first = await call('look', ctx);
    const again = await call('look', ctx);
    expect(first.failed).toBe(false);
    expect(again.failed).toBe(false);
    expect(first.outcome).not.toEqual(again.outcome);
    expect((await call('screenshot', ctx)).failed).toBe(false);
  });

  it('stops refusing the moment the channel ends', async () => {
    let playing = true;
    const ctx = pureContext({
      session: PICTURED,
      play: {
        open: () =>
          Promise.resolve({
            address: 'http://127.0.0.1:1/p/abc/',
            problem: null,
            already: false,
            endedView: false,
          }),
        playing: () => playing,
      },
    });
    await expect(call('time', ctx)).rejects.toThrow(CallRefused);
    playing = false;
    expect((await call('time', ctx)).failed).toBe(false);
  });

  it('has every operation on the held machine say which it is', async () => {
    // A new operation on a held machine has to decide what becomes of it while
    // that machine is being played, rather than inheriting whichever default
    // was quieter.
    for (const op of OPERATIONS) {
      if (op.needs !== 'session') continue;
      expect(op.played, op.name).toBeDefined();
    }
  });
});
