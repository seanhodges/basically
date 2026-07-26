// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The New-project dialog's decisions, as pure functions: which starting points
 * are available, and what document a set of choices produces. Kept out of the
 * component so they are unit-testable (the project's component logic lives in
 * plain `.ts` siblings - see `inputOverlayMode.ts`, `memoryBands.ts`).
 *
 * Machine grouping used to live here too; it moved to `machinePicker.ts` when
 * the picker became shared with the toolbar's target switcher.
 */

import type { Dialect, MemoryBlock, SampleFile } from '../dialects/types';
import { materializeSampleBlocks } from '../app/sampleBlocks';
import { UNTITLED_FILE_NAME } from '../storage/settings';

/** What the new document starts out as. */
export type StartingPoint = 'blank' | 'sample' | 'describe';

/**
 * Shown against the "describe it" option when the assistant has no API key.
 * A statement, not a link: the dialog does not send the user to settings and
 * bring them back.
 */
export const AI_UNCONFIGURED_NOTE =
  'Set up the AI assistant in settings to start a project from a description.';

/**
 * Whether a starting point can be chosen right now. Only "describe it" has a
 * precondition today - it needs the assistant configured with an API key.
 */
export function isStartingPointAvailable(
  point: StartingPoint,
  hasAiKey: boolean,
): boolean {
  return point === 'describe' ? hasAiKey : true;
}

/**
 * The document a set of choices produces: the source to install and the memory
 * blocks that go with it. "Describe it" starts blank - the program arrives from
 * the assistant afterwards.
 *
 * `sample` is the chosen sample when `point` is `'sample'`; an absent one (a
 * machine with no samples) yields a blank document rather than failing.
 */
export function startingDocument(
  dialect: Dialect,
  point: StartingPoint,
  sample: SampleFile | undefined,
): { source: string; blocks: MemoryBlock[] } {
  if (point !== 'sample' || !sample) return { source: '', blocks: [] };
  return {
    source: sample.text,
    blocks: materializeSampleBlocks(dialect, sample),
  };
}

/**
 * The document name for a project. A blank name leaves it untitled (only
 * Open/Save name a document otherwise); a name without an extension gains the
 * machine's default source extension, so it reads as a file from the start.
 */
export function projectFileName(rawName: string, dialect: Dialect): string {
  const name = rawName.trim();
  if (name === '') return UNTITLED_FILE_NAME;
  return name.includes('.')
    ? name
    : `${name}${dialect.fileExtensions[0] ?? ''}`;
}
