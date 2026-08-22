import { describe, expect, it } from 'vitest';
import { createMachineLoop } from './machineLoop';
import type { MachineLoopContract, MachineStep } from './machineLoop';
import type { DebugStepOptions } from '../dialects/types';

/**
 * The loop is exercised here rather than through a machine: booting a real ROM
 * to prove that a debt of five cycles is carried would say nothing the fake
 * doesn't, and the registry batteries (`debugEquivalence`, `lineProfiling`)
 * already prove each machine drives it correctly.
 */

/** A machine whose steps and reported lines the test dictates. */
function fake(over: Partial<MachineLoopContract> = {}) {
  const log: string[] = [];
  let stepped = 0;
  let line: number | null = null;
  const step = over.step ?? (() => 7);
  const contract: MachineLoopContract = {
    cyclesPerFrame: 100,
    onSliceStart: () => log.push('start'),
    onSliceEnd: () => log.push('end'),
    currentLine: () => line,
    ...over,
    step: (elapsed) => {
      stepped++;
      return step(elapsed);
    },
  };
  return {
    log,
    loop: createMachineLoop(contract),
    steps: () => stepped,
    setLine: (l: number | null) => {
      line = l;
    },
  };
}

const run = (fromLine: number | null = null): DebugStepOptions => ({
  breakpoints: new Set<number>(),
  mode: 'run',
  fromLine,
});

describe('createMachineLoop', () => {
  it('carries the overrun into the next frame instead of dropping it', () => {
    const m = fake();
    // 15 steps of 7 reach 105, so the next frame starts 5 cycles in and needs
    // only 14 - dropping the overrun would run the machine fast by that much.
    m.loop.runFrame();
    expect(m.steps()).toBe(15);
    m.loop.runFrame();
    expect(m.steps()).toBe(29);
    m.loop.runFrame();
    expect(m.steps()).toBe(43);
  });

  it('completes the step that exhausts the budget rather than truncating it', () => {
    // One step is worth more than a whole frame: it still runs to completion,
    // and the frames it overpaid for run no steps at all.
    const m = fake({ cyclesPerFrame: 10, step: () => 25 });
    m.loop.runFrame();
    expect(m.steps()).toBe(1);
    m.loop.runFrame(); // the 15 cycles owed cover this frame whole
    expect(m.steps()).toBe(1);
    m.loop.runFrame();
    expect(m.steps()).toBe(2);
  });

  it('drops the carried debt on reset', () => {
    const m = fake();
    m.loop.runFrame();
    m.loop.reset();
    m.loop.runFrame();
    expect(m.steps()).toBe(30);
  });

  it('runs the slice hooks exactly once per frame and per slice', () => {
    const m = fake();
    m.loop.runFrame();
    expect(m.log).toEqual(['start', 'end']);
    m.log.length = 0;
    m.loop.debugStep(run());
    expect(m.log).toEqual(['start', 'end']);
  });

  it('runs the slice hooks once on a slice that pauses early', () => {
    const m = fake();
    m.setLine(20);
    m.log.length = 0;
    expect(m.loop.debugStep({ ...run(), mode: 'step' })).toEqual({
      paused: true,
      line: 20,
    });
    expect(m.log).toEqual(['start', 'end']);
  });

  it('does nothing at all while the machine is not ready', () => {
    const m = fake({ ready: () => false });
    m.loop.runFrame();
    expect(m.loop.debugStep(run())).toEqual({ paused: false, line: null });
    expect(m.steps()).toBe(0);
    expect(m.log).toEqual([]);
  });

  describe('the line watch', () => {
    it('steps to the next line in step mode', () => {
      const m = fake();
      m.setLine(10);
      // Resuming from 10 runs on until the line changes; the slice that finds
      // it still on 10 pauses on nothing and reports the budget exhausted.
      expect(m.loop.debugStep({ ...run(10), mode: 'step' })).toEqual({
        paused: false,
        line: 10,
      });
      m.setLine(20);
      expect(m.loop.debugStep({ ...run(10), mode: 'step' })).toEqual({
        paused: true,
        line: 20,
      });
    });

    it('holds a breakpoint disarmed until execution leaves the resumed-from line', () => {
      const opts: DebugStepOptions = {
        breakpoints: new Set([10]),
        mode: 'run',
        fromLine: 10,
      };
      // Continue off a breakpointed line must not re-trigger on the spot.
      const held = fake();
      held.setLine(10);
      expect(held.loop.debugStep(opts)).toEqual({ paused: false, line: 10 });

      // ...but the loop coming back around to it within the slice does.
      const around = [10, 10, 20, 20, 10];
      let read = 0;
      const back = fake({
        currentLine: () => around[Math.min(read++, around.length - 1)] ?? null,
      });
      expect(back.loop.debugStep(opts)).toEqual({ paused: true, line: 10 });
    });

    it('arms immediately on the first slice of a session', () => {
      const m = fake();
      m.setLine(10);
      expect(
        m.loop.debugStep({
          breakpoints: new Set([10]),
          mode: 'run',
          fromLine: null,
        }),
      ).toEqual({ paused: true, line: 10 });
    });

    it('never watches on the frame path', () => {
      let read = 0;
      const m = fake({
        currentLine: () => {
          read++;
          return 10;
        },
      });
      m.loop.runFrame();
      expect(read).toBe(0);
    });

    it('watches on the cadence a cycle-ticked machine asks for', () => {
      let read = 0;
      const m = fake({
        cyclesPerFrame: 100,
        step: () => 1,
        lineWatchCycles: 8,
        currentLine: () => {
          read++;
          return null;
        },
      });
      m.loop.debugStep(run());
      // The first step, then every eighth cycle - 1, 9, 17 … 97 - plus the
      // one closing read that labels the line the slice ran out on.
      expect(read).toBe(14);
    });
  });

  describe('an idle step', () => {
    const halted: MachineStep = { cycles: 0, idle: true };

    it('ends the slice owing nothing where nothing will wake the CPU', () => {
      const m = fake({ step: () => halted, idleEndsSlice: true });
      m.loop.runFrame();
      expect(m.steps()).toBe(1);
      expect(m.log).toEqual(['start', 'end']);
    });

    it('is skipped by the line watch where the CPU keeps being stepped', () => {
      let read = 0;
      const m = fake({
        step: () => ({ cycles: 4, idle: true }),
        currentLine: () => {
          read++;
          return 10;
        },
      });
      // A halted CPU executes nothing, so the line cannot have changed and a
      // breakpoint on it must not fire.
      expect(
        m.loop.debugStep({
          breakpoints: new Set([10]),
          mode: 'run',
          fromLine: null,
        }),
      ).toEqual({ paused: false, line: 10 });
      expect(read).toBe(1); // only the closing read
    });
  });

  it('lets a step failure surface unchanged', () => {
    const m = fake({
      step: () => {
        throw new Error('bus fault');
      },
    });
    expect(() => m.loop.runFrame()).toThrow('bus fault');
    expect(() => m.loop.debugStep(run())).toThrow('bus fault');
  });
});
