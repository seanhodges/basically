// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A connection arriving, and which conversation it turns out to be.
 *
 * Every conversation this host serves is framed the same way, so what arrives
 * first is a `hello` naming one. That is the whole of the routing: after it,
 * the connection either becomes the operations conversation answered here, or
 * is handed whole to the editor's or the agent's own server, which reads it as
 * the streams it would otherwise have been given by the process. Neither of
 * those knows it is on a socket.
 *
 * A caller asking for a conversation this host was not started to serve is told
 * so, and told which it does serve, rather than being left waiting or answered
 * by the wrong handler.
 *
 * Nothing here opens a socket: the connection is a duplex stream the caller
 * supplies, which is what lets the routing be tested without binding anything
 * and lets the same code serve a host talking over its own standard streams.
 */

import type { Duplex } from 'node:stream';
import { CallRefused } from './ops';
import {
  encodeFrame,
  FrameReader,
  isConversation,
  type ClientMessage,
  type Conversation,
  type HostMessage,
  type HostRequest,
  type OpsRequest,
} from './protocol';
import type { HostSession, Sessions } from './sessions';

/** What the listener needs of the host around it. */
export interface HostServices {
  /** Which conversations this host was started to serve. */
  serving: readonly Conversation[];
  sessions: Sessions;
  /** Hand a connection to the editor's server, as its streams. */
  serveEditor(connection: Duplex): void;
  /** Hand a connection to the agent's server, as its streams. */
  serveAgent(connection: Duplex): void;
  /** Stop the whole host; what a caller asking it to stop reaches. */
  stop(): void;
  /**
   * A connection has arrived; the returned function says it has gone.
   *
   * What keeps a host alive is a caller connected to it, which is not the same
   * as a session existing: the command line's session outlives every one of its
   * connections, and a host that counted it would never let itself go.
   */
  attach?(): () => void;
  /** Something happened worth recording, somewhere that is not a connection. */
  note?(message: string): void;
}

/** Whether a message is one of the ones a caller sends. */
function asClientMessage(value: unknown): ClientMessage | null {
  if (typeof value !== 'object' || value === null) return null;
  const message = value as Record<string, unknown>;
  return message.kind === 'hello' ||
    message.kind === 'call' ||
    message.kind === 'host'
    ? (message as unknown as ClientMessage)
    : null;
}

/**
 * Serve one connection until it ends.
 *
 * The session is opened when the conversation turns out to be the operations
 * one, and closed however the connection ends - cleanly, by error, or by a
 * caller that simply disappeared - so a machine is never left behind.
 */
export function serveConnection(connection: Duplex, host: HostServices): void {
  const reader = new FrameReader();
  let session: HostSession | null = null;
  let routed = false;
  let finished = false;

  const send = (message: HostMessage) => {
    if (!connection.writableEnded) connection.write(encodeFrame(message));
  };

  const detach = host.attach?.();

  const finish = () => {
    if (finished) return;
    finished = true;
    // A caller that is killed closes the stream without saying anything, which
    // reaches here the same way a clean disconnection does. Whether that lets
    // go of the machine is the session's to decide: an agent's does, and the
    // command line's does not, because the next command is coming.
    void session?.close();
    session = null;
    detach?.();
  };

  const fail = (message: string) => {
    host.note?.(message);
    finish();
    connection.destroy();
  };

  const hello = (conversation: unknown): void => {
    if (!isConversation(conversation)) {
      send({
        kind: 'refusal',
        reason: `there is no conversation called "${String(conversation)}"`,
        serving: host.serving,
      });
      fail('a caller asked for a conversation that does not exist');
      return;
    }
    if (!host.serving.includes(conversation)) {
      send({
        kind: 'refusal',
        reason: `this host does not serve "${conversation}"`,
        serving: host.serving,
      });
      // Ended rather than destroyed, so the refusal is actually delivered.
      finish();
      connection.end();
      return;
    }
    routed = true;
    if (conversation === 'lsp' || conversation === 'mcp') {
      // Handed over whole. Nothing is read from the connection here again: the
      // editor's and the agent's servers own it from this point, and the
      // welcome is the last thing written by this module.
      send({ kind: 'welcome', serving: host.serving });
      connection.removeListener('data', onData);
      // Anything read past the handshake belongs to the protocol taking the
      // connection over: a caller that sent its first message in the same
      // packet would otherwise lose it and wait forever.
      const rest = reader.rest();
      if (rest.length > 0) connection.unshift(rest);
      if (conversation === 'lsp') host.serveEditor(connection);
      else host.serveAgent(connection);
      return;
    }
    // The command line's session, shared across its connections: each command
    // is a connection of its own, and the machine has to outlive one command.
    session = host.sessions.shared();
    send({ kind: 'welcome', serving: host.serving });
  };

  const call = async (request: OpsRequest): Promise<void> => {
    if (!session) {
      send({
        kind: 'error',
        id: request.id,
        failure: 'request',
        message: 'no conversation has been started on this connection',
      });
      return;
    }
    try {
      const { outcome, notes, failed } = await session.call(
        request.operation,
        request.input,
      );
      send({
        kind: 'result',
        id: request.id,
        outcome: { value: outcome, notes, failed },
      });
    } catch (error) {
      if (error instanceof CallRefused) {
        send({
          kind: 'error',
          id: request.id,
          failure: error.failure,
          message: error.message,
        });
        return;
      }
      // A bug rather than a bad request. The caller is told, so it is not left
      // waiting, and the host goes on serving everyone else.
      host.note?.(
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
      send({
        kind: 'error',
        id: request.id,
        failure: 'request',
        message:
          error instanceof Error
            ? error.message
            : 'the host failed unexpectedly',
      });
    }
  };

  const askHost = async (request: HostRequest): Promise<void> => {
    switch (request.action) {
      case 'status':
        send({
          kind: 'host-result',
          id: request.id,
          serving: host.serving,
          holding: (await session?.held()) ?? null,
        });
        return;
      case 'release':
        await session?.release();
        send({ kind: 'host-result', id: request.id, holding: null });
        return;
      case 'stop':
        // Answered before the host goes, so the caller learns it was stopped
        // rather than only that the connection ended.
        send({ kind: 'host-result', id: request.id, stopping: true });
        connection.end();
        host.stop();
        return;
    }
  };

  function onData(chunk: Buffer): void {
    let messages: unknown[];
    try {
      messages = reader.push(chunk);
    } catch (error) {
      // The framing is in doubt, and there is no way to know where the next
      // frame would start - so this connection is over rather than resynchronised.
      fail(error instanceof Error ? error.message : String(error));
      return;
    }
    for (const value of messages) {
      const message = asClientMessage(value);
      if (!message) {
        fail('a caller sent something that is not a message');
        return;
      }
      if (message.kind === 'hello') {
        if (routed) {
          fail('a caller said hello twice on one connection');
          return;
        }
        hello(message.conversation);
        continue;
      }
      if (!routed) {
        fail('a caller sent a request before saying which conversation it is');
        return;
      }
      void (message.kind === 'call' ? call(message) : askHost(message));
    }
  }

  connection.on('data', onData);
  connection.on('close', finish);
  connection.on('end', finish);
  connection.on('error', () => finish());
}

/* ------------------------------------------------------------------ */
/* Binding the address                                                 */
/* ------------------------------------------------------------------ */

/** A host that is listening, and the way to stop it. */
export interface Listening {
  address: string;
  close(): Promise<void>;
}

/**
 * The address is already taken.
 *
 * Raised rather than reported so a caller starting a host can tell the one
 * outcome that is not a failure - another host got there first - from every
 * other reason a bind fails.
 */
export class AddressInUse extends Error {}

/**
 * Listen on the address, serving each connection that arrives.
 *
 * On POSIX the directory is made mode 0700 before the socket goes in it: the
 * socket's own permissions are not what keeps another user out on every system,
 * but the directory's are everywhere. On Windows a named pipe lives in the
 * system's namespace, so there is no directory and nothing to unlink.
 */
export async function listenOn(
  address: string,
  directory: string | null,
  host: HostServices,
): Promise<Listening> {
  const net = await import('node:net');
  const fs = await import('node:fs/promises');

  if (directory !== null) {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    // `recursive` does not apply the mode to a directory that already exists,
    // and one left over from an older release may be wider than this.
    await fs.chmod(directory, 0o700).catch(() => {});
  }

  const server = net.createServer((connection) => {
    serveConnection(connection, host);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        reject(new AddressInUse(`${address} is already in use`));
        return;
      }
      reject(error);
    });
    server.listen(address, () => {
      server.removeAllListeners('error');
      server.on('error', (error) => host.note?.(String(error)));
      resolve();
    });
  });

  return {
    address,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      // A Unix socket is a file and outlives the process that bound it; a named
      // pipe goes with its process, so there is nothing to remove on Windows.
      if (directory !== null) await fs.rm(address, { force: true });
    },
  };
}
