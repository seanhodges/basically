import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  StreamHandle,
  StreamOptions,
  StreamResult,
  ToolCall,
} from './providers/types';

/**
 * Each backend is a lazily-imported module, so the seam under test is reached by
 * standing in for that module rather than by injecting anything: the point of
 * these tests is the loop `aiClient` runs *around* a backend, and a real one
 * would only add a network.
 */
const anthropicStream = vi.fn();
const openaiStream = vi.fn();

vi.mock('./providers/anthropic', () => ({
  anthropicBackend: {
    streamChat: (opts: StreamOptions, onText: (d: string) => void) =>
      anthropicStream(opts, onText),
    describeError: (e: unknown) => String(e),
  },
}));
vi.mock('./providers/openai', () => ({
  openaiBackend: {
    streamChat: (opts: StreamOptions, onText: (d: string) => void) =>
      openaiStream(opts, onText),
    describeError: (e: unknown) => String(e),
  },
}));
vi.mock('./providers/gemini', () => ({
  geminiBackend: {
    streamChat: () => {
      throw new Error('unused');
    },
    describeError: (e: unknown) => String(e),
  },
}));

const { streamChat, MAX_TOOL_ROUNDS, TOOL_ROUNDS_EXHAUSTED } =
  await import('./aiClient');

/** A backend reply, as a handle the loop can await. */
function reply(result: Partial<StreamResult>): StreamHandle {
  return {
    done: Promise.resolve({ text: '', stop: 'complete', ...result }),
    abort: () => {},
  };
}

function call(id: string, name = 'drive'): ToolCall {
  return { id, name, input: {} };
}

const BASE: StreamOptions = {
  apiKey: 'k',
  model: 'm',
  maxTokens: 1000,
  system: 's',
  messages: [{ role: 'user', content: 'hello' }],
};

beforeEach(() => {
  anthropicStream.mockReset();
  openaiStream.mockReset();
});

describe('a turn that offers no tools', () => {
  it('is one exchange, exactly as it was before tools existed', async () => {
    anthropicStream.mockReturnValueOnce(reply({ text: 'hi' }));

    const result = await streamChat('anthropic', BASE, () => {}).done;

    expect(result.text).toBe('hi');
    expect(anthropicStream).toHaveBeenCalledTimes(1);
    expect(anthropicStream.mock.calls[0][0].tools).toBeUndefined();
  });

  it('ends the turn on a tool call when there is no runner for it', async () => {
    // A backend that calls a tool nobody offered is the model misbehaving, not
    // a reason to hang: without a runner there is nothing to answer it with.
    anthropicStream.mockReturnValueOnce(
      reply({ text: 'called', toolCalls: [call('a')] }),
    );

    const result = await streamChat('anthropic', BASE, () => {}).done;

    expect(result.text).toBe('called');
    expect(anthropicStream).toHaveBeenCalledTimes(1);
  });
});

describe('a turn that runs tools', () => {
  it('answers each call and comes back for more until the model stops', async () => {
    anthropicStream
      .mockReturnValueOnce(reply({ text: 'one ', toolCalls: [call('a')] }))
      .mockReturnValueOnce(reply({ text: 'two ', toolCalls: [call('b')] }))
      .mockReturnValueOnce(reply({ text: 'done' }));

    const runTool = vi.fn(async (c: ToolCall) => ({
      callId: c.id,
      content: `ran ${c.id}`,
    }));

    const result = await streamChat('anthropic', BASE, () => {}, runTool).done;

    // The text of every exchange, in order - a model that narrates before
    // calling keeps what it said.
    expect(result.text).toBe('one two done');
    expect(runTool).toHaveBeenCalledTimes(2);
    expect(anthropicStream).toHaveBeenCalledTimes(3);
  });

  it('grows the history by the calls and the answers, appending only', async () => {
    anthropicStream
      .mockReturnValueOnce(reply({ text: 'thinking', toolCalls: [call('a')] }))
      .mockReturnValueOnce(reply({ text: 'ok' }));

    await streamChat(
      'anthropic',
      BASE,
      () => {},
      async (c) => ({
        callId: c.id,
        content: 'result',
      }),
    ).done;

    const second = anthropicStream.mock.calls[1][0] as StreamOptions;
    // The original turn is untouched at the front: nothing earlier is ever
    // rewritten, which is what the cached prefix depends on.
    expect(second.messages[0]).toEqual({ role: 'user', content: 'hello' });
    expect(second.messages[1]).toMatchObject({
      role: 'assistant',
      toolCalls: [{ id: 'a' }],
    });
    expect(second.messages[2]).toMatchObject({
      role: 'user',
      toolResults: [{ callId: 'a', content: 'result' }],
    });
  });

  it('runs the calls of one reply together rather than one after another', async () => {
    anthropicStream
      .mockReturnValueOnce(
        reply({ toolCalls: [call('a'), call('b'), call('c')] }),
      )
      .mockReturnValueOnce(reply({ text: 'done' }));

    const runTool = vi.fn(async (c: ToolCall) => ({
      callId: c.id,
      content: c.id,
    }));

    await streamChat('anthropic', BASE, () => {}, runTool).done;

    expect(runTool).toHaveBeenCalledTimes(3);
    const answered = (anthropicStream.mock.calls[1][0] as StreamOptions)
      .messages[2].toolResults;
    expect(answered?.map((r) => r.callId)).toEqual(['a', 'b', 'c']);
  });

  it('passes a tool that failed back as a failure, rather than throwing', async () => {
    anthropicStream
      .mockReturnValueOnce(reply({ toolCalls: [call('a', 'press')] }))
      .mockReturnValueOnce(reply({ text: 'I will try another key' }));

    const result = await streamChat(
      'anthropic',
      BASE,
      () => {},
      async (c) => ({
        callId: c.id,
        content: 'no such key on this machine',
        isError: true,
      }),
    ).done;

    // The point of reporting rather than throwing: the turn survives, and the
    // model gets to correct itself.
    expect(result.text).toBe('I will try another key');
    const answered = (anthropicStream.mock.calls[1][0] as StreamOptions)
      .messages[2].toolResults;
    expect(answered?.[0]).toMatchObject({ isError: true });
  });
});

describe('the bound on a turn', () => {
  it('stops running tools and asks the model to conclude', async () => {
    // A model that would never stop calling on its own: every reply asks for
    // another tool, so only the bound can end this turn. The last pass is the
    // one offered no tools, which is what makes "concluded" reachable at all.
    anthropicStream.mockImplementation((opts: StreamOptions) =>
      opts.tools?.length
        ? reply({ toolCalls: [call('x')] })
        : reply({ text: 'concluded' }),
    );

    const runTool = vi.fn(async (c: ToolCall) => ({
      callId: c.id,
      content: 'ran',
    }));

    const result = await streamChat(
      'anthropic',
      {
        ...BASE,
        tools: [{ name: 'drive', description: 'd', input: { type: 'object' } }],
      },
      () => {},
      runTool,
    ).done;

    expect(runTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(result.text).toBe('concluded');
  });

  it('tells the model why, as a failure it cannot mistake for a result', async () => {
    let round = 0;
    anthropicStream.mockImplementation(() => {
      round++;
      return round > MAX_TOOL_ROUNDS + 1
        ? reply({ text: 'concluded' })
        : reply({ toolCalls: [call(`c${round}`)] });
    });

    await streamChat(
      'anthropic',
      BASE,
      () => {},
      async (c) => ({
        callId: c.id,
        content: 'ran',
      }),
    ).done;

    const last = anthropicStream.mock.calls.at(-1)![0] as StreamOptions;
    const exhausted = last.messages.at(-1)!.toolResults![0];
    expect(exhausted.content).toBe(TOOL_ROUNDS_EXHAUSTED);
    expect(exhausted.isError).toBe(true);
    // Nothing left to call, so the only thing it can do is answer.
    expect(last.tools).toBeUndefined();
  });
});

describe('a backend that cannot be given tools', () => {
  it('is not given them, however the caller asked', async () => {
    openaiStream.mockReturnValueOnce(reply({ text: 'plain' }));

    await streamChat(
      'openai',
      {
        ...BASE,
        tools: [{ name: 'drive', description: 'd', input: { type: 'object' } }],
      },
      () => {},
      async (c) => ({ callId: c.id, content: 'ran' }),
    ).done;

    // Declared incapable, so the request must not carry what it would drop.
    expect(openaiStream.mock.calls[0][0].tools).toBeUndefined();
  });
});
