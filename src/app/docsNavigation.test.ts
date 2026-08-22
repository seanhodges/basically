import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dialects } from '../dialects/registry';
import { referencePageOf } from '../dialects/referencePage';

/**
 * Every registered machine's reference page is reachable from the docs site.
 *
 * `docsTopic.test.ts` already proves the page *file* exists, which is what
 * keeps the IDE's docs button off a 404. It says nothing about whether a reader
 * who never presses that button can find the page: a `.md` absent from both the
 * sidebar and the reference index is published and unreachable, which is how a
 * newly registered machine's documentation stayed invisible while every test
 * passed.
 *
 * Read as text and pinned on the link path (`/reference/<page>`, `./<page>`)
 * rather than on any structure: importing the VitePress config would pull its
 * types into the unit-test graph to learn what one regex already knows, and the
 * link is the part that has to be right anyway.
 */

const CONFIG = fileURLToPath(
  new URL('../../docs/.vitepress/config.ts', import.meta.url),
);
const INDEX = fileURLToPath(
  new URL('../../docs/reference/index.md', import.meta.url),
);

/** The reference pages, once each, in registry order. */
const PAGES = [...new Set(dialects.map((d) => referencePageOf(d)))];

/** Which machines read from a page, for a failure that names them. */
const machinesOn = (page: string): string =>
  dialects
    .filter((d) => referencePageOf(d) === page)
    .map((d) => d.name)
    .join(', ');

describe('the docs reference navigation', () => {
  const config = readFileSync(CONFIG, 'utf8');
  const index = readFileSync(INDEX, 'utf8');

  it.each(PAGES)('%s is in the sidebar', (page) => {
    expect(
      config.includes(`link: '/reference/${page}'`),
      `nothing in the sidebar links to /reference/${page} (${machinesOn(page)})`,
    ).toBe(true);
  });

  it.each(PAGES)('%s is in the reference index', (page) => {
    expect(
      index.includes(`](./${page})`),
      `docs/reference/index.md lists no link to ./${page} (${machinesOn(page)})`,
    ).toBe(true);
  });
});
