import { describe, expect, it, vi } from 'vitest';
import { createSessions } from './sessions';
import type { MachineHolder } from './machineWorker';

/** A holder that records what was asked of it, without booting anything. */
function stubHolder(name: string | null = null) {
  const calls: string[] = [];
  let disposed = 0;
  const holder: MachineHolder = {
    call: (operation) => {
      calls.push(operation);
      return Promise.resolve({ outcome: { operation, name }, notes: [], failed: false });
    },
    held: () => Promise.resolve(name),
    dispose: () => {
      disposed += 1;
      return Promise.resolve();
    },
  };
  return { holder, calls, disposed: () => disposed };
}

describe('the callers a host is serving', () => {
  it('starts no machine for a session that never needs one', async () => {
    const newHolder = vi.fn(() => stubHolder().holder);
    const sessions = createSessions(newHolder);
    const session = sessions.open();
    expect(await session.held()).toBeNull();
    expect(newHolder).not.toHaveBeenCalled();
    await session.close();
    expect(newHolder).not.toHaveBeenCalled();
  });

  it('makes a holder on first use and reuses it after', async () => {
    const newHolder = vi.fn(() => stubHolder('ZX81').holder);
    const session = createSessions(newHolder).open();
    await session.call('run', {});
    await session.call('look', {});
    expect(newHolder).toHaveBeenCalledTimes(1);
    expect(await session.held()).toBe('ZX81');
  });

  it('gives each caller a machine of its own', async () => {
    const made: ReturnType<typeof stubHolder>[] = [];
    const sessions = createSessions(() => {
      const one = stubHolder(`machine ${made.length}`);
      made.push(one);
      return one.holder;
    });
    const first = sessions.open();
    const second = sessions.open();
    await first.call('run', {});
    await second.call('run', {});
    expect(made).toHaveLength(2);
    expect(await first.held()).toBe('machine 0');
    expect(await second.held()).toBe('machine 1');
    // What one caller asked is not in the other's record.
    expect(made[0].calls).toEqual(['run']);
    expect(made[1].calls).toEqual(['run']);
  });

  it('neither caller is refused because the other holds a machine', async () => {
    const sessions = createSessions(() => stubHolder('ZX81').holder);
    const first = sessions.open();
    const second = sessions.open();
    await expect(first.call('run', {})).resolves.toBeTruthy();
    await expect(second.call('run', {})).resolves.toBeTruthy();
  });

  it('lets a machine go on release, and keeps the session open', async () => {
    const one = stubHolder('ZX81');
    const session = createSessions(() => one.holder).open();
    await session.call('run', {});
    await session.release();
    expect(one.disposed()).toBe(1);
    expect(await session.held()).toBeNull();
    // The session still works: a later run starts a machine again.
    await expect(session.call('run', {})).resolves.toBeTruthy();
  });

  it('lets a machine go when the caller disconnects', async () => {
    const one = stubHolder('ZX81');
    const sessions = createSessions(() => one.holder);
    const session = sessions.open();
    await session.call('run', {});
    expect(sessions.openCount).toBe(1);
    await session.close();
    expect(one.disposed()).toBe(1);
    expect(sessions.openCount).toBe(0);
  });

  it('counts only the callers still connected', async () => {
    const sessions = createSessions(() => stubHolder().holder);
    const first = sessions.open();
    sessions.open();
    expect(sessions.openCount).toBe(2);
    await first.close();
    expect(sessions.openCount).toBe(1);
  });

  it('closes every session and every machine when the host goes', async () => {
    const made: ReturnType<typeof stubHolder>[] = [];
    const sessions = createSessions(() => {
      const one = stubHolder('ZX81');
      made.push(one);
      return one.holder;
    });
    await sessions.open().call('run', {});
    await sessions.open().call('run', {});
    await sessions.closeAll();
    expect(sessions.openCount).toBe(0);
    expect(made.map((one) => one.disposed())).toEqual([1, 1]);
  });

  it('is safe to close twice', async () => {
    const one = stubHolder('ZX81');
    const session = createSessions(() => one.holder).open();
    await session.call('run', {});
    await session.close();
    await expect(session.close()).resolves.toBeUndefined();
    expect(one.disposed()).toBe(1);
  });
});
