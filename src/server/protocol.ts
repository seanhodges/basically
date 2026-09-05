// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What crosses a connection, and how it is framed.
 *
 * The framing is the one the toolchain already speaks over its standard
 * streams - a `Content-Length` header, a blank line, then that many bytes of
 * JSON - so a connection carrying the operations conversation is framed exactly
 * as one carrying the editor's or the agent's protocol. That is what lets one
 * listener hand a socket to either without translating anything.
 *
 * Nothing here decides an answer or touches a socket: the framing is over a
 * byte stream the caller supplies, so it is testable without a listener and
 * reusable over anything duplex.
 */

/** Which conversation a connection is for. */
export type Conversation = 'ops' | 'lsp' | 'mcp';

export const CONVERSATIONS: readonly Conversation[] = ['ops', 'lsp', 'mcp'];

/** Whether the value names a conversation this host knows about. */
export function isConversation(value: unknown): value is Conversation {
  return (
    typeof value === 'string' && CONVERSATIONS.includes(value as Conversation)
  );
}

/**
 * The first message on a connection: which conversation, and which build the
 * caller is.
 *
 * The build is sent as well as being part of the address because the address
 * only proves the caller found this host, and a caller that was handed an
 * address some other way should still be told plainly rather than subtly
 * misunderstood.
 */
export interface Hello {
  kind: 'hello';
  conversation: Conversation;
  buildId: string;
}

/** What the host says back: whether it will serve that, and what it does serve. */
export interface Welcome {
  kind: 'welcome';
  serving: readonly Conversation[];
}

/** The host will not serve that conversation, and says which it does. */
export interface Refusal {
  kind: 'refusal';
  reason: string;
  serving: readonly Conversation[];
}

/** One operation, named, with its input. */
export interface OpsRequest {
  kind: 'call';
  id: number;
  operation: string;
  input: Record<string, unknown>;
  /** The machine a program naming none is read as, when the caller has one. */
  defaultMachine?: string;
  /** Whether a run is to leave the machine it booted up. */
  hold?: boolean;
}

/** Something asked of the host itself rather than of a program. */
export interface HostRequest {
  kind: 'host';
  id: number;
  /** `status` reports what is served and what is held; `stop` ends the host. */
  action: 'status' | 'stop' | 'release';
}

/**
 * How a request failed, in the terms the command line reports.
 *
 * `request` is the caller having asked for something impossible and `program`
 * is the BASIC program being at fault - the same two the exit codes separate,
 * decided where the operation ran and carried back rather than re-derived.
 */
export type FailureKind = 'request' | 'program';

export interface OpsSuccess {
  kind: 'result';
  id: number;
  outcome: unknown;
}

export interface OpsFailure {
  kind: 'error';
  id: number;
  failure: FailureKind;
  message: string;
}

export interface HostReply {
  kind: 'host-result';
  id: number;
  serving?: readonly Conversation[];
  /** The machine being held for this caller, or null when none is. */
  holding?: string | null;
  stopping?: boolean;
}

export type ClientMessage = Hello | OpsRequest | HostRequest;
export type HostMessage =
  | Welcome
  | Refusal
  | OpsSuccess
  | OpsFailure
  | HostReply;

/**
 * A frame is refused rather than buffered past this.
 *
 * A program's listing and a screenshot's bytes both cross a connection, so the
 * limit is generous; what it is really for is a caller that is not speaking
 * this protocol at all, whose first "header" would otherwise be read until
 * memory ran out.
 */
export const MAX_FRAME_BYTES = 64 * 1024 * 1024;

/** One message, framed for the wire. */
export function encodeFrame(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii'),
    body,
  ]);
}

/**
 * Reads whole messages out of a stream that arrives in whatever sizes the
 * operating system chose.
 *
 * A frame is split across chunks as readily as several arrive in one, so the
 * reader keeps its own buffer and yields only what is complete. A header it
 * cannot read, or a length it will not accept, is fatal for the connection
 * rather than something to resynchronise past: there is no way to know where
 * the next frame starts once the framing is in doubt.
 */
export class FrameReader {
  private buffer: Buffer = Buffer.alloc(0);
  private expected: number | null = null;

  /** Every whole message the chunk completed, in order. */
  push(chunk: Buffer): unknown[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: unknown[] = [];
    for (;;) {
      if (this.expected === null) {
        const end = this.buffer.indexOf('\r\n\r\n');
        if (end === -1) {
          // A header this long is not a header. Refuse before the buffer
          // becomes the caller's memory to spend.
          if (this.buffer.length > 8192) {
            throw new Error('no frame header arrived before the header limit');
          }
          return messages;
        }
        const header = this.buffer.subarray(0, end).toString('ascii');
        const match = /Content-Length:\s*(\d+)/i.exec(header);
        if (!match) throw new Error(`frame header has no length: "${header}"`);
        const length = Number(match[1]);
        if (length > MAX_FRAME_BYTES) {
          throw new Error(`frame of ${length} bytes is over the limit`);
        }
        this.expected = length;
        this.buffer = this.buffer.subarray(end + 4);
      }
      if (this.buffer.length < this.expected) return messages;
      const body = this.buffer.subarray(0, this.expected).toString('utf8');
      this.buffer = this.buffer.subarray(this.expected);
      this.expected = null;
      try {
        messages.push(JSON.parse(body));
      } catch {
        throw new Error('frame body is not JSON');
      }
    }
  }
}
