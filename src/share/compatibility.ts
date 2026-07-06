// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

// Which machines a program can be shared to (standalone-player-plan Stage 5):
// the ids of every registered dialect whose tokenizer accepts the source with
// zero errors. Purely syntactic - a program may tokenize on a machine yet rely
// on hardware it lacks - but cheap, client-side, and always includes the
// authoring dialect for a program that lints clean there.

import { dialects } from '../dialects/registry';

/** Registry-ordered dialect ids on which `source` tokenizes without errors. */
export function computeCompatibleDialects(source: string): string[] {
  return dialects
    .filter((d) => d.tokenize(source).errors.length === 0)
    .map((d) => d.id);
}
