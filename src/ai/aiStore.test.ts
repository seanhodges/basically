import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamOptions } from './providers/types';

// Install a localStorage stub and a shared streaming handle BEFORE the modules
// under test are imported (aiStore reads localStorage at module init).
const h = vi.hoisted(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  return {
    current: null as null | {
      onText: (d: string) => void;
      resolve: (t: string) => void;
      reject: (e: unknown) => void;
    },
  };
});

vi.mock('./aiClient', () => ({
  streamChat: (
    _providerId: string,
    _opts: StreamOptions,
    onText: (d: string) => void,
  ) => {
    let resolve!: (t: string) => void;
    let reject!: (e: unknown) => void;
    const done = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    h.current = { onText, resolve, reject };
    return {
      done,
      abort: () => {
        const err = new Error('Generation stopped.');
        err.name = 'AbortError';
        reject(err);
      },
    };
  },
  describeAiError: (_providerId: string, e: unknown) =>
    e instanceof Error ? e.message : String(e),
}));

import { useAiStore } from './aiStore';
import { useIdeStore } from '../app/store';
import { loadAiConversation } from '../storage/settings';

const params = {
  providerId: 'anthropic' as const,
  apiKey: 'key',
  model: 'test-model',
  maxTokens: 1024,
  system: 'sys',
  userContent: 'full context',
  displayRequest: 'make breakout',
};

const plain = (m: { role: string; content: string }) => ({
  role: m.role,
  content: m.content,
});

describe('aiStore', () => {
  beforeEach(() => {
    useAiStore.getState().reset();
    localStorage.clear();
    h.current = null;
  });

  it('send appends the turn, finalizes, and persists', async () => {
    const p = useAiStore.getState().send(params);
    expect(useAiStore.getState().busy).toBe(true);
    h.current!.onText('10 ');
    h.current!.onText('PRINT');
    h.current!.resolve('10 PRINT');
    await p;

    expect(useAiStore.getState().messages.map(plain)).toEqual([
      { role: 'user', content: 'make breakout' },
      { role: 'assistant', content: '10 PRINT' },
    ]);
    expect(useAiStore.getState().busy).toBe(false);
    expect(loadAiConversation()).toEqual([
      { role: 'user', content: 'make breakout' },
      { role: 'assistant', content: '10 PRINT' },
    ]);
  });

  it('retries once with a format nudge when the first reply is empty', async () => {
    const p = useAiStore.getState().send(params);
    // First attempt resolves empty -> the store re-requests.
    const first = h.current!;
    first.resolve('');
    await Promise.resolve(); // let send() react and start the retry
    await Promise.resolve();

    // A fresh streaming handle means the retry actually fired.
    expect(h.current).not.toBe(first);
    // The placeholder is marked as retrying while the reformat is in flight.
    const streaming = useAiStore.getState().messages.at(-1)!;
    expect(streaming.retrying).toBe(true);

    h.current!.onText('10 PRINT');
    h.current!.resolve('10 PRINT');
    await p;

    expect(useAiStore.getState().messages.map(plain)).toEqual([
      { role: 'user', content: 'make breakout' },
      { role: 'assistant', content: '10 PRINT' },
    ]);
    expect(useAiStore.getState().error).toBe('');
    expect(useAiStore.getState().busy).toBe(false);
  });

  it('surfaces an error when both attempts return empty', async () => {
    const p = useAiStore.getState().send(params);
    h.current!.resolve('');
    await Promise.resolve();
    await Promise.resolve();
    h.current!.resolve('   '); // whitespace-only is still "empty"
    await p;

    // No empty assistant bubble is left behind; only the user turn remains.
    expect(useAiStore.getState().messages.map(plain)).toEqual([
      { role: 'user', content: 'make breakout' },
    ]);
    expect(useAiStore.getState().error).toContain('empty response');
    expect(useAiStore.getState().busy).toBe(false);
  });

  it('does not retry a non-empty reply', async () => {
    const p = useAiStore.getState().send(params);
    const first = h.current!;
    first.resolve('10 PRINT');
    await p;

    // No second attempt was started.
    expect(h.current).toBe(first);
    expect(useAiStore.getState().messages.map(plain)).toEqual([
      { role: 'user', content: 'make breakout' },
      { role: 'assistant', content: '10 PRINT' },
    ]);
  });

  it('reset clears the thread and ignores a late completion', async () => {
    const p = useAiStore.getState().send(params);
    h.current!.onText('partial');
    useAiStore.getState().reset();
    expect(useAiStore.getState().messages).toEqual([]);

    // A completion arriving after reset (or its abort) must not resurrect it.
    h.current!.resolve('full answer');
    await p;
    expect(useAiStore.getState().messages).toEqual([]);
    expect(loadAiConversation()).toEqual([]);
  });

  it('keeps a partial answer (e.g. after Stop) marked incomplete', async () => {
    const p = useAiStore.getState().send(params);
    h.current!.onText('half a program');
    useAiStore.getState().stop(); // aborts -> rejects done
    await p;

    const msgs = useAiStore.getState().messages;
    expect(msgs.map(plain)).toEqual([
      { role: 'user', content: 'make breakout' },
      { role: 'assistant', content: 'half a program' },
    ]);
    expect(msgs[1]!.incomplete).toBe(true);
    expect(useAiStore.getState().busy).toBe(false);
  });

  it('clears when the IDE store signals a new program (aiResetSeq)', async () => {
    const p = useAiStore.getState().send(params);
    h.current!.resolve('done');
    await p;
    expect(useAiStore.getState().messages.length).toBe(2);

    useIdeStore.setState((s) => ({ aiResetSeq: s.aiResetSeq + 1 }));
    expect(useAiStore.getState().messages).toEqual([]);
    expect(loadAiConversation()).toEqual([]);
  });
});
