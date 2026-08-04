import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// aiStore reads its (empty) stored thread at import, so storage has to exist
// before it loads. A `window` deliberately does not: declaring one in a node
// test makes the machine cores decide they are in a browser, so the guard takes
// its target as a parameter and the test hands it a plain object.
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

import { installUnloadGuard } from './unloadGuard';
import { useAiStore, type DisplayMessage } from './aiStore';

const listeners = new Map<string, Set<EventListener>>();

/** Stands in for the window, recording only what the guard puts on it. */
const target = {
  addEventListener: (type: string, fn: EventListener) => {
    const set = listeners.get(type) ?? new Set();
    set.add(fn);
    listeners.set(type, set);
  },
  removeEventListener: (type: string, fn: EventListener) => {
    listeners.get(type)?.delete(fn);
  },
} as unknown as Window;

/** The beforeunload listeners currently installed. */
const guards = (): EventListener[] => [
  ...(listeners.get('beforeunload') ?? []),
];

const arriving: DisplayMessage[] = [
  { role: 'user', content: 'make breakout' },
  { role: 'assistant', content: '10 PR', streaming: true },
];

const arrived: DisplayMessage[] = [
  { role: 'user', content: 'make breakout' },
  { role: 'assistant', content: '10 PRINT' },
];

describe('unloadGuard', () => {
  let uninstall: () => void;

  beforeEach(() => {
    useAiStore.getState().reset();
    listeners.clear();
    uninstall = installUnloadGuard(target);
  });

  afterEach(() => uninstall());

  it('leaves an idle thread unguarded', () => {
    expect(guards()).toHaveLength(0);
    useAiStore.setState({ messages: arrived });
    expect(guards()).toHaveLength(0);
  });

  it('guards the page while an answer is arriving', () => {
    useAiStore.setState({ messages: arriving });
    expect(guards()).toHaveLength(1);
  });

  it('asks the browser to confirm the departure', () => {
    useAiStore.setState({ messages: arriving });
    const event = {
      preventDefault: vi.fn(),
      returnValue: undefined,
    } as unknown as BeforeUnloadEvent;
    guards()[0]!(event);

    // Both triggers: browsers disagree on which one raises the prompt.
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe('');
  });

  it('stands down once the answer has arrived', () => {
    useAiStore.setState({ messages: arriving });
    useAiStore.setState({ messages: arrived });
    expect(guards()).toHaveLength(0);
  });

  it('stands down when the thread is cleared', () => {
    useAiStore.setState({ messages: arriving });
    useAiStore.getState().reset(); // what /clear does
    expect(guards()).toHaveLength(0);
  });

  it('does not stack a second guard as the answer grows', () => {
    useAiStore.setState({ messages: arriving });
    useAiStore.setState({
      messages: [
        arriving[0]!,
        { role: 'assistant', content: '10 PRINT "H', streaming: true },
      ],
    });
    expect(guards()).toHaveLength(1);
  });

  it('takes the guard with it when uninstalled mid-answer', () => {
    useAiStore.setState({ messages: arriving });
    uninstall();
    expect(guards()).toHaveLength(0);

    // And stops listening: a later answer must not re-arm a guard nobody owns.
    useAiStore.setState({ messages: arriving });
    expect(guards()).toHaveLength(0);
    uninstall = () => {};
  });
});
