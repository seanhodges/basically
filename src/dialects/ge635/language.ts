// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/**
 * The compiler deleted every blank outside a string literal as it read a line,
 * as the GE-235's did, so keyword matching is position-independent. Confirm
 * against the fourth edition before relying on it.
 */
export const ge635Crunched = true;

/** Keyword autocomplete. Not written yet. */
export const ge635CompletionSource: CompletionSource = () => null;

/** CodeMirror highlighting and languageData. Not written yet. */
export function ge635LanguageSupport(): Extension {
  throw new Error('ge635: language support not implemented');
}
