import { create } from 'zustand';
import {
  streamChat,
  describeAiError,
  type ChatMessage,
  type StreamHandle,
  type StreamResult,
} from './aiClient';
import type { AiProviderId } from './providers/types';
import {
  loadAiConversation,
  saveAiConversation,
  clearAiConversation,
  getAiProvider,
  getProviderApiKey,
} from '../storage/settings';
import { useIdeStore } from '../app/store';
import {
  buildRunFix,
  buildRunNote,
  buildSystemPrompt,
  FORMAT_RETRY_MESSAGE,
  type PendingFix,
} from './promptBuilder';
import { getProvider } from './providers/registry';
import { sourceFingerprint } from './sourceFingerprint';

export type { PendingFix } from './promptBuilder';

/** A message as shown in the thread. `streaming`/`retrying` are UI-only. */
export interface DisplayMessage extends ChatMessage {
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

/** Persist the thread, dropping the empty placeholder and the `streaming` flag. */
function persist(messages: DisplayMessage[]): void {
  saveAiConversation(
    messages
      .filter((m) => !(m.streaming && m.content === ''))
      .map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.streaming || m.incomplete ? { incomplete: true } : {}),
        ...(m.baseFingerprint ? { baseFingerprint: m.baseFingerprint } : {}),
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
    baseSource,
    automatic,
  }) => {
    // A request the user makes is a fresh start for the automatic corrections:
    // a long conversation must not exhaust its budget early and then silently
    // stop correcting itself.
    if (!automatic) autoFixAttempts = 0;
    // Spend any noted run outcome on this request, whoever asked for it.
    const note = pendingRunNote;
    pendingRunNote = '';
    const baseFingerprint = sourceFingerprint(baseSource);
    const prior = get().messages;
    // History for the API: prior turns (role+content only) + the new request.
    const baseHistory: ChatMessage[] = [
      ...prior.map(({ role, content }) => ({ role, content })),
      {
        role: 'user',
        content: note ? `${note}\n\n${userContent}` : userContent,
      },
    ];
    const myGen = ++gen;
    set({
      busy: true,
      error: '',
      pendingFix: null,
      messages: [
        ...prior,
        { role: 'user', content: displayRequest },
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
  system: string;
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
    system: buildSystemPrompt(dialect),
  };
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

  // A run that didn't fail is worth telling the assistant about, but not worth
  // a request of its own: note it and let the next request carry it.
  if (run.outcome.kind !== 'errored') {
    pendingRunNote = buildRunNote(run.outcome);
    return;
  }

  const ai = useAiStore.getState();
  const fix = buildRunFix(state.source, run.outcome.report);
  // Correcting a program the user has edited since it ran would be answering a
  // question they have already moved on from.
  const edited =
    sourceFingerprint(run.ranSource) !== sourceFingerprint(state.source);
  const context = resolveRequestContext();
  if (
    edited ||
    ai.busy ||
    context === null ||
    autoFixAttempts >= MAX_AUTO_FIX_ATTEMPTS
  ) {
    // Out of automatic attempts (or not entitled to one): back to offering the
    // fix for the user to accept, which is what happens without this feature.
    ai.setPendingFix(fix);
    state.showAiPanel();
    return;
  }

  autoFixAttempts++;
  // Surface the panel so a correction the user didn't ask for is visible while
  // it runs, and stoppable like any other reply.
  state.showAiPanel();
  void ai.send({
    ...context,
    userContent: fix.userContent,
    displayRequest: fix.displayRequest,
    baseSource: state.source,
    automatic: true,
  });
});
