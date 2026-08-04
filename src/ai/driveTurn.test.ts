import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Storage stubs before the modules under test import: aiStore reads the stored
// conversation at module init, and the provider gate reads the chosen backend.
vi.hoisted(() => {
  const stub = () => {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    } as Storage;
  };
  globalThis.localStorage = stub();
  globalThis.sessionStorage = stub();
});
import {
  forgetMachineControl,
  machineFrozen,
  registerMachineControl,
  type MachineControl,
} from '../app/machineControl';
import { armDriving } from './aiStore';
import { DRIVE_TOOL, LOOK_TOOL } from './driveTools';
import { setAiProvider } from '../storage/settings';

/**
 * The three gates on driving, tested where they are decided.
 *
 * Reaching them through a streamed turn would test the mocking rather than the
 * rule, and the rule is the whole safety story: a turn that drove when it
 * should not have would act on the user's machine unasked.
 */
function stubControl(over: Partial<MachineControl> = {}): MachineControl {
  return {
    keyNames: () => ['KeyA'],
    pressKeys: vi.fn(() => ({ ok: true, frames: 3 })),
    joystick: vi.fn(() => ({ ok: true, frames: 3 })),
    advance: vi.fn((n: number) => ({ ok: true, frames: n })),
    waitForText: vi.fn(() => ({ ok: true, frames: 3 })),
    readText: () => ({ lines: ['READY'], cols: 5, rows: 1 }),
    releaseAll: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  forgetMachineControl();
  setAiProvider('anthropic');
});

afterEach(() => {
  forgetMachineControl();
});

describe('when driving is armed', () => {
  it('is not armed when the assistant did not ask', () => {
    registerMachineControl(stubControl());
    expect(armDriving(false)).toBeNull();
    // And the machine is left running, as it would be on any ordinary check.
    expect(machineFrozen()).toBe(false);
  });

  it('is not armed when there is no machine to drive', () => {
    // A check whose machine has gone away must not pretend otherwise: an
    // answer about this program could otherwise be checked against the last.
    expect(armDriving(true)).toBeNull();
    expect(machineFrozen()).toBe(false);
  });

  it('is not armed on a provider that cannot be given tools', () => {
    registerMachineControl(stubControl());
    setAiProvider('openai');
    // Stated, not discovered: offering tools a backend drops would leave the
    // assistant asked to do something that silently never happens.
    expect(armDriving(true)).toBeNull();
    expect(machineFrozen()).toBe(false);
  });

  it('is armed, and holds the machine still, when all three hold', () => {
    registerMachineControl(stubControl());

    const driving = armDriving(true);

    expect(driving).not.toBeNull();
    // Frozen for the turn's duration: a tool round trip is seconds of network,
    // and what the assistant acts on has to be the screen it was last shown.
    expect(machineFrozen()).toBe(true);
    expect(driving!.tools.map((t) => t.name)).toEqual([DRIVE_TOOL, LOOK_TOOL]);
  });

  it('lets the machine go again when the turn ends', () => {
    registerMachineControl(stubControl());
    const driving = armDriving(true)!;

    driving.finish();

    // Otherwise the freeze outlives the turn and the user's run never advances.
    expect(machineFrozen()).toBe(false);
  });

  it('releases every key when the turn ends', () => {
    const control = stubControl();
    registerMachineControl(control);

    armDriving(true)!.finish();

    expect(control.releaseAll).toHaveBeenCalled();
  });
});

describe('the tools it hands over', () => {
  it('drives the machine and shows what the screen became', async () => {
    const control = stubControl();
    registerMachineControl(control);
    const driving = armDriving(true)!;

    const result = await driving.runTool({
      id: 'c1',
      name: DRIVE_TOOL,
      input: { script: 'PRESS KeyA' },
    });

    expect(control.pressKeys).toHaveBeenCalled();
    expect(result.content).toContain('pressed KeyA');
    expect(result.content).toContain('READY');
    expect(result.isError).toBeUndefined();
  });

  it('looks without touching anything', async () => {
    const control = stubControl();
    registerMachineControl(control);
    const driving = armDriving(true)!;

    const result = await driving.runTool({
      id: 'c1',
      name: LOOK_TOOL,
      input: {},
    });

    expect(result.content).toContain('READY');
    expect(control.pressKeys).not.toHaveBeenCalled();
  });

  it('reports driving that failed as the driving failing', async () => {
    const control = stubControl({
      pressKeys: vi.fn(() => ({
        ok: false,
        frames: 0,
        detail: 'this machine has no key called "F13"',
      })),
    });
    registerMachineControl(control);
    const driving = armDriving(true)!;

    const result = await driving.runTool({
      id: 'c1',
      name: DRIVE_TOOL,
      input: { script: 'PRESS F13' },
    });

    // Flagged so the assistant corrects its driving - never so it rewrites a
    // program that may be perfectly correct.
    expect(result.isError).toBe(true);
    expect(result.content).toContain('no key called');
  });

  it('answers a tool that does not exist rather than throwing', async () => {
    registerMachineControl(stubControl());
    const driving = armDriving(true)!;

    const result = await driving.runTool({
      id: 'c1',
      name: 'teleport',
      input: {},
    });

    // A turn that died here would lose everything the model did before it.
    expect(result.isError).toBe(true);
    expect(result.content).toContain('no tool called "teleport"');
  });
});
