import type { KeywordInfo } from '../types';

/**
 * Which Locomotive BASIC the keyword table targets: 1.0 (CPC 464) or 1.1
 * (CPC 664/6128, adding CLEAR INPUT, COPYCHR$, CURSOR, DEC$, DERR, FILL,
 * FRAME, GRAPHICS PAPER, GRAPHICS PEN, MASK and ON BREAK CONT). The variant
 * seam mirrors bbcmicro's BASIC_IV flag so the cpc6128 dialect is one import
 * away. See docs/contributing/dialect-plans/cpc464.md Stage 1.
 */
export type LocoBasicVariant = 'basic10' | 'basic11';

/** The Locomotive BASIC keyword table for one variant. Stage 1 fills this in. */
export function locoKeywords(_variant: LocoBasicVariant): KeywordInfo[] {
  throw new Error('cpc464: not implemented');
}

/**
 * Locomotive BASIC 1.0 keywords (CPC 464). Placeholder until Stage 1 lands;
 * empty so the unregistered dialect stub stays loadable.
 */
export const cpc464Keywords: KeywordInfo[] = [];
