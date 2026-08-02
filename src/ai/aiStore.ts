import { create } from 'zustand';
import {
  streamChat,
  describeAiError,
  type ChatMessage,
  type StreamHandle,
  type StreamResult,
} from './aiClient';
import type { AiProviderId, ChatImage } from './providers/types';
import {
  loadAiConversation,
  saveAiConversation,
  clearAiConversation,
  getAiProvider,
  getProviderApiKey,
} from '../storage/settings';
import { useIdeStore, type AiRunOutcome } from '../app/store';
import type { Dialect } from '../dialects/types';
import {
  applyJudgement,
  leaveUnjudged,
  type ExpectationResult,
} from './expectations';
import {
  extractCodeBlocks,
  extractJudgement,
  isApplicableBlock,
} from './codeExtractor';
import {
  buildExpectationFix,
  buildRunFix,
  buildRunNote,
  buildScreenJudgeRequest,
  buildViewNote,
  unavailableViews,
  FORMAT_RETRY_MESSAGE,
  loadSystemPrompt,
  type PendingFix,
} from './promptBuilder';
import { getProvider } from './providers/registry';
import { sourceFingerprint } from './sourceFingerprint';

export type { PendingFix } from './promptBuilder';

/**
 * A message as shown in the thread. `streaming`/`retrying` are UI-only.
 *
 * An `image` (inherited from `ChatMessage`) is a screen shown with that turn.
 * It survives in memory for as long as the thread does - so the panel can show
 * what was sent, and so the wire history keeps a stable, cacheable prefix - but
 * never reaches storage; see {@link persist} and `screenShown`.
 */
export interface DisplayMessage extends ChatMessage {
  /**
   * A screen was shown with this turn, but its image is gone: set on a turn
   * restored from storage, where the marker was kept and the bytes were not.
   */
  screenShown?: boolean;
  /** True while the assistant answer is still arriving. */
  streaming?: boolean;
  /** True for a truncated answer (stopped, or cut off by the output limit). */
  incomplete?: boolean;
  /** True while re-requesting after an empty reply (shows a distinct status). */
  retrying?: boolean;
  /**
   * True while this answer is a correction the assistant was asked for without
   * the user requesting it, after a run of its own program failed. UI-only, and
   * distinct from `retrying`: both are attempts the store started by itself,
   * but they are worth different words in the panel.
   */
  autoFix?: boolean;
  /**
   * Fingerprint of the program this answer was written against. A fragment is
   * a delta, so applying it once the editor has moved on may not be what the
   * assistant meant; the panel compares this with the current source.
   */
  baseFingerprint?: string;
}

/** Everything `send` needs that depends on the active dialect/editor. */
export interface SendParams {
  /** The selected backend; also picks the error-message mapping. */
  providerId: AiProviderId;
  apiKey: string;
  /** Model id resolved for the active provider. */
  model: string;
  /** Max output tokens (from the dialect's AI profile). */
  maxTokens: number;
  system: string;
  /** Full context (source + lint errors + request) sent to the API. */
  userContent: string;
  /** Bare request shown in the thread. */
  displayRequest: string;
  /**
   * The machine's display, shown to the assistant with this request. Only ever
   * set when the user attached it or a run needs looking at, and only for a
   * provider that can be shown one.
   */
  image?: ChatImage;
  /**
   * The program as it stood when this request was sent. Fingerprinted onto the
   * answer so a fragment applied later can be flagged as possibly stale.
   */
  baseSource: string;
  /**
   * True when the store raised this request itself to correct a failed run,
   * rather than the user asking for it. Marks the answer in the panel, and
   * spends one of the bounded automatic attempts instead of releasing them -
   * only a request the user makes does that.
   */
  automatic?: boolean;
}

interface AiState {
  messages: DisplayMessage[];
  busy: boolean;
  error: string;
  /**
   * A correction the assistant is offering after an apply/run surfaced problems,
   * shown as a one-tap prompt in the panel. Null when there is nothing to fix.
   */
  pendingFix: PendingFix | null;
  send(params: SendParams): Promise<void>;
  stop(): void;
  setPendingFix(fix: PendingFix): void;
  clearPendingFix(): void;
  /** Clear the thread (new/loaded program). Aborts any in-flight stream. */
  reset(): void;
}

/**
 * Module-level handle + generation counter live OUTSIDE the store state: they
 * are not render data, and keeping them here lets an in-flight stream survive
 * `AiPanel` unmounting. `gen` is bumped on reset so a late completion from an
 * aborted/superseded stream is ignored.
 */
let activeHandle: StreamHandle | null = null;
let gen = 0;

/**
 * How many corrections the assistant may be asked for without the user asking.
 * Small and fixed: past this the failure goes back to being a fix the user
 * chooses to accept, so the decision to keep spending requests is always
 * theirs. Counted per applied block and released by any request the user makes.
 */
const MAX_AUTO_FIX_ATTEMPTS = 2;
let autoFixAttempts = 0;

/**
 * How the last run turned out, when it didn't fail, waiting to ride along with
 * the next request (see {@link buildRunNote}). Cleared as soon as it is spent.
 */
let pendingRunNote = '';

/**
 * The screen from that run, when the assistant asked to be shown it and the run
 * gave no other reason to send one. It waits with the note and is spent with it:
 * a view that was asked for is carried whether or not the program failed, and a
 * successful run is not a reason to withhold what was requested.
 */
let pendingRunImage: ChatImage | null = null;

/**
 * Persist the thread, dropping the empty placeholder and the `streaming` flag.
 *
 * A shown screen is recorded as a marker and not as pixels: the conversation
 * backup shares a few megabytes of localStorage with the autosaved program and
 * everything else the IDE keeps, and a handful of upscaled PNGs would evict
 * them. A restored thread can still say a screen was shown; it just cannot show
 * it again.
 */
function persist(messages: DisplayMessage[]): void {
  saveAiConversation(
    messages
      .filter((m) => !(m.streaming && m.content === ''))
      .map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.streaming || m.incomplete ? { incomplete: true } : {}),
        ...(m.baseFingerprint ? { baseFingerprint: m.baseFingerprint } : {}),
        ...(m.image || m.screenShown ? { screenShown: true } : {}),
      })),
  );
}

export const useAiStore = create<AiState>((set, get) => ({
  messages:
    // The conversation is per-tab with a localStorage backup, so both storages
    // must exist (safeStorage installs in-memory stand-ins in the browser).
    typeof localStorage !== 'undefined' && typeof sessionStorage !== 'undefined'
      ? loadAiConversation()
      : [],
  busy: false,
  error: '',
  pendingFix: null,

  send: async ({
    providerId,
    apiKey,
    model,
    maxTokens,
    system,
    userContent,
    displayRequest,
    image,
    baseSource,
    automatic,
  }) => {
    // A request the user makes is a fresh start for the automatic corrections:
    // a long conversation must not exhaust its budget early and then silently
    // stop correcting itself.
    if (!automatic) autoFixAttempts = 0;
    // Spend any noted run outcome on this request, whoever asked for it - and
    // with it the screen that outcome was asked to carry, unless this request
    // is already carrying one of its own.
    const note = pendingRunNote;
    pendingRunNote = '';
    const shown = image ?? pendingRunImage ?? undefined;
    pendingRunImage = null;
    const baseFingerprint = sourceFingerprint(baseSource);
    const prior = get().messages;
    // History for the API: prior turns + the new request. A screen shown with
    // an earlier turn stays on it rather than being rewritten out - the prefix
    // has to stay byte-stable for the provider's cache to hit, and a cached
    // image reads for a fraction of what re-writing the prefix would cost.
    const baseHistory: ChatMessage[] = [
      ...prior.map(({ role, content, image: was }) => ({
        role,
        content,
        ...(was ? { image: was } : {}),
      })),
      {
        role: 'user',
        content: note ? `${note}\n\n${userContent}` : userContent,
        ...(shown ? { image: shown } : {}),
      },
    ];
    const myGen = ++gen;
    set({
      busy: true,
      error: '',
      pendingFix: null,
      messages: [
        ...prior,
        {
          role: 'user',
          content: displayRequest,
          ...(shown ? { image: shown } : {}),
        },
        {
          role: 'assistant',
          content: '',
          streaming: true,
          ...(automatic ? { autoFix: true } : {}),
        },
      ],
    });

    // Stream one attempt into the trailing placeholder, resolving to its final
    // text. Reused verbatim for the empty-reply reformat retry below; the
    // `myGen`/`gen` guards make late deltas/completions from a superseded stream
    // no-ops just as before.
    let lastPersist = 0;
    const runAttempt = (history: ChatMessage[]): Promise<StreamResult> => {
      const handle = streamChat(
        providerId,
        { apiKey, model, maxTokens, system, messages: history },
        (delta) => {
          if (gen !== myGen) return; // superseded by reset/new send
          set((s) => {
            const copy = [...s.messages];
            const last = copy[copy.length - 1]!;
            copy[copy.length - 1] = { ...last, content: last.content + delta };
            return { messages: copy };
          });
          const now = Date.now();
          if (now - lastPersist > 1000) {
            lastPersist = now;
            persist(get().messages);
          }
        },
      );
      activeHandle = handle;
      return handle.done;
    };

    try {
      let result = await runAttempt(baseHistory);
      if (gen !== myGen) return;

      // A decline comes back as a successful, empty response. Retrying it as
      // though the transport had failed just spends another request to be
      // declined again, and then reports the wrong reason.
      if (result.stop === 'refused') {
        set((s) => ({
          messages: s.messages.filter(
            (m) => !(m.streaming && m.content === ''),
          ),
          busy: false,
          error:
            'The AI declined this request. Try rephrasing it, or ask for something else.',
        }));
        persist(get().messages);
        return;
      }

      // An empty reply (e.g. the whole token budget went to adaptive thinking)
      // renders as a blank bubble. Re-request once with a format nudge before
      // giving up. Only a truly empty reply retries - legitimate prose answers
      // are left alone.
      if (result.text.trim() === '') {
        set((s) => {
          const copy = [...s.messages];
          copy[copy.length - 1] = {
            role: 'assistant',
            content: '',
            streaming: true,
            retrying: true,
            ...(automatic ? { autoFix: true } : {}),
          };
          return { messages: copy };
        });
        const retryHistory: ChatMessage[] = [
          ...baseHistory,
          // Synthetic assistant turn keeps role alternation valid; '(no
          // response)' avoids the API's empty-content rejection.
          { role: 'assistant', content: '(no response)' },
          { role: 'user', content: FORMAT_RETRY_MESSAGE },
        ];
        result = await runAttempt(retryHistory);
        if (gen !== myGen) return;

        if (result.text.trim() === '') {
          // Twice empty: drop the placeholder and surface an error.
          set((s) => ({
            messages: s.messages.filter(
              (m) => !(m.streaming && m.content === ''),
            ),
            busy: false,
            error:
              'The AI returned an empty response twice. Please try again or rephrase your request.',
          }));
          persist(get().messages);
          return;
        }
      }

      set((s) => {
        const copy = [...s.messages];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: result.text,
          baseFingerprint,
          // Cut off by the output limit: the code in it stops mid-thought, so
          // it must not be offered as a finished answer to apply.
          ...(result.stop === 'truncated' ? { incomplete: true } : {}),
        };
        return { messages: copy, busy: false };
      });
      persist(get().messages);
    } catch (e) {
      if (gen !== myGen) return; // reset already cleared the thread
      // Keep any partial text (e.g. after Stop) as a truncated answer; drop an
      // empty placeholder.
      set((s) => {
        const messages = s.messages
          .filter((m) => !(m.streaming && m.content === ''))
          .map((m) =>
            m.streaming
              ? {
                  role: m.role,
                  content: m.content,
                  incomplete: true,
                  baseFingerprint,
                }
              : m,
          );
        return { messages, busy: false, error: describeAiError(providerId, e) };
      });
      persist(get().messages);
    } finally {
      if (gen === myGen) activeHandle = null;
    }
  },

  stop: () => activeHandle?.abort(),

  setPendingFix: (fix) => set({ pendingFix: fix }),
  clearPendingFix: () => set({ pendingFix: null }),

  reset: () => {
    gen++;
    activeHandle?.abort();
    activeHandle = null;
    autoFixAttempts = 0;
    pendingRunNote = '';
    pendingRunImage = null;
    clearAiConversation();
    set({ messages: [], busy: false, error: '', pendingFix: null });
  },
}));

/**
 * Everything a request needs that doesn't come from the caller. The panel reads
 * the same settings when the user sends something; the automatic correction has
 * no panel to read them from, so it resolves them here. Null when there is no
 * API key, which is where the automatic path gives up (asking the user for a
 * key is a conversation to have when they asked for something, not in the
 * middle of a run they didn't).
 */
function resolveRequestContext(): {
  providerId: ReturnType<typeof getAiProvider>;
  apiKey: string;
  model: string;
  maxTokens: number;
  /** The machine to build the system prompt for; see {@link loadSystemPrompt}. */
  dialect: Dialect;
} | null {
  const providerId = getAiProvider();
  const apiKey = getProviderApiKey(providerId);
  if (!apiKey) return null;
  const { dialect } = useIdeStore.getState();
  return {
    providerId,
    apiKey,
    model: getProvider(providerId).defaultModel,
    maxTokens: dialect.aiProfile.maxTokens,
    dialect,
  };
}

/**
 * Show the assistant the screen its program produced and ask it to judge what
 * it said that screen would show - correcting the program in the same reply if
 * it does not hold.
 *
 * One request, not two: the model has everything it needs to judge and to fix
 * at once, and folding them is what keeps a look at the screen costing no more
 * unrequested requests than a runtime error does.
 *
 * The bound is spent by corrections, not by looking. This request spends none
 * of it; the counter moves only if the reply comes back carrying a corrected
 * program, which is the same one attempt an error correction would have used.
 */
function judgeScreen(
  outcome: AiRunOutcome,
  ranSource: string,
  results: readonly ExpectationResult[],
  screen: ChatImage,
  context: NonNullable<ReturnType<typeof resolveRequestContext>>,
): void {
  const ai = useAiStore.getState();
  const visuals = results
    .map((r) => r.expectation)
    .filter((e) => e.kind === 'visual');
  const judge = buildScreenJudgeRequest(ranSource, visuals);
  const { dialect, ...request } = context;
  void loadSystemPrompt(dialect, true)
    .then((system) =>
      ai.send({
        ...request,
        system,
        userContent: judge.userContent,
        displayRequest: judge.displayRequest,
        image: screen,
        baseSource: ranSource,
        automatic: true,
      }),
    )
    .then(() => settleJudgement(outcome, ranSource, results));
}

/**
 * Read the verdict out of the reply the judging request produced, and turn it
 * into the run's answer.
 *
 * A reply that never finished - stopped, failed, empty - judges nothing: the
 * expectations stay unchecked and no correction follows, which is what stopping
 * a reply has always meant.
 */
function settleJudgement(
  outcome: AiRunOutcome,
  ranSource: string,
  results: readonly ExpectationResult[],
): void {
  const ai = useAiStore.getState();
  const reply = ai.messages[ai.messages.length - 1];
  if (
    !reply ||
    reply.role !== 'assistant' ||
    reply.incomplete ||
    reply.streaming ||
    reply.content.trim() === ''
  ) {
    pendingRunNote = buildRunNote(
      outcome,
      leaveUnjudged(results, 'the judgement did not finish'),
    );
    return;
  }

  const judged = applyJudgement(results, extractJudgement(reply.content));
  if (!judged.some((r) => r.status === 'failed')) {
    pendingRunNote = buildRunNote(outcome, judged);
    return;
  }

  // It found its own program wanting. If it corrected it in the same breath,
  // that reply IS the correction and costs the one attempt an error correction
  // would have; if it only said what was wrong, there is nothing to apply, so
  // the fix goes back to being one the user chooses to ask for.
  if (extractCodeBlocks(reply.content).some(isApplicableBlock)) {
    autoFixAttempts++;
  } else {
    ai.setPendingFix(buildExpectationFix(ranSource, judged, true));
  }
}

// Module-level reactions to IDE-store changes. These run regardless of whether
// AiPanel is mounted, so they work even with the panel closed or, on mobile,
// while the editor tab is showing.
let prevReset = useIdeStore.getState().aiResetSeq;
let prevOutcomeSeq = useIdeStore.getState().runOutcome?.seq ?? -1;
useIdeStore.subscribe((state) => {
  // A different program became active: clear the thread (and storage).
  if (state.aiResetSeq !== prevReset) {
    prevReset = state.aiResetSeq;
    useAiStore.getState().reset();
  }

  const run = state.runOutcome;
  if (!run || run.seq === prevOutcomeSeq) return;
  prevOutcomeSeq = run.seq;

  // A program that ran cleanly but produced the wrong answer has failed just as
  // surely as one that stopped on an error, so it takes the same path: the same
  // correction, out of the same bounded budget. One budget, deliberately - a
  // separate allowance per kind of failure would let a single applied block
  // spend twice over.
  const wrongResult =
    run.outcome.kind !== 'errored' &&
    run.expectations.some((r) => r.status === 'failed');

  const ai = useAiStore.getState();
  // Correcting a program the user has edited since it ran would be answering a
  // question they have already moved on from.
  const edited =
    sourceFingerprint(run.ranSource) !== sourceFingerprint(state.source);
  const context = resolveRequestContext();
  const canShowScreen =
    context !== null && getProvider(context.providerId).acceptsImages;
  // The display travels only where the assistant asked to see it (the capture
  // is taken on that basis) and only to a backend that can be shown one.
  const screen = canShowScreen ? run.screen : undefined;
  // What it asked for and did not get - reported back rather than passed over.
  const missedViews = unavailableViews(run.views, screen !== undefined);
  // A picture was possible and it asked for none: the correction says so, so a
  // failure it did not foresee is one turn from being visible rather than out
  // of reach.
  const screenOffered =
    canShowScreen && !run.views.image && run.screen === undefined;

  // Expectations about how the screen looks are the one form no machine can
  // settle. They arrive unchecked and are settled by showing the assistant what
  // its program drew - if there is a screen, somewhere to show it, and an
  // automatic request still going spare.
  const visuals = run.expectations.filter(
    (r) => r.expectation.kind === 'visual',
  );
  if (run.outcome.kind !== 'errored' && !wrongResult && visuals.length > 0) {
    const blocked =
      screen === undefined
        ? canShowScreen
          ? 'there was no screen to show'
          : 'the screen cannot be shown to this assistant'
        : edited || ai.busy || context === null
          ? 'it was not judged'
          : autoFixAttempts >= MAX_AUTO_FIX_ATTEMPTS
            ? 'the automatic corrections for this run were already used up'
            : null;
    if (blocked !== null) {
      // Unchecked, never failed: not looking is not evidence of anything.
      pendingRunNote = buildRunNote(
        run.outcome,
        leaveUnjudged(run.expectations, blocked),
        missedViews,
      );
      return;
    }
    judgeScreen(run.outcome, state.source, run.expectations, screen!, context!);
    state.showAiPanel();
    return;
  }

  // A run that didn't fail is worth telling the assistant about, but not worth
  // a request of its own: note it and let the next request carry it.
  if (run.outcome.kind !== 'errored' && !wrongResult) {
    pendingRunNote = buildRunNote(
      run.outcome,
      run.expectations,
      missedViews,
      screen !== undefined,
    );
    // Asked for and produced: it travels with the note, so a view is carried
    // whether or not the program that produced it failed.
    pendingRunImage = screen ?? null;
    return;
  }

  const buildFix = (screenAttached: boolean): PendingFix =>
    run.outcome.kind === 'errored'
      ? buildRunFix(
          state.source,
          run.outcome.report,
          screenAttached,
          screenOffered,
        )
      : buildExpectationFix(
          state.source,
          run.expectations,
          screenAttached,
          screenOffered,
        );
  if (
    edited ||
    ai.busy ||
    context === null ||
    autoFixAttempts >= MAX_AUTO_FIX_ATTEMPTS
  ) {
    // Out of automatic attempts (or not entitled to one): back to offering the
    // fix for the user to accept, which is what happens without this feature.
    // No screen rides along with a banner the user may never accept, so the fix
    // is built as one that has none.
    ai.setPendingFix(buildFix(false));
    state.showAiPanel();
    return;
  }

  autoFixAttempts++;
  const fix = buildFix(screen !== undefined);
  // A failing run's outcome is the correction request, so an unavailable view
  // rides in front of it - the same words a run that didn't fail would use.
  pendingRunNote = buildViewNote(missedViews);
  // Surface the panel so a correction the user didn't ask for is visible while
  // it runs, and stoppable like any other reply.
  state.showAiPanel();
  // The machine's reference is fetched on demand, so the system prompt resolves
  // asynchronously - which costs this path nothing, since it was already firing
  // the request without waiting for it.
  const { dialect, ...request } = context;
  void loadSystemPrompt(dialect, canShowScreen).then((system) =>
    ai.send({
      ...request,
      system,
      userContent: fix.userContent,
      displayRequest: fix.displayRequest,
      ...(screen ? { image: screen } : {}),
      baseSource: state.source,
      automatic: true,
    }),
  );
});
