// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it } from 'vitest';

/**
 * Stage 1 fills these in. The round-trip cases matter most: once the dialect is
 * registered, `src/dialects/roundTrip.test.ts` requires every bundled sample's
 * image to decode to text that re-tokenizes byte-for-byte, so drift shows up
 * there as a whole-suite failure rather than a local one.
 */
describe('altair8800 tokenizer', () => {
  it.todo('tokenizes each 8K keyword to its documented token byte');
  it.todo('stores lines as [u16 link][u16 line number][body][0x00]');
  it.todo('terminates the program with a zero link');
  it.todo('leaves keyword text inside strings, REM and DATA untokenized');
  it.todo('reports unparseable line structure as a fatal error');
  it.todo('marks heuristic statement-shape lint non-fatal');
  it.todo('round-trips tokenize -> detokenize -> tokenize byte-exactly');
});
