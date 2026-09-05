// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where a host listens, and where a caller looks for one.
 *
 * The address is derived rather than recorded, so a caller finds a host without
 * reading anything a stopped host may have left behind: given the same user and
 * the same build of the toolchain, the client and the host compute the same
 * address independently.
 *
 * Keying on the build is what stops a caller reaching a host built from
 * different source. A host from another build listens somewhere else, so it is
 * invisible rather than reachable and wrong - which is the useful failure,
 * since the two would otherwise agree on every message shape right up to the
 * point where they disagreed about an answer.
 *
 * Nothing here touches the filesystem or `process`: the caller hands in what it
 * knows and gets back a path, so every platform's branch is testable from any
 * platform.
 */

/** What the address is derived from, as the node-only edge reads it. */
export interface AddressEnvironment {
  platform: NodeJS.Platform;
  /**
   * Who the host belongs to: the numeric user id on POSIX, the account name on
   * Windows. Only ever part of a name - it is the directory's permissions, not
   * this, that keeps another user out.
   */
  user: string;
  /** `$XDG_RUNTIME_DIR`, on a system that sets one. */
  runtimeDir?: string;
  tmpDir: string;
}

/**
 * How much of the build id goes into the name.
 *
 * Long enough that two builds never collide in practice, short enough to leave
 * room under the socket path limit below. A collision would mean a caller
 * reaching a host built from different source, which is the one thing this key
 * exists to prevent - 48 bits of it is a margin nothing here will exhaust.
 */
const KEY_LENGTH = 12;

/**
 * The longest a Unix domain socket path may be.
 *
 * `sun_path` is 108 bytes on Linux and 104 on macOS, including the terminator,
 * and the failure when it is exceeded is a bind error naming nothing useful.
 * 100 is the smaller limit with margin, and applies on every POSIX system so
 * that a path is not portable only where it was written.
 */
const MAX_SOCKET_PATH = 100;

/** The key a host is found by: this user's, this build's. */
export function addressKey(buildId: string): string {
  return buildId.slice(0, KEY_LENGTH);
}

/**
 * The directory a POSIX host's socket lives in, or null on Windows, where a
 * named pipe lives in the system's own namespace rather than on disk.
 *
 * `$XDG_RUNTIME_DIR` is the right home when the system provides one: it is the
 * user's own, it is cleaned up at logout, and it is already mode 0700. The
 * temporary directory is the fallback, and the host makes its own directory
 * there rather than putting a socket among everyone else's files.
 */
export function addressDirectory(env: AddressEnvironment): string | null {
  if (env.platform === 'win32') return null;
  const runtime = env.runtimeDir;
  if (runtime !== undefined && runtime !== '') return `${runtime}/basically`;
  return `${env.tmpDir}/basically-${env.user}`;
}

/**
 * The address a host of this build listens on, and a caller of this build
 * looks for.
 *
 * On Windows this is a named pipe. Note that a pipe's name is not itself a
 * permission: Node creates one with the system's default security descriptor,
 * so the name carries the user only to keep two accounts on one machine from
 * colliding. On POSIX the socket sits in a directory the host creates mode
 * 0700, which is what actually keeps another user out.
 */
export function hostAddress(buildId: string, env: AddressEnvironment): string {
  const key = addressKey(buildId);
  if (env.platform === 'win32') {
    // The pipe namespace is flat and machine-wide, so the name carries
    // everything that distinguishes one host from another.
    return `\\\\.\\pipe\\basically-${env.user}-${key}`;
  }
  const directory = addressDirectory(env);
  const preferred = `${directory}/${key}.sock`;
  if (preferred.length <= MAX_SOCKET_PATH) return preferred;
  // A deep `$XDG_RUNTIME_DIR` or temporary directory can put the preferred path
  // over the limit, where binding fails with an error that names nothing.
  // Falling back to a flat name in the temporary directory buys back every
  // character the nesting spent.
  const flat = `${env.tmpDir}/bsly-${env.user}-${key}.sock`;
  if (flat.length <= MAX_SOCKET_PATH) return flat;
  throw new Error(
    `no socket path under ${MAX_SOCKET_PATH} characters is available for ` +
      `this user in ${env.tmpDir}; set TMPDIR to somewhere shorter`,
  );
}
