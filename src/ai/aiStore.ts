import { create } from 'zustand';
import type { AiProfile } from '../dialects/types';
import {
  streamChat,
  describeAiError,
  type ChatMessage,
  type StreamHandle,
} from './anthropicClient';
import {
  loadAiConversation,
  saveAiConversation,
  clearAiConversation,
} from '../storage/settings';
import { useIdeStore } from '../app/store';
import { buildRunFix, type PendingFix } from './promptBuilder';

export type { PendingFix } from './promptBuilder';

/** A message as shown in the thread. `streaming`/`incomplete` are UI-only. */
export interface DisplayMessage extends ChatMessage {
  /** True while the assistant answer is still arriving. */
  streaming?: boolean;
  /** True for a truncated answer restored after a reload (cannot resume). */
  incomplete?: boolean;
}

/** Everything `send` needs that depends on the active dialect/editor. */
export interface SendParams {
  apiKey: string;
  profile: AiProfile;
  system: string;
  /** Full context (source + lint errors + request) sent to the API. */
  userContent: string;
  /** Bare request shown in the thread. */
  displayRequest: string;
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

/** Persist the thread, dropping the empty placeholder and the `streaming` flag. */
function persist(messages: DisplayMessage[]): void {
  saveAiConversation(
    messages
      .filter((m) => !(m.streaming && m.content === ''))
      .map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.streaming || m.incomplete ? { incomplete: true } : {}),
      })),
  );
}

export const useAiStore = create<AiState>((set, get) => ({
  messages: typeof localStorage !== 'undefined' ? loadAiConversation() : [],
  busy: false,
  error: '',
  pendingFix: null,

  send: async ({ apiKey, profile, system, userContent, displayRequest }) => {
    const prior = get().messages;
    // History for the API: prior turns (role+content only) + the new request.
    const history: ChatMessage[] = [
      ...prior.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: userContent },
    ];
    const myGen = ++gen;
    set({
      busy: true,
      error: '',
      pendingFix: null,
      messages: [
        ...prior,
        { role: 'user', content: displayRequest },
        { role: 'assistant', content: '', streaming: true },
      ],
    });

    let lastPersist = 0;
    try {
      const handle = streamChat(apiKey, profile, system, history, (delta) => {
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
      });
      activeHandle = handle;
      const finalText = await handle.done;
      if (gen !== myGen) return;
      set((s) => {
        const copy = [...s.messages];
        copy[copy.length - 1] = { role: 'assistant', content: finalText };
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
              ? { role: m.role, content: m.content, incomplete: true }
              : m,
          );
        return { messages, busy: false, error: describeAiError(e) };
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
    clearAiConversation();
    set({ messages: [], busy: false, error: '', pendingFix: null });
  },
}));

// Module-level reactions to IDE-store changes. These run regardless of whether
// AiPanel is mounted, so they work even with the panel closed or, on mobile,
// while the editor tab is showing.
let prevReset = useIdeStore.getState().aiResetSeq;
let prevReportSeq = useIdeStore.getState().runReport?.seq ?? -1;
useIdeStore.subscribe((state) => {
  // A different program became active: clear the thread (and storage).
  if (state.aiResetSeq !== prevReset) {
    prevReset = state.aiResetSeq;
    useAiStore.getState().reset();
  }
  // The emulator reported a runtime error for an AI-checked run: offer a fix and
  // surface the panel so the user can review it.
  const report = state.runReport;
  if (report && report.seq !== prevReportSeq) {
    prevReportSeq = report.seq;
    if (report.report.isError) {
      useAiStore
        .getState()
        .setPendingFix(buildRunFix(state.source, report.report));
      state.showAiPanel();
    }
  }
});
