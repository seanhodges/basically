// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges
//
// This file is part of Basically, a browser IDE for microcomputer BASIC.
// Basically is free software, distributed under the GNU GPL v3.0 or later;
// see the LICENSE file in the project root for the full license text.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
