import type { KeywordInfo } from '../types';
import { locoKeywords } from '../cpc464/keywords';

/**
 * Locomotive BASIC 1.1 keywords (CPC 664). The 664 is where 1.1 first shipped,
 * so this is the same selection the 6128 makes through the same variant seam -
 * the cpc464 table plus the entries tagged `since: 'basic11'`. Taking it from
 * the seam rather than listing it again keeps all three CPCs from drifting
 * apart on the keywords they share.
 */
export const cpc664Keywords: KeywordInfo[] = locoKeywords('basic11');
