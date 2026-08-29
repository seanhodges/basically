import type { BuildTarget } from '../types';
import { locoBuildTargets } from '../cpc464/targets';

/**
 * The 664's hardware-export targets. The AMSDOS `.bas` header, the `.cdt` tape
 * image and the cassette WAV encoding are byte-identical to the 464's - the
 * same firmware tape scheme reads them - so only the tokenizer variant differs.
 * Disc (`.dsk`) export waits on AMSDOS + the FDC, as it does on the 6128.
 */
export const cpc664BuildTargets: BuildTarget[] = locoBuildTargets(
  'cpc664',
  'basic11',
);
