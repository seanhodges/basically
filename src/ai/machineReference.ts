import { referencePageOf } from '../dialects/referencePage';
import type { Dialect } from '../dialects/types';
import type { EscapeTableData, ReferenceTableData } from '../reference/types';

/**
 * Loads the reference data the assistant is given, on demand: the machine's own
 * language definition for the system prompt, and the tables a port report is
 * composed from.
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
  altair8800: () =>
    import('../reference/altair8800').then((m) => m.altair8800Reference),
  apple1: () => import('../reference/apple1').then((m) => m.apple1Reference),
  apple2: () => import('../reference/apple2').then((m) => m.apple2Reference),
  atari: () => import('../reference/atari').then((m) => m.atariReference),
  atom: () => import('../reference/atom').then((m) => m.atomReference),
  bbc: () => import('../reference/bbc').then((m) => m.bbcReference),
  commodore: () =>
    import('../reference/commodore').then((m) => m.commodoreReference),
  cpc: () => import('../reference/cpc').then((m) => m.cpcReference),
  pmd85: () => import('../reference/pmd85').then((m) => m.pmd85Reference),
  trs80: () => import('../reference/trs80').then((m) => m.trs80Reference),
  zx80: () => import('../reference/zx80').then((m) => m.zx80Reference),
  zx81: () => import('../reference/zx81').then((m) => m.zx81Reference),
  zxspectrum: () =>
    import('../reference/zxspectrum').then((m) => m.zxspectrumReference),
};

/**
 * The control-code tables, code-split exactly as the reference pages are and
 * for the same reason: they are only wanted when a port is actually asked for.
 *
 * Keyed by the same page slug, because a control code is a property of the
 * charset and the machines sharing a reference page share their escapes too.
 */
const ESCAPE_PAGES: Record<string, () => Promise<EscapeTableData>> = {
  altair8800: () =>
    import('../reference/escapes/altair8800').then((m) => m.altair8800Escapes),
  apple1: () =>
    import('../reference/escapes/apple1').then((m) => m.apple1Escapes),
  apple2: () =>
    import('../reference/escapes/apple2').then((m) => m.apple2Escapes),
  atari: () => import('../reference/escapes/atari').then((m) => m.atariEscapes),
  atom: () => import('../reference/escapes/atom').then((m) => m.atomEscapes),
  bbc: () => import('../reference/escapes/bbc').then((m) => m.bbcEscapes),
  commodore: () =>
    import('../reference/escapes/commodore').then((m) => m.commodoreEscapes),
  cpc: () => import('../reference/escapes/cpc').then((m) => m.cpcEscapes),
  pmd85: () => import('../reference/escapes/pmd85').then((m) => m.pmd85Escapes),
  trs80: () => import('../reference/escapes/trs80').then((m) => m.trs80Escapes),
  zx80: () => import('../reference/escapes/zx80').then((m) => m.zx80Escapes),
  zx81: () => import('../reference/escapes/zx81').then((m) => m.zx81Escapes),
  zxspectrum: () =>
    import('../reference/escapes/zxspectrum').then((m) => m.zxspectrumEscapes),
};

/**
 * Composed descriptions, by dialect id. The composition is pure and its input
 * is module-level constant data, so the result never goes stale - and the
 * second request for a machine costs nothing.
 */
const cache = new Map<string, string>();

/**
 * One page's keyword table, or `undefined` where no page is registered under
 * that slug.
 *
 * Undefined rather than throwing, unlike {@link loadMachineReference}: that one
 * is swept by `machineReference.test.ts` over every registered dialect, so an
 * unregistered page fails the suite before a user could reach it. These two sit
 * on a click path whose caller degrades (see `./portReport.ts`), where refusing
 * to work is a worse answer than working with less.
 */
export async function loadReferencePage(
  page: string,
): Promise<ReferenceTableData | undefined> {
  return REFERENCE_PAGES[page]?.();
}

/** One page's control-code table; see {@link loadReferencePage}. */
export async function loadEscapePage(
  page: string,
): Promise<EscapeTableData | undefined> {
  return ESCAPE_PAGES[page]?.();
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

  const page = referencePageOf(dialect);
  const loadPage = REFERENCE_PAGES[page];
  if (loadPage === undefined) {
    throw new Error(`no reference page "${page}" for dialect "${dialect.id}"`);
  }
  // The escape table joins the description rather than staying with the port
  // path: telling the assistant a control code must be replaced is useless
  // without telling it how this machine spells one. Its absence is tolerated
  // (the description simply omits the section) because a page may register a
  // keyword table and no escapes, and half a description beats none.
  const [{ describeMachine }, table, escapes] = await Promise.all([
    import('../reference/machineDescription'),
    loadPage(),
    loadEscapePage(page),
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
    escapes,
    // Taken from the dialect rather than loaded, exactly as the port report
    // takes it: the map is static data the dialect declares, and this side of
    // the app already holds the dialect. A machine without one is described
    // without a memory section.
    dialect.memoryMap,
  );
  cache.set(dialect.id, text);
  return text;
}
