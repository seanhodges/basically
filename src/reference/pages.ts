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
import { applesoftReference } from './applesoft';
import { integerBasicReference } from './integer-basic';
import { msxReference } from './msx';
import { atariReference } from './atari';
import { atomReference } from './atom';
import { bbcReference } from './bbc';
import { commodoreReference } from './commodore';
import { cpcReference } from './cpc';
import { pmd85Reference } from './pmd85';
import { sinclairReference } from './sinclair';
import { trs80Reference } from './trs80';
import { zx80Reference } from './zx80';

import { altair8800Escapes } from './escapes/altair8800';
import { applesoftEscapes } from './escapes/applesoft';
import { integerBasicEscapes } from './escapes/integer-basic';
import { msxEscapes } from './escapes/msx';
import { atariEscapes } from './escapes/atari';
import { atomEscapes } from './escapes/atom';
import { bbcEscapes } from './escapes/bbc';
import { commodoreEscapes } from './escapes/commodore';
import { cpcEscapes } from './escapes/cpc';
import { pmd85Escapes } from './escapes/pmd85';
import { sinclairEscapes } from './escapes/sinclair';
import { trs80Escapes } from './escapes/trs80';
import { zx80Escapes } from './escapes/zx80';

export { referencePageOf } from '../dialects/referencePage';

/**
 * Pages whose machines have not joined the registry yet.
 *
 * A target system's reference set is written before its dialects are
 * registered, because registering turns every registry-driven battery on at
 * once and the reference set is one of the things they demand. Until the switch
 * is thrown such a page is real - its data is checked by every battery that
 * reads this map by page - but no registered machine reads from it, so the two
 * assertions that would otherwise call it dead consult this list instead.
 *
 * Naming a page here is a promise to delete the name in the change that
 * registers its machines, and pages.test.ts fails on an entry that is not a
 * page or whose machines have arrived - so the exemption cannot outlive the
 * staging it exists for. Empty is the ordinary state.
 */
export const PENDING_PAGE_IDS: readonly string[] = ['msx'];

/** Every BASIC keyword table, keyed by the page slug its machines name. */
export const referencePages: Record<string, BasicReferenceTableData> = {
  altair8800: altair8800Reference,
  applesoft: applesoftReference,
  atari: atariReference,
  atom: atomReference,
  bbc: bbcReference,
  commodore: commodoreReference,
  cpc: cpcReference,
  'integer-basic': integerBasicReference,
  msx: msxReference,
  pmd85: pmd85Reference,
  sinclair: sinclairReference,
  trs80: trs80Reference,
  zx80: zx80Reference,
};

/**
 * Every control-code table, keyed by the same slug.
 *
 * Usually a control code is a property of the charset and the machines sharing
 * a page share their charset outright. Where they do not - the Apple I and the
 * Apple II share the Integer BASIC page with a character generator each - the
 * rows are scoped with `onlyOn` and `CHARSET_PROBES` reads each family against
 * its own.
 */
export const escapePages: Record<string, EscapeTableData> = {
  altair8800: altair8800Escapes,
  applesoft: applesoftEscapes,
  atari: atariEscapes,
  atom: atomEscapes,
  bbc: bbcEscapes,
  commodore: commodoreEscapes,
  cpc: cpcEscapes,
  'integer-basic': integerBasicEscapes,
  msx: msxEscapes,
  pmd85: pmd85Escapes,
  sinclair: sinclairEscapes,
  trs80: trs80Escapes,
  zx80: zx80Escapes,
};

/** The page slugs, in the order this file lists them. */
export const REFERENCE_PAGE_IDS = Object.keys(referencePages);
