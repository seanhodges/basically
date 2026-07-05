// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges
//
// This file is part of Basically, a browser IDE for microcomputer BASIC.
// Basically is free software, distributed under the GNU GPL v3.0 or later;
// see the LICENSE file in the project root for the full license text.

// Must run before anything touches localStorage (settings, autosave, AI keys):
// installs an in-memory fallback when the browser blocks storage access.
import './storage/safeStorage';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { parsePlayerPath } from './player/routes';
import './styles.css';

// The only routing decision in the app: /<verb>/<shareId> paths open the
// standalone player, everything else (including invalid share links) opens
// the IDE. Both shells are lazy so the player never loads the editor or the
// AI SDKs, and the IDE never loads the player.
const App = React.lazy(() => import('./App'));
const PlayerApp = React.lazy(() => import('./player/PlayerApp'));

const playerRoute = parsePlayerPath(window.location.pathname);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      {playerRoute ? (
        <PlayerApp
          dialectId={playerRoute.dialectId}
          shareId={playerRoute.shareId}
        />
      ) : (
        <App />
      )}
    </Suspense>
  </React.StrictMode>,
);
