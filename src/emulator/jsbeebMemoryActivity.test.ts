import { describe, expect, it } from 'vitest';
import { JsbeebMemoryActivity } from './jsbeebMemoryActivity';
import { READ_BIT, WRITE_BIT } from './memoryActivityBuffer';
import type { Cpu6502 } from 'jsbeeb/src/fake6502.js';

/**
 * Minimal stand-in for jsbeeb's `debugRead`/`debugWrite` DebugHooks: collects
 * handlers, drops them on remove, and lets the test fire an access. `fire`
 * returns whether any handler asked to halt the CPU (a truthy return), so the
 * test can assert the recorder never does.
 */
class FakeHook {
  private handlers: ((...args: number[]) => boolean | void)[] = [];
  add(handler: (...args: number[]) => boolean | void): { remove(): void } {
    this.handlers.push(handler);
    return {
      remove: () => {
        this.handlers = this.handlers.filter((h) => h !== handler);
      },
    };
  }
  get count(): number {
    return this.handlers.length;
  }
  fire(...args: number[]): boolean {
    let halted = false;
    for (const h of this.handlers) if (h(...args)) halted = true;
    return halted;
  }
}

function fakeCpu(): { cpu: Cpu6502; read: FakeHook; write: FakeHook } {
  const read = new FakeHook();
  const write = new FakeHook();
  const cpu = { debugRead: read, debugWrite: write } as unknown as Cpu6502;
  return { cpu, read, write };
}

describe('JsbeebMemoryActivity', () => {
  it('records nothing and installs no hooks while disabled', () => {
    const { cpu, read, write } = fakeCpu();
    const activity = new JsbeebMemoryActivity(cpu);
    expect(read.count).toBe(0);
    expect(write.count).toBe(0);
    expect(activity.drain()).toBeNull();
  });

  it('stamps read and write bits at the CPU address when enabled', () => {
    const { cpu, read, write } = fakeCpu();
    const activity = new JsbeebMemoryActivity(cpu);
    activity.setRecording(true);
    expect(read.count).toBe(1);
    expect(write.count).toBe(1);

    read.fire(0x1900, 0x0d, 0); // program-area read
    write.fire(0x2000, 0x42); // write
    read.fire(0x2000, 0x42, 0); // read the address it just wrote

    const drained = activity.drain()!;
    expect(drained[0x1900]).toBe(READ_BIT);
    expect(drained[0x2000]).toBe(READ_BIT | WRITE_BIT);
    expect(drained[0x3000]).toBe(0);
  });

  it('never halts the CPU (handlers return falsy)', () => {
    const { cpu, read, write } = fakeCpu();
    new JsbeebMemoryActivity(cpu).setRecording(true);
    expect(read.fire(0x1234, 0, 0)).toBe(false);
    expect(write.fire(0x1234, 0)).toBe(false);
  });

  it('keeps stamping the live buffer across a drain (array is swapped)', () => {
    const { cpu, read } = fakeCpu();
    const activity = new JsbeebMemoryActivity(cpu);
    activity.setRecording(true);
    read.fire(0x1900, 0, 0);
    const first = activity.drain()!;
    expect(first[0x1900]).toBe(READ_BIT);
    // After the drain the old buffer must not receive new hits...
    read.fire(0x2000, 0, 0);
    expect(first[0x2000]).toBe(0);
    // ...they land in the fresh fill buffer.
    const second = activity.drain()!;
    expect(second[0x2000]).toBe(READ_BIT);
    expect(second[0x1900]).toBe(0);
  });

  it('removes hooks and clears hits when disabled, and re-arming is clean', () => {
    const { cpu, read, write } = fakeCpu();
    const activity = new JsbeebMemoryActivity(cpu);
    activity.setRecording(true);
    read.fire(0x1900, 0, 0);
    activity.setRecording(false);
    expect(read.count).toBe(0);
    expect(write.count).toBe(0);
    expect(activity.drain()).toBeNull();

    activity.setRecording(true);
    expect(read.count).toBe(1);
    const drained = activity.drain()!;
    expect(drained.every((b) => b === 0)).toBe(true); // no stale activity
  });

  it('is idempotent when re-armed with the current state', () => {
    const { cpu, read } = fakeCpu();
    const activity = new JsbeebMemoryActivity(cpu);
    activity.setRecording(true);
    activity.setRecording(true);
    expect(read.count).toBe(1); // not doubled
  });

  it('removes hooks on dispose', () => {
    const { cpu, read, write } = fakeCpu();
    const activity = new JsbeebMemoryActivity(cpu);
    activity.setRecording(true);
    activity.dispose();
    expect(read.count).toBe(0);
    expect(write.count).toBe(0);
  });
});
