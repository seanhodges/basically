import { describe, expect, it } from 'vitest';
import { assistantTools } from '../ai/driveTools';
import { PROVIDERS } from '../ai/providers/registry';
import {
  forgetMachineSession,
  registerMachineSession,
} from '../app/machineSession';
import { toolDefinitions } from './tools';
import { stubSession } from './testSupport';

/**
 * What every request offers as tools, pinned per provider.
 *
 * The definitions render ahead of the system prompt, so a provider's prompt
 * cache survives a conversation only if they are the same bytes on every
 * turn - whatever the machine is doing between them. Silent when broken: the
 * answers stay correct and the bill goes up, which is why this is a test in
 * the manner of the prompt-stability one rather than a comment.
 */

/**
 * The largest the rendered tool block may be, in characters. A measured
 * figure plus headroom: a new operation grows it, and says so here rather
 * than on a bill.
 */
const TOOL_BLOCK_CEILING = 9_000;

describe('the tool block', () => {
  it('is the same bytes across the turns of a conversation, per provider', () => {
    for (const provider of PROVIDERS.filter((p) => p.supportsTools)) {
      const turns: string[] = [];
      for (let turn = 0; turn < 10; turn++) {
        // A machine comes and goes between turns; the block must not notice.
        if (turn % 3 === 1) registerMachineSession(stubSession());
        else forgetMachineSession();
        turns.push(JSON.stringify(assistantTools()));
      }
      forgetMachineSession();
      expect(new Set(turns).size, provider.id).toBe(1);
    }
  });

  it('is rendered from the registry alone', () => {
    expect(JSON.stringify(assistantTools())).toBe(
      JSON.stringify(toolDefinitions()),
    );
  });

  it('stays under its ceiling', () => {
    expect(JSON.stringify(toolDefinitions()).length).toBeLessThan(
      TOOL_BLOCK_CEILING,
    );
  });

  it('carries no machine specifics, so one block serves every dialect', () => {
    // The per-machine part is the key names, and those live in the system
    // prompt, which is already a per-dialect constant.
    const json = JSON.stringify(toolDefinitions());
    for (const machineWord of ['ZX81', 'Spectrum', 'Commodore', 'KeyA']) {
      expect(json).not.toContain(machineWord);
    }
  });
});
