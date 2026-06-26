import { describe, it, expect } from 'vitest';
import type { MachineEmulator } from '../dialects/types';
import type { ControllerRole } from './layoutSchema';
import {
  ControllerInputEngine,
  type RoleTokens,
} from './controllerInputEngine';

/** Records every setKey / releaseAllKeys call for assertions. */
function recorder() {
  const events: [string, boolean][] = [];
  let releasedAll = 0;
  const machine = {
    setKey: (token: string, down: boolean) => events.push([token, down]),
    releaseAllKeys: () => {
      releasedAll++;
    },
  } as unknown as MachineEmulator;
  return {
    machine,
    events,
    get releasedAll() {
      return releasedAll;
    },
  };
}

const ROLE_TOKENS: RoleTokens = {
  up: ['U'],
  down: ['D'],
  left: ['L'],
  right: ['R'],
  fire1: ['F'],
  fire2: ['G'],
};

const roles = (...r: ControllerRole[]) => new Set<ControllerRole>(r);

describe('ControllerInputEngine', () => {
  it('presses and releases a fire button (min-hold 0)', () => {
    const rec = recorder();
    const e = new ControllerInputEngine(
      ROLE_TOKENS,
      { getMachine: () => rec.machine },
      0,
    );
    e.pressRole(1, 'fire1');
    expect(rec.events).toEqual([['F', true]]);
    e.releasePointer(1);
    expect(rec.events).toEqual([
      ['F', true],
      ['F', false],
    ]);
  });

  it('sliding up → up-right → right holds then releases the right keys', () => {
    const rec = recorder();
    const e = new ControllerInputEngine(
      ROLE_TOKENS,
      { getMachine: () => rec.machine },
      0,
    );
    e.setPointerRoles(1, roles('up'));
    e.setPointerRoles(1, roles('up', 'right')); // up stays down, right added
    e.setPointerRoles(1, roles('right')); // up released, right stays
    expect(rec.events).toEqual([
      ['U', true],
      ['R', true],
      ['U', false],
    ]);
    expect(e.getActiveRoles()).toEqual(roles('right'));
  });

  it('defers a release until min-hold frames elapse', () => {
    const rec = recorder();
    const e = new ControllerInputEngine(
      ROLE_TOKENS,
      { getMachine: () => rec.machine },
      3,
    );
    e.pressRole(1, 'fire1'); // frame 0
    e.releasePointer(1); // scheduled for frame 3
    expect(rec.events).toEqual([['F', true]]); // not released yet
    e.onFrame(); // 1
    e.onFrame(); // 2
    expect(rec.events).toEqual([['F', true]]); // still held
    e.onFrame(); // 3 → flush
    expect(rec.events).toEqual([
      ['F', true],
      ['F', false],
    ]);
  });

  it('ref-counts a token shared by two roles', () => {
    const shared: RoleTokens = { ...ROLE_TOKENS, fire2: ['F'] };
    const rec = recorder();
    const e = new ControllerInputEngine(
      shared,
      { getMachine: () => rec.machine },
      0,
    );
    e.pressRole(1, 'fire1'); // F count 1 → setKey true
    e.pressRole(2, 'fire2'); // F count 2 → no setKey
    expect(rec.events).toEqual([['F', true]]);
    e.releasePointer(1); // count 1 → no release
    expect(rec.events).toEqual([['F', true]]);
    e.releasePointer(2); // count 0 → setKey false
    expect(rec.events).toEqual([
      ['F', true],
      ['F', false],
    ]);
  });

  it('drives a direction and a fire on independent pointers', () => {
    const rec = recorder();
    const e = new ControllerInputEngine(
      ROLE_TOKENS,
      { getMachine: () => rec.machine },
      0,
    );
    e.setPointerRoles(1, roles('left'));
    e.pressRole(2, 'fire1');
    expect(e.getActiveRoles()).toEqual(roles('left', 'fire1'));
    e.releasePointer(2);
    expect(e.getActiveRoles()).toEqual(roles('left'));
    expect(rec.events).toEqual([
      ['L', true],
      ['F', true],
      ['F', false],
    ]);
  });

  it('cancelAll releases the machine and clears state', () => {
    const rec = recorder();
    const e = new ControllerInputEngine(
      ROLE_TOKENS,
      { getMachine: () => rec.machine },
      0,
    );
    e.setPointerRoles(1, roles('up'));
    e.cancelAll();
    expect(rec.releasedAll).toBe(1);
    expect(e.getActiveRoles()).toEqual(roles());
  });

  it('ignores unbound roles (no tokens) without error', () => {
    const partial: RoleTokens = { ...ROLE_TOKENS, fire2: undefined };
    const rec = recorder();
    const e = new ControllerInputEngine(
      partial,
      { getMachine: () => rec.machine },
      0,
    );
    e.pressRole(1, 'fire2');
    expect(rec.events).toEqual([]);
    expect(e.getActiveRoles()).toEqual(roles('fire2'));
    e.releasePointer(1);
    expect(rec.events).toEqual([]);
  });
});
