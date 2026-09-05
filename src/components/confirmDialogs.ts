// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The four small confirmations, in one module so they travel as one chunk.
 *
 * Each is a couple of kilobytes and none is reached before the user asks for
 * it, so a chunk apiece would cost more in requests than it saves in bytes.
 */

export { AiSettingsDialog } from './AiSettingsDialog';
export { SwitchTargetDialog } from './SwitchTargetDialog';
export { DeleteBlockDialog } from './DeleteBlockDialog';
export { DeleteDataFileDialog } from './DeleteDataFileDialog';
