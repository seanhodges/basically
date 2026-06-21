import { useEffect, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { useAiStore, type DisplayMessage } from '../ai/aiStore';
import {
  buildSystemPrompt,
  buildUserMessage,
  buildEditorFix,
} from '../ai/promptBuilder';
import { extractCodeBlocks, mergeBasicLines } from '../ai/codeExtractor';
import { getApiKey } from '../storage/settings';
import styles from './AiPanel.module.css';

export function AiPanel() {
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore((s) => s.source);
  const replaceDocument = useIdeStore((s) => s.replaceDocument);
  const requestAiRun = useIdeStore((s) => s.requestAiRun);
  const showAiPanel = useIdeStore((s) => s.showAiPanel);
  const setSettingsOpen = useIdeStore((s) => s.setSettingsOpen);

  // The conversation and the in-flight stream live in a module-level store, so
  // they survive this panel unmounting (e.g. toggled closed mid-stream).
  const messages = useAiStore((s) => s.messages);
  const busy = useAiStore((s) => s.busy);
  const error = useAiStore((s) => s.error);
  const pendingFix = useAiStore((s) => s.pendingFix);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the thread scrolled to the newest content as it streams or on remount.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = () => {
    const request = input.trim();
    if (request === '' || busy) return;
    const apiKey = getApiKey();
    if (!apiKey) {
      setSettingsOpen(true);
      return;
    }
    setInput('');
    const errors = dialect.lint(source);
    void useAiStore.getState().send({
      apiKey,
      profile: dialect.aiProfile,
      system: buildSystemPrompt(dialect),
      userContent: buildUserMessage(request, source, errors),
      displayRequest: request,
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

  const applyReplace = (code: string) => {
    const text = code.endsWith('\n') ? code : code + '\n';
    replaceDocument(text);
    checkEditorErrors(text);
  };

  const applyMerge = (code: string) => {
    const text = mergeBasicLines(source, code);
    replaceDocument(text);
    checkEditorErrors(text);
  };

  // "Replace + Run": apply, then either prompt to fix editor errors (the program
  // can't run with them) or run with the AI runtime-error check armed.
  const applyReplaceAndRun = (code: string) => {
    const text = code.endsWith('\n') ? code : code + '\n';
    replaceDocument(text);
    if (!checkEditorErrors(text)) requestAiRun();
  };

  // Accept a one-tap fix: send it to Claude, continuing the conversation.
  const sendFix = () => {
    const fix = useAiStore.getState().pendingFix;
    if (!fix || busy) return;
    const apiKey = getApiKey();
    if (!apiKey) {
      setSettingsOpen(true);
      return;
    }
    useAiStore.getState().clearPendingFix();
    void useAiStore.getState().send({
      apiKey,
      profile: dialect.aiProfile,
      system: buildSystemPrompt(dialect),
      userContent: fix.userContent,
      displayRequest: fix.displayRequest,
    });
  };

  const renderMessage = (msg: DisplayMessage, idx: number) => {
    if (msg.role === 'user') {
      return (
        <div key={idx} className={`${styles.aiMsg} ${styles.aiUser}`}>
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
      parts.push(
        <div key={`c${bi}`} className={styles.aiCode}>
          <pre>{block.code}</pre>
          <div className={styles.aiCodeActions}>
            <button
              onClick={() => applyReplace(block.code)}
              title="Replace the whole program"
            >
              Replace program
            </button>
            <button
              onClick={() => applyMerge(block.code)}
              title="Merge by BASIC line number"
            >
              Merge lines
            </button>
            <button onClick={() => applyReplaceAndRun(block.code)}>
              Replace + Run ▶
            </button>
          </div>
        </div>,
      );
    });
    const tail = rest.trim();
    if (tail) parts.push(<p key="tail">{tail}</p>);
    if (parts.length === 0 && msg.streaming)
      parts.push(<p key="thinking">…</p>);
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
        <button className="linklike" onClick={() => setSettingsOpen(true)}>
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
            <button onClick={sendFix} disabled={busy}>
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
      <div className={styles.aiInput}>
        <textarea
          value={input}
          rows={2}
          placeholder="Describe the game or change you want…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        {busy ? (
          <button onClick={stop}>Stop</button>
        ) : (
          <button onClick={send} disabled={input.trim() === ''}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}
