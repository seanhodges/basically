import { create } from 'zustand';
import {
  streamChat,
  describeAiError,
  type ChatMessage,
  type StreamHandle,
  type StreamResult,
  type ToolRunner,
} from './aiClient';
import type { AiEffort, AiProviderId, ChatImage } from './providers/types';
import {
  loadAiConversation,
  saveAiConversation,
  clearAiConversation,
  getAiProvider,
  getProviderApiKey,
} from '../storage/settings';
import { useIdeStore, type AiRunOutcome } from '../app/store';
import {
  freezeMachine,
  hasMachineControl,
  machineControl,
  ownsMachine,
} from '../app/machineControl';
import {
  describeDriving,
  describeScreen,
  driveToolDefinitions,
  parseDriveScript,
  refuseUngivenMachine,
  runDriveScript,
  DRIVE_TOOL,
  LOOK_TOOL,
  type DriveReport,
} from './driveTools';
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
  loadSystemPromptFor,
  type PendingFix,
} from './promptBuilder';
import { getProvider } from './providers/registry';
import { hasMovedOn, sourceFingerprint } from './sourceFingerprint';
import { resolveAiTuning, type AiTuning } from './aiTuning';
import {
  buildContinuationRequest,
  readPartialProgram,
  stitchContinuation,
  type PartialProgram,
} from './continuation';

export type { PendingFix } from './promptBuilder';

/**
 * Why an answer stopped before it was finished.
 *
 * The three are distinguished because one sentence for all of them reads as
 * though the user stopped an answer that in fact ran out of room, and this is
 * the only case that leaves no error message beside it.
 *
 * - `stopped`   - the user pressed Stop. Their choice; nothing to explain.
 * - `failed`    - the stream died. An error message accompanies it.
 * - `outOfRoom` - the provider hit the output limit. Nobody did anything wrong,
 *                 the budget was too small, and the answer can be continued.
 */
export type CutOffReason = 'stopped' | 'failed' | 'outOfRoom';

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
   * What this turn said to the provider, where that is not what the panel
   * shows. Absent whenever the two are the same, which is every assistant turn.
   *
   * A user turn carries far more than the sentence the user typed - the program,
   * its lint errors, how the last run went - and the panel shows only the
   * sentence. The wire needs the rest: the provider's cache is a prefix match,
   * so a turn replayed as anything other than what was sent ends the match at
   * that point and the whole prompt behind it is written afresh. The cost of
   * keeping it is one copy of the program per turn of history, read at a
   * fraction of an input token; the cost of not keeping it is the entire prefix,
   * rewritten on every turn from the second onward.
   */
  sentContent?: string;
  /**
   * A screen was shown with this turn, but its image is gone: set on a turn
   * restored from storage, where the marker was kept and the bytes were not.
   */
  screenShown?: boolean;
  /**
   * What the assistant did to the machine to reach the screen shown with this
   * turn - set only where driving actually sent input.
   *
   * Absent where it only waited and looked, because nothing then happened that
   * the user could not have seen for themselves. An unexplained screen reads as
   * the IDE having done something odd rather than as the assistant having tried
   * the program.
   */
  drivingNote?: string;
  /** True while the assistant answer is still arriving. */
  streaming?: boolean;
  /** True for a truncated answer (stopped, or cut off by the output limit). */
  incomplete?: boolean;
  /**
   * Why {@link incomplete} was set, when it is known.
   *
   * Deliberately alongside `incomplete` rather than replacing it: every existing
   * consumer asks only "is this finished" - the run check, the judgement settling,
   * the apply actions - and none of them should have to learn three answers to
   * keep working. Only the panel's wording and the offer to continue read this.
   *
   * Covers the three ways an answer ends inside a live session. The fourth - the
   * page going away mid-stream - is {@link interrupted}, which is a different
   * thing in a way that matters here: it is the only one that survives a reload,
   * because it is the only one that can be *observed* after one. Absent on a
   * complete answer, and on one restored from storage.
   */
  cutOff?: CutOffReason;
  /**
   * True for an answer the page went away from mid-stream, restored from
   * storage. Narrower than `incomplete`, which also covers Stop and the output
   * limit: nothing interrupted those, so only this one is worth offering to ask
   * again.
   *
   * Persisted, unlike {@link cutOff}, which cannot be observed after a reload.
   */
  interrupted?: boolean;
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
  /**
   * How long the answer may be, and how hard to think first - both resolved by
   * `resolveAiTuning`, never read from the dialect. Spread it in rather than
   * setting `maxTokens` alone, or the effort is silently dropped.
   */
  maxTokens: number;
  effort?: AiEffort;
  system: string;
  /**
   * How to run a tool the assistant calls, for the turn that has been given the
   * machine. Absent on every other turn, which answers a call with a refusal
   * instead (see {@link refuseUngivenMachine}).
   *
   * Not paired with a tool list: which tools a request offers is a property of
   * the conversation's provider and is resolved by {@link AiState.send}, so a
   * caller cannot make one turn's offering differ from the next's.
   */
  runTool?: ToolRunner;
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
  /**
   * Resume a cut-off answer rather than starting a fresh one.
   *
   * The reply is joined onto this partial and takes its place as one answer, so
   * everything downstream - block extraction, the run check, staleness - sees a
   * single complete answer and needs to know nothing about continuation.
   */
  continueFrom?: PartialProgram;
  /**
   * The fingerprint the joined answer should carry, which is the one the *original*
   * answer carried. Staleness asks whether the user has moved on since the answer
   * was written, and it was written before the interruption - taking a fresh
   * fingerprint here would silently forgive an edit made in between.
   */
  baseFingerprintOverride?: string;
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
  /**
   * Pick up the last answer where its output limit stopped it.
   *
   * Resolves its own provider/prompt the way the unattended paths do, because the
   * offer is made from a message rather than from the composer - there is no
   * request in flight to inherit from.
   */
  continueLastAnswer(): void;
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
 * What to tell the user about the machine having been driven, held until the
 * finished work is shown so it lands with the screen it explains.
 *
 * Empty whenever the assistant only waited and looked, which is the ordinary
 * case and says nothing.
 */
let pendingDriveNote = '';

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
 *
 * What each turn sent is kept, though, and it earns its room. The largest
 * bundled sample is 3.6 KB and nine in ten are under 2.5 KB, so a dozen turns
 * carrying one costs some tens of kilobytes against a budget of megabytes -
 * where dropping it would restore a thread that replays its own history
 * differently from how it was sent, which is the whole defect this field
 * exists to prevent, reintroduced by a reload.
 */
function persist(messages: DisplayMessage[]): void {
  saveAiConversation(
    messages
      .filter((m) => !(m.streaming && m.content === ''))
      .map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.sentContent ? { sentContent: m.sentContent } : {}),
        ...(m.streaming || m.incomplete ? { incomplete: true } : {}),
        // Still streaming as it was written means the page went away with the
        // answer half-arrived - the only way to be sure, and it needs no
        // pagehide/visibilitychange listener (a tab the OS discards fires
        // neither). Every finalize path clears `streaming` before persisting,
        // so a stopped or completed answer can never pick this up.
        ...(m.streaming || m.interrupted ? { interrupted: true } : {}),
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
    effort,
    system,
    runTool,
    userContent,
    displayRequest,
    image,
    baseSource,
    automatic,
    checkAgainst,
    judging,
    skipCheck,
    continueFrom,
    baseFingerprintOverride,
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
    const baseFingerprint =
      baseFingerprintOverride ?? sourceFingerprint(baseSource);
    const prior = get().messages;
    /** What this turn says on the wire, as against what the panel shows. */
    const sentContent = note ? `${note}\n\n${userContent}` : userContent;
    // History for the API: prior turns as they were sent + the new request.
    // Every earlier turn is replayed byte-for-byte - `sentContent` where it has
    // one, `content` where the two are the same - because the provider's cache
    // matches from the front and stops at the first difference. A screen shown
    // with an earlier turn stays on it for the same reason, and reads for a
    // fraction of what rewriting the prefix would cost.
    const baseHistory: ChatMessage[] = [
      ...prior.map(({ role, content, sentContent: sent, image: was }) => ({
        role,
        content: sent ?? content,
        ...(was ? { image: was } : {}),
      })),
      {
        role: 'user',
        content: sentContent,
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
          ...(sentContent === displayRequest ? {} : { sentContent }),
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

    // The same tools on every turn of the conversation, or none at all on a
    // backend that cannot be given them. Tool definitions render ahead of the
    // system prompt, so a set that appeared on the turns that drive and
    // vanished on the rest would invalidate everything behind it - the prompt
    // and the whole thread - on every turn following a drive.
    //
    // Offering a tool is not granting the machine: `runTool` is supplied only by
    // the turn that holds one, and every other turn answers a call with a
    // refusal rather than acting on an emulator nobody handed over.
    const tools = getProvider(providerId).supportsTools
      ? driveToolDefinitions()
      : undefined;

    // Stream one attempt into the trailing placeholder, resolving to its final
    // text. Reused verbatim for the empty-reply reformat retry below; the
    // `myGen`/`gen` guards make late deltas/completions from a superseded stream
    // no-ops just as before.
    let lastPersist = 0;
    const runAttempt = (history: ChatMessage[]): Promise<StreamResult> => {
      const handle = streamChat(
        providerId,
        {
          apiKey,
          model,
          maxTokens,
          effort,
          system,
          messages: history,
          ...(tools?.length ? { tools } : {}),
        },
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
        runTool ?? refuseUngivenMachine,
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

      // Out of room before a word was written: the whole budget went to thinking.
      // Checked ahead of the empty-reply branch below, which would otherwise read
      // this as a formatting mistake and spend a second request nudging the
      // format - against a longer history and the same ceiling, so it fails the
      // same way. The budget is the thing to change, and saying so is the help.
      if (result.stop === 'truncated' && result.text.trim() === '') {
        set((s) => ({
          messages: s.messages.filter(
            (m) => !(m.streaming && m.content === ''),
          ),
          busy: false,
          error:
            'The AI ran out of room before it wrote anything - its whole answer ' +
            'went on thinking. Raise the answer length, or lower the thinking ' +
            'effort, in AI settings.',
        }));
        persist(get().messages);
        return;
      }

      // An empty reply renders as a blank bubble. Re-request once with a format
      // nudge before giving up. Only a truly empty reply retries - legitimate
      // prose answers are left alone.
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

      // A continuation replaces the partial rather than sitting beside it: the
      // joined text becomes this reply's content, so the last message is a whole
      // answer like any other.
      const answerText = continueFrom
        ? stitchContinuation(continueFrom, result.text)
        : result.text;

      set((s) => {
        const copy = [...s.messages];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: answerText,
          baseFingerprint,
          // Cut off by the output limit: the code in it stops mid-thought, so
          // it must not be offered as a finished answer to apply. It can be
          // continued, though, which is why the reason travels with it.
          ...(result.stop === 'truncated'
            ? { incomplete: true, cutOff: 'outOfRoom' as const }
            : {}),
        };
        return { messages: copy, busy: false };
      });
      persist(get().messages);
      // The answer is complete: run it and see how it goes, before the user is
      // asked to decide anything about it.
      if (!skipCheck) checkLatestAnswer(checkAgainst ?? baseSource, baseSource);
    } catch (e) {
      if (gen !== myGen) return; // reset already cleared the thread
      // An abort that reaches here is the user's Stop: `reset` also aborts, but
      // bumps `gen` first, so its aborts return above. Anything else is the
      // transport giving up, which is a different thing to tell them.
      const reason: CutOffReason =
        e instanceof Error && e.name === 'AbortError' ? 'stopped' : 'failed';
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
                  cutOff: reason,
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

  continueLastAnswer: () => {
    const state = get();
    if (state.busy) return;
    const last = state.messages[state.messages.length - 1];
    if (!last || last.role !== 'assistant' || last.cutOff !== 'outOfRoom')
      return;

    const partial = readPartialProgram(last.content);
    if (!partial) return; // stopped too early to have anything to resume

    const context = resolveRequestContext();
    if (context === null) return;
    const { dialect, ...request } = context;
    void loadSystemPromptFor(dialect, context.providerId).then((system) =>
      useAiStore.getState().send({
        ...request,
        system,
        userContent: buildContinuationRequest(partial),
        displayRequest: 'Continue the answer',
        // The program this answer was written against - unchanged, so the joined
        // answer is judged stale on the same terms the original would have been.
        baseSource: useIdeStore.getState().source,
        baseFingerprintOverride: last.baseFingerprint,
        continueFrom: partial,
      }),
    );
  },

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
function resolveRequestContext():
  | ({
      providerId: ReturnType<typeof getAiProvider>;
      apiKey: string;
      model: string;
      /** The machine to build the system prompt for; see {@link loadSystemPrompt}. */
      dialect: Dialect;
    } & AiTuning)
  | null {
  const providerId = getAiProvider();
  const apiKey = getProviderApiKey(providerId);
  if (!apiKey) return null;
  const { dialect } = useIdeStore.getState();
  return {
    providerId,
    apiKey,
    model: getProvider(providerId).defaultModel,
    // The same resolution the panel uses. These requests are the ones nobody is
    // watching, so they must not drift onto a different budget from the visible
    // ones - that drift is how a correction ends up cut off unnoticed.
    ...resolveAiTuning(providerId),
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
  /**
   * The display to show it, where there is one. Absent for a turn made only to
   * drive: what that turn needs is the machine, not a picture of it.
   */
  screen: ChatImage | undefined,
  context: NonNullable<ReturnType<typeof resolveRequestContext>>,
  /** Whether the assistant asked to be given the machine for this answer. */
  drive: boolean,
): void {
  const ai = useAiStore.getState();
  const visuals = results
    .map((r) => r.expectation)
    .filter((e) => e.kind === 'visual');
  const judge = buildScreenJudgeRequest(ranSource, visuals);
  const { dialect, ...request } = context;

  // The turn that judges the screen is also the only turn where driving is
  // meaningful: the program is loaded, the machine is up, and the screen has
  // been captured. The answering turn cannot drive - the program did not exist
  // yet, let alone run - and a third turn would need a second set of rules for
  // when it happens.
  const driving = armDriving(drive);

  // Told about driving on the same terms as every other turn - a property of
  // the provider, not of whether this particular answer asked. The prompt sits
  // in the cached prefix, so describing it only on the turns that drive would
  // cost a cache write on every turn after one of them.
  settleJudgingTurn(
    driving,
    loadSystemPromptFor(dialect, context.providerId).then((system) =>
      ai.send({
        ...request,
        system,
        ...(driving ? { runTool: driving.runTool } : {}),
        userContent: judge.userContent,
        displayRequest: judge.displayRequest,
        ...(screen ? { image: screen } : {}),
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
    ),
    () => settleJudgement(outcome, ranSource, stalenessBase, results),
    () => abandonJudgement(outcome, results, 'the judgement could not be made'),
  );
}

/**
 * Hand the machine back when a judging turn ends, however it ended.
 *
 * `finish()` has to run on both paths, and that is the whole reason this exists.
 * A machine left frozen outlives the turn that froze it: the pane's loop bails
 * on every tick, so the user's own run shows their program and never advances a
 * frame. `send` catches its own transport failures, so the rejection guarded
 * here is the turn never leaving the ground at all - a system prompt that could
 * not be loaded, say - which is exactly the case where nothing else would ever
 * release the machine.
 *
 * Two handlers rather than a trailing `.catch`, and not `.finally`, because
 * only this form makes "the reply arrived" and "the turn never happened"
 * exclusive: a `.catch` after the success handler would run `finish()` a second
 * time whenever `judged` itself threw, and `.finally` would let `judged` run on
 * the rejected path.
 *
 * And `abandoned` deliberately does not judge. On a rejection no reply was ever
 * appended, so the last message in the thread is the answer being judged -
 * complete, non-empty, not streaming. Reading a verdict out of that would apply
 * one the assistant never gave, and a `FAIL` read that way would spend a
 * correction attempt and start another run.
 *
 * Exported for its own tests: the ordering and the exclusivity are the whole
 * rule, and reaching them through a streamed turn would test the mocking.
 */
export function settleJudgingTurn(
  driving: { finish: () => void } | null,
  turn: Promise<unknown>,
  judged: () => void,
  abandoned: () => void,
): void {
  void turn.then(
    () => {
      driving?.finish();
      judged();
    },
    () => {
      driving?.finish();
      abandoned();
    },
  );
}

/**
 * Everything the driving turn needs, or null when there is no driving to do.
 *
 * Null whenever any one of the three conditions fails - the assistant did not
 * ask, the chosen provider cannot be given tools, or there is no machine up to
 * drive. In each case the turn is exactly the judging turn it has always been,
 * which is what makes this safe to reach on every checked answer.
 *
 * What this arms is the machine, not the tools: those are offered on every turn
 * (see {@link AiState.send}), and a turn that arms nothing answers a call with a
 * refusal. This is the one gate that decides whether the assistant may actually
 * act on the emulator.
 *
 * Exported for its own tests: the three gates are the whole safety story, and
 * reaching them through a streamed turn would test the mocking rather than the
 * rule.
 */
export function armDriving(asked: boolean): {
  runTool: ToolRunner;
  finish: () => void;
} | null {
  if (!asked) return null;
  if (!getProvider(getAiProvider()).supportsTools) return null;
  const control = machineControl();
  if (!control) return null;

  const reports: DriveReport[] = [];
  freezeMachine(true);

  return {
    runTool: async (call) => {
      // The machine may have moved on since this turn was armed: a run the user
      // started registers a new driver over this one. This turn's reference goes
      // on working regardless - it closes over the machine - so without asking,
      // it would type into whatever program the user has since loaded, and
      // describe that program's screen as though it were its own.
      //
      // Reported rather than thrown, on the same terms as a tool that does not
      // exist: the assistant keeps everything it did before, and can say in its
      // reply that the machine was taken away rather than losing the turn.
      if (!ownsMachine(control)) {
        return {
          callId: call.id,
          content:
            'the machine is no longer yours to drive - the user started a run of their own',
          isError: true,
        };
      }
      if (call.name === LOOK_TOOL) {
        return { callId: call.id, content: describeScreen(control) };
      }
      if (call.name !== DRIVE_TOOL) {
        // Reported rather than thrown, so the assistant can pick a tool that
        // exists instead of losing everything it did before the mistake.
        return {
          callId: call.id,
          content: `there is no tool called "${call.name}"`,
          isError: true,
        };
      }
      const script = String(call.input.script ?? '');
      const report = runDriveScript(control, parseDriveScript(script));
      reports.push(report);
      return {
        callId: call.id,
        content: `${report.lines.join('\n')}\n\n${describeScreen(control)}`,
        // An action that could not be carried out is the driving failing, not
        // the program: flagged so the assistant corrects its driving rather
        // than rewriting code that may be perfectly correct.
        ...(report.ok ? {} : { isError: true }),
      };
    },
    finish: () => {
      // Only where this turn still owns the machine: after a Stop the machine
      // behind that driver has been disposed, and after a run the user started
      // the keys held are somebody else's. The thaw below is unconditional for
      // the opposite reason - the freeze is the thing that strands a machine, so
      // a thaw that could be skipped is exactly how one gets stranded.
      if (ownsMachine(control)) control.releaseAll();
      freezeMachine(false);
      // Said only where input actually reached the machine. Waiting and looking
      // change nothing the user could not have seen themselves, where a
      // keypress produces a screen they cannot otherwise account for.
      pendingDriveNote = describeDriving(reports);
    },
  };
}

/**
 * Finish the work with nothing judged: the run reported, its expectations left
 * unchecked with `why`, and the screen shown to the user regardless.
 *
 * The screen is the point. Whatever became of the judgement, the program ran and
 * drew something, and that is the user's to see - a judgement that could not be
 * made is a reason to say nothing about the program, not a reason to withhold
 * what it did.
 */
function abandonJudgement(
  outcome: AiRunOutcome,
  results: readonly ExpectationResult[],
  why: string,
): void {
  pendingRunNote = buildRunNote(outcome, leaveUnjudged(results, why));
  showFinishedWork(latestFinalScreen ?? undefined);
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
    abandonJudgement(outcome, results, 'the judgement did not finish');
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
    // Asked again here, and not only where this turn was dispatched, because
    // this is the one stage with a user in the middle of it: the judgement is
    // seconds of network and tool calls, and applying an answer and running it
    // is exactly what the user does while reading the reply it is judging. A
    // check started now would seize the machine they just started, to run a
    // program they have already moved past.
    //
    // The correction is not lost by declining - it is in the thread, with its
    // apply buttons, for the user to take when they want it. What is refused is
    // only the IDE acting on it unasked.
    if (hasMovedOn(stalenessBase, useIdeStore.getState().source)) {
      pendingRunNote = buildRunNote(outcome, judged);
      showFinishedWork(latestFinalScreen ?? undefined);
      return;
    }
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
 * Checking happens before the answer reaches the editor, so a program that
 * needs two corrections is never left sitting broken in the user's document.
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
  const drivingNote = pendingDriveNote;
  pendingDriveNote = '';
  if (!screen) return;
  useAiStore.setState((s) => {
    const last = s.messages[s.messages.length - 1];
    if (!last || last.role !== 'assistant') return s;
    const copy = [...s.messages];
    copy[copy.length - 1] = {
      ...last,
      finalScreen: screen,
      // Lands with the screen it explains rather than as a turn of its own:
      // what the user needs is to be able to account for what they are
      // looking at, not a running commentary on the checking machinery.
      ...(drivingNote ? { drivingNote } : {}),
    };
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
  const edited = hasMovedOn(stalenessBase, state.source);
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
  void loadSystemPromptFor(dialect, context.providerId).then((system) =>
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
  // they have already moved on from. See {@link hasMovedOn} for why the
  // comparison is against the program the answer was WRITTEN against rather than
  // the one that ran - the same rule guards the judging turn's own correction,
  // which is asked a second time because the user can move on while it is in
  // flight.
  const edited = hasMovedOn(run.baseSource, state.source);
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
  // Driving is the other reason to make this turn, and it stands on its own:
  // an answer may need the machine worked before there is anything worth
  // saying about it, without ever having stated how the screen should look.
  // Only where it can actually happen, though - a turn made for driving that
  // then could not drive would be a request asking nothing.
  const drivingPossible =
    run.views.drive &&
    context !== null &&
    getProvider(context.providerId).supportsTools &&
    hasMachineControl();

  if (
    run.outcome.kind !== 'errored' &&
    !wrongResult &&
    (visuals.length > 0 || drivingPossible)
  ) {
    const blocked =
      // A screen is required only by an expectation that needs looking at.
      // Driving needs the machine, not a picture of it, and asking for the
      // screen as text is answered without one.
      visuals.length > 0 && screen === undefined
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
      screen,
      context!,
      run.views.drive,
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
  void loadSystemPromptFor(dialect, context.providerId).then((system) =>
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
