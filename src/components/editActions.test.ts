// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { editActionAvailable, type EditAction } from './editActions';
import type { ActiveTab } from '../app/store';

const BASIC: ActiveTab = { kind: 'basic' };
const SCRATCH: ActiveTab = { kind: 'scratch', id: 'scratch-1' };
const BLOCK: ActiveTab = { kind: 'block', id: 'block-border' };

const GENERAL: EditAction[] = [
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'find',
  'closeFind',
];
const BASIC_ONLY: EditAction[] = ['renumber', 'renumberFile', 'outline'];

describe('editActionAvailable', () => {
  it('offers the general actions on every editable tab', () => {
    for (const action of GENERAL) {
      for (const tab of [BASIC, SCRATCH, BLOCK]) {
        expect(editActionAvailable(action, tab)).toBe(true);
      }
    }
  });

  it('withholds the BASIC-only actions while a block is showing', () => {
    for (const action of BASIC_ONLY) {
      expect(editActionAvailable(action, BLOCK)).toBe(false);
    }
  });

  it('offers them on the program and on a scratch buffer, which hold BASIC', () => {
    for (const action of BASIC_ONLY) {
      expect(editActionAvailable(action, BASIC)).toBe(true);
      expect(editActionAvailable(action, SCRATCH)).toBe(true);
    }
  });
});
