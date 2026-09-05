import { describe, expect, it } from 'vitest';
import { RunError } from '../dialects/headless/runError';
import type { MachineSession } from '../app/machineSession';
import type { OpContext, Operation } from '../ops/types';
import { OPERATIONS } from '../ops/registry';
import { CallRefused, runOperation, type CallHost } from './ops';

/** A context holding nothing, as a caller with no machine up has. */
function context(session: MachineSession | null = null): OpContext {
  return { roms: { present: () => false }, session };
}

function host(ctx: OpContext = context(), held: CallHost['heldMachine'] = () => null): CallHost {
  return { context: () => ctx, heldMachine: held };
}

const reachesAll = () => true;

describe('dispatching a call', () => {
  it('refuses an operation nobody declares, in the words the caller uses', async () => {
    await expect(runOperation('teleport', {}, host(), reachesAll)).rejects.toThrow(
      'there is no operation called "teleport"',
    );
    await expect(
      runOperation('teleport', {}, host(), reachesAll, 'tool'),
    ).rejects.toThrow('there is no tool called "teleport"');
  });

  it('refuses an operation this caller does not reach, though it exists', async () => {
    await expect(runOperation('lint', {}, host(), () => false)).rejects.toThrow(
      /no operation called "lint"/,
    );
  });

  it('refuses an input that does not fit the schema, before running anything', async () => {
    // `machine` is required and must be a string; a number is the caller's
    // mistake, and is caught without the operation being entered.
    await expect(
      runOperation('info', { machine: 7 }, host(), reachesAll),
    ).rejects.toThrow(/machine must be a string/);
  });

  it('says how to get a machine when one is needed and none is up', async () => {
    const needsSession = OPERATIONS.filter((op) => op.needs === 'session');
    expect(needsSession.length).toBeGreaterThan(0);
    for (const op of needsSession) {
      await expect(runOperation(op.name, {}, host(), reachesAll)).rejects.toThrow(
        /No machine is up/,
      );
    }
  });

  it('marks which failure a refusal is, so an exit code is not re-derived', async () => {
    const error = await runOperation('teleport', {}, host(), reachesAll).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(CallRefused);
    expect((error as CallRefused).failure).toBe('request');
  });

  it("turns an operation's own RunError into a refusal rather than a dead host", async () => {
    // `info` raises RunError for a machine that is not registered; the host has
    // to go on serving afterwards, so it must not escape as a throw.
    await expect(
      runOperation('info', { machine: 'pdp11' }, host(), reachesAll),
    ).rejects.toBeInstanceOf(CallRefused);
  });

  it('lets an error that is a bug rather than a bad request escape', async () => {
    const exploding: Operation = {
      name: 'explode',
      summary: 'x',
      input: { type: 'object', properties: {}, required: [] },
      needs: 'nothing',
      run: () => {
        throw new TypeError('a bug, not a bad request');
      },
      describe: () => '',
    };
    const original = OPERATIONS as Operation[];
    original.push(exploding);
    try {
      await expect(
        runOperation('explode', {}, host(), reachesAll),
      ).rejects.toBeInstanceOf(TypeError);
    } finally {
      original.pop();
    }
  });

  it('notices when a run replaced the machine that was held', async () => {
    let token = { first: true };
    const outcome = await runOperation(
      'machines',
      {},
      {
        context: () => context(),
        heldMachine: () => ({ name: 'ZX81', token }),
      },
      reachesAll,
    );
    expect(outcome.notes).toEqual([]);
    // The same call with the token changing under it is what a run looks like.
    const replaced = await runOperation(
      'machines',
      {},
      {
        context: () => context(),
        heldMachine: () => {
          const seen = token;
          token = { first: false } as typeof token;
          return { name: 'ZX81', token: seen };
        },
      },
      reachesAll,
    );
    expect(replaced.notes.join(' ')).toMatch(/one machine is held at a time/);
  });

  it('carries the outcome and whether the operation failed', async () => {
    const outcome = await runOperation('machines', {}, host(), reachesAll);
    expect(Array.isArray(outcome.outcome)).toBe(true);
    expect(outcome.failed).toBe(false);
    expect(outcome.notes).toEqual([]);
  });

  it('answers with an outcome that survives being written as JSON', async () => {
    const { outcome } = await runOperation('machines', {}, host(), reachesAll);
    expect(JSON.parse(JSON.stringify(outcome))).toEqual(outcome);
  });
});

describe('RunError', () => {
  it('is what an operation raises for a mistake the caller made', () => {
    expect(new RunError('x')).toBeInstanceOf(Error);
  });
});
