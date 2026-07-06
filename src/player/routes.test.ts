import { describe, expect, it } from 'vitest';
import {
  SHARE_ID_RE,
  SHARE_VERBS,
  parsePlayerPath,
  playerPathFor,
} from './routes';
import { dialects } from '../dialects/registry';

describe('SHARE_VERBS', () => {
  it('is a bijection with the dialect registry', () => {
    const verbIds = SHARE_VERBS.map((v) => v.dialectId).sort();
    const registryIds = dialects.map((d) => d.id).sort();
    expect(verbIds).toEqual(registryIds);
  });

  it('has no duplicate verbs', () => {
    const verbs = SHARE_VERBS.map((v) => v.verb);
    expect(new Set(verbs).size).toBe(verbs.length);
  });
});

describe('SHARE_ID_RE', () => {
  it('accepts six characters of the unambiguous alphabet', () => {
    expect(SHARE_ID_RE.test('abc234')).toBe(true);
    expect(SHARE_ID_RE.test('zzzzzz')).toBe(true);
  });

  it('rejects ambiguous characters, wrong lengths and uppercase', () => {
    for (const bad of [
      'abc23', // too short
      'abc2345', // too long
      'abc23O', // ambiguous O
      'abc230', // ambiguous 0
      'abc23l', // ambiguous l
      'abc23i', // ambiguous i
      'abc231', // ambiguous 1
      'ABC234', // uppercase
      '', // empty
    ]) {
      expect(SHARE_ID_RE.test(bad), bad).toBe(false);
    }
  });
});

describe('parsePlayerPath', () => {
  it('parses every verb to its dialect', () => {
    for (const { verb, dialectId } of SHARE_VERBS) {
      expect(parsePlayerPath(`/${verb}/abc234`)).toEqual({
        verb,
        dialectId,
        shareId: 'abc234',
      });
    }
  });

  it('tolerates a trailing slash', () => {
    expect(parsePlayerPath('/run/abc234/')).toMatchObject({
      dialectId: 'commodore64',
      shareId: 'abc234',
    });
  });

  it('returns null for anything else', () => {
    for (const path of [
      '/',
      '/run', // no id
      '/run/abc23', // bad id
      '/run/ABC234', // uppercase id
      '/list/abc234', // unknown verb
      '/run/abc234/extra', // extra segment
      '/docs/guide', // docs site
      '/run/abc234?x=1', // query strings are not part of pathname
    ]) {
      expect(parsePlayerPath(path), path).toBeNull();
    }
  });
});

describe('playerPathFor', () => {
  it('round-trips with parsePlayerPath for every dialect', () => {
    for (const { dialectId } of SHARE_VERBS) {
      const path = playerPathFor(dialectId, 'xyz789');
      expect(parsePlayerPath(path)).toMatchObject({
        dialectId,
        shareId: 'xyz789',
      });
    }
  });

  it('throws for an unknown dialect', () => {
    expect(() => playerPathFor('nope', 'abc234')).toThrow(/No share verb/);
  });
});
