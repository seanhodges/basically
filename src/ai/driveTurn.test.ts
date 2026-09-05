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
  forgetMachineSession,
  machineFrozen,
  registerMachineSession,
  type MachineSession,
} from '../app/machineSession';
import { armDriving, settleJudgingTurn } from './aiStore';
import { setAiProvider } from '../storage/settings';

/**
 * The three gates on driving, tested where they are decided.
 *
 * Reaching them through a streamed turn would test the mocking rather than the
 * rule, and the rule is the whole safety story: a turn that drove when it
 * should not have would act on the user's machine unasked.
 */
function stubControl(over: Partial<MachineSession> = {}): MachineSession {
  return {
    pressKeys: vi.fn(() => ({ ok: true, frames: 3 })),
    joystick: vi.fn(() => ({ ok: true, frames: 3 })),
    advance: vi.fn((n: number) => ({ ok: true, frames: n })),
    waitForText: vi.fn(() => ({ ok: true, frames: 3 })),
    waitForEnd: vi.fn(() => ({ ok: true, frames: 3 })),
    programState: () => false,
    readText: () => ({ lines: ['READY'], cols: 5, rows: 1 }),
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
    ...over,
  };
}

beforeEach(() => {
  forgetMachineSession();
  setAiProvider('anthropic');
});

afterEach(() => {
  forgetMachineSession();
});

describe('when driving is armed', () => {
  it('is not armed when the assistant did not ask', () => {
    registerMachineSession(stubControl());
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
    registerMachineSession(stubControl());
    setAiProvider('openai');
    // Stated, not discovered: offering tools a backend drops would leave the
    // assistant asked to do something that silently never happens.
    expect(armDriving(true)).toBeNull();
    expect(machineFrozen()).toBe(false);
  });

  it('is armed, and holds the machine still, when all three hold', () => {
    registerMachineSession(stubControl());

    const driving = armDriving(true);

    expect(driving).not.toBeNull();
    // Frozen for the turn's duration: a tool round trip is seconds of network,
    // and what the assistant acts on has to be the screen it was last shown.
    expect(machineFrozen()).toBe(true);
  });

  it('lets the machine go again when the turn ends', () => {
    registerMachineSession(stubControl());
    const driving = armDriving(true)!;

    driving.finish();

    // Otherwise the freeze outlives the turn and the user's run never advances.
    expect(machineFrozen()).toBe(false);
  });

  it('releases every key when the turn ends', () => {
    const control = stubControl();
    registerMachineSession(control);

    armDriving(true)!.finish();

    expect(control.releaseAll).toHaveBeenCalled();
  });

  it('lets the machine go even when it no longer owns it', () => {
    const control = stubControl();
    registerMachineSession(control);
    const driving = armDriving(true)!;

    // What a run the user started does: the pane drops the driver, and this
    // turn is left holding one that owns nothing.
    forgetMachineSession();
    driving.finish();

    // The thaw still has to happen - it is the freeze that strands a machine.
    expect(machineFrozen()).toBe(false);
    // But the keys do not: they are held on a machine that is either disposed
    // or running somebody else's program.
    expect(control.releaseAll).not.toHaveBeenCalled();
  });
});

describe('a turn whose machine was taken back', () => {
  it('refuses to drive it', async () => {
    const control = stubControl();
    registerMachineSession(control);
    const driving = armDriving(true)!;
    forgetMachineSession();

    const result = await driving.runTool({
      id: 'c1',
      name: 'drive',
      input: { script: 'PRESS KeyA' },
    });

    // Its own reference still works, so nothing but the registry would stop it
    // typing into whatever the user loaded.
    expect(control.pressKeys).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content).toContain('no longer yours');
  });

  it('refuses to look at it', async () => {
    const control = stubControl();
    registerMachineSession(control);
    const driving = armDriving(true)!;
    forgetMachineSession();

    const result = await driving.runTool({
      id: 'c1',
      name: 'look',
      input: {},
    });

    // A look would describe the user's program as though it were its own.
    expect(result.isError).toBe(true);
    expect(result.content).not.toContain('READY');
  });
});

describe('the tools it hands over', () => {
  it('drives the machine and shows what the screen became', async () => {
    const control = stubControl();
    registerMachineSession(control);
    const driving = armDriving(true)!;

    const result = await driving.runTool({
      id: 'c1',
      name: 'drive',
      input: { script: 'PRESS KeyA' },
    });

    expect(control.pressKeys).toHaveBeenCalled();
    expect(result.content).toContain('pressed KeyA');
    expect(result.content).toContain('READY');
    expect(result.isError).toBeUndefined();
  });

  it('looks without touching anything', async () => {
    const control = stubControl();
    registerMachineSession(control);
    const driving = armDriving(true)!;

    const result = await driving.runTool({
      id: 'c1',
      name: 'look',
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
    registerMachineSession(control);
    const driving = armDriving(true)!;

    const result = await driving.runTool({
      id: 'c1',
      name: 'drive',
      input: { script: 'PRESS F13' },
    });

    // Flagged so the assistant corrects its driving - never so it rewrites a
    // program that may be perfectly correct.
    expect(result.isError).toBe(true);
    expect(result.content).toContain('no key called');
  });

  it('answers a tool that does not exist rather than throwing', async () => {
    registerMachineSession(stubControl());
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

describe('settling the turn that judges', () => {
  const spies = () => ({
    finish: vi.fn(),
    judged: vi.fn(),
    abandoned: vi.fn(),
  });

  it('hands the machine back and judges when the reply arrives', async () => {
    const { finish, judged, abandoned } = spies();

    settleJudgingTurn({ finish }, Promise.resolve('ok'), judged, abandoned);
    await Promise.resolve();

    expect(finish).toHaveBeenCalledTimes(1);
    expect(judged).toHaveBeenCalledTimes(1);
    expect(abandoned).not.toHaveBeenCalled();
  });

  it('hands the machine back even when the turn never happened', async () => {
    const { finish, judged, abandoned } = spies();

    settleJudgingTurn(
      { finish },
      Promise.reject(new Error('no system prompt')),
      judged,
      abandoned,
    );
    await Promise.resolve();
    await Promise.resolve();

    // The whole point: a turn that failed before it was sent is exactly the
    // case where nothing else would ever release the machine.
    expect(finish).toHaveBeenCalledTimes(1);
    expect(abandoned).toHaveBeenCalledTimes(1);
    // And it judges nothing. No reply was appended, so the last message in the
    // thread is the answer being judged - reading a verdict out of that would
    // apply one the assistant never gave.
    expect(judged).not.toHaveBeenCalled();
  });

  it('hands the machine back before anything downstream runs', async () => {
    const order: string[] = [];
    const finish = vi.fn(() => void order.push('finish'));

    settleJudgingTurn(
      { finish },
      Promise.resolve('ok'),
      () => void order.push('judged'),
      () => void order.push('abandoned'),
    );
    await Promise.resolve();

    // A correction settles by starting another check run, and one that began on
    // a machine still frozen would never advance a frame.
    expect(order).toEqual(['finish', 'judged']);
  });

  it('settles a turn that armed no driving at all', async () => {
    const { judged, abandoned } = spies();

    settleJudgingTurn(null, Promise.resolve('ok'), judged, abandoned);
    await Promise.resolve();

    expect(judged).toHaveBeenCalledTimes(1);
    expect(abandoned).not.toHaveBeenCalled();
  });
});
