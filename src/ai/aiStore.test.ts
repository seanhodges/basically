import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  StopReason,
  StreamOptions,
  StreamResult,
} from './providers/types';

// Install storage stubs and a shared streaming handle BEFORE the modules under
// test are imported (aiStore reads the stored conversation at module init).
const h = vi.hoisted(() => {
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
  return {
    current: null as null | {
      onText: (d: string) => void;
      /** Finish the attempt; `stop` defaults to a normal completion. */
      resolve: (t: string, stop?: StopReason) => void;
      reject: (e: unknown) => void;
    },
    /** The history handed to the most recent attempt. */
    sent: null as null | StreamOptions,
  };
});

vi.mock('./aiClient', () => ({
  streamChat: (
    _providerId: string,
    opts: StreamOptions,
    onText: (d: string) => void,
  ) => {
    h.sent = opts;
    let resolve!: (t: string, stop?: StopReason) => void;
    let reject!: (e: unknown) => void;
    const done = new Promise<StreamResult>((res, rej) => {
      resolve = (text, stop = 'complete') => res({ text, stop });
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
import { loadMachineReference } from './machineReference';
import { useIdeStore, type AiRunOutcome } from '../app/store';
import {
  loadAiConversation,
  getAiProvider,
  setProviderApiKey,
} from '../storage/settings';
import { sourceFingerprint } from './sourceFingerprint';
import type { MachineReport } from '../dialects/types';
import type { ExpectationResult } from './expectations';
import type { ScreenCapture } from '../app/screenCapture';
import { getProvider } from './providers/registry';

const BASE_SOURCE = '10 CLS\n20 GOTO 10\n';

const params = {
  providerId: 'anthropic' as const,
  apiKey: 'key',
  model: 'test-model',
  maxTokens: 1024,
  system: 'sys',
  userContent: 'full context',
  displayRequest: 'make breakout',
  baseSource: BASE_SOURCE,
};

const plain = (m: { role: string; content: string }) => ({
  role: m.role,
  content: m.content,
});

/** The content of the last user turn actually sent to the provider. */
const sentUserContent = (): string => {
  const msgs = h.sent?.messages ?? [];
  return [...msgs].reverse().find((m) => m.role === 'user')?.content ?? '';
};

describe('aiStore', () => {
  beforeEach(() => {
    useAiStore.getState().reset();
    localStorage.clear();
    sessionStorage.clear();
    h.current = null;
    h.sent = null;
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
      {
        role: 'assistant',
        content: '10 PRINT',
        baseFingerprint: sourceFingerprint(BASE_SOURCE),
      },
    ]);
  });

  describe('base fingerprint', () => {
    it('records the program the answer was written against', async () => {
      const p = useAiStore.getState().send(params);
      h.current!.resolve('10 PRINT');
      await p;

      const answer = useAiStore.getState().messages.at(-1)!;
      expect(answer.baseFingerprint).toBe(sourceFingerprint(BASE_SOURCE));
      // The point of recording it: an edited program no longer matches.
      expect(answer.baseFingerprint).not.toBe(
        sourceFingerprint(BASE_SOURCE + '30 STOP\n'),
      );
    });

    it('survives a persist and reload', async () => {
      const p = useAiStore.getState().send(params);
      h.current!.resolve('10 PRINT');
      await p;

      const restored = loadAiConversation().at(-1)!;
      expect(restored.baseFingerprint).toBe(sourceFingerprint(BASE_SOURCE));
    });

    it('is recorded even when the answer was cut short', async () => {
      const p = useAiStore.getState().send(params);
      h.current!.resolve('10 PRINT', 'truncated');
      await p;
      expect(useAiStore.getState().messages.at(-1)!.baseFingerprint).toBe(
        sourceFingerprint(BASE_SOURCE),
      );
    });

    it('leaves a thread stored without one alone', () => {
      // Threads written before the fingerprint existed have no base; that is a
      // defined state (unknown), not a missing field to repair.
      sessionStorage.setItem(
        'mbide.autosave.ai',
        JSON.stringify([{ role: 'assistant', content: '10 PRINT' }]),
      );
      expect(loadAiConversation()[0]!.baseFingerprint).toBeUndefined();
    });
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

  describe('why generation stopped', () => {
    it('marks an answer cut off by the output limit as incomplete', async () => {
      const p = useAiStore.getState().send(params);
      h.current!.resolve('10 CLS\n20 PRINT "HAL', 'truncated');
      await p;

      const answer = useAiStore.getState().messages.at(-1)!;
      expect(answer.content).toContain('HAL');
      // The program stops mid-line; it must not read as a finished answer.
      expect(answer.incomplete).toBe(true);
      expect(useAiStore.getState().error).toBe('');
    });

    it('leaves a normally finished answer applicable', async () => {
      const p = useAiStore.getState().send(params);
      h.current!.resolve('10 CLS');
      await p;
      expect(useAiStore.getState().messages.at(-1)!.incomplete).toBeUndefined();
    });

    it('reports a decline instead of retrying it as an empty reply', async () => {
      const first = h;
      const p = useAiStore.getState().send(params);
      first.current!.resolve('', 'refused');
      await p;

      expect(useAiStore.getState().error).toContain('declined');
      expect(useAiStore.getState().busy).toBe(false);
      // No blank bubble left behind, and no second request was made: the
      // retry path would have installed a fresh handle to resolve.
      expect(useAiStore.getState().messages.map(plain)).toEqual([
        { role: 'user', content: 'make breakout' },
      ]);
    });
  });

  describe('correcting a failed run without being asked', () => {
    const FAILED: MachineReport = {
      isError: true,
      message: 'Undefined variable',
      code: '2',
      line: 10,
    };

    /**
     * Publish a run outcome the way EmulatorPane does. `ranSource` defaults to
     * the live source, i.e. a program the user hasn't touched since it ran.
     */
    async function reportRun(
      outcome: AiRunOutcome,
      ranSource?: string,
      expectations: ExpectationResult[] = [],
      screen?: ScreenCapture,
    ): Promise<void> {
      // Each run is its own request, exactly as an apply-and-run makes it; the
      // outcome is tagged with that sequence so a stale one can be ignored.
      useIdeStore.getState().requestAiRun();
      const state = useIdeStore.getState();
      state.reportRun(outcome, ranSource ?? state.source, expectations, screen);
      // The correction's system prompt carries the machine's reference, which is
      // loaded on demand - so the request leaves a few microtasks after the
      // outcome is published rather than inside the same call. Settling here
      // keeps every assertion below about what the store did, not about when.
      // (`beforeEach` warms the reference cache, so this is only microtasks.)
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }

    /** An expectation result as the run check would report one. */
    function expectation(
      status: ExpectationResult['status'],
      name = 'T',
      actual?: string,
    ): ExpectationResult {
      return {
        expectation: {
          kind: 'var',
          name,
          expected: '42',
          source: `VAR ${name} = 42`,
        },
        status,
        ...(actual !== undefined ? { actual } : {}),
      };
    }

    /** The user turn of the most recent exchange, whoever raised it. */
    const lastRequest = () =>
      [...useAiStore.getState().messages]
        .reverse()
        .find((m) => m.role === 'user')?.content ?? '';

    beforeEach(async () => {
      setProviderApiKey(getAiProvider(), 'key');
      useIdeStore.setState({ source: BASE_SOURCE, runOutcome: null });
      // Warm the on-demand reference for the active machine, so the automatic
      // correction below is waiting on nothing but microtasks.
      await loadMachineReference(useIdeStore.getState().dialect);
    });

    it('sends a correction unasked when a run fails', async () => {
      await reportRun({ kind: 'errored', report: FAILED });

      // A request went out on its own: a stream handle exists and the panel is
      // busy, with no user action in between.
      expect(useAiStore.getState().busy).toBe(true);
      expect(h.current).not.toBeNull();
      expect(lastRequest()).toContain('runtime error');
      // Shown as a correction, not as an ordinary reply.
      expect(useAiStore.getState().messages.at(-1)!.autoFix).toBe(true);
      // Offered fixes are for the user to accept; this one wasn't offered.
      expect(useAiStore.getState().pendingFix).toBeNull();

      h.current!.resolve('10 LET A=1');
      await Promise.resolve();
    });

    it('stops after the bound and offers the fix instead', async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        await reportRun({ kind: 'errored', report: FAILED });
        expect(useAiStore.getState().busy).toBe(true);
        h.current!.resolve('10 LET A=1');
        await Promise.resolve();
        await Promise.resolve();
      }
      h.current = null;

      // Third failure: no further request, just the offer the user can accept.
      reportRun({ kind: 'errored', report: FAILED });
      expect(h.current).toBeNull();
      expect(useAiStore.getState().pendingFix?.summary).toContain(
        'Runtime error',
      );
    });

    it('releases the bound when the user makes a new request', async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        await reportRun({ kind: 'errored', report: FAILED });
        h.current!.resolve('10 LET A=1');
        await Promise.resolve();
        await Promise.resolve();
      }

      const p = useAiStore.getState().send(params);
      h.current!.resolve('10 PRINT');
      await p;

      h.current = null;
      await reportRun({ kind: 'errored', report: FAILED });
      expect(h.current).not.toBeNull(); // corrections are available again
      expect(useAiStore.getState().pendingFix).toBeNull();
    });

    it('only offers the fix when the program has changed since the run', async () => {
      await reportRun(
        { kind: 'errored', report: FAILED },
        '10 SOMETHING ELSE\n',
      );

      expect(h.current).toBeNull();
      expect(useAiStore.getState().busy).toBe(false);
      expect(useAiStore.getState().pendingFix?.summary).toContain(
        'Runtime error',
      );
    });

    it('corrects nothing when the run did not fail', async () => {
      for (const kind of [
        'ended-ok',
        'still-running',
        'never-started',
      ] as const) {
        await reportRun({ kind });
        expect(h.current).toBeNull();
        expect(useAiStore.getState().busy).toBe(false);
        expect(useAiStore.getState().pendingFix).toBeNull();
      }
    });

    it('tells the assistant about a run that did not fail on the next request', async () => {
      await reportRun({ kind: 'ended-ok' });
      const p = useAiStore.getState().send(params);
      h.current!.resolve('10 PRINT');
      await p;

      // The note rides in the request, not as a turn of its own, so the thread
      // still reads as one request and one answer.
      expect(useAiStore.getState().messages.map(plain)).toEqual([
        { role: 'user', content: 'make breakout' },
        { role: 'assistant', content: '10 PRINT' },
      ]);
      expect(sentUserContent()).toContain(
        'finished without reporting an error',
      );
      expect(sentUserContent()).toContain('full context');
    });

    it('spends the note once', async () => {
      await reportRun({ kind: 'ended-ok' });
      const first = useAiStore.getState().send(params);
      h.current!.resolve('10 PRINT');
      await first;
      expect(sentUserContent()).toContain('finished without reporting');

      const second = useAiStore.getState().send(params);
      h.current!.resolve('20 PRINT');
      await second;
      expect(sentUserContent()).not.toContain('finished without reporting');
    });

    it('leaves no further attempt queued when the user stops a correction', async () => {
      await reportRun({ kind: 'errored', report: FAILED });
      expect(useAiStore.getState().busy).toBe(true);

      useAiStore.getState().stop();
      await Promise.resolve();
      await Promise.resolve();
      expect(useAiStore.getState().busy).toBe(false);

      // Stopping ends it there: nothing re-requests without a new run.
      h.current = null;
      await Promise.resolve();
      expect(h.current).toBeNull();
    });

    describe('a program that ran but produced the wrong answer', () => {
      it('corrects it unasked, exactly as a runtime error is corrected', async () => {
        await reportRun({ kind: 'ended-ok' }, undefined, [
          expectation('failed', 'T', '41'),
        ]);

        expect(useAiStore.getState().busy).toBe(true);
        expect(h.current).not.toBeNull();
        expect(useAiStore.getState().messages.at(-1)!.autoFix).toBe(true);
        expect(useAiStore.getState().pendingFix).toBeNull();
        // The thread shows what it is correcting, and the message actually sent
        // says what was expected and what the machine reported instead.
        expect(lastRequest()).toContain('wrong result');
        expect(sentUserContent()).toContain('did not produce what you said');
        expect(sentUserContent()).toContain(
          'you said T would be 42, but the machine reported 41',
        );
      });

      it('shares one budget with runtime errors rather than doubling it', async () => {
        // Two runtime errors spend both automatic attempts...
        for (let attempt = 0; attempt < 2; attempt++) {
          await reportRun({ kind: 'errored', report: FAILED });
          h.current!.resolve('10 LET A=1');
          await Promise.resolve();
          await Promise.resolve();
        }
        h.current = null;

        // ...so a wrong answer on the same applied block gets the banner, not a
        // third request. A per-kind allowance would let one block spend four.
        reportRun({ kind: 'ended-ok' }, undefined, [
          expectation('failed', 'T', '41'),
        ]);
        expect(h.current).toBeNull();
        expect(useAiStore.getState().pendingFix?.summary).toContain(
          'Wrong result',
        );
      });

      it('only offers the fix when the program has changed since the run', async () => {
        await reportRun({ kind: 'ended-ok' }, '10 SOMETHING ELSE\n', [
          expectation('failed', 'T', '41'),
        ]);

        expect(h.current).toBeNull();
        expect(useAiStore.getState().busy).toBe(false);
        expect(useAiStore.getState().pendingFix?.summary).toContain(
          'Wrong result',
        );
      });

      it('corrects nothing when every expectation held', async () => {
        await reportRun({ kind: 'ended-ok' }, undefined, [
          expectation('passed'),
        ]);
        expect(h.current).toBeNull();
        expect(useAiStore.getState().busy).toBe(false);
        expect(useAiStore.getState().pendingFix).toBeNull();
      });

      it('corrects nothing when an expectation could not be checked', () => {
        // Unchecked is not failed: a program nobody could judge must not be
        // sent back for a fix it may not need.
        reportRun({ kind: 'still-running' }, undefined, [
          expectation('unchecked'),
        ]);
        expect(h.current).toBeNull();
        expect(useAiStore.getState().pendingFix).toBeNull();
      });

      it('tells the assistant on the next request that its expectations held', async () => {
        await reportRun({ kind: 'ended-ok' }, undefined, [
          expectation('passed'),
        ]);
        const p = useAiStore.getState().send(params);
        h.current!.resolve('10 PRINT');
        await p;
        expect(sentUserContent()).toContain(
          'Everything you said should be true of it held',
        );
      });

      it('reports an unchecked expectation rather than passing it silently', async () => {
        await reportRun({ kind: 'still-running' }, undefined, [
          {
            ...expectation('unchecked'),
            reason: 'the screen could not be read',
          },
        ]);
        const p = useAiStore.getState().send(params);
        h.current!.resolve('10 PRINT');
        await p;
        expect(sentUserContent()).toContain('I could not check');
        expect(sentUserContent()).toContain('the screen could not be read');
      });
    });

    describe('showing the assistant the screen', () => {
      const SCREEN: ScreenCapture = {
        mediaType: 'image/png',
        base64: 'PNGDATA',
        width: 512,
        height: 384,
      };

      /** The image on the last turn actually sent to the provider. */
      const sentImage = () => {
        const msgs = h.sent?.messages ?? [];
        return [...msgs].reverse().find((m) => m.role === 'user')?.image;
      };

      /** Let the judging request's follow-up settle. */
      const settle = async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      };

      /** A visual expectation, as the run check reports one: never yet judged. */
      const visual = (
        description = 'a circle in the middle',
      ): ExpectationResult => ({
        expectation: {
          kind: 'visual',
          description,
          source: `SCREEN SHOWS ${description}`,
        },
        status: 'unchecked',
        reason: 'the screen has not been looked at',
      });

      /** Run `body` with the active provider unable to be shown an image. */
      const withTextOnlyProvider = async (body: () => Promise<void>) => {
        const provider = getProvider(getAiProvider());
        provider.acceptsImages = false;
        try {
          await body();
        } finally {
          provider.acceptsImages = true;
        }
      };

      it('shows the screen with the correction for a failed run', async () => {
        await reportRun(
          { kind: 'errored', report: FAILED },
          undefined,
          [],
          SCREEN,
        );

        expect(sentImage()?.base64).toBe('PNGDATA');
        // Announced, so the picture reads as evidence rather than decoration.
        expect(sentUserContent()).toContain('attached');
      });

      it('shows nothing for a run that did not fail', async () => {
        await reportRun(
          { kind: 'ended-ok' },
          undefined,
          [expectation('passed')],
          SCREEN,
        );
        expect(h.current).toBeNull();

        const p = useAiStore.getState().send(params);
        h.current!.resolve('10 PRINT');
        await p;
        expect(sentImage()).toBeUndefined();
      });

      it('corrects a failure in words alone on a provider that cannot be shown one', async () => {
        await withTextOnlyProvider(async () => {
          await reportRun(
            { kind: 'errored', report: FAILED },
            undefined,
            [],
            SCREEN,
          );
          // The correction still happens - it just has no picture with it.
          expect(h.current).not.toBeNull();
          expect(sentImage()).toBeUndefined();
          expect(sentUserContent()).not.toContain('attached');
        });
      });

      it('asks the assistant to judge what only a look can settle', async () => {
        await reportRun({ kind: 'ended-ok' }, undefined, [visual()], SCREEN);

        expect(h.current).not.toBeNull();
        expect(sentImage()?.base64).toBe('PNGDATA');
        expect(sentUserContent()).toContain('a circle in the middle');
        expect(sentUserContent()).toContain('```basic-judge');
        // Visible as something the IDE asked for, like any other correction.
        expect(useAiStore.getState().messages.at(-1)!.autoFix).toBe(true);
      });

      it('judges once per run, not once per store change', async () => {
        await reportRun({ kind: 'ended-ok' }, undefined, [visual()], SCREEN);
        h.current!.resolve('```basic-judge\nPASS a circle in the middle\n```');
        await settle();

        h.current = null;
        useIdeStore.setState({ source: BASE_SOURCE });
        expect(h.current).toBeNull();
      });

      it('spends none of the bound when the screen looks right', async () => {
        await reportRun({ kind: 'ended-ok' }, undefined, [visual()], SCREEN);
        h.current!.resolve('```basic-judge\nPASS a circle in the middle\n```');
        await settle();
        expect(useAiStore.getState().pendingFix).toBeNull();

        // The full allowance is still there: two runtime errors, two
        // corrections, and only then the banner.
        for (let attempt = 0; attempt < 2; attempt++) {
          await reportRun({ kind: 'errored', report: FAILED });
          expect(h.current).not.toBeNull();
          h.current!.resolve('10 LET A=1');
          await settle();
        }
        h.current = null;
        reportRun({ kind: 'errored', report: FAILED });
        expect(h.current).toBeNull();
        expect(useAiStore.getState().pendingFix?.summary).toContain(
          'Runtime error',
        );
      });

      it('tells the assistant next time that its screen held', async () => {
        await reportRun({ kind: 'ended-ok' }, undefined, [visual()], SCREEN);
        h.current!.resolve('```basic-judge\nPASS a circle in the middle\n```');
        await settle();

        const p = useAiStore.getState().send(params);
        h.current!.resolve('10 PRINT');
        await p;
        expect(sentUserContent()).toContain('held');
      });

      it('spends exactly one when the judgement corrects the program', async () => {
        await reportRun({ kind: 'ended-ok' }, undefined, [visual()], SCREEN);
        h.current!.resolve(
          '```basic-judge\nFAIL it is an egg\n```\n\n```basic\n10 PLOT 1,1\n```',
        );
        await settle();
        // The correction is in the thread already; nothing to offer.
        expect(useAiStore.getState().pendingFix).toBeNull();

        // One attempt gone, so one more correction and then the banner.
        await reportRun({ kind: 'errored', report: FAILED });
        expect(h.current).not.toBeNull();
        h.current!.resolve('10 LET A=1');
        await settle();
        h.current = null;
        reportRun({ kind: 'errored', report: FAILED });
        expect(h.current).toBeNull();
        expect(useAiStore.getState().pendingFix?.summary).toContain(
          'Runtime error',
        );
      });

      it('offers the fix when the judgement finds fault but returns no program', async () => {
        await reportRun({ kind: 'ended-ok' }, undefined, [visual()], SCREEN);
        h.current!.resolve('```basic-judge\nFAIL it is an egg\n```');
        await settle();

        const fix = useAiStore.getState().pendingFix;
        expect(fix?.summary).toContain('Wrong result');
        expect(fix?.summary).toContain('an egg');
      });

      it('fails nothing when the judgement is stopped', async () => {
        await reportRun({ kind: 'ended-ok' }, undefined, [visual()], SCREEN);
        const err = new Error('Generation stopped.');
        err.name = 'AbortError';
        h.current!.reject(err);
        await settle();

        expect(useAiStore.getState().pendingFix).toBeNull();
        const p = useAiStore.getState().send(params);
        h.current!.resolve('10 PRINT');
        await p;
        expect(sentUserContent()).toContain('the judgement did not finish');
      });

      it('leaves it unchecked when there is no screen to show', async () => {
        await reportRun({ kind: 'ended-ok' }, undefined, [visual()]);
        expect(h.current).toBeNull();
        expect(useAiStore.getState().pendingFix).toBeNull();

        const p = useAiStore.getState().send(params);
        h.current!.resolve('10 PRINT');
        await p;
        expect(sentUserContent()).toContain('there was no screen to show');
      });

      it('leaves it unchecked on a provider that cannot be shown one', async () => {
        await withTextOnlyProvider(async () => {
          await reportRun({ kind: 'ended-ok' }, undefined, [visual()], SCREEN);
          expect(h.current).toBeNull();

          const p = useAiStore.getState().send(params);
          h.current!.resolve('10 PRINT');
          await p;
          expect(sentUserContent()).toContain(
            'the screen cannot be shown to this assistant',
          );
        });
      });

      it('leaves it unchecked once the automatic corrections are used up', async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          await reportRun({ kind: 'errored', report: FAILED });
          h.current!.resolve('10 LET A=1');
          await settle();
        }
        h.current = null;

        await reportRun({ kind: 'ended-ok' }, undefined, [visual()], SCREEN);
        expect(h.current).toBeNull();

        const p = useAiStore.getState().send(params);
        h.current!.resolve('10 PRINT');
        await p;
        expect(sentUserContent()).toContain('already used up');
      });
    });
  });

  describe('a screen shown with a request', () => {
    const shown = {
      ...params,
      image: { mediaType: 'image/png' as const, base64: 'PNGDATA' },
    };

    it('goes out with that turn and is shown in the thread', async () => {
      const p = useAiStore.getState().send(shown);
      h.current!.resolve('10 PRINT');
      await p;

      expect(h.sent!.messages[0]!.image?.base64).toBe('PNGDATA');
      expect(useAiStore.getState().messages[0]!.image?.base64).toBe('PNGDATA');
    });

    it('stays on its own turn as the conversation goes on', async () => {
      const first = useAiStore.getState().send(shown);
      h.current!.resolve('10 PRINT');
      await first;

      const second = useAiStore.getState().send(params);
      h.current!.resolve('20 PRINT');
      await second;

      const sent = h.sent!.messages;
      // Still there (the cached prefix must not be rewritten), and still only
      // on the turn that showed it.
      expect(sent[0]!.image?.base64).toBe('PNGDATA');
      expect(sent.filter((m) => m.image).length).toBe(1);
      expect(sent.at(-1)!.image).toBeUndefined();
    });

    it('is remembered in storage as a marker, never as pixels', async () => {
      const p = useAiStore.getState().send(shown);
      h.current!.resolve('10 PRINT');
      await p;

      const stored = loadAiConversation();
      expect(stored[0]).toEqual({
        role: 'user',
        content: 'make breakout',
        screenShown: true,
      });
      expect(JSON.stringify(stored)).not.toContain('PNGDATA');
    });
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
