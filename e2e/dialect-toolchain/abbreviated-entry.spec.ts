// Capability: dialect-toolchain — openspec/specs/dialect-toolchain/spec.md
import { test, expect } from '../fixtures';
import {
  openApp,
  setEditorSource,
  selectDialect,
  playAndWaitRunning,
  expectCanvasAdvancing,
} from '../helpers';

/**
 * A magazine listing pasted in its own notation runs on the machine it was
 * printed for.
 *
 * What only a browser proves: the whole path from pasted text through the
 * editor, the tokenizer and the loader to a C64 painting frames. The tokenizer's
 * own reading of every abbreviation - the sweep, the reserved-word order, the
 * spellings that are inert inside strings - is pinned against the machine's
 * keyword table in `src/dialects/commodore64/tokenizer.test.ts`, where it costs
 * no browser at all; this is the one journey that shows the notation reaching a
 * running machine.
 *
 * Also this capability's browser smoke test, so a build that boots no machine
 * fails somewhere other than a screenshot diff.
 */
test('a shifted-letter listing pasted from an archive runs', async ({
  page,
}) => {
  await openApp(page);
  await selectDialect(page, 'commodore64');
  // `pO` is POKE and `goT` is GOTO on a Commodore, exactly as they were typed
  // at the machine's own keyboard. The border colour cycles, so the screen
  // keeps moving while the loop runs.
  await setEditorSource(page, '10 pO53280,C\n20 C=C+1\n30 goT10');

  await playAndWaitRunning(page);
  await expectCanvasAdvancing(page);

  // The abbreviations tokenized rather than being stored as text: a line the
  // machine could not read would have left the tokenizer complaining in the
  // status bar.
  await expect(page.getByText('no errors')).toBeVisible();
});
