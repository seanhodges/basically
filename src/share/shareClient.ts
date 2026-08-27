// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

// Client for the share API (the wire contract is owned by the
// basically-share-server repo).
// The API lives on its own origin - GitHub Pages cannot proxy a same-origin
// /api - so the base URL comes from VITE_SHARE_API_URL at build time. When it
// is unset (no backend deployed), calls reject with kind 'unconfigured' so
// callers can degrade gracefully instead of firing doomed requests.

import { SHARE_ID_RE } from '../player/routes';
import type { Block } from '../dialects/types';
import { parseBlocks, type SerializedBlock } from '../storage/projectFile';

export interface SharedProgram {
  id: string;
  dialectId: string;
  compatibleDialects: string[];
  name: string;
  source: string;
  createdAt: string;
  /**
   * Memory blocks (machine code / data at fixed addresses) that ship with the
   * program, decoded from the wire's base64 form back into runtime
   * {@link Block}s - contract v2. Absent for a pure-BASIC share (the
   * common case) and for v1 payloads that predate blocks.
   */
  blocks?: Block[];
}

export interface CreateShareRequest {
  dialectId: string;
  compatibleDialects: string[];
  name: string;
  source: string;
  /**
   * Serialized memory blocks to attach (contract v2) - the same wire codec the
   * `.zip` bundle uses ({@link serializeBlocks}). Omit for a pure-BASIC
   * share; a v1-only server simply ignores the extra field.
   */
  blocks?: SerializedBlock[];
}

export type ShareErrorKind =
  | 'unconfigured'
  | 'invalid-id'
  | 'not-found'
  | 'expired'
  | 'too-large'
  | 'rate-limited'
  | 'network'
  | 'server';

export class ShareApiError extends Error {
  constructor(
    readonly kind: ShareErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ShareApiError';
  }
}

// Server-enforced limits, pre-checked here so oversized shares fail before
// the network round trip.
export const SOURCE_LIMIT_BYTES = 64 * 1024;
export const NAME_LIMIT_CHARS = 128;

function apiBase(): string {
  const url = import.meta.env.VITE_SHARE_API_URL;
  if (!url) {
    throw new ShareApiError(
      'unconfigured',
      'Share API not configured (set VITE_SHARE_API_URL)',
    );
  }
  return url.replace(/\/+$/, '');
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ShareApiError('network', 'Could not reach the share API');
  }
}

export async function fetchSharedProgram(id: string): Promise<SharedProgram> {
  if (!SHARE_ID_RE.test(id)) {
    throw new ShareApiError('invalid-id', `Not a valid share ID: ${id}`);
  }
  const res = await request(`${apiBase()}/share/${id}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) {
    throw new ShareApiError('not-found', 'No program with that share ID');
  }
  if (res.status === 410) {
    throw new ShareApiError('expired', 'This share link has expired');
  }
  if (!res.ok) {
    throw new ShareApiError('server', `Share API error ${res.status}`);
  }
  const body = (await res.json()) as Partial<SharedProgram> & {
    blocks?: unknown;
  };
  if (
    typeof body.id !== 'string' ||
    typeof body.dialectId !== 'string' ||
    typeof body.source !== 'string' ||
    !Array.isArray(body.compatibleDialects)
  ) {
    throw new ShareApiError('server', 'Malformed share API response');
  }
  // Blocks are optional (v1 payloads have none). When present they must be a
  // well-formed, uniquely-named set - parseBlocks throws otherwise, which we
  // surface as a server error rather than booting a half-decoded document.
  let blocks: Block[] | undefined;
  if (body.blocks !== undefined) {
    if (!Array.isArray(body.blocks)) {
      throw new ShareApiError('server', 'Malformed share API response');
    }
    try {
      blocks = parseBlocks(body.blocks);
    } catch {
      throw new ShareApiError('server', 'Malformed share block data');
    }
  }
  return {
    id: body.id,
    dialectId: body.dialectId,
    compatibleDialects: body.compatibleDialects.filter(
      (d): d is string => typeof d === 'string',
    ),
    name: typeof body.name === 'string' ? body.name : '',
    source: body.source,
    createdAt: typeof body.createdAt === 'string' ? body.createdAt : '',
    ...(blocks ? { blocks } : {}),
  };
}

export async function createShare(
  req: CreateShareRequest,
): Promise<{ id: string }> {
  if (req.name.length > NAME_LIMIT_CHARS) {
    throw new ShareApiError(
      'too-large',
      `Program name exceeds ${NAME_LIMIT_CHARS} characters`,
    );
  }
  // The 64 KiB budget now covers the serialized memory blocks too - base64
  // block bytes are bulky, so a program that fits alone can still bust the
  // limit once its blocks are attached. Message names the blocks only when
  // there are any, so a pure-BASIC overflow reads as before.
  const sourceBytes = new TextEncoder().encode(req.source).length;
  const hasBlocks = req.blocks !== undefined && req.blocks.length > 0;
  const blocksBytes = hasBlocks
    ? new TextEncoder().encode(JSON.stringify(req.blocks)).length
    : 0;
  if (sourceBytes + blocksBytes > SOURCE_LIMIT_BYTES) {
    throw new ShareApiError(
      'too-large',
      hasBlocks
        ? `Program plus its memory blocks exceed ${SOURCE_LIMIT_BYTES / 1024} KiB`
        : `Program exceeds ${SOURCE_LIMIT_BYTES / 1024} KiB`,
    );
  }
  const res = await request(`${apiBase()}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(req),
  });
  if (res.status === 429) {
    throw new ShareApiError(
      'rate-limited',
      'Too many shares right now - try again shortly',
    );
  }
  if (res.status === 400) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error === 'too_large') {
      throw new ShareApiError('too-large', 'The share API rejected the size');
    }
    throw new ShareApiError(
      'server',
      `Share rejected: ${body.error ?? 'bad_request'}`,
    );
  }
  if (!res.ok) {
    throw new ShareApiError('server', `Share API error ${res.status}`);
  }
  const body = (await res.json()) as { id?: string };
  if (typeof body.id !== 'string' || !SHARE_ID_RE.test(body.id)) {
    throw new ShareApiError('server', 'Malformed share API response');
  }
  return { id: body.id };
}
