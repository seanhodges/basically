import { describe, expect, it } from 'vitest';
import { WITHOUT_A_MACHINE } from '../server/ops';
import { pureContext, stubSession } from './testSupport';
import {
  CANNOT_BE_PICTURED,
  CANNOT_PROJECT,
  viewOp,
  type ViewOutcome,
} from './view';
import type { ViewOpened, ViewProjection } from './types';

/** A projection that opens once and hands the same address back afterwards. */
function stubProjection(address: string | null = 'http://127.0.0.1:1/v/abc/'): {
  projection: ViewProjection;
  opens: number;
} {
  const record = { opens: 0, projection: null as unknown as ViewProjection };
  let open = false;
  record.projection = {
    open: (): Promise<ViewOpened> => {
      record.opens++;
      const already = open;
      open = true;
      return Promise.resolve({
        address,
        problem: address === null ? 'nothing to project to' : null,
        already,
        endedPlay: false,
      });
    },
  };
  return record;
}

const PICTURED = stubSession({
  capture: () => ({ width: 2, height: 1, png: 'AA==' }),
});

describe('asking for a view', () => {
  it('answers with the address, as JSON a caller can read back', async () => {
    const { projection } = stubProjection();
    const outcome = (await viewOp.run(
      {},
      pureContext({ session: PICTURED, view: projection }),
    )) as ViewOutcome;
    expect(outcome).toEqual({
      address: 'http://127.0.0.1:1/v/abc/',
      already: false,
      endedPlay: false,
      problem: null,
    });
    expect(JSON.parse(JSON.stringify(outcome))).toEqual(outcome);
    expect(viewOp.failed!(outcome)).toBe(false);
    expect(viewOp.describe(outcome)).toContain('http://127.0.0.1:1/v/abc/');
  });

  it('hands back the view already open rather than opening a second', async () => {
    const record = stubProjection();
    const ctx = pureContext({ session: PICTURED, view: record.projection });
    const first = (await viewOp.run({}, ctx)) as ViewOutcome;
    const again = (await viewOp.run({}, ctx)) as ViewOutcome;
    expect(first.already).toBe(false);
    expect(again.already).toBe(true);
    expect(again.address).toBe(first.address);
    // Asked of the projection each time; it is the projection that knows one
    // is open, and this operation carries no state of its own.
    expect(record.opens).toBe(2);
    expect(viewOp.describe(again)).toContain('already open');
  });

  it('refuses a machine whose display cannot be pictured', async () => {
    const record = stubProjection();
    const outcome = (await viewOp.run(
      {},
      // The stub session's own answer: a machine there is no painting.
      pureContext({ session: stubSession(), view: record.projection }),
    )) as ViewOutcome;
    expect(outcome.address).toBeNull();
    expect(outcome.problem).toBe(CANNOT_BE_PICTURED);
    expect(viewOp.failed!(outcome)).toBe(true);
    // Refused before anything was bound, rather than after.
    expect(record.opens).toBe(0);
  });

  it('says so when this toolchain projects nothing at all', async () => {
    const outcome = (await viewOp.run(
      {},
      pureContext({ session: PICTURED }),
    )) as ViewOutcome;
    expect(outcome.problem).toBe(CANNOT_PROJECT);
    expect(viewOp.describe(outcome)).toBe(CANNOT_PROJECT);
  });

  it('needs a machine, so a caller holding none gets the standing answer', () => {
    // The check itself is the dispatch's, once, for every operation that needs
    // a machine; what this pins is that `view` is one of them.
    expect(viewOp.needs).toBe('session');
    expect(WITHOUT_A_MACHINE).toContain('No machine is up');
  });
});
