import type { SampleFile } from '../types';
import { cpc464Samples } from '../cpc464/samples';

/**
 * The 664's example programs. Locomotive BASIC 1.1 is a strict superset of
 * 1.0, so the 464's five samples are valid here unchanged and are shared
 * rather than forked - including the kaleidoscope's machine-code block, which
 * runs from the same &8000 on all three CPCs.
 *
 * They deliberately stay 1.0-only source: a first program should read the same
 * on any CPC. Showcasing FRAME or FILL belongs in a sample of its own.
 */
export const cpc664Samples: SampleFile[] = cpc464Samples;
