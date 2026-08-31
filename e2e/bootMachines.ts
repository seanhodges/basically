/**
 * Every machine the picker offers - its registry id and the label its row
 * carries - in registry order.
 *
 * Kept here rather than derived in the browser so the specs can name the
 * machines without importing the dialect registry (and every emulator core with
 * it) into the Playwright process. `src/e2eBootMachines.test.ts` fails if a
 * machine is registered, renamed or made unofferable without this list
 * following.
 *
 * The picker offers only machines that can actually start, so a checkout with a
 * ROM deleted (see public/roms/ATTRIBUTION.md) offers fewer than this. A stock
 * build ships every image and offers every one of them.
 */
export const BOOT_MACHINES = [
  { id: 'zx81', label: 'ZX81' },
  { id: 'zx80', label: 'ZX80' },
  { id: 'zxspectrum', label: 'Spectrum' },
  { id: 'zxspectrum128', label: 'Spectrum 128' },
  { id: 'bbcmicro', label: 'BBC Micro' },
  { id: 'bbcmaster', label: 'BBC Master' },
  { id: 'commodore64', label: 'C64' },
  { id: 'pet', label: 'PET' },
  { id: 'vic20', label: 'VIC-20' },
  { id: 'atom', label: 'Atom' },
  { id: 'trs80', label: 'TRS-80' },
  { id: 'cpc464', label: 'CPC 464' },
  { id: 'cpc664', label: 'CPC 664' },
  { id: 'cpc6128', label: 'CPC 6128' },
  { id: 'altair8800', label: 'Altair 8800' },
  { id: 'pmd85', label: 'PMD 85-2' },
  { id: 'apple1', label: 'Apple I' },
  { id: 'apple2', label: 'Apple II' },
  { id: 'atari800', label: 'Atari 800' },
  { id: 'atari400', label: 'Atari 400' },
];
