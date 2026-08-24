// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect, useRef, type RefObject } from 'react';
import { closeCompletion } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import { hideClickMenu } from '../editor/clickMenu';
import { useIdeStore } from './store';
import { editorPopupsRetired } from './surfaces';
import { useMediaQuery, MOBILE_QUERY } from './useMediaQuery';

/**
 * Take away the editor's transient popups - the completion list and the menu of
 * what a picked token can answer - when the user raises something over the
 * editor. Both are anchored to a caret the user has stopped looking at, so
 * whatever they just opened should be all that is left on screen.
 *
 * Which surfaces count is read from {@link ./surfaces}, so a dialog registered
 * later is covered without being named here. The on-screen input overlays are
 * excluded there, not by this hook: the keyboard is how the editor is typed into
 * and appears of its own accord when a pane takes focus, so it must not take
 * away the offer the user was reaching for.
 *
 * Acts on the rising edge rather than on the flag itself, because the
 * documentation drawer is half-width on desktop and leaves the editor usable
 * beside it: retiring while it merely *is* open would suppress the menu there
 * for as long as it stayed open. A popup raised beside an open surface is the
 * layering's job (src/styles.css), not this hook's.
 *
 * Mounted by both editors. `closeCompletion` is a no-op where autocompletion is
 * not mounted, so the assembly editor - which has the menu but no completion -
 * uses it unchanged.
 */
export function useRetireEditorPopups(
  viewRef: RefObject<EditorView | null>,
): void {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const retired = useIdeStore((s) => editorPopupsRetired(s, isMobile));
  const wasRetired = useRef(retired);

  useEffect(() => {
    const rising = retired && !wasRetired.current;
    wasRetired.current = retired;
    const view = viewRef.current;
    if (!rising || !view) return;
    closeCompletion(view);
    hideClickMenu(view);
  }, [retired, viewRef]);
}
