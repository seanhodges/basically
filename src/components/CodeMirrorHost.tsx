import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { lintGutter, lintKeymap } from '@codemirror/lint';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import type { Dialect } from '../dialects/types';
import { dialectLinter } from '../editor/lintIntegration';

interface Props {
  dialect: Dialect;
  /** Pushed into the editor whenever seq changes. */
  override: { text: string; seq: number };
  onChange(text: string): void;
}

export function CodeMirrorHost({ dialect, override, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastSeq = useRef(-1);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: override.text,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        autocompletion({ activateOnTyping: true }),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle),
        dialect.languageSupport(),
        dialectLinter(dialect),
        lintGutter(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...searchKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': { fontFamily: "'IBM Plex Mono', 'Fira Mono', monospace" },
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    lastSeq.current = override.seq;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor is rebuilt only when the dialect changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialect]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || override.seq === lastSeq.current) return;
    lastSeq.current = override.seq;
    if (view.state.doc.toString() !== override.text) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: override.text },
      });
    }
  }, [override]);

  return <div className="cm-host" ref={hostRef} />;
}
