// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where a published ROM set is read from.
 *
 * Every case names the build value rather than leaving it to the environment:
 * it is folded into the bundle at build time, so a checkout whose `.env.local`
 * names a server and a CI run where nothing does would otherwise be testing two
 * different things.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { romsBaseUrl } from './romRef';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('romsBaseUrl', () => {
  it('reads the set from the share server the build names', () => {
    vi.stubEnv('VITE_SHARE_API_URL', 'https://api.test');
    expect(romsBaseUrl()).toBe('https://api.test/roms/');
  });

  it('takes the origin however many slashes it was given', () => {
    vi.stubEnv('VITE_SHARE_API_URL', '  https://api.test//  ');
    expect(romsBaseUrl()).toBe('https://api.test/roms/');
  });

  it('has nowhere to read from when the build named no server', () => {
    vi.stubEnv('VITE_SHARE_API_URL', '');
    expect(romsBaseUrl()).toBeUndefined();
  });

  it('takes an override as the whole base, and prefers it to the build', () => {
    // The override is a ROM base rather than a server: it is how a deployment
    // that moved the set alone is pointed at, so nothing is appended to it.
    vi.stubEnv('VITE_SHARE_API_URL', 'https://api.test');
    expect(romsBaseUrl('https://roms.example/set')).toBe(
      'https://roms.example/set/',
    );
  });

  it('ends an override in exactly one slash', () => {
    vi.stubEnv('VITE_SHARE_API_URL', '');
    expect(romsBaseUrl('https://roms.example/roms//')).toBe(
      'https://roms.example/roms/',
    );
  });

  it('ignores an override that says nothing', () => {
    vi.stubEnv('VITE_SHARE_API_URL', 'https://api.test');
    expect(romsBaseUrl('   ')).toBe('https://api.test/roms/');
  });
});
