import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import { buildBasicLanguage } from './basicLanguage';
import type { KeywordInfo } from '../dialects/types';
import { zx81Keywords } from '../dialects/zx81/keywords';
import { spectrumKeywords } from '../dialects/zxspectrum/keywords';
import { bbcKeywords } from '../dialects/bbcmicro/keywords';

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
    const bbc = { nameChars: '_', suffixChars: '$%', graphicsEscapes: false };

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

    it('real BBC dialect tags A% as a variable', () => {
      expect(classify('10 A%', bbcKeywords, bbc)).toContainEqual(['A%', 'var']);
    });
  });
});
