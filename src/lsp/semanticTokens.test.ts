// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { dialects } from '../dialects/registry';
import { DocumentStore } from './documents';
import {
  SEMANTIC_TOKEN_TYPES,
  semanticTokensFor,
  semanticTokensForRangeOf,
} from './semanticTokens';

const URI = 'file:///a.bas';

/** One decoded token: absolute line and character, its length and its kind. */
interface Decoded {
  line: number;
  character: number;
  length: number;
  type: string;
}

/** The protocol's packed groups read back as absolute positions. */
function decode(data: readonly number[]): Decoded[] {
  const out: Decoded[] = [];
  let line = 0;
  let character = 0;
  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i]!;
    line += deltaLine;
    character = deltaLine === 0 ? character + data[i + 1]! : data[i + 1]!;
    out.push({
      line,
      character,
      length: data[i + 2]!,
      type: SEMANTIC_TOKEN_TYPES[data[i + 3]!]!,
    });
  }
  return out;
}

function tokensOf(machine: string | undefined, text: string): Decoded[] {
  const store = new DocumentStore();
  store.open(URI, text, 1, machine);
  const answer = semanticTokensFor(store.editorState(URI));
  return answer ? decode(answer.data) : [];
}

describe('semanticTokensFor', () => {
  it('reports each kind of run as itself', () => {
    const found = tokensOf('zx81', '10 PRINT "HI": REM why');
    expect(found).toContainEqual({
      line: 0,
      character: 0,
      length: 2,
      type: 'label',
    });
    expect(found.map((t) => t.type)).toEqual([
      'label',
      'keyword',
      'string',
      'operator',
      'keyword',
      'comment',
    ]);
  });

  it('distinguishes a line number from a numeric literal', () => {
    const found = tokensOf('zx81', '10 LET A=20');
    expect(found.find((t) => t.character === 0)?.type).toBe('label');
    expect(found.at(-1)).toEqual({
      line: 0,
      character: 9,
      length: 2,
      type: 'number',
    });
  });

  it('carries a directive as a directive', () => {
    expect(tokensOf('zxspectrum', '#BIN QQ==')[0]).toEqual({
      line: 0,
      character: 0,
      length: 9,
      type: 'macro',
    });
  });

  it('encodes later lines relative to the ones before them', () => {
    const found = tokensOf('zx81', '10 PRINT "A"\n20 GOTO 10\n');
    expect(found.map((t) => [t.line, t.character, t.type])).toEqual([
      [0, 0, 'label'],
      [0, 3, 'keyword'],
      [0, 9, 'string'],
      [1, 0, 'label'],
      [1, 3, 'keyword'],
      [1, 8, 'number'],
    ]);
  });

  it('says nothing about a program it could not bind to a machine', () => {
    // Nothing distinguishes this listing, and no machine is configured, so the
    // binding declines - and colour declines with it rather than guessing.
    const store = new DocumentStore();
    store.open(URI, '10 PRINT "HI"', 1, undefined);
    expect(store.get(URI)!.binding.kind).not.toBe('bound');
    expect(semanticTokensFor(store.editorState(URI))).toBeNull();
  });

  it('reports the same name differently on two machines that read it differently', () => {
    // Driven from the registry rather than a hardcoded pair, so a machine whose
    // keywords change cannot silently make this test vacuous.
    const pair = findDisagreement();
    expect(
      pair,
      'no two registered machines disagree about any keyword',
    ).not.toBeNull();
    const { word, hasIt, lacksIt } = pair!;
    const listing = `10 LET ${word}=1`;
    const kindOn = (machine: string) =>
      tokensOf(machine, listing).find((t) => t.character === 7)?.type;
    expect(kindOn(hasIt), `${word} on ${hasIt}`).toBe('keyword');
    expect(kindOn(lacksIt), `${word} on ${lacksIt}`).toBe('variable');
  });
});

describe('semanticTokensForRangeOf', () => {
  it('answers about the range asked for and not the whole program', () => {
    const text = '10 PRINT "A"\n20 PRINT "B"\n30 PRINT "C"\n';
    const store = new DocumentStore();
    store.open(URI, text, 1, 'zx81');
    const answer = semanticTokensForRangeOf(store.editorState(URI), {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 12 },
    });
    expect(decode(answer!.data).map((t) => t.line)).toEqual([1, 1, 1]);
  });

  it('reports a range at the end of a long listing as fully as one at the start', () => {
    const store = new DocumentStore();
    store.open(URI, LONG_LISTING, 1, 'zx81');
    const state = store.editorState(URI);
    const kindsOfLine = (line: number) =>
      decode(
        semanticTokensForRangeOf(state, {
          start: { line, character: 0 },
          end: { line, character: longListingLine(line).length },
        })!.data,
      ).map((t) => t.type);
    expect(kindsOfLine(LONG_LISTING_LINES - 1)).toEqual(kindsOfLine(0));
    expect(kindsOfLine(LONG_LISTING_LINES - 1)).toEqual([
      'label',
      'keyword',
      'string',
    ]);
  });
});

/**
 * A listing far longer than an editor shows at once, and far longer than the
 * few kilobytes a lazy parse covers: the whole point of the tests below is that
 * a program's length changes how much there is to report and nothing else.
 *
 * Every line is the same three runs, differing only in its number, so a
 * truncated answer shows up as the last line holding nothing at all rather than
 * as a difference in what its runs are.
 */
const LONG_LISTING_LINES = 2000;
const longListingLine = (index: number) => `${(index + 1) * 10} PRINT "LINE"`;
const LONG_LISTING = Array.from({ length: LONG_LISTING_LINES }, (_, i) =>
  longListingLine(i),
).join('\n');

describe('colour covers all of what was asked about', () => {
  it('reports a listing far longer than a lazy parse covers, to its last line', () => {
    const store = new DocumentStore();
    store.open(URI, LONG_LISTING, 1, 'zx81');
    // The lazy tree stops a fixed few kilobytes in whatever the program's
    // length, and the old budget fell back to it, so the last line of a listing
    // this long is exactly what used to be lost.
    expect(LONG_LISTING.length).toBeGreaterThan(20_000);
    const found = decode(semanticTokensFor(store.editorState(URI))!.data);
    const lastLine = longListingLine(LONG_LISTING_LINES - 1);
    expect(found.at(-1)).toEqual({
      line: LONG_LISTING_LINES - 1,
      character: lastLine.indexOf('"'),
      length: '"LINE"'.length,
      type: 'string',
    });
    expect(found).toHaveLength(LONG_LISTING_LINES * 3);
  });

  it('tells an editor asking twice about an unchanged program the same thing both times', () => {
    // The `EditorState` is cached per version, so a first answer that stopped
    // short stayed short for as long as the document was open: this fails on a
    // truncating implementation rather than passing on the repetition alone,
    // because both answers are checked against the whole listing.
    const store = new DocumentStore();
    store.open(URI, LONG_LISTING, 1, 'zx81');
    const first = semanticTokensFor(store.editorState(URI))!.data;
    const second = semanticTokensFor(store.editorState(URI))!.data;
    expect(second).toEqual(first);
    expect(decode(second)).toHaveLength(LONG_LISTING_LINES * 3);
  });
});

/**
 * A command one registered machine has and another does not, spelled so that
 * both machines would otherwise accept it as a variable name: the one case
 * where two machines must colour the same characters differently.
 */
function findDisagreement(): {
  word: string;
  hasIt: string;
  lacksIt: string;
} | null {
  const commandsOf = new Map(
    dialects.map((d) => [
      d.id,
      new Set(
        d.keywords.filter((k) => k.kind === 'command').map((k) => k.word),
      ),
    ]),
  );
  // A plain alphabetic word only: a symbolic or `$`-suffixed spelling would not
  // be a legal variable name on the machine that lacks it.
  const plain = (word: string) => /^[A-Z]+$/.test(word);
  for (const [hasIt, words] of commandsOf) {
    for (const word of words) {
      if (!plain(word)) continue;
      for (const [lacksIt, others] of commandsOf) {
        if (lacksIt === hasIt || others.has(word)) continue;
        // The machine that lacks it must not read the word as some *other*
        // keyword either - a crunching ROM would split it.
        if ([...others].some((other) => word.startsWith(other))) continue;
        return { word, hasIt, lacksIt };
      }
    }
  }
  return null;
}
