import { describe, expect, it } from 'vitest';
import { WITHOUT_A_MACHINE } from '../server/ops';
import { pureContext, stubSession } from './testSupport';
import {
  CANNOT_BE_MAPPED,
  CANNOT_PROJECT_MAP,
  mapOp,
  type MapOutcome,
} from './map';
import type { MapOpened, MapProjection } from './types';

/** A projection that opens once and hands the same address back afterwards. */
function stubProjection(
  address: string | null = 'http://127.0.0.1:1/m/abc/',
  mappable = true,
): { projection: MapProjection; opens: number } {
  const record = { opens: 0, projection: null as unknown as MapProjection };
  let open = false;
  record.projection = {
    open: (): Promise<MapOpened> => {
      record.opens++;
      const already = open;
      open = true;
      return Promise.resolve({
        address,
        problem: address === null ? 'nothing to project to' : null,
        already,
      });
    },
    mappable: () => mappable,
  };
  return record;
}

const A_MACHINE = stubSession();

describe('asking for a map of a machine’s memory', () => {
  it('answers with the address, as JSON a caller can read back', async () => {
    const { projection } = stubProjection();
    const outcome = (await mapOp.run(
      {},
      pureContext({ session: A_MACHINE, map: projection }),
    )) as MapOutcome;
    expect(outcome).toEqual({
      address: 'http://127.0.0.1:1/m/abc/',
      already: false,
      problem: null,
    });
    expect(JSON.parse(JSON.stringify(outcome))).toEqual(outcome);
    expect(mapOp.failed!(outcome)).toBe(false);
    expect(mapOp.describe(outcome)).toContain('http://127.0.0.1:1/m/abc/');
    // What the address admits is said in the answer, because it is the whole
    // of what protects the map.
    expect(mapOp.describe(outcome)).toContain('this computer only');
    expect(mapOp.describe(outcome)).toContain('what any address holds');
  });

  it('hands back the map already open rather than opening a second', async () => {
    const record = stubProjection();
    const ctx = pureContext({ session: A_MACHINE, map: record.projection });
    const first = (await mapOp.run({}, ctx)) as MapOutcome;
    const again = (await mapOp.run({}, ctx)) as MapOutcome;
    expect(first.already).toBe(false);
    expect(again.already).toBe(true);
    expect(again.address).toBe(first.address);
    // Asked of the projection each time; it is the projection that knows one
    // is open, and this operation carries no state of its own.
    expect(record.opens).toBe(2);
    expect(mapOp.describe(again)).toContain('already open');
  });

  it('refuses a machine whose memory layout the toolchain does not describe', async () => {
    const record = stubProjection('http://127.0.0.1:1/m/abc/', false);
    const outcome = (await mapOp.run(
      {},
      pureContext({ session: A_MACHINE, map: record.projection }),
    )) as MapOutcome;
    expect(outcome.address).toBeNull();
    expect(outcome.problem).toBe(CANNOT_BE_MAPPED);
    expect(mapOp.failed!(outcome)).toBe(true);
    // Refused before anything was bound, rather than after.
    expect(record.opens).toBe(0);
  });

  it('says so when this toolchain projects nothing at all', async () => {
    const outcome = (await mapOp.run(
      {},
      pureContext({ session: A_MACHINE }),
    )) as MapOutcome;
    expect(outcome.problem).toBe(CANNOT_PROJECT_MAP);
    expect(mapOp.describe(outcome)).toBe(CANNOT_PROJECT_MAP);
    expect(CANNOT_PROJECT_MAP).toContain('a host that is holding the machine');
  });

  it('is answered while the machine is being played, because it only reads it', () => {
    // The one circumstance in which a held machine advances of its own accord
    // is while it is being played, so that is exactly the machine worth
    // mapping - and a map that was refused then would be a still picture.
    expect(mapOp.played).toBe('answer');
  });

  it('needs a machine, so a caller holding none gets the standing answer', () => {
    expect(mapOp.needs).toBe('session');
    expect(WITHOUT_A_MACHINE).toContain('No machine is up');
  });
});
