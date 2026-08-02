// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult } from '../types';

/**
 * Altair 8K BASIC tokenized program bytes -> editor text (Stage 1): the inverse
 * of `tokenizer.ts`, and the half that has to be built *total* from the start.
 *
 * The bar every shipped dialect meets (see
 * `docs/contributing/adding-a-dialect.md`): tokens are interpreted only outside
 * strings, REM and DATA - inside them bytes round-trip exactly - and every byte
 * the text form cannot represent as a glyph gets a `{0xNN}` escape rather than
 * a lossy `?`. `src/dialects/roundTrip.test.ts` pins it once the dialect is
 * registered: every bundled sample's image must decode to text that re-tokenizes
 * byte-for-byte.
 */
export function detokenizeProgram(_image: Uint8Array): string {
  throw new Error('altair8800: not implemented');
}

/**
 * As {@link detokenizeProgram}, but reporting what the text form could not
 * capture (unmappable bytes, a truncated link chain, trailing non-BASIC data).
 * The import UI prefers this over the bare `detokenize` when present.
 */
export function detokenizeProgramWithReport(
  _image: Uint8Array,
): DetokenizeResult {
  throw new Error('altair8800: not implemented');
}
