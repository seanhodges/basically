import { describe, expect, it } from 'vitest';
import { schemaProblem, withoutUndefined } from './schema';

const schema = {
  type: 'object',
  properties: {
    source: { type: 'string' },
    frames: { type: 'integer' },
    on: { type: 'boolean' },
    mode: { type: 'string', enum: ['fast', 'slow'] },
  },
  required: ['source'],
  additionalProperties: false,
};

describe('checking an input against its schema', () => {
  it('accepts what fits, absent optionals included', () => {
    expect(schemaProblem(schema, { source: 'x' })).toBeNull();
    expect(
      schemaProblem(schema, { source: 'x', frames: 3, on: true, mode: 'fast' }),
    ).toBeNull();
    expect(
      schemaProblem(schema, { source: 'x', frames: undefined }),
    ).toBeNull();
  });

  it('names what does not fit', () => {
    expect(schemaProblem(schema, {})).toBe('input is missing source');
    expect(schemaProblem(schema, { source: 1 })).toBe(
      'input.source must be a string',
    );
    expect(schemaProblem(schema, { source: 'x', frames: 1.5 })).toBe(
      'input.frames must be a whole number',
    );
    expect(schemaProblem(schema, { source: 'x', on: 'yes' })).toBe(
      'input.on must be true or false',
    );
    expect(schemaProblem(schema, { source: 'x', mode: 'faster' })).toBe(
      'input.mode must be one of fast, slow',
    );
    expect(schemaProblem(schema, { source: 'x', extra: 1 })).toBe(
      'input has no property extra',
    );
    expect(schemaProblem(schema, 'x')).toBe('input must be an object');
  });

  it('refuses a schema it cannot read rather than passing everything', () => {
    expect(() => schemaProblem({ type: 'array' }, [])).toThrow(/unsupported/);
  });

  it('drops undefined properties so an input reads as its JSON would', () => {
    expect(withoutUndefined({ a: 1, b: undefined })).toEqual({ a: 1 });
  });
});
