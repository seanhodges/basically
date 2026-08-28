// The reference tables, by page slug: one keyword table and one control-code
// table per documentation page.
//
// Nine crosscheck tests each kept a copy of this map, and each copy decided on
// its own which machines that battery covered - so a page left out of one of
// them was not checked and never said so. The map is here once now, pinned to
// the registry by pages.test.ts: a newly registered dialect fails until its
// page is listed, and every battery that imports this picks the new page up
// without being edited.
//
// Hand-authored and registry-free for the same reason src/reference/machines.ts
// is: the docs runtime imports from this tree and must never reach the dialect
// registry, which pulls in every emulator core. The app must not statically
// import it either (eslint.config.js bans that, so the ~12,000 lines of tables
// stay out of the initial download) - `src/ai/machineReference.ts` loads the
// same modules through `import()`. In practice the importers are the tests.
import type { BasicReferenceTableData, EscapeTableData } from './types';

import { altair8800Reference } from './altair8800';
import { apple1Reference } from './apple1';
import { atariReference } from './atari';
import { atomReference } from './atom';
import { bbcReference } from './bbc';
import { commodoreReference } from './commodore';
import { cpcReference } from './cpc';
import { pmd85Reference } from './pmd85';
import { trs80Reference } from './trs80';
import { zx80Reference } from './zx80';
import { zx81Reference } from './zx81';
import { zxspectrumReference } from './zxspectrum';

import { altair8800Escapes } from './escapes/altair8800';
import { apple1Escapes } from './escapes/apple1';
import { atariEscapes } from './escapes/atari';
import { atomEscapes } from './escapes/atom';
import { bbcEscapes } from './escapes/bbc';
import { commodoreEscapes } from './escapes/commodore';
import { cpcEscapes } from './escapes/cpc';
import { pmd85Escapes } from './escapes/pmd85';
import { trs80Escapes } from './escapes/trs80';
import { zx80Escapes } from './escapes/zx80';
import { zx81Escapes } from './escapes/zx81';
import { zxspectrumEscapes } from './escapes/zxspectrum';

export { referencePageOf } from '../dialects/referencePage';

/**
 * Pages whose machines have not joined the registry yet.
 *
 * A target system's reference set is written before its dialects are
 * registered, because registering turns every registry-driven battery on at
 * once and the reference set is one of the things they demand. Until the switch
 * is thrown, the page below is real - its data is checked by every battery that
 * reads this map by page - but no registered machine reads from it, so the two
 * assertions that would otherwise call it dead consult this list instead.
 *
 * Naming a page here is a promise to delete the name in the change that
 * registers its machines, and pages.test.ts fails on an entry that is not a
 * page or whose machines have arrived - so the exemption cannot outlive the
 * staging it exists for.
 */
export const PENDING_PAGE_IDS: readonly string[] = ['atari'];

/** Every BASIC keyword table, keyed by the page slug its machines name. */
export const referencePages: Record<string, BasicReferenceTableData> = {
  altair8800: altair8800Reference,
  apple1: apple1Reference,
  atari: atariReference,
  atom: atomReference,
  bbc: bbcReference,
  commodore: commodoreReference,
  cpc: cpcReference,
  pmd85: pmd85Reference,
  trs80: trs80Reference,
  zx80: zx80Reference,
  zx81: zx81Reference,
  zxspectrum: zxspectrumReference,
};

/**
 * Every control-code table, keyed by the same slug: a control code is a
 * property of the charset, and the machines sharing a reference page share
 * their charset too.
 */
export const escapePages: Record<string, EscapeTableData> = {
  altair8800: altair8800Escapes,
  apple1: apple1Escapes,
  atari: atariEscapes,
  atom: atomEscapes,
  bbc: bbcEscapes,
  commodore: commodoreEscapes,
  cpc: cpcEscapes,
  pmd85: pmd85Escapes,
  trs80: trs80Escapes,
  zx80: zx80Escapes,
  zx81: zx81Escapes,
  zxspectrum: zxspectrumEscapes,
};

/** The page slugs, in the order this file lists them. */
export const REFERENCE_PAGE_IDS = Object.keys(referencePages);
