// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it, expect, beforeEach } from 'vitest';
import { dialects } from '../dialects/registry';
import { useIdeStore, type EmulatorStatus } from './store';
import { dispatchShortcut } from './useGlobalShortcuts';

/** A machine with a line-level debugger, and one without. */
const DEBUGGABLE = dialects.find((d) => d.debuggable);
const PLAIN = dialects.find((d) => !d.debuggable);

/** Put the store on a machine, in a run state, with the counters at a mark. */
function given(debuggable: boolean, status: EmulatorStatus) {
  const dialect = debuggable ? DEBUGGABLE : PLAIN;
  if (!dialect) throw new Error('no such machine is registered');
  useIdeStore.setState({ dialect, emulatorStatus: status });
  const { pauseRequest, continueRequest } = useIdeStore.getState();
  return {
    /** How many pauses and continues the chord has asked for since. */
    asked: () => {
      const s = useIdeStore.getState();
      return {
        pauses: s.pauseRequest - pauseRequest,
        continues: s.continueRequest - continueRequest,
      };
    },
  };
}

describe('the pause/continue chord', () => {
  beforeEach(() => {
    useIdeStore.setState({ emulatorStatus: 'stopped' });
  });

  it('pauses a running program', () => {
    // The half this chord never had: before, a user watching a run had no key
    // that took a pause, only one that released a breakpoint.
    const run = given(true, 'running');
    expect(dispatchShortcut('run.continue')).toBe(true);
    expect(run.asked()).toEqual({ pauses: 1, continues: 0 });
  });

  it('continues a paused program', () => {
    const run = given(true, 'paused');
    expect(dispatchShortcut('run.continue')).toBe(true);
    expect(run.asked()).toEqual({ pauses: 0, continues: 1 });
  });

  it('takes and then releases a pause on the same key', () => {
    const run = given(true, 'running');
    dispatchShortcut('run.continue');
    // The run loop is what actually moves the machine, so stand in for the
    // pause it takes.
    useIdeStore.setState({ emulatorStatus: 'paused' });
    dispatchShortcut('run.continue');
    expect(run.asked()).toEqual({ pauses: 1, continues: 1 });
  });

  it('is refused on a machine with no line-level debugger', () => {
    // Pausing is offered only where continuing is: nothing on such a machine
    // would release the pause.
    for (const status of ['stopped', 'running', 'paused'] as const) {
      const run = given(false, status);
      expect(dispatchShortcut('run.continue')).toBe(false);
      expect(run.asked()).toEqual({ pauses: 0, continues: 0 });
    }
  });

  it('is refused while nothing is running, rather than starting a program', () => {
    // Play has its own chord; this one acts on a run that is under way.
    const run = given(true, 'stopped');
    const runs = useIdeStore.getState().runRequest;
    expect(dispatchShortcut('run.continue')).toBe(false);
    expect(run.asked()).toEqual({ pauses: 0, continues: 0 });
    expect(useIdeStore.getState().runRequest).toBe(runs);
  });
});
