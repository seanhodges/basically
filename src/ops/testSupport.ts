import type { MachineSession } from '../app/machineSession';
import type { OpContext } from './types';

/**
 * Scaffolding the operation tests share: a context that holds no machine and
 * reads every ROM as present, and a session that says yes to everything and
 * records what it was asked. Neither reaches node, so a test of an operation
 * is a test of the operation.
 */

export function pureContext(over: Partial<OpContext> = {}): OpContext {
  return { roms: { canRun: () => true }, session: null, ...over };
}

export interface StubSession extends MachineSession {
  /** Every key name pressed, in order. */
  pressed: string[];
  released: boolean;
}

export function stubSession(over: Partial<MachineSession> = {}): StubSession {
  const session: StubSession = {
    pressed: [],
    released: false,
    pressKeys(names) {
      session.pressed.push(...names);
      return { ok: true, frames: 3 };
    },
    joystick: () => ({ ok: true, frames: 3 }),
    advance: (n) => ({ ok: true, frames: n }),
    waitForText: () => ({ ok: true, frames: 3 }),
    waitForEnd: () => ({ ok: true, frames: 3 }),
    programState: () => false,
    readText: () => ({ lines: ['READY'], cols: 5, rows: 1 }),
    releaseAll() {
      session.released = true;
    },
    capture: () => null,
    measurements: () => ({
      canProfile: true,
      profile: null,
      source: '',
      capabilities: {
        hasProc: false,
        hasFn: false,
        hasGosub: false,
        hasGoto: false,
      },
    }),
    timing: () => null,
    variables: () => null,
    ...over,
  };
  return session;
}
