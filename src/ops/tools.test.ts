import { describe, expect, it } from 'vitest';
import { runToolCall, toolDefinitions, toolOperations } from './tools';
import { OPERATIONS } from './registry';
import { pureContext, stubSession } from './testSupport';

const options = { withoutSession: 'not given' };

describe('the tool definitions', () => {
  it('are every operation the assistant reaches as a tool, in registry order', () => {
    const names = toolDefinitions().map((t) => t.name);
    expect(names).toEqual(toolOperations().map((op) => op.name));
    expect(names).toEqual(
      OPERATIONS.filter((op) => op.assistant?.kind === 'tool').map(
        (o) => o.name,
      ),
    );
  });

  it("carry each declaration's description and schema as given", () => {
    for (const tool of toolDefinitions()) {
      const op = OPERATIONS.find((o) => o.name === tool.name)!;
      expect(tool.description).toBe(op.description ?? op.summary);
      expect(tool.input).toBe(op.input);
    }
  });
});

describe('running a call', () => {
  it('answers a tool that does not exist rather than throwing', async () => {
    const result = await runToolCall(
      { id: 'c1', name: 'teleport', input: {} },
      pureContext(),
      options,
    );
    expect(result).toEqual({
      callId: 'c1',
      content: 'there is no tool called "teleport"',
      isError: true,
    });
  });

  it('refuses an operation the assistant reaches some other way', async () => {
    // `run` is not a tool and `screenshot` is asked for in the view block: a
    // model that guessed either name is told so, not handed a machine.
    for (const name of ['run', 'screenshot', 'expect']) {
      const result = await runToolCall(
        { id: 'c1', name, input: {} },
        pureContext({ session: stubSession() }),
        options,
      );
      expect(result.isError, name).toBe(true);
    }
  });

  it("refuses a call needing a machine when none was given, in the caller's words", async () => {
    const result = await runToolCall(
      { id: 'c1', name: 'drive', input: { script: 'PRESS A' } },
      pureContext(),
      options,
    );
    expect(result).toEqual({
      callId: 'c1',
      content: 'not given',
      isError: true,
    });
  });

  it('runs an operation needing no machine on a turn that holds none', async () => {
    const result = await runToolCall(
      { id: 'c1', name: 'lint', input: { source: '10 PRINT "HI"\n' } },
      pureContext({ defaultMachine: 'zx81' }),
      options,
    );
    expect(result.isError).toBeUndefined();
    expect(result.content).toBe('ZX81: no problems.');
  });

  it('refuses an input that does not fit, naming what is wrong', async () => {
    const result = await runToolCall(
      { id: 'c1', name: 'drive', input: {} },
      pureContext({ session: stubSession() }),
      options,
    );
    expect(result).toEqual({
      callId: 'c1',
      content: 'input is missing script',
      isError: true,
    });
  });

  it("reports an operation's own refusal rather than throwing it", async () => {
    const result = await runToolCall(
      { id: 'c1', name: 'info', input: { machine: 'speccy-2000' } },
      pureContext(),
      options,
    );
    expect(result.isError).toBe(true);
    expect(result.content).toContain('no registered machine');
  });

  it('flags an outcome the operation counts as failed, and hears every outcome', async () => {
    const heard: string[] = [];
    const result = await runToolCall(
      { id: 'c1', name: 'drive', input: { script: 'PRESS A' } },
      pureContext({
        session: stubSession({
          pressKeys: () => ({ ok: false, frames: 0, detail: 'no such key' }),
        }),
      }),
      { ...options, onOutcome: (op) => heard.push(op.name) },
    );
    expect(result.isError).toBe(true);
    expect(heard).toEqual(['drive']);
  });
});
