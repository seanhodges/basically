/**
 * Which output chunk a module belongs in.
 *
 * Rollup's default is one chunk per entry plus one per dynamic-import boundary,
 * and it names them after whichever module it happened to start from - which is
 * how the app's largest chunk came to be called `shareClient`, and why the
 * reference pages come out as `bbc-<hash>.js` and `sinclair-<hash>.js`, names a
 * machine could just as easily have claimed.
 *
 * Naming them buys two things. A returning visitor re-downloads only the chunk
 * that changed rather than everything that shares a file with it; and the
 * service worker's precache globs can name what they mean, which is what lets
 * `vite.config.ts` keep the assistant's downloads out of a first visit.
 *
 * Only packages the app always needs are named, and only to make them
 * separately cacheable. A manual chunk is all-or-nothing: if any one module in
 * it is reachable without a dynamic import, the whole chunk joins the initial
 * download - which is why nothing here covers a package that is meant to stay
 * deferred. Rollup's own split is better at those than a name is.
 */

/** A `node_modules` package this build keeps in a chunk of its own. */
interface VendorChunk {
  /** Package roots, matched as a path segment under `node_modules`. */
  packages: string[];
  name: string;
}

const VENDOR_CHUNKS: VendorChunk[] = [
  // The editor. Reached statically by the IDE, so this is cache granularity
  // rather than a smaller first load.
  { packages: ['@codemirror', '@lezer'], name: 'codemirror' },
  // The BBC and Atom cores, and the largest single package the app carries.
  { packages: ['jsbeeb'], name: 'jsbeeb' },
  // Deliberately not here: the virtual filesystem's storage engine. `rxdb`
  // brings `dexie`, `mingo` and `broadcast-channel` with it, and naming them as
  // one chunk puts all four in the initial download, because a small part of it
  // is reached before the first dynamic import is. Left unnamed, Rollup splits
  // it along that boundary itself and the bulk stays deferred.
  // Deliberately not here: the three AI provider SDKs. Rollup already splits
  // them cleanly along `src/ai/aiClient.ts`'s `import()` of each backend, and
  // naming them by package undid that - the SDKs share enough internals that a
  // chunk per package put one of them in the initial download and made another
  // depend on it. Their default names (`anthropic-*`, `openai-*`, `gemini-*`,
  // after the provider module each is reached through) are what the service
  // worker's precache globs match.
];

/** Path segments, so the same rules read the same on Windows. */
function segments(id: string): string[] {
  return id.split(/[\\/]/);
}

/**
 * The chunk `id` belongs in, or `undefined` to leave the decision to Rollup.
 *
 * `id` is an absolute module path, as Rollup's `manualChunks` hands it over.
 */
export function chunkFor(id: string): string | undefined {
  const parts = segments(id);
  const vendorAt = parts.lastIndexOf('node_modules');

  if (vendorAt !== -1) {
    const pkg = parts[vendorAt + 1];
    if (pkg === undefined) return undefined;
    for (const chunk of VENDOR_CHUNKS) {
      if (chunk.packages.includes(pkg)) return chunk.name;
    }
    return undefined;
  }

  // Nothing under src/ is named. Naming a chunk is all-or-nothing: one module
  // in it that static code reaches pulls the whole chunk into the initial
  // download, and the app's own modules are shared too widely to predict which
  // those are. `src/reference/` was tried and is the example - most of it is
  // fetched on demand, but `machines.ts` and `abbreviations.ts` are not, and a
  // name spanning both would have precached the wrong half.
  return undefined;
}
