import { describe, expect, it } from 'vitest';
import { parseDeepLinkParams } from './deepLinkParams';

describe('parseDeepLinkParams', () => {
  it('reads every deep-link param the reference pages use', () => {
    expect(
      parseDeepLinkParams(
        '?q=print&name=PLOT&cat=colour&domain=graphics&from=zx81&to=bbc',
      ),
    ).toEqual({
      q: 'print',
      name: 'PLOT',
      cat: 'colour',
      domain: 'graphics',
      from: 'zx81',
      to: 'bbc',
    });
  });

  it('reports missing params as null', () => {
    expect(parseDeepLinkParams('')).toEqual({
      q: null,
      name: null,
      cat: null,
      domain: null,
      from: null,
      to: null,
    });
  });

  it('treats an empty value as absent', () => {
    // The drawer drops `?q=` when there is no editor selection; a blank value
    // must clear the search box rather than filter on the empty string.
    expect(parseDeepLinkParams('?q=&name=').q).toBeNull();
    expect(parseDeepLinkParams('?q=&name=').name).toBeNull();
    expect(parseDeepLinkParams('?domain=').domain).toBeNull();
  });

  it('decodes percent-encoded values', () => {
    // referenceTopic() encodes the selection, so keywords with symbols survive.
    expect(parseDeepLinkParams('?q=PRINT%20AT').q).toBe('PRINT AT');
    expect(parseDeepLinkParams('?cat=function%2Bkeys').cat).toBe(
      'function+keys',
    );
  });

  it('ignores params it does not own', () => {
    expect(parseDeepLinkParams('?utm_source=x&q=poke')).toEqual({
      q: 'poke',
      name: null,
      cat: null,
      domain: null,
      from: null,
      to: null,
    });
  });
});
