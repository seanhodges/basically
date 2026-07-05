// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { getDialect } from '../dialects/registry';

// Stage-1 placeholder for the standalone player (see
// docs/contributing/standalone-player-plan.md). Later stages replace this
// with the emulator screen, virtual keyboard and gamepad, fed by the share
// API. Default export so main.tsx can React.lazy() it.
export default function PlayerApp({
  dialectId,
  shareId,
}: {
  dialectId: string;
  shareId: string;
}) {
  const dialect = getDialect(dialectId);
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        textAlign: 'center',
        padding: '1rem',
      }}
    >
      <h1>Basically player</h1>
      <p>
        Machine: <strong>{dialect.name}</strong> — program{' '}
        <strong>{shareId}</strong>
      </p>
      <p>The standalone player arrives in a later stage.</p>
      <p>
        <a href="/">Open the IDE</a>
      </p>
    </div>
  );
}
