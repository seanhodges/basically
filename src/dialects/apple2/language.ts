// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/** Whether the interpreter strips spaces outside literals, as the Apple I's does. */
export const apple2Crunched = false;

export const apple2CompletionSource: CompletionSource = () => {
  throw new Error('apple2: not implemented');
};

export function apple2LanguageSupport(): Extension {
  throw new Error('apple2: not implemented');
}
