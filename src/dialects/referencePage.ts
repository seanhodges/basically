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
