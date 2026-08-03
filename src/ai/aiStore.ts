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
  candidateProgram,
  extractCodeBlocks,
  extractExpectations,
  extractJudgement,
  extractScreenViews,
  isApplicableBlock,
} from './codeExtractor';
import { canCheckByRunning } from './machineObservability';
import {
  buildEditorFix,
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
   * True while the IDE is running this answer on the machine to see how it
   * goes. UI-only, and the one stage that outlives the streamed text: it begins
   * once the answer is complete, so without it the panel would fall silent for
   * as long as the machine takes and read as having hung.
   */
  checking?: boolean;
  /**
   * True while this reply is the assistant being shown the screen its program
   * drew and asked whether what it stated holds. Distinct from `autoFix`: both
   * are requests the store raised itself, but "looking at the screen" and
   * "fixing the failed run" are different waits and deserve different words.
   */
  judging?: boolean;
  /**
   * The machine's display once the assistant has stopped working on this
   * answer, for the user's own look at the finished work.
   *
   * Deliberately not {@link ChatMessage.image}: that field is what a turn
   * carries to the provider, and every later request replays it to keep the
   * cached prefix byte-stable. A picture shown only to the user riding on it
   * would be re-sent on every subsequent turn - paying for vision tokens
   * forever, and destabilising the prefix that carrying images forward exists
   * to protect. This one never leaves the browser.
   */
  finalScreen?: ChatImage;
  /**
   * Fingerprint of the program this answer was written against. A fragment is
   * a delta, so applying it once the editor has moved on may not be what the
   * assistant meant; the panel compares this with the current source.
   */
  baseFingerprint?: string;
}

/**
 * The machine's display this thread is showing that the assistant has not been
 * sent: the picture handed to the user under the latest answer, until a request
 * carries it.
 *
 * A function of the messages rather than a flag kept alongside them - the thread
 * already knows both what it is showing and what it has sent, and a second
 * source of truth would have to be cleared correctly on reset, on restore, and
 * on every path that ends an answer.
 *
 * "Already sent" compares the image itself, which works because the run check
 * captures once: the picture the assistant was shown and the picture the user
 * was handed are the same one. Sending it twice would pay for the same pixels
 * again and rewrite a prefix the provider had cached - a shown screen stays on
 * the turn that carried it and is replayed from there.
 */
export function unsentScreen(
  messages: readonly DisplayMessage[],
): ChatImage | null {
  let latest: ChatImage | undefined;
  for (const msg of messages) if (msg.finalScreen) latest = msg.finalScreen;
  if (!latest) return null;
  const shown = latest;
  const sent = messages.some(
    (msg) => msg.role === 'user' && msg.image?.base64 === shown.base64,
  );
  return sent ? null : shown;
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
  /**
   * The program a fragment in the reply should be merged into for the check -
   * the program this request is asking about, which for a correction is the
   * candidate that just failed rather than what the editor holds.
   *
   * Distinct from {@link baseSource}, which answers a different question: has
   * the *user* moved on. That one must stay the editor's program all the way
   * down a chain of corrections, or the second correction would compare the
   * first correction's candidate against the editor and conclude the user had
   * edited when they had not. Defaults to `baseSource`, which is right for
   * every request the user makes.
   */
  checkAgainst?: string;
  /** Mark the reply as the assistant judging its own screen (see `judging`). */
  judging?: boolean;
  /**
   * Skip checking the answer this request produces. Set only by the judging
   * request, whose reply is settled by {@link settleJudgement} once it has been
   * read - checking it here would start the next run before the judgement it is
   * waiting on had been applied.
   */
  skipCheck?: boolean;
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
 * The machine's display from the latest check, waiting to be handed to the user
 * once the assistant stops working on this answer.
 *
 * Held rather than shown immediately because "the assistant has stopped" is not
 * knowable at the moment the run ends: a failed run may be about to become a
 * correction, and a clean one with a visual expectation may be about to become a
 * judgement. Every branch that ends the work shows it; the branches that
 * continue leave it for the attempt that does end.
 */
let latestFinalScreen: ChatImage | null = null;

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
        // The same rule for both kinds of screen: the one shown to the
        // assistant and the one shown to the user are equally not worth
        // evicting the autosaved program for.
        ...(m.image || m.finalScreen || m.screenShown
          ? { screenShown: true }
          : {}),
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
    checkAgainst,
    judging,
    skipCheck,
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
          ...(judging ? { judging: true } : {}),
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
            ...(judging ? { judging: true } : {}),
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
      // The answer is complete: run it and see how it goes, before the user is
      // asked to decide anything about it.
      if (!skipCheck) checkLatestAnswer(checkAgainst ?? baseSource, baseSource);
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

  stop: () => {
    activeHandle?.abort();
    // A check is a stage like any other, and the same action ends it. The run
    // itself is left to finish on the machine - its verdict is simply not acted
    // on (see stoppedCheckSeq), which is cheaper and less startling than
    // yanking the emulator out from under whatever it is drawing.
    if (get().messages[get().messages.length - 1]?.checking) {
      stoppedCheckSeq = useIdeStore.getState().runRequest;
      markChecking(false);
    }
  },

  setPendingFix: (fix) => set({ pendingFix: fix }),
  clearPendingFix: () => set({ pendingFix: null }),

  reset: () => {
    gen++;
    activeHandle?.abort();
    activeHandle = null;
    autoFixAttempts = 0;
    pendingRunNote = '';
    pendingRunImage = null;
    latestFinalScreen = null;
    stoppedCheckSeq = -1;
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
  stalenessBase: string,
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
        baseSource: stalenessBase,
        checkAgainst: ranSource,
        automatic: true,
        judging: true,
        // The verdict has to be read out of this reply before anything is run:
        // checking it here would start the next run before the judgement it is
        // waiting on had been applied. `settleJudgement` checks it instead, and
        // only when it came back carrying a correction.
        skipCheck: true,
      }),
    )
    .then(() => settleJudgement(outcome, ranSource, stalenessBase, results));
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
  stalenessBase: string,
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
    showFinishedWork(latestFinalScreen ?? undefined);
    return;
  }

  const judged = applyJudgement(results, extractJudgement(reply.content));
  if (!judged.some((r) => r.status === 'failed')) {
    pendingRunNote = buildRunNote(outcome, judged);
    showFinishedWork(latestFinalScreen ?? undefined);
    return;
  }

  // It found its own program wanting. If it corrected it in the same breath,
  // that reply IS the correction and costs the one attempt an error correction
  // would have; if it only said what was wrong, there is nothing to apply, so
  // the fix goes back to being one the user chooses to ask for.
  if (extractCodeBlocks(reply.content).some(isApplicableBlock)) {
    autoFixAttempts++;
    // Now that the verdict has been read, the corrected program it carried is
    // an answer like any other and gets checked like any other.
    checkLatestAnswer(ranSource, stalenessBase);
  } else {
    ai.setPendingFix(buildExpectationFix(ranSource, judged, true));
    showFinishedWork(latestFinalScreen ?? undefined);
  }
}

/**
 * Run the answer the assistant just returned and check how it goes - without it
 * reaching the editor.
 *
 * This is where the loop starts now. It used to start when the user pressed an
 * apply-and-run button, which meant the checking happened with an unverified
 * program already in their document; an answer that needed two corrections sat
 * there broken for both of them. Nothing below this point changed: the same
 * outcomes, the same expectations, the same bounded corrections.
 *
 * `mergeBase` is the program a returned fragment lands in; `stalenessBase` is
 * the editor's program, which is what decides whether the user has moved on.
 * They are the same thing for a request the user made and differ down a chain
 * of corrections - see {@link SendParams.checkAgainst}.
 */
function checkLatestAnswer(mergeBase: string, stalenessBase: string): void {
  const ai = useAiStore.getState();
  const reply = ai.messages[ai.messages.length - 1];
  // Nothing to run: stopped, cut off mid-thought, refused, or still arriving.
  if (
    !reply ||
    reply.role !== 'assistant' ||
    reply.incomplete ||
    reply.streaming ||
    reply.content.trim() === ''
  ) {
    return;
  }

  const state = useIdeStore.getState();
  // A machine with no error report can never reach a verdict, so checking on it
  // would restart the user's emulator for an answer that never arrives.
  if (!canCheckByRunning(state.dialect.id)) return;

  // The last applicable block: a reply builds towards its answer, and an
  // earlier block is illustrative far more often than it is the deliverable.
  const blocks = extractCodeBlocks(reply.content).filter(isApplicableBlock);
  const block = blocks[blocks.length - 1];
  if (!block) return; // an answer with no program is not a thing to run

  const candidate = candidateProgram(block, mergeBase);
  if (candidate === null) return; // kind unknown - offered as it is, unchecked

  // A candidate that will not tokenize never reaches the machine, and the run
  // effect refuses it with a message rather than an outcome - so the loop would
  // wait forever on a verdict nobody is going to produce. Report it as the
  // failure of this answer that it is, on the same bounded terms as any other.
  const lintErrors = state.dialect.lint(candidate);
  if (lintErrors.length > 0) {
    reportUnbuildableAnswer(candidate, stalenessBase, lintErrors);
    return;
  }

  markChecking(true);
  state.requestAiRun({
    candidate,
    baseSource: stalenessBase,
    expectations: extractExpectations(reply.content),
    views: extractScreenViews(reply.content),
  });
}

/**
 * Flag/unflag the latest answer as being checked, for the panel's status.
 *
 * Also holds `busy`, because a check is work in progress like any other stage:
 * without it the composer would accept a new request while the machine was still
 * running the last answer, and the two would race over the same emulator.
 */
function markChecking(checking: boolean): void {
  useAiStore.setState((s) => {
    const last = s.messages[s.messages.length - 1];
    if (!last || last.role !== 'assistant') return { busy: checking };
    if (!!last.checking === checking) return { busy: checking };
    const copy = [...s.messages];
    copy[copy.length - 1] = checking
      ? { ...last, checking: true }
      : { ...last, checking: undefined };
    return { messages: copy, busy: checking };
  });
}

/**
 * The run whose check the user stopped, so its verdict is not acted on when it
 * arrives - stopping a stage has always meant nothing follows from it.
 *
 * Its screen is still handed over: the user asked for the work to stop, not to
 * be hidden from them, and the machine did draw something.
 */
let stoppedCheckSeq = -1;

/**
 * Hand the user the machine's screen for the answer they have just been given.
 *
 * Once per answer, replacing any earlier one, so a run that took three attempts
 * ends with the picture from the third and not with three pictures. It rides on
 * the answer rather than as a turn of its own, because nobody said it - it is
 * the IDE showing its working.
 */
function showFinishedWork(screen: ChatImage | undefined): void {
  if (!screen) return;
  useAiStore.setState((s) => {
    const last = s.messages[s.messages.length - 1];
    if (!last || last.role !== 'assistant') return s;
    const copy = [...s.messages];
    copy[copy.length - 1] = { ...last, finalScreen: screen };
    return { messages: copy };
  });
  // Attached after the answer's own persist, so the stored thread would
  // otherwise never learn a screen was shown at all.
  persist(useAiStore.getState().messages);
}

/**
 * An answer whose program does not tokenize, handled exactly as a failed run
 * is: corrected without being asked while the budget lasts, offered as a fix
 * once it is spent.
 */
function reportUnbuildableAnswer(
  candidate: string,
  stalenessBase: string,
  errors: ReturnType<Dialect['lint']>,
): void {
  const ai = useAiStore.getState();
  const state = useIdeStore.getState();
  const fix = buildEditorFix(candidate, errors);
  const context = resolveRequestContext();
  const edited =
    sourceFingerprint(stalenessBase) !== sourceFingerprint(state.source);
  if (
    edited ||
    ai.busy ||
    context === null ||
    autoFixAttempts >= MAX_AUTO_FIX_ATTEMPTS
  ) {
    ai.setPendingFix(fix);
    state.showAiPanel();
    return;
  }
  autoFixAttempts++;
  state.showAiPanel();
  const { dialect, ...request } = context;
  void loadSystemPrompt(
    dialect,
    getProvider(context.providerId).acceptsImages,
  ).then((system) =>
    ai.send({
      ...request,
      system,
      userContent: fix.userContent,
      displayRequest: fix.displayRequest,
      baseSource: stalenessBase,
      // The correction is about the program that would not build, not the one
      // in the editor.
      checkAgainst: candidate,
      automatic: true,
    }),
  );
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
  // The machine has finished with this answer, whatever it concluded.
  markChecking(false);
  latestFinalScreen = run.finalScreen ?? null;

  // The user stopped this check: no correction, no judgement, no note - the same
  // as stopping any other stage. They still get to see what the machine drew.
  if (run.seq === stoppedCheckSeq) {
    showFinishedWork(latestFinalScreen ?? undefined);
    return;
  }

  // A program that ran cleanly but produced the wrong answer has failed just as
  // surely as one that stopped on an error, so it takes the same path: the same
  // correction, out of the same bounded budget. One budget, deliberately - a
  // separate allowance per kind of failure would let a single applied block
  // spend twice over.
  const wrongResult =
    run.outcome.kind !== 'errored' &&
    run.expectations.some((r) => r.status === 'failed');

  const ai = useAiStore.getState();
  // Correcting a program the user has edited since would be answering a question
  // they have already moved on from.
  //
  // Compared against the program the answer was WRITTEN against, not the one
  // that ran. Those used to be the same thing - the run was of applied text - so
  // comparing `ranSource` was an equivalent shortcut. It is not equivalent any
  // more: a checked answer is by definition not what the editor holds, so that
  // comparison would report "edited" every single time and silently disable
  // every unrequested correction. It would also pass every test that existed
  // before this change.
  const edited =
    sourceFingerprint(run.baseSource) !== sourceFingerprint(state.source);
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
      showFinishedWork(latestFinalScreen ?? undefined);
      return;
    }
    judgeScreen(
      run.outcome,
      run.ranSource,
      run.baseSource,
      run.expectations,
      screen!,
      context!,
    );
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
    showFinishedWork(latestFinalScreen ?? undefined);
    return;
  }

  // The program to correct is the one that failed - the answer that was checked,
  // which the user has not applied and the editor therefore does not hold.
  const buildFix = (screenAttached: boolean): PendingFix =>
    run.outcome.kind === 'errored'
      ? buildRunFix(
          run.ranSource,
          run.outcome.report,
          screenAttached,
          screenOffered,
        )
      : buildExpectationFix(
          run.ranSource,
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
    // The assistant has given up on this answer, which is exactly where a human
    // look is worth most.
    showFinishedWork(latestFinalScreen ?? undefined);
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
      // Still the editor's program: whether the user has moved on is a question
      // about them, and it must not drift onto the candidate chain.
      baseSource: state.source,
      // But a fragment in the correction patches the program that failed.
      checkAgainst: run.ranSource,
      automatic: true,
    }),
  );
});
