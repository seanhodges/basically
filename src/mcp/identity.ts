// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/** Who the server says it is when a client announces itself. */
export const SERVER_INFO = {
  name: 'basically',
  /**
   * The version of this surface, not of the application: it moves when what
   * the server offers changes in a way a client would have to notice, and the
   * operations it offers are the declaration's rather than this file's.
   */
  version: '1',
  title: 'Basically: retro BASIC, outside the browser',
} as const;
