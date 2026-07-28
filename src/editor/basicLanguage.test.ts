import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import { buildBasicLanguage } from './basicLanguage';
import type { KeywordInfo } from '../dialects/types';
import { zx81Keywords } from '../dialects/zx81/keywords';
import { spectrumKeywords } from '../dialects/zxspectrum/keywords';
import { bbcKeywords } from '../dialects/bbcmicro/keywords';
import { c64Keywords } from '../dialects/commodore64/keywords';

const testKeywords: KeywordInfo[] = [
  { word: 'PRINT', token: 1, kind: 'command' },
  { word: 'LET', token: 2, kind: 'command' },
  { word: 'REM', token: 3, kind: 'command' },
  { word: 'SIN', token: 4, kind: 'function' },
  { word: 'CHR$', token: 5, kind: 'function' },
  { word: 'AND', token: 6, kind: 'operator' },
  { word: '**', token: 7, kind: 'operator' },
];

// Readable class names so we can assert which role each token was tagged with.
const probe = tagHighlighter([
  { tag: tags.keyword, class: 'cmd' },
  { tag: tags.function(tags.variableName), class: 'fn' },
  { tag: tags.variableName, class: 'var' },
  { tag: tags.operator, class: 'op' },
  { tag: tags.string, class: 'str' },
  { tag: tags.comment, class: 'comment' },
  { tag: tags.labelName, class: 'label' },
  { tag: tags.atom, class: 'atom' },
  { tag: tags.number, class: 'number' },
]);

/** Highlight `doc` with the given dialect, returning [text, class] per token. */
function classify(
  doc: string,
  keywords: KeywordInfo[] = testKeywords,
  options?: Parameters<typeof buildBasicLanguage>[2],
): Array<[string, string]> {
  const language = buildBasicLanguage(keywords, () => null, options).language;
  const state = EditorState.create({ doc, extensions: [language] });
  const tree = ensureSyntaxTree(state, doc.length, 1e9);
  if (!tree) throw new Error('no syntax tree');
  const out: Array<[string, string]> = [];
  highlightTree(tree, probe, (from, to, cls) => {
    out.push([doc.slice(from, to), cls]);
  });
  return out;
}

describe('buildBasicLanguage highlighting', () => {
  it('colours commands, functions, operators and variables distinctly', () => {
    const tokens = classify('10 PRINT SIN A AND B');
    expect(tokens).toEqual([
      ['10', 'label'],
      ['PRINT', 'cmd'],
      ['SIN', 'fn'],
      ['A', 'var'],
      ['AND', 'op'],
      ['B', 'var'],
    ]);
  });

  it('tags $-suffixed functions and symbolic operators', () => {
    const tokens = classify('20 LET C=CHR$ B');
    expect(tokens).toContainEqual(['LET', 'cmd']);
    expect(tokens).toContainEqual(['CHR$', 'fn']);
    expect(tokens).toContainEqual(['B', 'var']);

    const exp = classify('30 PRINT A**B');
    expect(exp).toContainEqual(['**', 'op']);
  });

  it('keeps REM comments and strings on their own tags', () => {
    expect(classify('40 REM hello there')).toContainEqual([
      ' hello there',
      'comment',
    ]);
    expect(classify('50 PRINT "HI"')).toContainEqual(['"HI"', 'str']);
  });

  it('does not treat a keyword glued into an identifier as a keyword', () => {
    // PRINTED begins with PRINT but is one identifier run -> variable.
    const tokens = classify('60 PRINTED');
    expect(tokens).toContainEqual(['PRINTED', 'var']);
  });

  // Guards against a future keyword-table entry (e.g. a 2-char $ keyword)
  // silently mis-colouring a plain variable in any shipped dialect.
  describe.each([
    ['zx81', zx81Keywords],
    ['zxspectrum', spectrumKeywords],
    ['bbcmicro', bbcKeywords],
  ] as const)('variable detection for %s', (_name, keywords) => {
    it.each(['A', 'k$'])('tags %s as a variable', (name) => {
      expect(classify(`10 ${name}`, keywords)).toContainEqual([name, 'var']);
    });
  });

  describe('dialect lexical options', () => {
    const bbc = {
      nameChars: '_',
      suffixChars: '$%',
      graphicsEscapes: false,
      hexPrefix: '&',
      binaryPrefix: '%',
    };

    it('treats BBC integer (%) and underscore variables as one variable', () => {
      expect(classify('10 A%', testKeywords, bbc)).toContainEqual([
        'A%',
        'var',
      ]);
      expect(classify('20 score%=0', testKeywords, bbc)).toContainEqual([
        'score%',
        'var',
      ]);
      expect(classify('30 my_var', testKeywords, bbc)).toContainEqual([
        'my_var',
        'var',
      ]);
    });

    it('does not mis-tag % as a variable suffix for the default dialect', () => {
      // Default (ZX81/Spectrum): % is not part of the name, so A stands alone.
      expect(classify('10 A%X', testKeywords)).toContainEqual(['A', 'var']);
    });

    it('keeps a keyword glued to an underscore name as a variable (BBC)', () => {
      // AND is an operator keyword; AND_X is one BBC variable.
      expect(classify('10 AND_X', testKeywords, bbc)).toContainEqual([
        'AND_X',
        'var',
      ]);
    });

    it('still recognises ZX-style graphics escapes by default', () => {
      // %.. is a graphics/inverse escape unless graphicsEscapes is disabled.
      expect(classify('10 PRINT %ab')).toContainEqual(['%ab', 'atom']);
    });

    it('tags the machine graphics characters like the escape spellings', () => {
      // A block graphic is not a keyword, name or number; without a tag of its
      // own it would draw in the default (dimmed) style, which is the wrong
      // emphasis for the shapes a program draws with.
      expect(classify('10 PRINT ▘▄▒')).toContainEqual(['▘▄▒', 'atom']);
    });

    it('tags an astral graphics character as one unit', () => {
      // The Spectrum's user-defined graphics are outside the BMP, so a naive
      // per-code-unit rule would split one character in two.
      expect(classify('10 PRINT 🄰')).toContainEqual(['🄰', 'atom']);
    });

    it('leaves the graphics tagging to the dialect for BBC-style dialects', () => {
      // Mode-7 mosaics are graphics too - the rule is not gated on
      // graphicsEscapes, which only governs the `%`/`\` two-char spellings.
      expect(classify('10 PRINT "x"', bbcKeywords, bbc)).toContainEqual([
        '"x"',
        'str',
      ]);
      expect(classify('10 PRINT ▘', bbcKeywords, bbc)).toContainEqual([
        '▘',
        'atom',
      ]);
    });

    it('real BBC dialect tags A% as a variable', () => {
      expect(classify('10 A%', bbcKeywords, bbc)).toContainEqual(['A%', 'var']);
    });

    it('tags BBC hex (&) and binary (%) literals as numbers', () => {
      // &FFFF must not be mis-read as a variable named FFFF.
      const hex = classify('10 A=&FF00', testKeywords, bbc);
      expect(hex).toContainEqual(['&FF00', 'number']);
      expect(hex).not.toContainEqual(['FF00', 'var']);

      expect(classify('20 B=%1010', testKeywords, bbc)).toContainEqual([
        '%1010',
        'number',
      ]);
    });

    it('tags the caret exponent operator', () => {
      expect(classify('10 A=B^2')).toContainEqual(['^', 'op']);
    });

    // Acorn Atom opts its own operators (! % & \) into the operator set via
    // extraOperators; ?, $ and : are already shared.
    const atom = { graphicsEscapes: false, suffixChars: '', hexPrefix: '#' };
    const atomOps = { ...atom, extraOperators: '!%&\\' };

    it.each(['!', '%', '&', '\\'])(
      'tags the Atom operator %s when extraOperators includes it',
      (op) => {
        expect(classify(`10 A=B${op}C`, testKeywords, atomOps)).toContainEqual([
          op,
          'op',
        ]);
      },
    );

    it('does not tag those characters as operators without extraOperators', () => {
      // Same lexical options minus extraOperators: ! % & \ fall through untagged
      // (guarding that the option, not the shared set, is what styles them).
      for (const op of ['!', '%', '&', '\\']) {
        expect(classify(`10 A=B${op}C`, testKeywords, atom)).not.toContainEqual(
          [op, 'op'],
        );
      }
    });

    it('still tags the shared ? $ : operators for the Atom', () => {
      expect(classify('10 ?A=B', testKeywords, atomOps)).toContainEqual([
        '?',
        'op',
      ]);
      expect(classify('10 A=B:C', testKeywords, atomOps)).toContainEqual([
        ':',
        'op',
      ]);
    });
  });

  describe('crunched highlighting (C64/TRS-80)', () => {
    // Mirrors c64LanguageSupport(): the ROM ignores spaces, so glued keywords
    // must highlight exactly the way the tokenizer will split them.
    const crunched = {
      suffixChars: '$%',
      graphicsEscapes: false,
      crunched: true,
    };
    const c64 = (doc: string) => classify(doc, c64Keywords, crunched);

    it('splits a keyword glued to a variable (POKEA,10)', () => {
      const tokens = c64('10 POKEA,10');
      expect(tokens).toContainEqual(['POKE', 'cmd']);
      expect(tokens).toContainEqual(['A', 'var']);
    });

    it('splits a fully crunched FOR loop (FORI=1TO10)', () => {
      const tokens = c64('10 FORI=1TO10');
      expect(tokens).toContainEqual(['FOR', 'cmd']);
      expect(tokens).toContainEqual(['I', 'var']);
      expect(tokens).toContainEqual(['TO', 'op']);
      expect(tokens).toContainEqual(['10', 'number']);
    });

    it('splits a keyword glued to trailing letters (PRINTX, PRINTED)', () => {
      expect(c64('10 PRINTX')).toContainEqual(['PRINT', 'cmd']);
      expect(c64('10 PRINTX')).toContainEqual(['X', 'var']);
      // ROM-faithful: PRINTED is PRINT + ED, not one variable.
      expect(c64('10 PRINTED')).toContainEqual(['PRINT', 'cmd']);
      expect(c64('10 PRINTED')).toContainEqual(['ED', 'var']);
    });

    it('shows a keyword embedded mid-name (SCORE is SC OR E)', () => {
      const tokens = c64('10 SCORE=1');
      expect(tokens).toContainEqual(['SC', 'var']);
      expect(tokens).toContainEqual(['OR', 'op']);
      expect(tokens).toContainEqual(['E', 'var']);
    });

    it('longest keyword wins (GOTO100 is GOTO, not GO)', () => {
      const tokens = c64('10 GOTO100');
      expect(tokens).toContainEqual(['GOTO', 'cmd']);
      expect(tokens).toContainEqual(['100', 'number']);
    });

    it('REM glued to text still comments the rest of the line', () => {
      const tokens = c64('10 REMARKS HERE');
      expect(tokens).toContainEqual(['REM', 'cmd']);
      expect(tokens).toContainEqual(['ARKS HERE', 'comment']);
    });

    it('splits a $-suffixed keyword at a token boundary (ALEFT$)', () => {
      const tokens = c64('10 B=ALEFT$(A$,1)');
      expect(tokens).toContainEqual(['A', 'var']);
      expect(tokens).toContainEqual(['LEFT$', 'fn']);
    });

    it('never splits inside a string literal', () => {
      expect(c64('10 PRINT"FORI"')).toContainEqual(['"FORI"', 'str']);
    });

    it('non-crunched dialects keep the whole-run rule (zx81/bbc)', () => {
      expect(classify('10 PRINTX', zx81Keywords)).toContainEqual([
        'PRINTX',
        'var',
      ]);
      expect(
        classify('10 PRINTX', bbcKeywords, {
          nameChars: '_',
          suffixChars: '$%',
          graphicsEscapes: false,
        }),
      ).toContainEqual(['PRINTX', 'var']);
    });
  });
});
