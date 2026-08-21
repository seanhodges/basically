import { describe, it, expect } from 'vitest';
import { KeyboardInputEngine } from './inputEngine';
import type { KeyboardLayout } from './layoutSchema';
import type { MachineEmulator } from '../dialects/types';

class FakeMachine {
  log: [string, boolean][] = [];
  down = new Set<string>();
  releaseAllCalls = 0;

  setKey(token: string, down: boolean): void {
    this.log.push([token, down]);
    if (down) this.down.add(token);
    else this.down.delete(token);
  }

  releaseAllKeys(): void {
    this.releaseAllCalls++;
    this.down.clear();
  }
}

const layout: KeyboardLayout = {
  id: 'test',
  name: 'Test',
  theme: 'vk-theme-test',
  gridColumns: 4,
  layers: [
    { id: 'main', position: 'center', activeWhen: [] },
    { id: 'shift', position: 'tr', activeWhen: ['shift'] },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows: [
    [
      {
        id: 'Shift',
        spanX: 1,
        emits: ['Shift'],
        modifier: 'shift',
        labels: [{ text: 'SHIFT' }, null],
      },
      {
        id: 'KeyP',
        spanX: 1,
        emits: ['KeyP'],
        labels: [{ text: 'P' }, { text: '"' }],
      },
      {
        id: 'KeyH',
        spanX: 1,
        emits: ['KeyH'],
        labels: [{ text: 'H' }, { text: '**' }],
      },
      {
        id: 'x-quote',
        spanX: 1,
        emits: ['Shift', 'KeyP'],
        labels: [{ text: '"' }, null],
      },
    ],
  ],
  glyphs: {},
  options: { minHoldFrames: 3 },
};

function setup() {
  const machine = new FakeMachine();
  const engine = new KeyboardInputEngine(layout, {
    kind: 'machine',
    getMachine: () => machine as unknown as MachineEmulator,
  });
  return { machine, engine };
}

function frames(engine: KeyboardInputEngine, n: number) {
  for (let i = 0; i < n; i++) engine.onFrame();
}

describe('KeyboardInputEngine', () => {
  it('defers release of a too-fast tap until minHoldFrames have elapsed', () => {
    const { machine, engine } = setup();
    engine.pointerDown('KeyH', 1);
    expect(machine.down.has('KeyH')).toBe(true);
    engine.pointerUp(1); // released before any frame ran
    expect(machine.down.has('KeyH')).toBe(true); // still held - too young
    frames(engine, 2);
    expect(machine.down.has('KeyH')).toBe(true);
    frames(engine, 1); // 3rd frame - mature
    expect(machine.down.has('KeyH')).toBe(false);
  });

  it('releases immediately when the press is already mature', () => {
    const { machine, engine } = setup();
    engine.pointerDown('KeyH', 1);
    frames(engine, 5);
    engine.pointerUp(1);
    expect(machine.down.has('KeyH')).toBe(false);
  });

  it('sticky modifier overlaps the next keypress and releases after it', () => {
    const { machine, engine } = setup();
    // Tap SHIFT → sticky
    engine.pointerDown('Shift', 1);
    engine.pointerUp(1);
    expect(engine.getModifierState('shift')).toBe('sticky');
    expect(machine.down.has('Shift')).toBe(true);
    expect(engine.getActiveLayer().id).toBe('shift');
    // Press P: chord SHIFT+P held together
    engine.pointerDown('KeyP', 2);
    expect(machine.down.has('Shift')).toBe(true);
    expect(machine.down.has('KeyP')).toBe(true);
    frames(engine, 5);
    engine.pointerUp(2);
    // SHIFT releases only once P's release completed
    expect(machine.down.has('KeyP')).toBe(false);
    expect(machine.down.has('Shift')).toBe(false);
    expect(engine.getModifierState('shift')).toBe('off');
    expect(engine.getActiveLayer().id).toBe('main');
  });

  it('sticky release waits for a min-hold-deferred key release', () => {
    const { machine, engine } = setup();
    engine.pointerDown('Shift', 1);
    engine.pointerUp(1);
    engine.pointerDown('KeyP', 2);
    engine.pointerUp(2); // immediate up → deferred release
    expect(machine.down.has('Shift')).toBe(true);
    expect(machine.down.has('KeyP')).toBe(true);
    frames(engine, 3);
    expect(machine.down.has('KeyP')).toBe(false);
    expect(machine.down.has('Shift')).toBe(false);
  });

  it('double-tap locks the modifier until tapped again', () => {
    const { machine, engine } = setup();
    engine.pointerDown('Shift', 1);
    engine.pointerUp(1);
    expect(engine.getModifierState('shift')).toBe('sticky');
    engine.pointerDown('Shift', 1);
    engine.pointerUp(1);
    expect(engine.getModifierState('shift')).toBe('locked');
    expect(machine.down.has('Shift')).toBe(true);
    // Locked: keypresses do not consume it
    engine.pointerDown('KeyP', 2);
    frames(engine, 5);
    engine.pointerUp(2);
    expect(engine.getModifierState('shift')).toBe('locked');
    expect(machine.down.has('Shift')).toBe(true);
    // Third tap unlocks
    engine.pointerDown('Shift', 1);
    engine.pointerUp(1);
    frames(engine, 5);
    expect(engine.getModifierState('shift')).toBe('off');
    expect(machine.down.has('Shift')).toBe(false);
  });

  it('held modifier with a second pointer releases on lift (no sticky)', () => {
    const { machine, engine } = setup();
    engine.pointerDown('Shift', 1); // finger 1 holds SHIFT
    expect(engine.getModifierState('shift')).toBe('held');
    engine.pointerDown('KeyP', 2); // finger 2 taps P while SHIFT held
    expect(machine.down.has('Shift')).toBe(true);
    expect(machine.down.has('KeyP')).toBe(true);
    frames(engine, 5);
    engine.pointerUp(2);
    expect(machine.down.has('KeyP')).toBe(false);
    expect(machine.down.has('Shift')).toBe(true); // finger 1 still down
    engine.pointerUp(1);
    frames(engine, 5);
    expect(machine.down.has('Shift')).toBe(false);
    expect(engine.getModifierState('shift')).toBe('off'); // used → not sticky
  });

  it('tracks multiple pointers on different keys independently', () => {
    const { machine, engine } = setup();
    engine.pointerDown('KeyP', 1);
    engine.pointerDown('KeyH', 2);
    expect(machine.down.has('KeyP')).toBe(true);
    expect(machine.down.has('KeyH')).toBe(true);
    frames(engine, 5);
    engine.pointerUp(1);
    expect(machine.down.has('KeyP')).toBe(false);
    expect(machine.down.has('KeyH')).toBe(true);
    engine.pointerUp(2);
    expect(machine.down.has('KeyH')).toBe(false);
  });

  it('reference-counts shared tokens across overlapping presses', () => {
    const { machine, engine } = setup();
    engine.pointerDown('Shift', 1); // holds Shift
    engine.pointerDown('x-quote', 2); // emits Shift+KeyP
    frames(engine, 5);
    engine.pointerUp(2); // quote key up - Shift still held by finger 1
    expect(machine.down.has('KeyP')).toBe(false);
    expect(machine.down.has('Shift')).toBe(true);
    engine.pointerUp(1);
    frames(engine, 5);
    expect(machine.down.has('Shift')).toBe(false);
  });

  it('slide off a key releases it; slide onto a key presses it', () => {
    const { machine, engine } = setup();
    engine.pointerDown('KeyP', 1);
    frames(engine, 5);
    engine.pointerEnter('KeyH', 1); // slid from P to H
    expect(machine.down.has('KeyP')).toBe(false);
    expect(machine.down.has('KeyH')).toBe(true);
    engine.pointerEnter(null, 1); // slid off all keys
    frames(engine, 5);
    expect(machine.down.has('KeyH')).toBe(false);
    engine.pointerUp(1); // up outside any key - no-op, nothing stuck
    expect(machine.down.size).toBe(0);
  });

  it('cancelAll releases everything and clears the matrix', () => {
    const { machine, engine } = setup();
    engine.pointerDown('Shift', 1);
    engine.pointerDown('KeyP', 2);
    engine.cancelAll();
    expect(machine.releaseAllCalls).toBe(1);
    expect(engine.getModifierState('shift')).toBe('off');
    expect(engine.getPressedKeyIds().size).toBe(0);
    // Late events for the dead pointers are ignored
    engine.pointerUp(1);
    engine.pointerUp(2);
    frames(engine, 10);
    expect(machine.down.size).toBe(0);
  });

  it('pointercancel on a held modifier releases it without going sticky', () => {
    const { machine, engine } = setup();
    engine.pointerDown('Shift', 1);
    frames(engine, 5);
    engine.cancel(1);
    expect(engine.getModifierState('shift')).toBe('off');
    expect(machine.down.has('Shift')).toBe(false);
  });
});

/**
 * A layout that asks for a hold ceiling, and has a function key to prove the
 * exemption with. Five frames rather than a machine's real number: the value is
 * the layout's to choose, and the engine only ever compares it with its own
 * frame count.
 */
const ceilingLayout: KeyboardLayout = {
  ...layout,
  functionKeys: [
    { id: 'K0', spanX: 1, emits: ['K0'], labels: [{ text: 'K0' }] },
  ],
  options: { minHoldFrames: 3, maxHoldFrames: 5 },
};

describe('KeyboardInputEngine (hold ceiling)', () => {
  function ceilingSetup() {
    const machine = new FakeMachine();
    const engine = new KeyboardInputEngine(ceilingLayout, {
      kind: 'machine',
      getMachine: () => machine as unknown as MachineEmulator,
    });
    return { machine, engine };
  }

  it('ends a press that outstays the ceiling, and never presses it again', () => {
    const { machine, engine } = ceilingSetup();
    engine.pointerDown('KeyH', 1);
    frames(engine, 4);
    expect(machine.down.has('KeyH')).toBe(true);
    frames(engine, 1); // 5th frame - the ceiling
    expect(machine.down.has('KeyH')).toBe(false);
    // The finger is still on the key: nothing may press it again, and the key
    // stops drawing as pressed so the user can see the press is spent.
    expect(engine.getPressedKeyIds().has('KeyH')).toBe(false);
    frames(engine, 50);
    engine.pointerUp(1); // the eventual lift has nothing left to do
    frames(engine, 10);
    expect(machine.log.filter(([, down]) => down)).toEqual([['KeyH', true]]);
    expect(machine.down.size).toBe(0);
  });

  it('does not press the key again when the pointer moves over it', () => {
    // The keyboard hit-tests every pointer move, so a finger that stays put but
    // trembles reports the same key over and over. Once the press is spent that
    // has to stay spent, or the ceiling would just move the burst one move
    // later.
    const { machine, engine } = ceilingSetup();
    engine.pointerDown('KeyH', 1);
    frames(engine, 5);
    expect(machine.down.has('KeyH')).toBe(false);
    for (let move = 0; move < 5; move++) {
      engine.pointerEnter('KeyH', 1);
      frames(engine, 3);
    }
    expect(machine.log.filter(([, down]) => down)).toEqual([['KeyH', true]]);
    // Sliding onto a different key is still a press of that key.
    engine.pointerEnter('KeyP', 1);
    expect(machine.down.has('KeyP')).toBe(true);
    frames(engine, 5);
    engine.pointerUp(1);
    expect(machine.down.size).toBe(0);
  });

  it('leaves a press that lifts inside the ceiling alone', () => {
    const { machine, engine } = ceilingSetup();
    engine.pointerDown('KeyH', 1);
    frames(engine, 3);
    engine.pointerUp(1);
    expect(machine.down.has('KeyH')).toBe(false);
    expect(machine.log).toEqual([
      ['KeyH', true],
      ['KeyH', false],
    ]);
  });

  it('holds a function key for as long as the pointer is on it', () => {
    const { machine, engine } = ceilingSetup();
    engine.pointerDown('K0', 1);
    frames(engine, 60);
    expect(machine.down.has('K0')).toBe(true); // held state a program reads
    engine.pointerUp(1);
    expect(machine.down.has('K0')).toBe(false);
  });

  it('keeps a held modifier down when the key it modifies expires', () => {
    const { machine, engine } = ceilingSetup();
    engine.pointerDown('Shift', 1);
    engine.pointerDown('KeyP', 2);
    frames(engine, 10);
    expect(machine.down.has('KeyP')).toBe(false); // expired
    expect(machine.down.has('Shift')).toBe(true); // finger 1 still on it
    engine.pointerUp(1);
    frames(engine, 5);
    expect(machine.down.has('Shift')).toBe(false);
  });

  it('releases a sticky modifier the expired press consumed', () => {
    const { machine, engine } = ceilingSetup();
    engine.pointerDown('Shift', 1);
    engine.pointerUp(1); // tap → sticky
    engine.pointerDown('KeyP', 2);
    expect(machine.down.has('Shift')).toBe(true);
    frames(engine, 5);
    expect(machine.down.has('KeyP')).toBe(false);
    expect(machine.down.has('Shift')).toBe(false);
    expect(engine.getModifierState('shift')).toBe('off');
  });

  it('holds indefinitely where the layout asks for no ceiling', () => {
    const { machine, engine } = setup();
    engine.pointerDown('KeyH', 1);
    frames(engine, 200);
    expect(machine.down.has('KeyH')).toBe(true);
    engine.pointerUp(1);
    expect(machine.down.has('KeyH')).toBe(false);
  });
});

describe('KeyboardInputEngine (editor target)', () => {
  function editorSetup() {
    const presses: { keyId: string; layerId: string }[] = [];
    const engine = new KeyboardInputEngine(layout, {
      kind: 'editor',
      onKeyPress: (key, activeLayer) =>
        presses.push({ keyId: key.id, layerId: activeLayer.id }),
    });
    return { presses, engine };
  }

  it('fires the callback on key-down with the current layer', () => {
    const { presses, engine } = editorSetup();
    engine.pointerDown('KeyP', 1);
    expect(presses).toEqual([{ keyId: 'KeyP', layerId: 'main' }]);
    engine.pointerUp(1);
    expect(presses).toHaveLength(1); // down only, never on release
  });

  it('sticky shift applies to the next press and clears without frames', () => {
    const { presses, engine } = editorSetup();
    engine.pointerDown('Shift', 1);
    engine.pointerUp(1);
    expect(engine.getModifierState('shift')).toBe('sticky');
    expect(presses).toHaveLength(0); // modifiers never reach the callback
    engine.pointerDown('KeyP', 2);
    expect(presses).toEqual([{ keyId: 'KeyP', layerId: 'shift' }]);
    engine.pointerUp(2);
    // No onFrame() ever ran - releases must not depend on emulator frames.
    expect(engine.getModifierState('shift')).toBe('off');
    expect(engine.getActiveLayer().id).toBe('main');
  });

  it('locked shift persists across presses without frames', () => {
    const { presses, engine } = editorSetup();
    engine.pointerDown('Shift', 1);
    engine.pointerUp(1);
    engine.pointerDown('Shift', 1);
    engine.pointerUp(1);
    expect(engine.getModifierState('shift')).toBe('locked');
    engine.pointerDown('KeyP', 2);
    engine.pointerUp(2);
    engine.pointerDown('KeyH', 2);
    engine.pointerUp(2);
    expect(presses.map((p) => p.layerId)).toEqual(['shift', 'shift']);
    expect(engine.getModifierState('shift')).toBe('locked');
  });

  it('sliding onto a key fires the callback for it', () => {
    const { presses, engine } = editorSetup();
    engine.pointerDown('KeyP', 1);
    engine.pointerEnter('KeyH', 1);
    expect(presses.map((p) => p.keyId)).toEqual(['KeyP', 'KeyH']);
  });
});
