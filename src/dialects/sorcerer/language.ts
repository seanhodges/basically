// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/**
 * Not implemented yet. Spaces outside strings, REM and DATA are eaten by this family's
 * scanner, so the language options set `crunched` and the dialect declares it.
 */
export const sorcererCrunched = true;

export function sorcererLanguageSupport(): Extension {
  throw new Error('sorcerer: language support not implemented');
}

export const sorcererCompletionSource: CompletionSource = () => {
  throw new Error('sorcerer: completion source not implemented');
};
