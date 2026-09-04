import { describe, expect, it, vi } from 'vitest';
import {
  forgetMachineSession,
  freezeMachine,
  hasMachineSession,
  machineFrozen,
  machineSession,
  ownsMachine,
  registerMachineSession,
  type MachineSession,
} from './machineSession';

/** A session that says yes to everything; the registry never looks inside. */
function stubSession(): MachineSession {
  return {
    pressKeys: vi.fn(() => ({ ok: true, frames: 3 })),
    joystick: vi.fn(() => ({ ok: true, frames: 3 })),
    advance: vi.fn((n: number) => ({ ok: true, frames: n })),
    waitForText: vi.fn(() => ({ ok: true, frames: 3 })),
    waitForEnd: vi.fn(() => ({ ok: true, frames: 3 })),
    programState: () => false,
    readText: () => null,
    releaseAll: vi.fn(),
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
  };
}

describe('the registry', () => {
  it('hands out the session the pane registered, and takes it back', () => {
    forgetMachineSession();
    expect(hasMachineSession()).toBe(false);

    const session = stubSession();
    const unregister = registerMachineSession(session);
    expect(machineSession()).toBe(session);

    unregister();
    // A machine that is gone must not be drivable, or an answer about this
    // program could be checked against the last one.
    expect(machineSession()).toBeNull();
    expect(hasMachineSession()).toBe(false);
  });

  it('thaws the machine when the session goes away', () => {
    forgetMachineSession();
    const unregister = registerMachineSession(stubSession());

    freezeMachine(true);
    expect(machineFrozen()).toBe(true);
    unregister();

    // Otherwise a frozen machine outlives the turn that froze it and the
    // user's own run never advances again.
    expect(machineFrozen()).toBe(false);
  });

  it('thaws the machine when the session is forgotten outright', () => {
    forgetMachineSession();
    registerMachineSession(stubSession());
    freezeMachine(true);

    forgetMachineSession();

    // This is the path a run the user started takes: the pane drops the
    // session rather than unregistering a particular one, and a drop that left
    // the machine frozen would strand the very run that asked for it.
    expect(machineFrozen()).toBe(false);
  });

  it('says which session owns the machine', () => {
    forgetMachineSession();
    const first = stubSession();
    const second = stubSession();

    registerMachineSession(first);
    expect(ownsMachine(first)).toBe(true);

    // A new run registers over the old session, and the turn still holding
    // the old one has to be able to find that out: its own reference goes on
    // working, so nothing else would tell it the machine had moved on.
    registerMachineSession(second);
    expect(ownsMachine(first)).toBe(false);
    expect(ownsMachine(second)).toBe(true);

    forgetMachineSession();
    expect(ownsMachine(second)).toBe(false);
  });

  it('cannot be thawed by the unregister of a session already replaced', () => {
    forgetMachineSession();
    const first = stubSession();
    const second = stubSession();
    const unregisterFirst = registerMachineSession(first);
    registerMachineSession(second);

    freezeMachine(true);
    unregisterFirst();

    // The pane drops and re-registers a session on every run, so a stale
    // unregister firing late must not reach past its own session and thaw - or
    // drop - the machine that replaced it.
    expect(machineFrozen()).toBe(true);
    expect(machineSession()).toBe(second);
  });
});
