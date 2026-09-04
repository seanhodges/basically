import type { InputSchema } from './types';

/**
 * The part of JSON Schema an operation's input uses, checked here so a call
 * from a model and an input from the command line's parser are held to the
 * same shape before an operation sees either.
 *
 * Objects with typed properties, a required list and no extras; strings,
 * numbers, integers and booleans; an enum of strings. Nothing else is written
 * in a schema here, and a schema using anything else fails loudly rather than
 * passing whatever it cannot read.
 */

/** Why a value does not fit its schema, or null when it does. */
export function schemaProblem(
  schema: InputSchema,
  value: unknown,
  path = 'input',
): string | null {
  const type = schema.type;
  if (schema.enum !== undefined) {
    const allowed = schema.enum as unknown[];
    return allowed.includes(value)
      ? null
      : `${path} must be one of ${allowed.map(String).join(', ')}`;
  }
  switch (type) {
    case 'string':
      return typeof value === 'string' ? null : `${path} must be a string`;
    case 'boolean':
      return typeof value === 'boolean'
        ? null
        : `${path} must be true or false`;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? null
        : `${path} must be a number`;
    case 'integer':
      return Number.isInteger(value) ? null : `${path} must be a whole number`;
    case 'object':
      return objectProblem(schema, value, path);
    default:
      throw new Error(`schema at ${path} uses an unsupported type "${type}"`);
  }
}

function objectProblem(
  schema: InputSchema,
  value: unknown,
  path: string,
): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return `${path} must be an object`;
  }
  const given = value as Record<string, unknown>;
  const properties = (schema.properties ?? {}) as Record<string, InputSchema>;
  const required = (schema.required ?? []) as string[];
  for (const name of required) {
    if (given[name] === undefined) return `${path} is missing ${name}`;
  }
  for (const [name, item] of Object.entries(given)) {
    // An absent optional is written as undefined by the command line's parser
    // and as nothing at all by a model; both mean "not given".
    if (item === undefined) continue;
    const property = properties[name];
    if (!property) {
      if (schema.additionalProperties === false) {
        return `${path} has no property ${name}`;
      }
      continue;
    }
    const problem = schemaProblem(property, item, `${path}.${name}`);
    if (problem) return problem;
  }
  return null;
}

/**
 * The value with its undefined properties dropped, so what an operation is
 * handed is what a JSON reader would have read: no key that is not there.
 */
export function withoutUndefined<T extends Record<string, unknown>>(
  value: T,
): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}
