import { describe, expect, it, vi } from 'vitest';
import { createSessions } from './sessions';
import type { MachineHolder } from './machineWorker';
import type { SessionView } from './view/link';
import { noPlay } from './play/link';
import type { ProjectionHost, SessionProjection } from './projection/link';

/** A holder that records what was asked of it, without booting anything. */
function stubHolder(name: string | null = null) {
  const calls: string[] = [];
  let disposed = 0;
  const holder: MachineHolder = {
    call: (operation) => {
      calls.push(operation);
      return Promise.resolve({
        outcome: { operation, name },
        notes: [],
        failed: false,
      });
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

describe('the session the command line shares', () => {
  it('is the same session every time, so a machine survives between commands', async () => {
    const newHolder = vi.fn(() => stubHolder('ZX81').holder);
    const sessions = createSessions(newHolder);
    await sessions.shared().call('run', {});
    await sessions.shared().call('look', {});
    expect(newHolder).toHaveBeenCalledTimes(1);
    expect(await sessions.shared().held()).toBe('ZX81');
  });

  it('keeps its machine when one command ends', async () => {
    // Each command is a connection of its own; closing one is not the command
    // line going away, and the next command has to find the machine still up.
    const one = stubHolder('ZX81');
    const sessions = createSessions(() => one.holder);
    await sessions.shared().call('run', {});
    await sessions.shared().close();
    expect(one.disposed()).toBe(0);
    expect(await sessions.shared().held()).toBe('ZX81');
  });

  it('lets its machine go when told to release it', async () => {
    const one = stubHolder('ZX81');
    const sessions = createSessions(() => one.holder);
    await sessions.shared().call('run', {});
    await sessions.shared().release();
    expect(one.disposed()).toBe(1);
    expect(await sessions.shared().held()).toBeNull();
  });

  it('lets its machine go when the host stops', async () => {
    const one = stubHolder('ZX81');
    const sessions = createSessions(() => one.holder);
    await sessions.shared().call('run', {});
    await sessions.closeAll();
    expect(one.disposed()).toBe(1);
  });

  it('is not the session a caller holding its own connection gets', async () => {
    const made: ReturnType<typeof stubHolder>[] = [];
    const sessions = createSessions(() => {
      const one = stubHolder('ZX81');
      made.push(one);
      return one.holder;
    });
    await sessions.shared().call('run', {});
    const mine = sessions.open();
    await mine.call('run', {});
    expect(made).toHaveLength(2);
    await mine.close();
    // The one that went with its connection is gone; the shared one is not.
    expect(made[1].disposed()).toBe(1);
    expect(made[0].disposed()).toBe(0);
  });
});

/**
 * A view that records what its caller's session told it, without binding
 * anything. What a real one does over a socket is `./projection/host.test.ts`.
 */
function stubViews(): ProjectionHost & { made: StubView[] } {
  const made: StubView[] = [];
  return {
    made,
    forSession: (): SessionProjection => {
      const view = stubView();
      made.push(view);
      return {
        view,
        play: noPlay(),
        end: () => view.end(),
      };
    },
    close: () => Promise.resolve(),
  };
}

interface StubView extends SessionView {
  states: (string | null)[];
  ended: boolean;
  frames: number;
}

function stubView(): StubView {
  let open = false;
  const view: StubView = {
    states: [],
    ended: false,
    frames: 0,
    open: () => {
      const already = open;
      open = true;
      return Promise.resolve({
        address: 'http://127.0.0.1:1/v/token/',
        problem: null,
        already,
        endedPlay: false,
      });
    },
    watching: () => open,
    free: () => true,
    send: () => {
      view.frames++;
    },
    working: () => view.states.push('working'),
    settled: (held) => view.states.push(held),
    end: () => {
      view.ended = true;
      open = false;
      return Promise.resolve();
    },
  };
  return view;
}

describe("a caller's view of its own machine", () => {
  it('is made without projecting anything until the caller asks', () => {
    const views = stubViews();
    const sessions = createSessions(() => stubHolder('ZX81').holder, views);
    sessions.open();
    expect(views.made).toHaveLength(1);
    expect(views.made[0]!.watching()).toBe(false);
  });

  it('says when a request is working and what it left behind', async () => {
    const views = stubViews();
    const session = createSessions(
      () => stubHolder('ZX81').holder,
      views,
    ).open();
    const view = views.made[0]!;
    await view.open();

    await session.call('run', {});
    // Working, then settled on the machine the request left up: a still
    // picture is ambiguous unless the view says which of the two it is.
    expect(view.states).toEqual(['working', 'ZX81']);
  });

  it('costs a caller that is not being watched nothing', async () => {
    const views = stubViews();
    const session = createSessions(
      () => stubHolder('ZX81').holder,
      views,
    ).open();
    await session.call('run', {});
    // The machine was never asked what it holds, because nobody would have
    // been told.
    expect(views.made[0]!.states).toEqual(['working', null]);
  });

  it('follows the caller across the machine it replaces', async () => {
    const views = stubViews();
    const newHolder = vi.fn(() => stubHolder('ZX81').holder);
    const session = createSessions(newHolder, views).open();
    const view = views.made[0]!;
    await view.open();

    await session.call('run', {});
    await session.call('run', {});
    // One view for the caller, whatever it is running: the frame an embedding
    // application is showing must not go blank because a program was started.
    expect(views.made).toHaveLength(1);
    expect(view.ended).toBe(false);
    expect((await view.open()).already).toBe(true);
  });

  it('says no machine is up when the caller releases one, and stays open', async () => {
    const views = stubViews();
    const session = createSessions(
      () => stubHolder('ZX81').holder,
      views,
    ).open();
    const view = views.made[0]!;
    await view.open();

    await session.call('run', {});
    await session.release();
    expect(view.states.at(-1)).toBeNull();
    // The address is still the caller's; what has gone is the machine.
    expect(view.ended).toBe(false);
    expect(view.watching()).toBe(true);
  });

  it('lets a caller give up its view and go on acting on its machine', async () => {
    const views = stubViews();
    const holder = stubHolder('ZX81');
    const session = createSessions(() => holder.holder, views).open();
    const view = views.made[0]!;
    await view.open();

    await session.unview();
    expect(view.ended).toBe(true);
    await session.call('look', {});
    expect(await session.held()).toBe('ZX81');
  });

  it('ends with the caller, however the caller goes', async () => {
    const views = stubViews();
    const sessions = createSessions(() => stubHolder('ZX81').holder, views);
    const session = sessions.open();
    await views.made[0]!.open();
    await session.close();
    expect(views.made[0]!.ended).toBe(true);
  });

  it('ends every view, and stops the projection, when the host goes', async () => {
    const views = stubViews();
    const closed = vi.fn(() => Promise.resolve());
    const sessions = createSessions(() => stubHolder('ZX81').holder, {
      ...views,
      close: closed,
    });
    sessions.open();
    sessions.open();
    await sessions.closeAll();
    expect(views.made.every((view) => view.ended)).toBe(true);
    expect(closed).toHaveBeenCalled();
  });
});
