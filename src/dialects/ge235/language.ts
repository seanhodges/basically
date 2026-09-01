// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/** Completes nothing while the keyword table is empty. */
export const ge235CompletionSource: CompletionSource = () => null;

export function ge235LanguageSupport(): Extension {
  throw new Error('ge235: not implemented');
}
