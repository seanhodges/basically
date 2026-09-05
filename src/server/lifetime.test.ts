import { describe, expect, it, vi } from 'vitest';
import { watchLifetime, type LifetimeClock } from './lifetime';

/** A clock the test advances, so nothing waits on real time. */
function fakeClock() {
  let now = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let next = 1;
  const clock: LifetimeClock = {
    setTimeout: (fn, ms) => {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number);
    },
  };
  return {
    clock,
    advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
    pending: () => timers.size,
  };
}

describe('when a host lets itself go', () => {
  it('stops once nothing has needed it for the idle time', async () => {
    const shutdown = vi.fn(() => Promise.resolve());
    const time = fakeClock();
    watchLifetime({ connected: () => 0, shutdown }, 1000, time.clock);
    time.advance(999);
    expect(shutdown).not.toHaveBeenCalled();
    time.advance(1);
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it('does not stop while a caller is connected, however quiet', async () => {
    const shutdown = vi.fn(() => Promise.resolve());
    const time = fakeClock();
    watchLifetime({ connected: () => 1, shutdown }, 1000, time.clock);
    time.advance(10_000);
    expect(shutdown).not.toHaveBeenCalled();
  });

  it('starts the wait again each time it is wanted', async () => {
    const shutdown = vi.fn(() => Promise.resolve());
    const time = fakeClock();
    const life = watchLifetime({ connected: () => 0, shutdown }, 1000, time.clock);
    for (let i = 0; i < 5; i++) {
      time.advance(900);
      life.touch();
    }
    expect(shutdown).not.toHaveBeenCalled();
    time.advance(1000);
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it('checks again when the timer fires, not only when it was set', async () => {
    // A caller may connect during the wait; its machine is not something to
    // let go of behind its back.
    let connected = 0;
    const shutdown = vi.fn(() => Promise.resolve());
    const time = fakeClock();
    watchLifetime({ connected: () => connected, shutdown }, 1000, time.clock);
    connected = 1;
    time.advance(1000);
    expect(shutdown).not.toHaveBeenCalled();
  });

  it('stops when asked, whatever the clock says', async () => {
    const shutdown = vi.fn(() => Promise.resolve());
    const time = fakeClock();
    const life = watchLifetime({ connected: () => 3, shutdown }, 1000, time.clock);
    await life.stop();
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it('stops only once, however many times it is asked', async () => {
    const shutdown = vi.fn(() => Promise.resolve());
    const time = fakeClock();
    const life = watchLifetime({ connected: () => 0, shutdown }, 1000, time.clock);
    await life.stop();
    await life.stop();
    time.advance(5000);
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it('leaves no timer behind when it is cancelled', () => {
    const time = fakeClock();
    const life = watchLifetime(
      { connected: () => 0, shutdown: () => Promise.resolve() },
      1000,
      time.clock,
    );
    expect(time.pending()).toBe(1);
    life.cancel();
    expect(time.pending()).toBe(0);
  });

  it('does not re-arm after it has been cancelled', () => {
    const shutdown = vi.fn(() => Promise.resolve());
    const time = fakeClock();
    const life = watchLifetime({ connected: () => 0, shutdown }, 1000, time.clock);
    life.cancel();
    life.touch();
    time.advance(5000);
    expect(shutdown).not.toHaveBeenCalled();
  });
});
