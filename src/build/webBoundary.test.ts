import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { reachableFrom } from './moduleGraph';

/**
 * The website and the toolchain share a source tree and a `package.json`, and
 * three of the declared dependencies exist for the toolchain alone: the agent
 * protocol SDK and the two language-server packages, together about 1.4MB.
 * Nothing about the layout stops a component importing a helper out of
 * `src/mcp/` or `src/lsp/` and bringing one of them into the browser, and the
 * only symptom would be a bigger download.
 *
 * The reverse is checked from the toolchain's side, in
 * `src/client/thinness.test.ts`.
 *
 * What is deliberately *not* asserted here: the toolchain reaches
 * `@codemirror/*` through every dialect's `language.ts`, so the editor
 * packages are shared rather than web-only. That is a real cost in the host
 * and in every machine thread, and it is not fixable by an import rule - it
 * needs the editor off the `Dialect` interface.
 */

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The app's single client entry: routing, then one of the two shells. */
const WEB_ENTRY = 'main.tsx';

/** Folders that exist to be run by node, not served to a browser. */
const TOOLCHAIN_ONLY = ['cli/', 'server/', 'client/', 'lsp/', 'mcp/'];

/** Packages that only the toolchain has any use for. */
const TOOLCHAIN_PACKAGES = [
  '@modelcontextprotocol/sdk',
  'vscode-languageserver',
  'vscode-languageserver-textdocument',
];

function walkWeb() {
  return reachableFrom(WEB_ENTRY, {
    srcRoot,
    modules: [
      {
        label:
          'a toolchain-only folder (it is written for node, not a browser)',
        hit: (path) => TOOLCHAIN_ONLY.some((dir) => path.startsWith(dir)),
      },
    ],
    packages: [
      {
        label: 'a toolchain-only package (the browser has no use for it)',
        hit: (specifier) =>
          TOOLCHAIN_PACKAGES.some(
            (pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`),
          ),
      },
    ],
  });
}

describe('what the website carries', () => {
  it('reaches no toolchain folder and no toolchain-only package', () => {
    // The walk throws on the first breach, naming the chain that reached it.
    expect(walkWeb().modules.size).toBeGreaterThan(0);
  });

  it('walks the whole app, so the check above means something', () => {
    // A walk that stopped at the entry would pass forever. `main.tsx` lazily
    // imports both shells, and the walk follows dynamic imports, so the
    // registry and the editor are well inside the set it covers.
    const { modules, packages } = walkWeb();
    expect(modules.size).toBeGreaterThan(200);
    expect([...modules.keys()]).toContain('dialects/registry.ts');
    expect([...packages.keys()]).toContain('react');
  });

  it('lists packages this project actually depends on', () => {
    // If one were renamed or dropped, the rule above would quietly stop
    // covering it and nothing else would notice.
    const declared = JSON.parse(
      readFileSync(resolve(srcRoot, '../package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };
    for (const pkg of TOOLCHAIN_PACKAGES) {
      expect(Object.keys(declared.dependencies), pkg).toContain(pkg);
    }
  });
});
