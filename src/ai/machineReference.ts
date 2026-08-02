import type { Dialect } from '../dialects/types';
import type { ReferenceTableData } from '../reference/types';

/**
 * Loads the machine's own language definition for the system prompt, on demand.
 *
 * The reference tables are some twelve thousand lines of data, and the assistant
 * is optional - most sessions never open it. So nothing here is imported
 * statically: each reference page is its own `import()`, exactly as
 * `./aiClient.ts` loads the provider backends, and Vite gives each one a chunk
 * of its own. A session pulls the pages for the machines it actually talks
 * about, and only once the user sends something.
 *
 * An ESLint rule keeps that boundary honest by refusing static imports of
 * `src/reference/**` from the app, so a convenience import cannot quietly put
 * the whole reference tree back in the initial download.
 */
const REFERENCE_PAGES: Record<string, () => Promise<ReferenceTableData>> = {
  atom: () => import('../reference/atom').then((m) => m.atomReference),
  bbc: () => import('../reference/bbc').then((m) => m.bbcReference),
  commodore: () =>
    import('../reference/commodore').then((m) => m.commodoreReference),
  cpc: () => import('../reference/cpc').then((m) => m.cpcReference),
  trs80: () => import('../reference/trs80').then((m) => m.trs80Reference),
  zx80: () => import('../reference/zx80').then((m) => m.zx80Reference),
  zx81: () => import('../reference/zx81').then((m) => m.zx81Reference),
  zxspectrum: () =>
    import('../reference/zxspectrum').then((m) => m.zxspectrumReference),
};

/**
 * Composed descriptions, by dialect id. The composition is pure and its input
 * is module-level constant data, so the result never goes stale - and the
 * second request for a machine costs nothing.
 */
const cache = new Map<string, string>();

/** Which reference page a dialect reads from; several machines share one. */
function pageFor(dialect: Dialect): string {
  return dialect.docsReference ?? dialect.id;
}

/**
 * The machine's whole language definition, ready to drop into the system
 * prompt: every command it has, its language rules and hardware figures, and
 * what to do where it is short of a capability.
 *
 * Byte-stable for a given machine - which is what the providers' prefix caching
 * depends on, and what `machineReference.test.ts` pins.
 *
 * Throws for a dialect whose reference page is not registered above, rather than
 * describing a machine half-way: `machineReference.test.ts` requires every
 * registered dialect to resolve, so an unregistered page fails the suite.
 */
export async function loadMachineReference(dialect: Dialect): Promise<string> {
  const cached = cache.get(dialect.id);
  if (cached !== undefined) return cached;

  const page = pageFor(dialect);
  const loadPage = REFERENCE_PAGES[page];
  if (loadPage === undefined) {
    throw new Error(`no reference page "${page}" for dialect "${dialect.id}"`);
  }
  const [{ describeMachine }, table] = await Promise.all([
    import('../reference/machineDescription'),
    loadPage(),
  ]);
  const text = describeMachine(
    {
      id: dialect.id,
      name: dialect.name,
      manufacturer: dialect.manufacturer,
      year: dialect.year,
      page,
    },
    table,
  );
  cache.set(dialect.id, text);
  return text;
}
