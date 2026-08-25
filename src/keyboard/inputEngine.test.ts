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
    // Pinned by a mode rather than a modifier, like a real CURSOR mode.
    { id: 'cursor', position: 'br', activeWhen: [] },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows: [
    [
      {
        id: 'Shift',
        spanX: 1,
        emits: ['Shift'],
        modifier: 'shift',
        labels: [{ text: 'SHIFT' }, null, null],
      },
      {
        id: 'KeyP',
        spanX: 1,
        emits: ['KeyP'],
        // A cursor legend whose tokens are a chord sharing SHIFT with the
        // modifier - the Sinclair machines' arrangement.
        labels: [
          { text: 'P' },
          { text: '"' },
          { text: '←', editor: { action: 'left' }, emits: ['Shift', 'KeyP'] },
        ],
      },
      {
        id: 'KeyH',
        spanX: 1,
        emits: ['KeyH'],
        labels: [
          { text: 'H' },
          { text: '**' },
          { text: '↑', editor: { action: 'up' }, emits: ['ArrowUp'] },
        ],
      },
      {
        id: 'x-quote',
        spanX: 1,
        emits: ['Shift', 'KeyP'],
        labels: [{ text: '"' }, null, null],
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
  it("presses the pinned layer's own tokens instead of the key's", () => {
    const { machine, engine } = setup();
    engine.setPinnedLayer('cursor');
    engine.pointerDown('KeyH', 1);
    // The cursor legend's key, not the letter underneath it.
    expect(machine.down.has('ArrowUp')).toBe(true);
    expect(machine.down.has('KeyH')).toBe(false);
    frames(engine, 5);
    engine.pointerUp(1);
    expect(machine.down.size).toBe(0);
  });

  it('leaves a key alone on a layer whose legend names no tokens', () => {
    const { machine, engine } = setup();
    engine.setPinnedLayer('cursor');
    // 'x-quote' has no cursor legend, so it keeps its own tokens.
    engine.pointerDown('x-quote', 1);
    expect(machine.down.has('Shift')).toBe(true);
    expect(machine.down.has('KeyP')).toBe(true);
  });

  it("releases the tokens it actually pressed, not the key's own", () => {
    const { machine, engine } = setup();
    engine.setPinnedLayer('cursor');
    engine.pointerDown('KeyH', 1);
    frames(engine, 5);
    // The mode changes while the key is still held - the release must still
    // free ArrowUp rather than the letter the key would emit now.
    engine.setPinnedLayer(null);
    engine.pointerUp(1);
    expect(machine.down.has('ArrowUp')).toBe(false);
    expect(machine.down.has('KeyH')).toBe(false);
  });

  it('refcounts a cursor chord that shares a token with a held modifier', () => {
    const { machine, engine } = setup();
    engine.setPinnedLayer('cursor');
    engine.pointerDown('Shift', 1); // held, not tapped
    expect(machine.down.has('Shift')).toBe(true);
    engine.pointerDown('KeyP', 2); // chord is Shift + KeyP
    frames(engine, 5);
    engine.pointerUp(2);
    // SHIFT is still physically held, so the chord's release must not drop it.
    expect(machine.down.has('Shift')).toBe(true);
    expect(machine.down.has('KeyP')).toBe(false);
    engine.pointerUp(1);
    expect(machine.down.has('Shift')).toBe(false);
  });

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

  it('cancelAll leaves the machine alone when it was holding nothing', () => {
    // The keyboard overlay is built and torn down whenever focus moves between
    // the editor and the emulator, which on the tab layout is exactly when a
    // run starts. `releaseAllKeys` resets every key state the machine has, so
    // an overlay that never pressed a key must not send one on its way out.
    const { machine, engine } = setup();
    engine.cancelAll();
    expect(machine.releaseAllCalls).toBe(0);
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

describe('KeyboardInputEngine case lock', () => {
  /** The test layout plus a case-lock key and a power-on case. */
  const cased: KeyboardLayout = {
    ...layout,
    powerOnCase: 'upper',
    rows: [
      [
        ...layout.rows[0]!,
        {
          id: 'CapsLock',
          spanX: 1,
          emits: ['CapsLock'],
          caseLock: true,
          labels: [{ text: 'CAPS', editor: null }, null, null],
        },
      ],
    ],
  };

  function casedSetup() {
    const cases: string[] = [];
    const engine = new KeyboardInputEngine(cased, {
      kind: 'editor',
      onKeyPress: (_key, _layer, letterCase) => cases.push(letterCase),
    });
    return { cases, engine };
  }

  it('starts in the layout’s power-on case', () => {
    const { engine } = casedSetup();
    expect(engine.getLetterCase()).toBe('upper');
  });

  it('flips on a press and stays flipped after the release', () => {
    // A tap, not a hold: the lock lives in the machine, so releasing the key
    // must not undo it - which is exactly what a modifier would have done.
    const { engine } = casedSetup();
    engine.pointerDown('CapsLock', 1);
    engine.pointerUp(1);
    expect(engine.getLetterCase()).toBe('lower');
    engine.pointerDown('KeyP', 2);
    engine.pointerUp(2);
    expect(engine.getLetterCase()).toBe('lower');
    engine.pointerDown('CapsLock', 3);
    engine.pointerUp(3);
    expect(engine.getLetterCase()).toBe('upper');
  });

  it('hands the case in force to the editor callback', () => {
    const { cases, engine } = casedSetup();
    engine.pointerDown('KeyP', 1);
    engine.pointerUp(1);
    engine.pointerDown('CapsLock', 2);
    engine.pointerUp(2);
    engine.pointerDown('KeyP', 3);
    engine.pointerUp(3);
    // Three presses, and the lock's own is the middle one: it is an ordinary
    // key to the callback (its legend simply types nothing), and it reports
    // the case it has just switched to rather than the one it left.
    expect(cases).toEqual(['upper', 'lower', 'lower']);
  });

  it('still presses the machine’s own key', () => {
    const machine = new FakeMachine();
    const engine = new KeyboardInputEngine(cased, {
      kind: 'machine',
      getMachine: () => machine as unknown as MachineEmulator,
    });
    engine.pointerDown('CapsLock', 1);
    expect(machine.down.has('CapsLock')).toBe(true);
    frames(engine, 5);
    engine.pointerUp(1);
    expect(engine.getLetterCase()).toBe('lower');
  });

  it('reports upper case on a layout that declares no power-on case', () => {
    // A machine with no lower case has one case to be in, and this is it.
    const engine = new KeyboardInputEngine(layout, {
      kind: 'editor',
      onKeyPress: () => {},
    });
    expect(engine.getLetterCase()).toBe('upper');
  });
});
