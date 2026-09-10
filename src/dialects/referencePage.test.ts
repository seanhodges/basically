// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  PUBLIC_DOCS_BASE,
  referencePageOf,
  referenceTopicOf,
} from './referencePage';

describe('referenceTopicOf', () => {
  it('names the page the machine reads from', () => {
    expect(referenceTopicOf({ id: 'zx80' }, 'PRINT')).toBe(
      'reference/zx80?q=PRINT',
    );
  });

  it('names the shared page for a machine that shares one', () => {
    const sinclair = { id: 'zxspectrum128', docsReference: 'sinclair' };
    expect(referenceTopicOf(sinclair, 'BEEP')).toBe(
      'reference/sinclair?q=BEEP',
    );
    expect(referencePageOf(sinclair)).toBe('sinclair');
  });

  it('carries the keyword through exactly as written', () => {
    // The table matches on the short spellings too, so a keyword picked out of
    // a listing has to reach the search box in the form it was found in.
    expect(referenceTopicOf({ id: 'commodore64' }, '?')).toBe(
      'reference/commodore64?q=%3F',
    );
    expect(
      referenceTopicOf({ id: 'bbcmicro', docsReference: 'bbc' }, 'DEF PROC'),
    ).toBe('reference/bbc?q=DEF%20PROC');
  });

  it('offers no topic with no keyword to search for', () => {
    expect(referenceTopicOf({ id: 'zx81' }, '')).toBeNull();
  });

  it('resolves against the published documentation root', () => {
    // A reader outside the browser gets an absolute address; the topic itself
    // stays relative so the IDE can resolve it against its own mount.
    expect(
      `${PUBLIC_DOCS_BASE}${referenceTopicOf({ id: 'zx81', docsReference: 'sinclair' }, 'PRINT')}`,
    ).toBe('https://ba.sical.ly/docs/reference/sinclair?q=PRINT');
  });
});
