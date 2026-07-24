/**
 * Pins each dialect reference table to the dialect's own keyword table, so the
 * docs cannot drift from the code:
 *
 *  1. Completeness: every word in the keyword table has a reference row of the
 *     same name - a keyword added to a dialect fails here until its docs row
 *     exists, keeping "every command, function and operator" true.
 *  2. No inventions: every reference row names a word the keyword table
 *     actually contains, so the docs never document a keyword the tokenizer
 *     doesn't accept.
 *
 * Comparison is by unique name (keyword tables may list alias spellings that
 * collapse into one row), mirroring scripts/gen-reference-scaffold.mts. Like
 * escapes/escape-crosscheck.test.ts, this file may import src/ freely: vitest
 * runs it in node and the VitePress bundle never includes *.test.ts.
 */
import { describe, expect, it } from 'vitest';
import type { EditorKeyword } from '../../../src/dialects/types';
import type { ReferenceTableData } from './types';

import { zx81Reference } from './zx81';
import { zx80Reference } from './zx80';
import { zxspectrumReference } from './zxspectrum';
import { bbcReference } from './bbc';
import { commodoreReference } from './commodore';
import { atomReference } from './atom';
import { trs80Reference } from './trs80';
import { cpcReference } from './cpc';

import { zx81Keywords } from '../../../src/dialects/zx81/keywords';
import {
  zx80Keywords,
  zx80IntegralFunctions,
} from '../../../src/dialects/zx80/keywords';
import { spectrumKeywords } from '../../../src/dialects/zxspectrum/keywords';
import {
  SPECTRUM_KEYWORD,
  PLAY_KEYWORD,
} from '../../../src/dialects/zxspectrum128/keywords';
import { bbcKeywords } from '../../../src/dialects/bbcmicro/keywords';
import { petKeywords } from '../../../src/dialects/pet/keywords';
import { atomKeywords } from '../../../src/dialects/atom/keywords';
import { trs80Keywords } from '../../../src/dialects/trs80/keywords';
import { locoKeywordTable } from '../../../src/dialects/cpc464/keywords';

const PAIRS: [string, ReferenceTableData, EditorKeyword[]][] = [
  ['zx81', zx81Reference, zx81Keywords],
  // The ZX80's integral functions are computed by the editor rather than
  // tokenized, but they are part of the language and sit in its table.
  ['zx80', zx80Reference, [...zx80Keywords, ...zx80IntegralFunctions]],
  [
    'zxspectrum',
    zxspectrumReference,
    [...spectrumKeywords, SPECTRUM_KEYWORD, PLAY_KEYWORD],
  ],
  ['bbc', bbcReference, bbcKeywords],
  // One page covers all three Commodore machines: the merged table is
  // crosschecked against the PET's keyword set (= the C64 V2 core plus the 15
  // BASIC 4.0 disk commands), the same union model as zxspectrum's 48K+128K.
  ['commodore', commodoreReference, petKeywords],
  ['atom', atomReference, atomKeywords],
  ['trs80', trs80Reference, trs80Keywords],
  ['cpc', cpcReference, locoKeywordTable],
];

describe.each(PAIRS)('keyword crosscheck: %s', (_id, data, keywords) => {
  const rowNames = new Set(data.entries.map((e) => e.name));
  const keywordWords = new Set(keywords.map((k) => k.word));

  it('every keyword has a reference row', () => {
    const missing = [...keywordWords].filter((w) => !rowNames.has(w));
    expect(missing).toEqual([]);
  });

  it('every reference row is a real keyword', () => {
    const invented = [...rowNames].filter((n) => !keywordWords.has(n));
    expect(invented).toEqual([]);
  });
});
