import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { COMPARE_CONVERT_FIELDS, COMPARE_CONVERT_MESSAGE } from './DocsDrawer';

// The porting guide's "Convert … using AI" button posts its message from inside
// the docs iframe, so nothing typechecks across the boundary: a field the two
// sides spell differently makes the button silently do nothing. Pin the shape
// against the docs component that sends it, the same way docsTopic.test.ts pins
// the dialect -> reference-page mapping against the docs tree.
const COMPARE_PAGE = fileURLToPath(
  new URL(
    '../../docs/.vitepress/theme/components/DialectCompare.vue',
    import.meta.url,
  ),
);
const vue = readFileSync(COMPARE_PAGE, 'utf8');

/** The keys of the object literal `DialectCompare.vue` posts to the parent. */
function postedFields(): string[] {
  const payload = /window\.parent\.postMessage\(\s*\{([^}]*)\}/.exec(vue);
  if (!payload) throw new Error('no postMessage payload in DialectCompare.vue');
  return [...payload[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1]);
}

describe('compare-convert message contract', () => {
  it('the compare page posts the message name the drawer listens for', () => {
    expect(vue).toContain(`= '${COMPARE_CONVERT_MESSAGE}'`);
  });

  it('the compare page posts every field the drawer reads', () => {
    expect(postedFields()).toEqual(
      expect.arrayContaining(['type', ...COMPARE_CONVERT_FIELDS]),
    );
  });
});
