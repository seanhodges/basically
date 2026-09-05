/**
 * Walking `src/` the way a bundler would, to hold a boundary in place.
 *
 * Several boundaries in this project are worth nothing unless something checks
 * them: the docs render a few of the IDE's components and must not pull the
 * dialect registry in behind them, and the app must not reach the language
 * server or the agent protocol, whose packages exist for the toolchain alone.
 * Each is one careless import away from breaking, and none of them fails
 * loudly when it does - the bundle just gets bigger.
 *
 * The walk resolves imports itself rather than asking a bundler, so a failure
 * can name the chain that did it: `machinePicker.ts → … → registry.ts` is
 * actionable in a way that a 400KB chunk is not.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/** A module path (relative to `src/`) that must not be reached, and why. */
export interface ForbiddenModule {
  label: string;
  hit(path: string): boolean;
}

/** A package that must not be reached, and why. */
export interface ForbiddenPackage {
  label: string;
  hit(specifier: string): boolean;
}

export interface WalkOptions {
  /** Absolute path of `src/`. */
  srcRoot: string;
  modules?: ForbiddenModule[];
  packages?: ForbiddenPackage[];
}

/**
 * Every `from '…'` specifier in a module, static or dynamic. Deliberately
 * includes `import type`: an erased import is safe today, but a module that
 * names a forbidden target at all is one edit away from being unsafe, and
 * these walks exist to catch that edit rather than its consequence.
 */
export function specifiersOf(source: string): string[] {
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
const ASSET = /\.(bas|asm|css|png|svg|jpg|json|rom|wasm|txt|wav|woff2)$/;

/** Resolve a relative specifier the way the bundler does, or `null` if absent. */
export function resolveModule(
  fromFile: string,
  specifier: string,
): string | null {
  const base = join(dirname(fromFile), specifier);
  // `.js` and `.mjs` are here for the vendored cores (the 6502, the Z80,
  // viciious), which are checked-in JavaScript that TypeScript imports without
  // an extension like anything else.
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
    join(base, 'index.js'),
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

/** What a completed walk found. */
export interface Walk {
  /** Every module reached, mapped to the chain that reached it. */
  modules: Map<string, string[]>;
  /** Every bare specifier reached, mapped to the chain that reached it. */
  packages: Map<string, string[]>;
}

/**
 * Every module and package reachable from `entry`, as paths relative to `src/`.
 *
 * Throws on the first forbidden target rather than after the whole graph is
 * walked: past the dialect registry lies every machine in the project, and the
 * first thing one of those imports that this resolver cannot follow would
 * otherwise become the reported failure instead of the breach that caused it.
 */
export function reachableFrom(entry: string, options: WalkOptions): Walk {
  const {
    srcRoot,
    modules: badModules = [],
    packages: badPackages = [],
  } = options;
  const modules = new Map<string, string[]>([[entry, [entry]]]);
  const packages = new Map<string, string[]>();
  const queue = [entry];
  while (queue.length) {
    const current = queue.shift()!;
    const file = join(srcRoot, current);
    for (const specifier of specifiersOf(readFileSync(file, 'utf8'))) {
      if (!specifier.startsWith('.')) {
        if (packages.has(specifier)) continue;
        const chain = [...modules.get(current)!, specifier];
        for (const { label, hit } of badPackages) {
          if (hit(specifier)) {
            throw new Error(
              `${entry} reaches ${label}:\n  ${chain.join('\n  → ')}`,
            );
          }
        }
        packages.set(specifier, chain);
        continue;
      }
      // `?raw` and `?url` suffixes are Vite's, and name the same file.
      const path = specifier.split('?')[0];
      if (ASSET.test(path)) continue;
      const resolved = resolveModule(file, path);
      if (resolved === null) {
        throw new Error(
          `${current} imports ${specifier}, which does not resolve`,
        );
      }
      const key = relative(srcRoot, resolved);
      if (modules.has(key)) continue;
      const chain = [...modules.get(current)!, key];
      for (const { label, hit } of badModules) {
        if (hit(key)) {
          throw new Error(
            `${entry} reaches ${label}:\n  ${chain.join('\n  → ')}`,
          );
        }
      }
      modules.set(key, chain);
      queue.push(key);
    }
  }
  return { modules, packages };
}
