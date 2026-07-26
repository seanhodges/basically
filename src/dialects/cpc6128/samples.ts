import type { SampleFile } from '../types';
import { cpc464Samples } from '../cpc464/samples';

/**
 * The 6128's example programs. Locomotive BASIC 1.1 is a strict superset of
 * 1.0, so the 464's five samples are valid here unchanged and are shared
 * rather than forked - including the kaleidoscope's machine-code block, which
 * runs from the same &8000 in the base 64K on both machines.
 *
 * They deliberately stay 1.0-only source: a first program should read the same
 * on either CPC. Showcasing FRAME or FILL belongs in a sample of its own.
 */
export const cpc6128Samples: SampleFile[] = cpc464Samples;
