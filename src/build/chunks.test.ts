import { describe, expect, it } from 'vitest';
import { chunkFor } from './chunks';

/**
 * The names matter beyond tidiness: `vite.config.ts` globs `assets/ai-*.js` and
 * `assets/reference-*.js` to keep the assistant's downloads out of the service
 * worker's precache. A rule that stops matching takes that trim with it.
 */

const ROOT = '/repo';

describe('which chunk a module belongs in', () => {
  it('leaves the AI provider SDKs unnamed, so each stays deferred', () => {
    // Naming them by package undid Rollup's own split: the three share enough
    // internals that a chunk per package put one in the initial download and
    // made another depend on it. The precache globs match Rollup's names.
    const ids = [
      `${ROOT}/node_modules/@anthropic-ai/sdk/index.mjs`,
      `${ROOT}/node_modules/openai/index.mjs`,
      `${ROOT}/node_modules/@google/genai/dist/index.mjs`,
    ];
    for (const id of ids) {
      expect(chunkFor(id), id).toBeUndefined();
    }
  });

  it('names nothing under src/, reference data included', () => {
    // Tried and reverted: most of `src/reference/` is fetched on demand, but
    // `machines.ts` and `abbreviations.ts` are reached before first paint, and
    // one name over both precached the wrong half.
    const ids = [
      `${ROOT}/src/reference/bbc.ts`,
      `${ROOT}/src/reference/escapes/commodore.ts`,
      `${ROOT}/src/reference/machineDescription.ts`,
      `${ROOT}/src/reference/machines.ts`,
      `${ROOT}/src/ai/providers/anthropic.ts`,
    ];
    for (const id of ids) {
      expect(chunkFor(id), id).toBeUndefined();
    }
  });

  it('keeps the editor and the BBC core apart', () => {
    expect(
      chunkFor(`${ROOT}/node_modules/@codemirror/view/dist/index.js`),
    ).toBe('codemirror');
    expect(chunkFor(`${ROOT}/node_modules/@lezer/common/dist/index.js`)).toBe(
      'codemirror',
    );
    expect(chunkFor(`${ROOT}/node_modules/jsbeeb/src/6502.js`)).toBe('jsbeeb');
  });

  it('leaves the storage engine unnamed, so it stays deferred', () => {
    // Naming these as one chunk moved all four into the initial download: a
    // small part of the engine is reached before the first dynamic import is,
    // and a manual chunk is all-or-nothing. Unnamed, Rollup splits it along
    // that boundary itself.
    for (const pkg of ['rxdb', 'rxjs', 'dexie', 'mingo', 'broadcast-channel']) {
      expect(
        chunkFor(`${ROOT}/node_modules/${pkg}/index.js`),
        pkg,
      ).toBeUndefined();
    }
  });

  it('leaves everything else to Rollup', () => {
    const ids = [
      `${ROOT}/src/app/store.ts`,
      `${ROOT}/src/dialects/zx81/index.ts`,
      `${ROOT}/src/components/Workspace.tsx`,
      `${ROOT}/node_modules/react-dom/client.js`,
      `${ROOT}/src/ai/aiClient.ts`,
    ];
    for (const id of ids) {
      expect(chunkFor(id), id).toBeUndefined();
    }
  });

  it('reads a Windows path the same way', () => {
    expect(chunkFor('C:\\repo\\node_modules\\jsbeeb\\src\\6502.js')).toBe(
      'jsbeeb',
    );
    expect(
      chunkFor('C:\\repo\\node_modules\\@codemirror\\view\\dist\\index.js'),
    ).toBe('codemirror');
  });

  // A nested `node_modules` (a package with its own copy of a dependency)
  // belongs to the inner package, not the outer one.
  it('resolves a nested dependency against the innermost node_modules', () => {
    expect(
      chunkFor(`${ROOT}/node_modules/openai/node_modules/jsbeeb/src/6502.js`),
    ).toBe('jsbeeb');
  });
});
