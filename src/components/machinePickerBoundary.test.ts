/**
 * The docs runtime renders the IDE's machine picker (see
 * `docs/.vitepress/theme/components/MachinePicker.vue`), so the picker's
 * modules are imported by two bundles: the app's, and the documentation site's.
 *
 * The rule used to be "the docs never import `src/` at all", which was a proxy
 * for the thing that actually matters - `src/dialects/registry.ts` imports
 * every dialect index, and each pulls in an emulator core, so one careless
 * import puts a Z80 or a 6502 into a documentation page. This test states the
 * hazard directly and executably: whatever the picker's leaves come to import,
 * the registry and the emulator cores stay out of the transitive set.
 *
 * It resolves imports itself rather than asking a bundler, because the failure
 * has to name the module that reached the registry - `machinePicker.ts →
 * … → registry.ts` is actionable in a way that a 400KB docs chunk is not.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, '..');

/**
 * Every dialect's memory map, read off disk rather than listed.
 *
 * The porting guide renders both compared machines' maps, so it imports these
 * directly - the data is structured, and mirroring it into `src/reference/`
 * the way the porting *facts* are mirrored would buy a duplicate dataset and a
 * deep-equality test to keep it honest. Discovered rather than enumerated so a
 * dialect added later is covered without anyone remembering to add it here,
 * which is the property `src/dialects/memoryMap.test.ts` is built around too.
 */
const MEMORY_MAPS = readdirSync(join(srcRoot, 'dialects'), {
  withFileTypes: true,
})
  .filter((e) => e.isDirectory())
  .map((e) => `dialects/${e.name}/memoryMap.ts`)
  .filter((path) => {
    try {
      readFileSync(join(srcRoot, path));
      return true;
    } catch {
      return false; // A dialect with no map of its own (the TRS-80).
    }
  });

/** The modules the docs are allowed to import, and everything they reach. */
const DOCS_IMPORTABLE = [
  'components/machinePicker.ts',
  'components/machineArt.tsx',
  'components/machineArtIds.ts',
  'components/MachineTrigger.tsx',
  'components/MachinePickerDialog.tsx',
  'app/useDismiss.ts',
  ...MEMORY_MAPS,
];

/** What must never appear in the transitive set, and why it matters. */
const FORBIDDEN: { label: string; hit: (path: string) => boolean }[] = [
  {
    label: 'the dialect registry (it imports every dialect and its emulator)',
    hit: (path) => path === 'dialects/registry.ts',
  },
  {
    label: 'an emulator core',
    hit: (path) => path.startsWith('emulator/'),
  },
];

/**
 * Every `from '…'` specifier in a module, static or dynamic. Deliberately
 * includes `import type`: an erased import is safe today, but a module that
 * names the registry at all is one edit away from being unsafe, and this test
 * exists to catch that edit rather than its consequence.
 */
function specifiersOf(source: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /(?:^|[\s;}])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|[\s;}(])import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /(?:^|[\s;}])import\s*['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    for (const [, specifier] of source.matchAll(pattern)) found.add(specifier);
  }
  return [...found];
}

/**
 * Assets rather than code. A dialect's samples are imported as `?raw` text and
 * its ROMs as URLs; neither is a module, and neither can import anything, so
 * the walk stops at them rather than treating them as a broken specifier.
 */
const ASSET = /\.(bas|css|png|svg|jpg|json|rom|wasm|txt|wav)$/;

/** Resolve a relative specifier the way the bundler does, or `null` if absent. */
function resolveModule(fromFile: string, specifier: string): string | null {
  const base = join(dirname(fromFile), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch {
      // Not this extension; try the next.
    }
  }
  return null;
}

/**
 * Every module reachable from `entry`, as paths relative to `src/`, each mapped
 * to the chain that reached it so a failure can print the route.
 *
 * A forbidden module fails the moment it is reached, rather than after the
 * whole graph is walked: past the registry lies every dialect in the project,
 * and the first thing one of those imports that this resolver cannot follow
 * would otherwise become the reported failure instead of the boundary breach
 * that caused it.
 */
function reachableFrom(entry: string): Map<string, string[]> {
  const chains = new Map<string, string[]>([[entry, [entry]]]);
  const queue = [entry];
  while (queue.length) {
    const current = queue.shift()!;
    const file = join(srcRoot, current);
    const source = readFileSync(file, 'utf8');
    for (const specifier of specifiersOf(source)) {
      // Bare specifiers are packages (react, zustand): they cannot reach into
      // this repo, so the walk stops at them. `?raw` and `?url` suffixes are
      // Vite's, and name the same file.
      if (!specifier.startsWith('.')) continue;
      const path = specifier.split('?')[0];
      if (ASSET.test(path)) continue;
      const resolved = resolveModule(file, path);
      expect(
        resolved,
        `${current} imports ${specifier}, which does not resolve`,
      ).not.toBeNull();
      const key = relative(srcRoot, resolved!);
      if (chains.has(key)) continue;
      const chain = [...chains.get(current)!, key];
      for (const { label, hit } of FORBIDDEN) {
        expect(
          hit(key),
          `${entry} reaches ${label}:\n  ${chain.join('\n  → ')}`,
        ).toBe(false);
      }
      chains.set(key, chain);
      queue.push(key);
    }
  }
  return chains;
}

describe('the modules the docs render stay importable by them', () => {
  it.each(DOCS_IMPORTABLE)('%s reaches nothing forbidden', (entry) => {
    // The walk itself asserts; reaching the end is the pass.
    expect(reachableFrom(entry).size).toBeGreaterThan(0);
  });

  it('found the memory maps to check', () => {
    // Discovery that silently found nothing would pass forever. Every dialect
    // but one ships a map, so the list is long; assert it is populated rather
    // than pinning a count that a new machine would have to come and update.
    expect(MEMORY_MAPS.length).toBeGreaterThan(1);
  });

  it('walks far enough to be worth having', () => {
    // A guard that resolved nothing would pass forever. The dialog is the
    // deepest of the leaves; assert the walk actually leaves the entry file.
    const reachable = reachableFrom('components/MachinePickerDialog.tsx');
    expect(reachable.size).toBeGreaterThan(1);
    expect([...reachable.keys()]).toContain('app/useDismiss.ts');
  });
});
