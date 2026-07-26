// Capability: hardware-transfer — openspec/specs/hardware-transfer/spec.md
import { readFile } from 'node:fs/promises';
import { test, expect } from '../fixtures';
import {
  EDITOR,
  fileMenu,
  forceFallbackFilePickers,
  openApp,
  saveAsProject,
  setEditorSource,
} from '../helpers';

/**
 * Test plan §6 - Cassette audio import.
 * (docs/contributing/cross-browser-test-plan.md)
 *
 * 6.5 is fully automated as a lossless loop: export the cassette .wav, then
 * decode it back through the Web Audio pipeline (decodeAudioData → dialect
 * decoder). Real microphone capture (6.1–6.4, 6.6) needs a signal path and
 * permission UI that automation can't provide - manual.
 */

test('6.5 wav round trip: export cassette .wav, import and decode it', async ({
  page,
}) => {
  test.setTimeout(120_000); // encoding + decodeAudioData of ~30s of audio
  await forceFallbackFilePickers(page);
  const dialogs = await openApp(page);
  // Playwright's WebKit build on Windows/Linux ships without Web Audio, which
  // the import decode needs (decodeAudioData). Feature-detect rather than skip
  // by browser so the test still runs where WebKit has it (e.g. macOS).
  test.skip(
    await page.evaluate(() => typeof AudioContext === 'undefined'),
    'Web Audio unavailable in this WebKit build',
  );
  await setEditorSource(page, '10 PRINT "TAPE LOOP"\n20 GOTO 10');
  await saveAsProject(page, dialogs, 'tapeloop');

  // Export the cassette audio.
  await fileMenu(page, /^Export/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .wav' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.wav$/i);
  const wav = await readFile(await download.path());
  expect(wav.length).toBeGreaterThan(44); // more than a bare WAV header
  await page.getByRole('button', { name: 'Close' }).click();

  // Wipe the editor and decode the recording back in.
  await setEditorSource(page, '10 REM GONE');
  await fileMenu(page, /^Import/);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import .wav recording' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'tapeloop.wav',
    mimeType: 'audio/wav',
    buffer: wav,
  });
  await expect(page.locator(EDITOR)).toContainText('PRINT "TAPE LOOP"', {
    timeout: 60_000,
  });
  await expect(page.locator(EDITOR)).toContainText('20 GOTO 10');
});
