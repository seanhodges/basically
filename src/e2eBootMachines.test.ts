import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dialects } from './dialects/registry';
import { machineIsRunnable } from './app/machineAvailability';

/**
 * The machines `e2e/program-execution/emulator-boot.spec.ts` expects the picker
 * to offer, pinned to the registry.
 *
 * The spec's own guard already compares its list against the picker in a real
 * browser, which is the check that matters - but it only runs when the e2e
 * matrix does, so a machine registered between browser runs left the list
 * quietly short and every `npm test` green. This is the same claim, made where
 * a registered machine has to answer for it.
 *
 * Read as text rather than imported, so the Playwright-side file stays free of
 * anything that would pull the emulator cores into vitest - the trade
 * `graphicsPalette.test.ts` makes against `e2e/paletteMachines.ts`.
 */

const LIST = fileURLToPath(new URL('../e2e/bootMachines.ts', import.meta.url));

function listed(): { id: string; label: string }[] {
  const source = readFileSync(LIST, 'utf8');
  const body = /BOOT_MACHINES\s*=\s*\[([\s\S]*?)\n\];/.exec(source);
  if (!body) throw new Error(`no BOOT_MACHINES array in ${LIST}`);
  return [...body[1]!.matchAll(/id:\s*'([^']+)',\s*label:\s*'([^']+)'/g)].map(
    (m) => ({ id: m[1]!, label: m[2]! }),
  );
}

/**
 * What the picker offers a stock build before any ROM probe lands. That is the
 * same decision `runnableMachines` makes on first paint, so the spec's list is
 * pinned to the rule rather than to a second copy of its outcome.
 */
const offered = dialects
  .filter((d) => machineIsRunnable(d, { customRoms: {}, bundled: null }))
  .map((d) => ({ id: d.id, label: d.name }));

describe('the e2e boot machine list', () => {
  it('names every machine the picker offers, with its own label', () => {
    expect(
      listed(),
      'update e2e/bootMachines.ts so the boot spec covers every machine the ' +
        'picker offers',
    ).toEqual(offered);
  });
});
