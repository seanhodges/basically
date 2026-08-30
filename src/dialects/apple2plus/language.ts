// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/** Whether the interpreter strips spaces outside literals. */
export const apple2plusCrunched = false;

export const apple2plusCompletionSource: CompletionSource = () => {
  throw new Error('apple2plus: not implemented');
};

export function apple2plusLanguageSupport(): Extension {
  throw new Error('apple2plus: not implemented');
}
