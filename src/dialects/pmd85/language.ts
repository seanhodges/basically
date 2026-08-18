// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/** CodeMirror highlighting + languageData for BASIC-G. */
export function pmd85LanguageSupport(): Extension {
  throw new Error('pmd85: not implemented');
}

export const pmd85CompletionSource: CompletionSource = () => {
  throw new Error('pmd85: not implemented');
};
