import { describe, it, expect } from 'vitest';
import type { JoystickState, MachineEmulator } from '../dialects/types';
import type { ControllerRole } from './layoutSchema';
import {
  ControllerInputEngine,
  type RoleTokens,
} from './controllerInputEngine';

/** Records every setKey / releaseAllKeys / setJoystick call for assertions. */
function recorder() {
  const events: [string, boolean][] = [];
  const joystick: [number, JoystickState][] = [];
  let releasedAll = 0;
  const machine = {
    setKey: (token: string, down: boolean) => events.push([token, down]),
    releaseAllKeys: () => {
      releasedAll++;
    },
    setJoystick: (port: number, state: JoystickState) =>
      joystick.push([port, state]),
  } as unknown as MachineEmulator;
  return {
    machine,
    events,
    joystick,
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
      { mode: 'keymapped', minHoldFrames: 0 },
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
      { mode: 'keymapped', minHoldFrames: 0 },
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
      { mode: 'keymapped', minHoldFrames: 3 },
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
      { mode: 'keymapped', minHoldFrames: 0 },
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
      { mode: 'keymapped', minHoldFrames: 0 },
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
      { mode: 'keymapped', minHoldFrames: 0 },
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
      { mode: 'keymapped', minHoldFrames: 0 },
    );
    e.pressRole(1, 'fire2');
    expect(rec.events).toEqual([]);
    expect(e.getActiveRoles()).toEqual(roles('fire2'));
    e.releasePointer(1);
    expect(rec.events).toEqual([]);
  });
});

describe('ControllerInputEngine (controller mode)', () => {
  const controller = (
    rec: ReturnType<typeof recorder>,
    fireButtons: 1 | 2 = 1,
    port: 1 | 2 = 2,
  ) =>
    new ControllerInputEngine(
      ROLE_TOKENS,
      { getMachine: () => rec.machine },
      { mode: 'controller', port, fireButtons },
    );

  it('pushes joystick state instead of key tokens', () => {
    const rec = recorder();
    const e = controller(rec);
    e.setPointerRoles(1, roles('left'));
    expect(rec.events).toEqual([]); // never touches the key matrix
    expect(rec.joystick.at(-1)).toEqual([
      2,
      {
        up: false,
        down: false,
        left: true,
        right: false,
        fire1: false,
        fire2: false,
      },
    ]);
  });

  it('combines a direction and fire across pointers, then centres on release', () => {
    const rec = recorder();
    const e = controller(rec);
    e.setPointerRoles(1, roles('up'));
    e.pressRole(2, 'fire1');
    expect(rec.joystick.at(-1)![1]).toMatchObject({ up: true, fire1: true });
    e.releasePointer(1);
    e.releasePointer(2);
    expect(rec.joystick.at(-1)![1]).toMatchObject({
      up: false,
      fire1: false,
    });
  });

  it('suppresses fire2 on a single-fire machine but keeps it on two', () => {
    const one = recorder();
    controller(one, 1).pressRole(1, 'fire2');
    expect(one.joystick.at(-1)![1].fire2).toBe(false);

    const two = recorder();
    controller(two, 2).pressRole(1, 'fire2');
    expect(two.joystick.at(-1)![1].fire2).toBe(true);
  });

  it('does not defer releases with min-hold (port is level-sensitive)', () => {
    const rec = recorder();
    const e = controller(rec);
    e.pressRole(1, 'fire1');
    e.releasePointer(1); // released immediately, not after frames
    expect(rec.joystick.at(-1)![1].fire1).toBe(false);
    const before = rec.joystick.length;
    e.onFrame();
    expect(rec.joystick.length).toBe(before); // onFrame is a no-op here
  });

  it('cancelAll centres the joystick and releases keys', () => {
    const rec = recorder();
    const e = controller(rec);
    e.setPointerRoles(1, roles('down', 'fire1'));
    e.cancelAll();
    expect(rec.releasedAll).toBe(1);
    expect(rec.joystick.at(-1)![1]).toEqual({
      up: false,
      down: false,
      left: false,
      right: false,
      fire1: false,
      fire2: false,
    });
  });

  it('drives the requested port', () => {
    const rec = recorder();
    controller(rec, 1, 1).setPointerRoles(1, roles('right'));
    expect(rec.joystick.at(-1)![0]).toBe(1);
  });
});
