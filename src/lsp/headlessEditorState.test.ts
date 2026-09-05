// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The assumption the whole server rests on: the editor's own answers are
 * reachable from Node, unchanged, with no DOM. Proved here for three machines
 * with different keyword tables - one crunched (`commodore64`), one
 * uncrunched (`zx81`) and one with procedures (`bbcmicro`) - rather than
 * merely asserted in the proposal, so it cannot quietly stop being true.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { getDialect } from '../dialects/registry';
import {
  BASIC_REFERENCE_KINDS,
  referenceTokenAt,
} from '../editor/referenceRow';
import { operatorSpellings } from '../dialects/operators';
import { loadReferencePage } from '../ai/machineReference';
import { referencePageOf } from '../dialects/referencePage';
import { tableForMachine } from '../reference/compare';

const MACHINES = ['commodore64', 'zx81', 'bbcmicro'] as const;

describe('a headless EditorState answers what the browser editor answers', () => {
  it.each(MACHINES)(
    '%s: tokenAt, referenceTokenAt and completion agree',
    (id) => {
      const dialect = getDialect(id);
      const doc = '10 PRINT "HI"';
      const state = EditorState.create({
        doc,
        extensions: [dialect.languageSupport()],
      });
      const pos = doc.indexOf('PRINT');

      const token = referenceTokenAt(
        state,
        pos,
        BASIC_REFERENCE_KINDS,
        operatorSpellings(dialect),
      );
      expect(token?.text).toBe('PRINT');
      expect(token?.kind).toBe('keyword');

      const context = new CompletionContext(state, doc.indexOf('"HI"'), true);
      const result = dialect.completionSource(context);
      expect(result).not.toBeNull();
      expect(result!.options.length).toBeGreaterThan(0);
      expect(result!.options.some((o) => o.label === 'PRINT')).toBe(true);
    },
  );

  it.each(MACHINES)('%s: the reference page loads on demand', async (id) => {
    const dialect = getDialect(id);
    const page = await loadReferencePage(referencePageOf(dialect));
    expect(page).toBeDefined();
    const table = tableForMachine(page!, dialect.id);
    const row = table.entries.find((e) => e.name === 'PRINT');
    expect(row).toBeDefined();
    expect(row!.syntax.length).toBeGreaterThan(0);
    expect(row!.description.length).toBeGreaterThan(0);
  });
});
