import type { KeywordInfo } from '../types';

/**
 * Locomotive BASIC 1.1 keywords (CPC 6128): the cpc464 table plus CLEAR
 * INPUT, COPYCHR$, CURSOR, DEC$, DERR, FILL, FRAME, GRAPHICS PAPER,
 * GRAPHICS PEN, MASK and ON BREAK CONT. Stage A binds this to
 * `locoKeywords('basic11')` from ../cpc464/keywords (the bbcmaster BASIC_IV
 * pattern). Empty placeholder so the unregistered dialect stub stays
 * loadable. See docs/contributing/dialect-plans/cpc6128.md.
 */
export const cpc6128Keywords: KeywordInfo[] = [];
