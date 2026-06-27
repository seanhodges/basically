import { describe, it, expect } from 'vitest';
import { getDialect } from '../dialects/registry';
import { referenceTopic } from './docsTopic';

describe('referenceTopic', () => {
  it('returns null when the selection is empty or whitespace only', () => {
    const zx81 = getDialect('zx81');
    expect(referenceTopic(zx81, '')).toBeNull();
    expect(referenceTopic(zx81, '   \n\t ')).toBeNull();
  });

  it('builds a reference path with the keyword query for a self-named page', () => {
    expect(referenceTopic(getDialect('zx81'), 'PRINT')).toBe(
      'reference/zx81?q=PRINT',
    );
  });

  it('maps dialects that share a reference page to that page', () => {
    expect(referenceTopic(getDialect('zxspectrum128'), 'BEEP')).toBe(
      'reference/zxspectrum?q=BEEP',
    );
    expect(referenceTopic(getDialect('bbcmicro'), 'MODE')).toBe(
      'reference/bbc?q=MODE',
    );
    expect(referenceTopic(getDialect('bbcmaster'), 'MODE')).toBe(
      'reference/bbc?q=MODE',
    );
  });

  it('uses only the first token of a multi-word selection', () => {
    expect(referenceTopic(getDialect('zx81'), '  PRINT AT 0,0  ')).toBe(
      'reference/zx81?q=PRINT',
    );
  });

  it('url-encodes special characters in the keyword', () => {
    expect(referenceTopic(getDialect('zx81'), '<=')).toBe(
      'reference/zx81?q=%3C%3D',
    );
  });
});
