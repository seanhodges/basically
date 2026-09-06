// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Agreeing to obtain ROM images.
 *
 * The two claims worth holding down: agreeing once is agreeing for good, and a
 * caller with no terminal is answered rather than left waiting. That second one
 * is the load-bearing half - `run` and `check` read their program from stdin,
 * so a prompt reached on a pipe would sit on a stream that is about to carry
 * something else entirely.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRomCache } from './romCache';
import {
  askForConsent,
  consentFromEnv,
  consentQuestion,
  consentToFetch,
  forgetConsent,
  recordConsent,
  recordedConsent,
} from './romConsent';

let home: string;

beforeEach(() => {
  home = path.join(
    os.tmpdir(),
    `basically-consent-${process.pid}-${Math.random().toString(36).slice(2)}`,
  );
});

afterEach(() => {
  clearRomCache(home);
  forgetConsent(home);
  vi.unstubAllEnvs();
});

/** A stream pair that is not a terminal, which is what a pipe looks like. */
function piped() {
  const input = new PassThrough() as unknown as NodeJS.ReadStream;
  const output = new PassThrough() as unknown as NodeJS.WriteStream;
  return { input, output };
}

describe('agreeing in advance through the environment', () => {
  it('takes every spelling of yes, and nothing else', () => {
    for (const yes of ['yes', 'y', '1', 'true', 'YES', ' Yes ']) {
      expect(consentFromEnv({ BASICALLY_ROM_CONSENT: yes }), yes).toBe(true);
    }
    for (const no of ['no', 'n', '0', 'false', '', 'maybe', 'ok']) {
      expect(consentFromEnv({ BASICALLY_ROM_CONSENT: no }), no).toBe(false);
    }
    expect(consentFromEnv({})).toBe(false);
  });

  it('needs no terminal and asks nothing', async () => {
    const { input, output } = piped();
    const answer = await consentToFetch({
      home,
      env: { BASICALLY_ROM_CONSENT: 'yes' },
      input,
      output,
    });
    expect(answer.agreed).toBe(true);
    expect(answer.askedAndDeclined).toBe(false);
    expect(recordedConsent(home)?.source).toBe('environment');
  });
});

describe('agreeing once', () => {
  it('is not asked again', async () => {
    recordConsent(
      { acceptedAt: new Date().toISOString(), source: 'accept' },
      home,
    );
    const { input, output } = piped();
    const ask = vi.fn();
    input.on('data', ask);

    const answer = await consentToFetch({ home, env: {}, input, output });

    expect(answer.agreed).toBe(true);
    expect(
      ask,
      'a recorded agreement was asked about again',
    ).not.toHaveBeenCalled();
  });

  it('can be taken back', () => {
    recordConsent(
      { acceptedAt: new Date().toISOString(), source: 'accept' },
      home,
    );
    expect(recordedConsent(home)).not.toBeNull();
    forgetConsent(home);
    expect(recordedConsent(home)).toBeNull();
    expect(existsSync(path.join(home, 'consent.json'))).toBe(false);
  });

  it('treats an unreadable record as no agreement rather than as one', () => {
    // Better to ask again than to obtain someone's firmware on the strength of
    // a file we cannot read.
    mkdirSync(home, { recursive: true });
    writeFileSync(path.join(home, 'consent.json'), 'half a fi');
    expect(recordedConsent(home)).toBeNull();

    writeFileSync(
      path.join(home, 'consent.json'),
      JSON.stringify({ ok: true }),
    );
    expect(recordedConsent(home)).toBeNull();
  });
});

describe('a caller with no terminal', () => {
  it('is answered no rather than left waiting', async () => {
    const { input, output } = piped();
    const read = vi.fn();
    input.on('data', read);

    const answered = await askForConsent({ home, env: {}, input, output });

    expect(answered).toBe(false);
    expect(read, 'stdin was read for an answer').not.toHaveBeenCalled();
  });

  it('is told nothing was agreed, so the caller can say how to', async () => {
    const { input, output } = piped();
    const answer = await consentToFetch({ home, env: {}, input, output });
    expect(answer.agreed).toBe(false);
    expect(answer.askedAndDeclined).toBe(true);
    expect(recordedConsent(home)).toBeNull();
  });

  it('is not asked at all where the command may not ask', async () => {
    // `roms status` reports on the cache; it must never start a download or
    // put a question, however empty the cache is.
    const { input, output } = piped();
    const answer = await consentToFetch({
      home,
      env: {},
      ask: false,
      input,
      output,
    });
    expect(answer.agreed).toBe(false);
    expect(answer.askedAndDeclined).toBe(false);
  });
});

describe('what the question says', () => {
  it('names where the images go and where the terms are', () => {
    const lines = consentQuestion({ home, env: {} }).join('\n');
    expect(lines).toContain(path.join(home, 'roms'));
    expect(lines).toContain('ATTRIBUTION.md');
    expect(
      lines,
      'the published notice is the one a user with no checkout has',
    ).toMatch(/https?:\/\/\S+ATTRIBUTION\.md/);
  });

  it('says the answer is remembered, and how to take it back', () => {
    const lines = consentQuestion({ home, env: {} }).join('\n');
    expect(lines).toContain('roms clear');
  });
});
