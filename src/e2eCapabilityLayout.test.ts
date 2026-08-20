import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The e2e/ suite mirrors the OpenSpec capability layout: every spec folder is
// named after a baseline capability in openspec/specs/, so "which e2e tests
// cover <capability>?" is answered by `ls e2e/`. `shell` is reserved for
// cross-cutting UI specs no single capability owns. Capabilities without e2e
// coverage (e.g. unit-tested-only ones) are legal, so this check is one-way.
const ROOT = join(__dirname, '..');
const RESERVED = ['shell'];
const ROOT_SPEC_EXCEPTIONS = ['capture-docs-screenshots.spec.ts'];

function dirNames(path: string): string[] {
  return (
    readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      // `__`-prefixed folders are generated output, not spec folders: a
      // Playwright run writes e2e/__screenshots__/ (gitignored), and it must
      // not make this check fail on a working copy that has run the suite.
      .filter((entry) => !entry.name.startsWith('__'))
      .map((entry) => entry.name)
  );
}

/**
 * Capabilities an in-flight change is adding, which do not reach
 * `openspec/specs/` until it is archived.
 *
 * A new capability's browser coverage is written with the change that
 * introduces it, so its `e2e/` folder legitimately exists before the baseline
 * spec does. Read from the change folders rather than exempted by name, so the
 * allowance disappears on its own when the change is archived - by which point
 * the capability is in the baseline anyway.
 */
function inFlightCapabilities(): string[] {
  const changes = join(ROOT, 'openspec', 'changes');
  return dirNames(changes)
    .filter((change) => change !== 'archive')
    .flatMap((change) => {
      const specs = join(changes, change, 'specs');
      return existsSync(specs) ? dirNames(specs) : [];
    });
}

describe('e2e capability layout', () => {
  it('every e2e/ folder is an openspec capability or reserved', () => {
    const capabilities = [
      ...dirNames(join(ROOT, 'openspec', 'specs')),
      ...inFlightCapabilities(),
    ];
    for (const folder of dirNames(join(ROOT, 'e2e'))) {
      expect(
        [...capabilities, ...RESERVED],
        `e2e/${folder}/ matches no capability in openspec/specs/ — name e2e folders after capabilities (or put cross-cutting specs in e2e/shell/)`,
      ).toContain(folder);
    }
  });

  it('no spec files sit at the e2e/ root', () => {
    const rootSpecs = readdirSync(join(ROOT, 'e2e'))
      .filter((name) => name.endsWith('.spec.ts'))
      .filter((name) => !ROOT_SPEC_EXCEPTIONS.includes(name));
    expect(
      rootSpecs,
      'specs belong in e2e/<capability>/ (or e2e/shell/), not the e2e/ root',
    ).toEqual([]);
  });
});
