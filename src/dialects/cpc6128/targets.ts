import type { BuildTarget } from '../types';
import { locoBuildTargets } from '../cpc464/targets';

/**
 * The 6128's hardware-export targets. The AMSDOS `.bas` header, the `.cdt`
 * tape image and the cassette WAV encoding are byte-identical to the 464's -
 * the same firmware tape scheme reads them - so only the tokenizer variant
 * differs. Disc (`.dsk`) export waits on AMSDOS + the FDC.
 */
export const cpc6128BuildTargets: BuildTarget[] = locoBuildTargets(
  'cpc6128',
  'basic11',
);
