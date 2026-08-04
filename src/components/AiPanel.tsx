import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { useOnline } from '../app/useOnline';
import {
  unsentScreen,
  useAiStore,
  type CutOffReason,
  type DisplayMessage,
} from '../ai/aiStore';
import {
  loadSystemPrompt,
  buildUserMessage,
  buildEditorFix,
} from '../ai/promptBuilder';
import {
  classifyBlock,
  extractCodeBlocks,
  isApplicableBlock,
  isProtocolBlock,
  mergeBasicLines,
  mergePlan,
  type CodeBlock,
  type MergeRow,
} from '../ai/codeExtractor';
import { sourceFingerprint } from '../ai/sourceFingerprint';
import { getAiProvider, getProviderApiKey } from '../storage/settings';
import { getProvider } from '../ai/providers/registry';
import { resolveAiTuning } from '../ai/aiTuning';
import { GearsSpinner } from './GearsSpinner';
import styles from './AiPanel.module.css';

/**
 * Whether the program has moved on since this answer was written. A reply
 * stored before the base was recorded has no fingerprint - an unknown base,
 * which raises nothing rather than warning on every old thread.
 */
function staleAgainst(msg: DisplayMessage, source: string): boolean {
  return (
    msg.baseFingerprint !== undefined &&
    msg.baseFingerprint !== sourceFingerprint(source)
  );
}

/**
 * What the composer answers itself instead of asking the provider.
 *
 * Two exact strings rather than a prefix parser: a message that merely starts
 * with a slash is a request like any other, and the whole point of these is to
 * be reachable when the assistant is busy or unconfigured - which argues for as
 * little machinery in front of them as possible.
 */
const COMMANDS = ['/clear', '/hide'] as const;
type Command = (typeof COMMANDS)[number];

function asCommand(text: string): Command | null {
  const candidate = text.trim().toLowerCase();
  return COMMANDS.includes(candidate as Command)
    ? (candidate as Command)
    : null;
}

/** Unchanged lines kept either side of a change, for orientation. */
const DIFF_CONTEXT_LINES = 2;

type DiffEntry = MergeRow | { collapsed: number };

/**
 * Keep every change plus a little context around it, collapsing the untouched
 * stretches between. A small edit to a long program is otherwise mostly
 * scrolling.
 */
function withCollapsedContext(rows: MergeRow[]): DiffEntry[] {
  const keep = new Set<number>();
  rows.forEach((row, i) => {
    if (row.kind === 'context') return;
    for (let j = i - DIFF_CONTEXT_LINES; j <= i + DIFF_CONTEXT_LINES; j++) {
      if (j >= 0 && j < rows.length) keep.add(j);
    }
  });

  const out: DiffEntry[] = [];
  let hidden = 0;
  rows.forEach((row, i) => {
    if (!keep.has(i)) {
      hidden++;
      return;
    }
    if (hidden > 0) {
      out.push({ collapsed: hidden });
      hidden = 0;
    }
    out.push(row);
  });
  if (hidden > 0) out.push({ collapsed: hidden });
  return out;
}

/**
 * What merging this fragment would do to the current program, inline. Built
 * from the same plan the merge itself uses, so it cannot show one thing and
 * apply another - and computed against the *current* editor content, so a
 * fragment written against an older program visibly makes no sense.
 */
function MergeDiff({ rows }: { rows: MergeRow[] }) {
  if (!rows.some((row) => row.kind !== 'context')) {
    return (
      <div className={styles.aiDiffEmpty}>
        This changes nothing in the current program.
      </div>
    );
  }
  return (
    <div className={styles.aiDiff}>
      {withCollapsedContext(rows).map((entry, i) => {
        if ('collapsed' in entry) {
          return (
            <div key={i} className={styles.aiDiffSkip}>
              {`⋮ ${entry.collapsed} unchanged line${entry.collapsed === 1 ? '' : 's'}`}
            </div>
          );
        }
        return (
          <Fragment key={i}>
            {(entry.kind === 'removed' || entry.kind === 'changed') && (
              <div
                className={`${styles.aiDiffRow} ${styles.aiDiffRemoved}`}
                aria-label={`removed: ${entry.before}`}
              >
                <span aria-hidden="true">{'- '}</span>
                {entry.before}
              </div>
            )}
            {(entry.kind === 'added' || entry.kind === 'changed') && (
              <div
                className={`${styles.aiDiffRow} ${styles.aiDiffAdded}`}
                aria-label={`added: ${entry.text}`}
              >
                <span aria-hidden="true">{'+ '}</span>
                {entry.text}
              </div>
            )}
            {entry.kind === 'context' && (
              <div className={styles.aiDiffRow}>
                <span aria-hidden="true">{'  '}</span>
                {entry.text}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * What to say about a code block that stops mid-program, and whether there is
 * anything to be done about it.
 *
 * One sentence for all three used to mean an answer that outgrew its budget read
 * as though the user had stopped it - and the advice, "ask again", threw the
 * partial away and re-ran into the same ceiling.
 */
function cutOffNote(
  reason: CutOffReason | undefined,
  interrupted: boolean,
): string | null {
  // The page going away is said on the message, next to the button that acts on
  // it - so saying it again in here would be the same news twice, each with its
  // own "ask again". The block still offers nothing to apply, which is the part
  // this note exists to explain.
  if (interrupted) return null;
  switch (reason) {
    case 'outOfRoom':
      return 'This answer hit its length limit, so the program is unfinished. Continue it below, or raise the answer length in AI settings.';
    case 'stopped':
      return 'You stopped this answer, so the program is unfinished.';
    case 'failed':
      return 'The connection dropped, so the program is unfinished - ask again to get the rest.';
    default:
      // A thread restored from storage keeps the flag and not the reason.
      return 'This answer was cut off, so the code is unfinished - ask again to get the rest.';
  }
}

/**
 * One generated code block with the actions that are valid for it. A fragment
 * merges, a whole listing replaces; when the two signals disagree the kind is
 * unknown and both are offered, because neither default is safe - replacing
 * with a fragment destroys the program, merging a listing leaves stale lines.
 */
function AiCodeBlock({
  block,
  source,
  stale,
  incomplete,
  cutOff,
  interrupted,
  onContinue,
  onApply,
}: {
  block: CodeBlock;
  source: string;
  stale: boolean;
  incomplete: boolean;
  cutOff?: CutOffReason;
  /** The page went away mid-stream; the message-level warning says so. */
  interrupted?: boolean;
  /** Present only when this answer can be picked up where it stopped. */
  onContinue?: () => void;
  onApply: (text: string, run: boolean) => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const kind = classifyBlock(block, source);
  // A whole listing replaces outright, so a stray bare number in it must not
  // read as a deletion.
  const allowDeletes = kind !== 'full';
  const rows = useMemo(
    () =>
      kind === 'full' ? null : mergePlan(source, block.code, { allowDeletes }),
    [kind, source, block.code, allowDeletes],
  );

  const merged = () => mergeBasicLines(source, block.code, { allowDeletes });
  const whole = () =>
    block.code.endsWith('\n') ? block.code : block.code + '\n';

  const canMerge = kind !== 'full';
  const canReplace = kind !== 'partial';
  const asDiff = rows !== null && !showRaw;
  const note = cutOffNote(cutOff, interrupted === true);

  return (
    <div className={styles.aiCode} data-block-kind={kind}>
      {asDiff ? <MergeDiff rows={rows} /> : <pre>{block.code}</pre>}
      {rows !== null && (
        <button
          className={`linklike ${styles.aiDiffToggle}`}
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? 'Show what this changes' : 'Show the lines as written'}
        </button>
      )}
      {incomplete ? (
        <>
          {note !== null && <div className={styles.aiBlockNote}>{note}</div>}
          {onContinue && (
            <div className={styles.aiCodeActions}>
              <button onClick={onContinue}>Continue this answer</button>
            </div>
          )}
        </>
      ) : (
        <>
          {kind === 'unknown' && (
            <div className={styles.aiBlockNote}>
              The assistant didn&rsquo;t say whether this is the whole program
              or only the changed lines. Check the changes above, then choose.
            </div>
          )}
          {stale && canMerge && (
            <div className={styles.aiBlockWarn}>
              You&rsquo;ve edited the program since this answer, so it may not
              apply as intended.
            </div>
          )}
          <div className={styles.aiCodeActions}>
            {canMerge && (
              <>
                <button
                  onClick={() => onApply(merged(), false)}
                  title="Merge by BASIC line number"
                >
                  Merge lines
                </button>
                <button onClick={() => onApply(merged(), true)}>
                  Merge + Run ▶
                </button>
              </>
            )}
            {canReplace && (
              <>
                <button
                  onClick={() => onApply(whole(), false)}
                  title="Replace the whole program"
                >
                  Replace program
                </button>
                <button onClick={() => onApply(whole(), true)}>
                  Replace + Run ▶
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function AiPanel() {
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore((s) => s.source);
  const replaceDocument = useIdeStore((s) => s.replaceDocument);
  const requestRun = useIdeStore((s) => s.requestRun);
  const showAiPanel = useIdeStore((s) => s.showAiPanel);
  const showEmulator = useIdeStore((s) => s.showEmulator);
  const openSettings = useIdeStore((s) => s.openSettings);

  // The conversation and the in-flight stream live in a module-level store, so
  // they survive this panel unmounting (e.g. toggled closed mid-stream).
  const messages = useAiStore((s) => s.messages);
  const busy = useAiStore((s) => s.busy);
  const error = useAiStore((s) => s.error);
  const pendingFix = useAiStore((s) => s.pendingFix);

  // The AI providers all require the network; there is no offline fallback, so
  // when the browser goes offline we block sending and tell the user in-panel.
  const online = useOnline();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // The screen the thread is already showing - the machine's own display from
  // the last answer the IDE ran and checked - goes with the next request. It is
  // the picture the user is looking at while they type, so nothing is captured
  // again to answer them, and it travels once (see unsentScreen).
  const threadScreen = useAiStore((s) => unsentScreen(s.messages));

  // Keep the thread scrolled to the newest content as it streams or on remount.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /**
   * Run a composer command. `/clear` is the way out of a conversation that has
   * gone wrong, so it reuses the reset that a new program already performs -
   * abort, ignore whatever the abandoned stream still says, and take the stored
   * thread with it.
   *
   * `/hide` goes through showEmulator() rather than the toolbar's own panel
   * toggle: that toggle flips the split layout's panel flag only, which does
   * nothing in the tabbed layout, where the panel is mounted whenever the layout
   * is tabbed and it is the selected tab that decides what is seen. This closes
   * it on both, and touches layout state only - the conversation is preserved
   * because nothing here goes near it.
   */
  const runCommand = (command: Command) => {
    switch (command) {
      case '/clear':
        useAiStore.getState().reset();
        return;
      case '/hide':
        showEmulator();
        return;
    }
  };

  /**
   * Put a request. Defaults to the composer's contents; `text` is passed when
   * the thread itself offers to ask something again, in which case whatever the
   * user has since typed is left alone.
   */
  const send = async (text?: string) => {
    const fromComposer = text === undefined;
    const request = (text ?? input).trim();
    // Before the guards below, deliberately: a command has to work precisely
    // when the assistant is busy, offline or was never given a key - which is
    // when the user most wants one.
    const command = fromComposer ? asCommand(request) : null;
    if (command) {
      setInput('');
      runCommand(command);
      return;
    }
    if (request === '' || busy || !online) return;
    const providerId = getAiProvider();
    const provider = getProvider(providerId);
    const apiKey = getProviderApiKey(providerId);
    if (!apiKey) {
      openSettings('ai');
      return;
    }
    if (fromComposer) setInput('');
    const screen = provider.acceptsImages ? threadScreen : null;
    const errors = dialect.lint(source);
    void useAiStore.getState().send({
      providerId,
      apiKey,
      model: provider.defaultModel,
      ...resolveAiTuning(providerId),
      system: await loadSystemPrompt(dialect, provider.acceptsImages),
      userContent: buildUserMessage(request, source, errors, screen !== null),
      displayRequest: request,
      ...(screen ? { image: screen } : {}),
      baseSource: source,
    });
  };

  const stop = () => useAiStore.getState().stop();

  // After applying AI code, immediately re-lint the new program. Any remaining
  // tokenizer errors become a one-tap fix prompt (and surface the panel).
  // Returns whether the new text has editor errors.
  const checkEditorErrors = (text: string): boolean => {
    const errors = dialect.lint(text);
    if (errors.length > 0) {
      useAiStore.getState().setPendingFix(buildEditorFix(text, errors));
      showAiPanel();
      return true;
    }
    useAiStore.getState().clearPendingFix();
    return false;
  };

  /**
   * Land already-resolved program text in the editor. The block decides whether
   * that text came from replacing or merging; this only cares about running it
   * afterwards.
   *
   * On "+ Run": apply, then either prompt to fix editor errors (the program
   * can't run with them) or reveal the emulator and run it. An ordinary run -
   * the answer was already run and checked when it arrived, so there is nothing
   * here to arm. showEmulator() is what actually swaps the AI view for the
   * emulator - on the split layout it closes the AI panel (which otherwise hides
   * the preview), and in the tabbed layout it switches to the preview tab (the
   * run-request auto-switch only covers portrait, not the split/landscape cases).
   */
  const applyText = (text: string, run: boolean) => {
    replaceDocument(text);
    if (!checkEditorErrors(text) && run) {
      showEmulator();
      requestRun();
    }
  };

  // Accept a one-tap fix: send it to Claude, continuing the conversation.
  const sendFix = async () => {
    const fix = useAiStore.getState().pendingFix;
    if (!fix || busy || !online) return;
    const providerId = getAiProvider();
    const provider = getProvider(providerId);
    const apiKey = getProviderApiKey(providerId);
    if (!apiKey) {
      openSettings('ai');
      return;
    }
    useAiStore.getState().clearPendingFix();
    void useAiStore.getState().send({
      providerId,
      apiKey,
      model: provider.defaultModel,
      ...resolveAiTuning(providerId),
      system: await loadSystemPrompt(dialect, provider.acceptsImages),
      userContent: fix.userContent,
      displayRequest: fix.displayRequest,
      baseSource: source,
    });
  };

  const renderMessage = (msg: DisplayMessage, idx: number) => {
    if (msg.role === 'user') {
      return (
        <div key={idx} className={`${styles.aiMsg} ${styles.aiUser}`}>
          {/* Which request carried the screen, said rather than shown again:
              the picture it carried is the one in the thread just above it, and
              two identical thumbnails a few lines apart read as two different
              screens. The same words serve a turn restored from storage, which
              kept the marker and not the pixels. */}
          {msg.image || msg.screenShown ? (
            <div className={styles.aiScreenNote}>Screen shown</div>
          ) : null}
          {msg.content}
        </div>
      );
    }
    const blocks = extractCodeBlocks(msg.content);
    // Render text with code blocks replaced by panels
    const parts: React.ReactNode[] = [];
    let rest = msg.content;
    blocks.forEach((block, bi) => {
      const fenceStart = rest.indexOf('```');
      if (fenceStart >= 0) {
        const before = rest.slice(0, fenceStart).trim();
        if (before) parts.push(<p key={`t${bi}`}>{before}</p>);
        const fenceEnd = rest.indexOf('```', fenceStart + 3);
        rest = fenceEnd >= 0 ? rest.slice(fenceEnd + 3) : '';
      }
      // What the answer states about its program, and the views it asks to be
      // shown, are addressed to the IDE and acted on by it. Printing them here
      // put the machinery in front of the user beside the answer, with nothing
      // for them to do about it - so they are read and not shown.
      if (isProtocolBlock(block)) return;
      // Only offer the apply actions once the whole answer is in - while
      // streaming the code is partial, so applying it would use a truncated
      // program. Rendering the block itself while streaming is fine.
      //
      // A verdict is shown but never offered: it is what the assistant made of
      // the screen its program drew, not program text, so there is nothing here
      // to land in the editor.
      parts.push(
        msg.streaming || !isApplicableBlock(block) ? (
          <div key={`c${bi}`} className={styles.aiCode}>
            <pre>{block.code}</pre>
          </div>
        ) : (
          <AiCodeBlock
            key={`c${bi}`}
            block={block}
            source={source}
            stale={staleAgainst(msg, source)}
            incomplete={msg.incomplete === true}
            cutOff={msg.cutOff}
            interrupted={msg.interrupted}
            // Only the newest answer can be resumed: continuing an older one
            // would graft its ending onto a conversation that has moved past it.
            onContinue={
              msg.cutOff === 'outOfRoom' &&
              idx === messages.length - 1 &&
              !busy &&
              online
                ? () => useAiStore.getState().continueLastAnswer()
                : undefined
            }
            onApply={applyText}
          />
        ),
      );
    });
    const tail = rest.trim();
    if (tail) parts.push(<p key="tail">{tail}</p>);
    // While the assistant is working, show a live busy indicator saying which
    // stage it is in (in place of the old static ellipsis, which read as
    // "stuck"). Not only while the text is arriving: the machine check and the
    // judgement both begin after the answer is complete, and without a word for
    // them the panel would fall silent for as long as the machine takes.
    if (msg.streaming || msg.checking) {
      // An automatic correction says so, so a reply nobody asked for never
      // looks like one the user did.
      const status = msg.checking
        ? `Checking it on the ${dialect.name}…`
        : msg.retrying
          ? 'Reformatting response…'
          : msg.judging
            ? 'Looking at the screen…'
            : msg.autoFix
              ? 'Fixing the failed run…'
              : msg.content.trim() === ''
                ? 'Thinking…'
                : 'Writing code…';
      parts.push(
        <div key="status" className={styles.aiStatus}>
          <GearsSpinner size={16} />
          <span>{status}</span>
        </div>,
      );
    }
    // The finished work, once the assistant has stopped working on this answer:
    // the machine's own screen, for the user to look at with their own eyes.
    // Shown however the answer turned out - an answer the assistant could not
    // settle is where a human look is worth most. The picture says what it is;
    // a caption under it would only be a line of text to skip past.
    if (msg.finalScreen) {
      parts.push(
        <figure key="final-screen" className={styles.aiFinalScreen}>
          <img
            src={`data:${msg.finalScreen.mediaType};base64,${msg.finalScreen.base64}`}
            alt={`The ${dialect.name} screen after running this program`}
          />
        </figure>,
      );
    }
    // An answer the page went away from mid-sentence. Said on the message and
    // not only inside a code block: prose comes first, so an answer interrupted
    // before it opened a fence has no block to carry the warning and would
    // otherwise read as a finished one.
    //
    // A stream cannot be picked up where it left off, so the offer is to put the
    // same request afresh. What did arrive stays above it - removing it would
    // read as though it never happened.
    if (msg.interrupted) {
      const asked = messages[idx - 1];
      parts.push(
        <div key="interrupted" className={styles.aiBlockWarn}>
          This answer stopped when the page went away.
          {asked?.role === 'user' && (
            <button
              className={`linklike ${styles.aiAskAgain}`}
              onClick={() => void send(asked.content)}
              disabled={busy || !online}
            >
              Ask again
            </button>
          )}
        </div>,
      );
    }
    // A reply that was nothing but blocks the IDE reads has nothing to show;
    // an empty bubble in the thread would read as an answer that came back
    // blank.
    if (parts.length === 0) return null;
    return (
      <div key={idx} className={`${styles.aiMsg} ${styles.aiAssistant}`}>
        {parts}
      </div>
    );
  };

  return (
    <div className={styles.aiPanel}>
      <div className={styles.aiHeader}>
        <strong>AI assistant</strong>
        <button className="linklike" onClick={() => openSettings('ai')}>
          key…
        </button>
      </div>
      <div className={styles.aiThread} ref={scrollRef}>
        {messages.length === 0 && (
          <div className={styles.aiHint}>
            Ask for a game and it lands in your editor. Try:
            <em> “write a breakout game”</em>, <em>“make the paddle faster”</em>
            ,<em> “fix the errors”</em>.
          </div>
        )}
        {messages.map(renderMessage)}
        {error && <div className={styles.aiError}>{error}</div>}
      </div>
      {pendingFix && (
        <div className={styles.aiFixNotice}>
          <span className={styles.aiFixSummary}>{pendingFix.summary}</span>
          <div className={styles.aiFixActions}>
            <button onClick={sendFix} disabled={busy || !online}>
              Fix these errors
            </button>
            <button
              className="linklike"
              onClick={() => useAiStore.getState().clearPendingFix()}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {!online && (
        <div className={styles.aiOffline}>
          You’re offline - the AI assistant needs an internet connection and is
          unavailable until you reconnect.
        </div>
      )}
      {messages.length > 0 && (
        <div className={styles.aiCommandHint}>
          <code>/clear</code> starts over · <code>/hide</code> closes this
        </div>
      )}
      <div className={styles.aiInput}>
        <textarea
          value={input}
          rows={2}
          disabled={!online}
          placeholder={
            online
              ? 'Describe the game or change you want…'
              : 'AI assistant unavailable while offline'
          }
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {busy ? (
          <button onClick={stop}>Stop</button>
        ) : (
          <button
            onClick={() => void send()}
            // A command is answered here rather than sent, so being offline is
            // no reason to refuse it.
            disabled={
              input.trim() === '' || (!online && asCommand(input) === null)
            }
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
