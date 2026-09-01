/**
 * Which documentation reference page a machine reads from.
 *
 * Several machines share one page - the two BBCs, the three Commodores, the two
 * CPCs and the two Spectrums - so a dialect names its page with
 * `docsReference` and falls back to its own id. That one-line rule was
 * recomputed independently in the AI's reference loader, the docs-topic router
 * and half a dozen crosscheck tests; it lives here instead, so a machine
 * joining an existing page changes nothing but its own dialect entry.
 *
 * Takes the two fields rather than a `Dialect`, and imports nothing: the docs
 * runtime must never reach the dialect registry (see
 * src/components/machinePickerBoundary.test.ts), and the app must never
 * statically import the reference tree (see the import ban in eslint.config.js).
 * A leaf module answering to a shape is reachable from both sides of that
 * boundary.
 */
export function referencePageOf(machine: {
  id: string;
  docsReference?: string;
}): string {
  return machine.docsReference ?? machine.id;
}

/**
 * The family of BASIC a machine runs, which is what groups it: `Sinclair BASIC`
 * covers the ZX81 and both Spectrums, `BBC BASIC` the Micro and the Master.
 * Falls back to the version string, correct for every machine that is the only
 * one of its kind, so a dialect only declares a family when it shares one.
 *
 * Takes a shape and imports nothing for the same reason `referencePageOf` does:
 * the machine picker and the docs runtime both read it, and neither may reach
 * the other's module graph.
 */
export function basicFamilyOf(machine: {
  basicDialect: string;
  basicFamily?: string;
}): string {
  return machine.basicFamily ?? machine.basicDialect;
}
