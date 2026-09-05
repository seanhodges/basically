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
 * … → registry.ts` is actionable in a way that a 400KB docs chunk is not. The
 * walk itself is shared with the other boundary this project holds - see
 * `src/build/moduleGraph.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { reachableFrom, type ForbiddenModule } from '../build/moduleGraph';

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
  // The porting guide's memory-layout section renders the IDE's own map view,
  // twice. Its two escape hatches from this boundary are the reason it takes a
  // write-site shape of its own instead of importing the editor's POKE
  // analysis, and takes the activity canvas as an opaque node instead of
  // drawing it: both of those reach an emulator module.
  'components/MemoryMapView.tsx',
  // The hardware pages draw the same view one machine at a time, and name and
  // read each map from these two: the machine list for the display name, the
  // porting facts for the address notation and for whether the machine reads an
  // address back with `?` or with `PEEK`. Both restate what the registry knows
  // rather than importing it, which is only safe while this walk says so.
  'reference/machines.ts',
  'reference/facts.ts',
  ...MEMORY_MAPS,
];

/** What must never appear in the transitive set, and why it matters. */
const FORBIDDEN: ForbiddenModule[] = [
  {
    label: 'the dialect registry (it imports every dialect and its emulator)',
    hit: (path) => path === 'dialects/registry.ts',
  },
  {
    label: 'an emulator core',
    hit: (path) => path.startsWith('emulator/'),
  },
];

/** The walk, with this boundary's forbidden set applied. */
function reachable(entry: string): Map<string, string[]> {
  return reachableFrom(entry, { srcRoot, modules: FORBIDDEN }).modules;
}

describe('the modules the docs render stay importable by them', () => {
  it.each(DOCS_IMPORTABLE)('%s reaches nothing forbidden', (entry) => {
    // The walk itself throws on a breach; reaching the end is the pass.
    expect(reachable(entry).size).toBeGreaterThan(0);
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
    const walked = reachable('components/MachinePickerDialog.tsx');
    expect(walked.size).toBeGreaterThan(1);
    expect([...walked.keys()]).toContain('app/useDismiss.ts');
  });
});
