// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Asking a host for something, and turning the answer into a verdict.
 *
 * The verdict a caller reports is the one the host reached: the host says which
 * of the two failures a refusal was, and this maps that onto the exit code the
 * command line has always used, rather than deriving one afresh from a message.
 * Being unable to reach a host at all is its own failure and is never reported
 * as a program being at fault - nothing was ever asked about a program.
 *
 * Every call is bounded. A host that has wedged would otherwise leave a command
 * hanging with no way to tell it from one doing a great deal of work, and a
 * user who cannot tell those apart cannot do anything about either.
 */

import {
  encodeFrame,
  FrameReader,
  type Conversation,
  type FailureKind,
  type HostMessage,
} from '../server/protocol';
import type { Connection } from './connect';

/** The caller asked for something impossible. */
export const EXIT_BAD_REQUEST = 1;
/** The BASIC program is at fault. */
export const EXIT_BAD_PROGRAM = 2;

/** A host answered, and the answer was that it would not do it. */
export class HostRefused extends Error {
  readonly failure: FailureKind;

  constructor(message: string, failure: FailureKind) {
    super(message);
    this.failure = failure;
  }
}

/** The host could not be talked to at all. */
export class HostUnreachable extends Error {}

/**
 * The exit code for a failure.
 *
 * A host that refused because the program is at fault is the only route to the
 * code reserved for that; everything else - a bad option, an unknown machine, a
 * host that could not be reached - is the caller's, because none of them is a
 * verdict about a program.
 */
export function exitCodeFor(error: unknown): number {
  return error instanceof HostRefused && error.failure === 'program'
    ? EXIT_BAD_PROGRAM
    : EXIT_BAD_REQUEST;
}

/**
 * How long a call may take before the host is presumed wedged.
 *
 * Generous, because a call can legitimately be a long one: running a program to
 * its frame cap on a slow machine is work, not a hang.
 */
export const CALL_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * How long the handshake may take.
 *
 * Much shorter, because it is not work: a host that has accepted a connection
 * and not said hello has nothing to be busy with, so waiting the length of a
 * call would only make a wedged host look like a slow one.
 */
export const HANDSHAKE_TIMEOUT_MS = 15 * 1000;

export interface HostClient {
  /** Run one operation and return its outcome, its notes and whether it failed. */
  call(
    operation: string,
    input: unknown,
  ): Promise<{ value: unknown; notes: string[]; failed: boolean }>;
  /** Ask the host about itself. */
  ask(action: 'status' | 'stop' | 'release'): Promise<{
    serving?: readonly Conversation[];
    holding?: string | null;
    stopping?: boolean;
  }>;
  /** What the host said it serves, from the welcome. */
  serving(): readonly Conversation[];
  close(): void;
}

/**
 * Say hello over the connection and hand back a client for it.
 *
 * Rejects when the host will not serve this conversation, saying which it does,
 * so a caller is told rather than left waiting.
 */
export function openClient(
  connection: Connection,
  conversation: Conversation,
  buildId: string,
  timeoutMs = CALL_TIMEOUT_MS,
  handshakeMs = HANDSHAKE_TIMEOUT_MS,
): Promise<HostClient> {
  const reader = new FrameReader();
  const waiting = new Map<
    number,
    { resolve(value: HostMessage): void; reject(error: unknown): void }
  >();
  let welcomed: ((serving: readonly Conversation[]) => void) | null = null;
  let refused: ((error: Error) => void) | null = null;
  let serving: readonly Conversation[] = [];
  let closed = false;
  let nextId = 1;

  const abandon = (reason: string) => {
    if (closed) return;
    closed = true;
    const pending = [...waiting.values()];
    waiting.clear();
    for (const one of pending) one.reject(new HostUnreachable(reason));
    refused?.(new HostUnreachable(reason));
  };

  connection.on('data', (chunk: Buffer) => {
    let messages: unknown[];
    try {
      messages = reader.push(chunk);
    } catch (error) {
      abandon(error instanceof Error ? error.message : String(error));
      connection.destroy();
      return;
    }
    for (const value of messages) {
      const message = value as HostMessage;
      if (message.kind === 'welcome') {
        serving = message.serving;
        welcomed?.(message.serving);
        continue;
      }
      if (message.kind === 'refusal') {
        refused?.(
          new HostUnreachable(
            `${message.reason}; it serves ${message.serving.join(', ')}`,
          ),
        );
        continue;
      }
      const pending = waiting.get(message.id);
      if (!pending) continue;
      waiting.delete(message.id);
      pending.resolve(message);
    }
  });
  connection.on('close', () => abandon('the host closed the connection'));

  /** One request, matched to its reply, and bounded. */
  const send = (body: Record<string, unknown>): Promise<HostMessage> => {
    if (closed) return Promise.reject(new HostUnreachable('the host is gone'));
    const id = nextId++;
    return new Promise<HostMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(id);
        reject(
          new HostUnreachable(
            `the host did not answer within ${Math.round(timeoutMs / 1000)}s; ` +
              'stop it with "basically server stop" and try again',
          ),
        );
      }, timeoutMs);
      waiting.set(id, {
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      connection.write(encodeFrame({ ...body, id }));
    });
  };

  const client: HostClient = {
    call: async (operation, input) => {
      const reply = await send({ kind: 'call', operation, input });
      if (reply.kind === 'error') {
        throw new HostRefused(reply.message, reply.failure);
      }
      if (reply.kind !== 'result') {
        throw new HostUnreachable('the host answered with something else');
      }
      return reply.outcome as {
        value: unknown;
        notes: string[];
        failed: boolean;
      };
    },
    ask: async (action) => {
      const reply = await send({ kind: 'host', action });
      if (reply.kind === 'error') {
        throw new HostRefused(reply.message, reply.failure);
      }
      if (reply.kind !== 'host-result') {
        throw new HostUnreachable('the host answered with something else');
      }
      return reply;
    },
    serving: () => serving,
    close: () => {
      closed = true;
      connection.end();
    },
  };

  return new Promise<HostClient>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new HostUnreachable(
          `the host accepted a connection but did not answer within ` +
            `${Math.round(handshakeMs / 1000)}s; stop it with ` +
            '"basically server stop" and try again',
        ),
      );
    }, handshakeMs);
    welcomed = () => {
      clearTimeout(timer);
      resolve(client);
    };
    refused = (error) => {
      clearTimeout(timer);
      reject(error);
    };
    connection.write(encodeFrame({ kind: 'hello', conversation, buildId }));
  });
}
