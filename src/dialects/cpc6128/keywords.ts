import type { KeywordInfo } from '../types';
import { locoKeywords } from '../cpc464/keywords';

/**
 * Locomotive BASIC 1.1 keywords (CPC 6128): the cpc464 table plus CLEAR INPUT,
 * COPYCHR$, CURSOR, DEC$, DERR, FILL, FRAME, GRAPHICS PAPER, GRAPHICS PEN,
 * MASK and ON BREAK CONT, which the shared table carries tagged
 * `since: 'basic11'`. Selected through the variant seam rather than listed
 * again here (the bbcmaster BASIC_IV pattern), so the two machines cannot
 * drift apart on the keywords they share.
 */
export const cpc6128Keywords: KeywordInfo[] = locoKeywords('basic11');
