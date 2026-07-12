import type { SampleFile } from '../types';

/**
 * TODO (vic20 Stage 3): canonical hello / circles / breakout / maze
 * re-laid-out for 22 columns (colour via screen/colour RAM at $1E00/$9600 and
 * POKE 36879; hello is the starter).
 * See docs/contributing/dialect-plans/vic20.md.
 */
export const vic20Samples: SampleFile[] = [];
