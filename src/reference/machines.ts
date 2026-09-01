// What the porting comparison can be pointed at: every machine the IDE
// supports, and nothing else.
//
// The comparison used to offer one option per reference *page*, which meant
// four of its eight options covered two or three machines at once and answered
// for a marquee one - a port to a VIC-20 was told the C64's free RAM, and a port
// to a CPC was offered BASIC 1.1 commands a 464 does not have. The machine is
// the unit now; this module is the list.
//
// Only machine ids are selectable. Page slugs are not, deliberately: a page
// slug and a dialect id live in the same `?from=`/`?to=` namespace, and
// `zxspectrum` is both the 48K machine and the page its 128K sibling shares -
// one string, two meanings, and no way for the URL to say which. One namespace
// of machine ids has no such case to resolve. `page` below still names the
// reference page a machine reads from; it is a property of the machine, not
// something a reader can select.
//
// Hand-authored because the docs runtime must never reach the dialect registry
// (it imports every dialect index, and each pulls in an emulator core) - a ban
// this file keeps now that it sits under `src/` next to the registry - and
// pinned to the registry by machines-crosscheck.test.ts, which may import it
// freely - so a newly registered dialect, a renamed machine, a changed docs
// page or a reworded blurb fails until this file agrees.
//
// The fields beyond `id`/`page` are what the machine picker shows: this shape
// satisfies `MachineLike` in src/components/machinePicker.ts, which is what
// lets the guide render the IDE's own picker rather than a lookalike of it.

/** One machine the comparison can be pointed at. */
export interface MachineChoice {
  /** Dialect id, matching `Dialect.id` in the registry. The selectable value. */
  id: string;
  /** Reference page slug, matching `Dialect.docsReference ?? Dialect.id`. */
  page: string;
  /** Display name, matching `Dialect.name`. */
  name: string;
  /** Maker, matching `Dialect.manufacturer`. Groups the picker's list. */
  manufacturer: string;
  /** Year of release, matching `Dialect.year`. Orders each maker's machines. */
  year: number;
  /** One-line description, matching `Dialect.blurb`. Shown on a picker row. */
  blurb: string;
  /**
   * The BASIC this machine runs, matching `Dialect.basicDialect`. The picker
   * groups and searches on it.
   */
  basicDialect: string;
  /**
   * The family that BASIC belongs to, matching
   * `Dialect.basicFamily ?? Dialect.basicDialect`. Heads the picker's by-BASIC
   * groups, so machines running versions of one BASIC read together.
   */
  basicFamily: string;
}

/**
 * Every supported machine, ordered by manufacturer then by age within it - the
 * order the reference sidebar reads in. The picker orders the same machines for
 * itself, by whichever arrangement the reader has chosen, so this file's order
 * is the sidebar's rather than a shared one.
 */
export const machines: MachineChoice[] = [
  {
    id: 'altair8800',
    page: 'altair8800',
    name: 'Altair 8800',
    manufacturer: 'MITS',
    year: 1975,
    blurb: 'The microcomputer that started it all. Runs Altair 8K BASIC.',
    basicDialect: 'Altair 8K BASIC',
    basicFamily: 'Microsoft BASIC',
  },
  {
    id: 'apple1',
    page: 'apple1',
    name: 'Apple I',
    manufacturer: 'Apple',
    year: 1976,
    blurb: 'Woz’s hand-built kit computer. Runs Apple 1 Integer BASIC.',
    basicDialect: 'Apple 1 Integer BASIC',
    basicFamily: 'Integer BASIC',
  },
  {
    id: 'apple2',
    page: 'apple2',
    name: 'Apple II',
    manufacturer: 'Apple',
    year: 1977,
    blurb: 'Colour graphics off the shelf. Runs Apple II Integer BASIC.',
    basicDialect: 'Apple II Integer BASIC',
    basicFamily: 'Integer BASIC',
  },
  {
    id: 'apple2plus',
    page: 'applesoft',
    name: 'Apple II Plus',
    manufacturer: 'Apple',
    year: 1979,
    blurb: 'Applesoft in ROM at last. Runs Applesoft BASIC.',
    basicDialect: 'Applesoft BASIC',
    basicFamily: 'Applesoft BASIC',
  },
  {
    id: 'atari800',
    page: 'atari',
    name: 'Atari 800',
    manufacturer: 'Atari',
    year: 1979,
    blurb: 'Two cartridge slots and 48K. Runs Atari BASIC.',
    basicDialect: 'Atari BASIC',
    basicFamily: 'Atari BASIC',
  },
  {
    id: 'atari400',
    page: 'atari',
    name: 'Atari 400',
    manufacturer: 'Atari',
    year: 1979,
    blurb: 'The budget model, with a membrane keyboard. Runs Atari BASIC.',
    basicDialect: 'Atari BASIC',
    basicFamily: 'Atari BASIC',
  },
  {
    id: 'atom',
    page: 'atom',
    name: 'Atom',
    manufacturer: 'Acorn',
    year: 1980,
    blurb: 'Acorn’s forerunner to the BBC Micro. Runs Atom BASIC.',
    basicDialect: 'Atom BASIC',
    basicFamily: 'Atom BASIC',
  },
  {
    id: 'bbcmicro',
    page: 'bbc',
    name: 'BBC Micro',
    manufacturer: 'Acorn',
    year: 1981,
    blurb: 'The BBC’s computer literacy machine. Runs BBC BASIC II.',
    basicDialect: 'BBC BASIC II',
    basicFamily: 'BBC BASIC',
  },
  {
    id: 'bbcmaster',
    page: 'bbc',
    name: 'BBC Master',
    manufacturer: 'Acorn',
    year: 1986,
    blurb: 'The BBC Micro, upgraded. Runs BBC BASIC IV.',
    basicDialect: 'BBC BASIC IV',
    basicFamily: 'BBC BASIC',
  },
  {
    id: 'pet',
    page: 'commodore',
    name: 'PET',
    manufacturer: 'Commodore',
    year: 1977,
    blurb: 'Commodore’s all-in-one original. Runs Commodore BASIC 4.0.',
    basicDialect: 'Commodore BASIC 4.0',
    basicFamily: 'Commodore BASIC',
  },
  {
    id: 'vic20',
    page: 'commodore',
    name: 'VIC-20',
    manufacturer: 'Commodore',
    year: 1981,
    blurb: 'The first computer to sell a million. Commodore BASIC V2.',
    basicDialect: 'Commodore BASIC V2',
    basicFamily: 'Commodore BASIC',
  },
  {
    id: 'commodore64',
    page: 'commodore',
    name: 'C64',
    manufacturer: 'Commodore',
    year: 1982,
    blurb: 'The best-selling desktop computer ever. Commodore BASIC V2.',
    basicDialect: 'Commodore BASIC V2',
    basicFamily: 'Commodore BASIC',
  },
  {
    id: 'cpc464',
    page: 'cpc',
    name: 'CPC 464',
    manufacturer: 'Amstrad',
    year: 1984,
    blurb: 'Amstrad’s all-in-one with tape. Locomotive BASIC 1.0.',
    basicDialect: 'Locomotive BASIC 1.0',
    basicFamily: 'Locomotive BASIC',
  },
  {
    id: 'cpc664',
    page: 'cpc',
    name: 'CPC 664',
    manufacturer: 'Amstrad',
    year: 1985,
    blurb: 'The CPC between the 464 and the 6128. Locomotive BASIC 1.1.',
    basicDialect: 'Locomotive BASIC 1.1',
    basicFamily: 'Locomotive BASIC',
  },
  {
    id: 'cpc6128',
    page: 'cpc',
    name: 'CPC 6128',
    manufacturer: 'Amstrad',
    year: 1985,
    blurb: 'The CPC with 128K and more keywords. Locomotive BASIC 1.1.',
    basicDialect: 'Locomotive BASIC 1.1',
    basicFamily: 'Locomotive BASIC',
  },
  {
    id: 'trs80',
    page: 'trs80',
    name: 'TRS-80',
    manufacturer: 'Tandy',
    year: 1977,
    blurb: 'Tandy’s Radio Shack original. Runs Level II BASIC.',
    basicDialect: 'Level II BASIC',
    basicFamily: 'Level II BASIC',
  },
  {
    id: 'pmd85',
    page: 'pmd85',
    name: 'PMD 85-2',
    manufacturer: 'Tesla',
    year: 1986,
    blurb: 'Czechoslovakia’s school computer. Runs BASIC-G.',
    basicDialect: 'BASIC-G',
    basicFamily: 'BASIC-G',
  },
  {
    id: 'zx80',
    page: 'zx80',
    name: 'ZX80',
    manufacturer: 'Sinclair',
    year: 1980,
    blurb: 'Sinclair’s first home computer. Runs ZX80 BASIC.',
    basicDialect: 'ZX80 BASIC',
    basicFamily: 'ZX80 BASIC',
  },
  {
    id: 'zx81',
    page: 'zx81',
    name: 'ZX81',
    manufacturer: 'Sinclair',
    year: 1981,
    blurb: 'Sinclair’s million-selling breakthrough. ZX81 BASIC.',
    basicDialect: 'ZX81 BASIC',
    basicFamily: 'Sinclair BASIC',
  },
  {
    id: 'zxspectrum',
    page: 'zxspectrum',
    name: 'Spectrum',
    manufacturer: 'Sinclair',
    year: 1982,
    blurb: 'Britain’s best-selling computer. 48K Sinclair BASIC.',
    basicDialect: '48K Sinclair BASIC',
    basicFamily: 'Sinclair BASIC',
  },
  {
    id: 'zxspectrum128',
    page: 'zxspectrum',
    name: 'Spectrum 128',
    manufacturer: 'Sinclair',
    year: 1985,
    blurb: 'The Spectrum with AY sound. Runs 128 Sinclair BASIC.',
    basicDialect: '128 Sinclair BASIC',
    basicFamily: 'Sinclair BASIC',
  },
];
