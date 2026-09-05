// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The node-only edge of finding a host: who this process belongs to, what it
 * was built from, and where the bundles are.
 *
 * Everything that decides an address is in `src/server/address.ts` and takes
 * what it needs as an argument. This is the part that reads the world, kept
 * apart so the deciding stays testable from any platform.
 */

import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressEnvironment } from './address';

/** What this process can see of the user and the system. */
export function currentEnvironment(): AddressEnvironment {
  return {
    platform: process.platform,
    // A numeric id on POSIX, where it is what the directory's ownership is in
    // terms of; the account name on Windows, where `userInfo().uid` is -1.
    user:
      process.platform === 'win32'
        ? os.userInfo().username
        : String(os.userInfo().uid),
    runtimeDir: process.env.XDG_RUNTIME_DIR,
    tmpDir: os.tmpdir(),
  };
}

/** The directory the running bundle was written to. */
export function bundleDirectory(url: string): string {
  return path.dirname(fileURLToPath(url));
}

/**
 * What this build is, as the build wrote it beside the bundles.
 *
 * Absent only when running from source rather than from a build - under the
 * test runner, say - where there is no host to find and nothing that needs to
 * agree with anything.
 */
export function readBuildId(directory: string): string {
  try {
    return readFileSync(path.join(directory, 'buildId.txt'), 'utf8').trim();
  } catch {
    return 'unbuilt';
  }
}
