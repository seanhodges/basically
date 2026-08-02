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
}

/**
 * Every supported machine, ordered by manufacturer then by age within it - the
 * order the reference sidebar and the machine picker both use, so a reader
 * moving between them is not re-sorting in their head.
 */
export const machines: MachineChoice[] = [
  {
    id: 'atom',
    page: 'atom',
    name: 'Atom',
    manufacturer: 'Acorn',
    year: 1980,
    blurb: 'Acorn’s forerunner to the BBC Micro. Runs Atom BASIC.',
  },
  {
    id: 'bbcmicro',
    page: 'bbc',
    name: 'BBC Micro',
    manufacturer: 'Acorn',
    year: 1981,
    blurb: 'The BBC’s computer literacy machine. Runs BBC BASIC II.',
  },
  {
    id: 'bbcmaster',
    page: 'bbc',
    name: 'BBC Master',
    manufacturer: 'Acorn',
    year: 1986,
    blurb: 'The BBC Micro, upgraded. Runs BBC BASIC IV.',
  },
  {
    id: 'pet',
    page: 'commodore',
    name: 'PET',
    manufacturer: 'Commodore',
    year: 1977,
    blurb: 'Commodore’s all-in-one original. Runs Commodore BASIC 4.0.',
  },
  {
    id: 'vic20',
    page: 'commodore',
    name: 'VIC-20',
    manufacturer: 'Commodore',
    year: 1981,
    blurb: 'The first computer to sell a million. Commodore BASIC V2.',
  },
  {
    id: 'commodore64',
    page: 'commodore',
    name: 'C64',
    manufacturer: 'Commodore',
    year: 1982,
    blurb: 'The best-selling desktop computer ever. Commodore BASIC V2.',
  },
  {
    id: 'cpc464',
    page: 'cpc',
    name: 'CPC 464',
    manufacturer: 'Amstrad',
    year: 1984,
    blurb: 'Amstrad’s all-in-one with tape. Locomotive BASIC 1.0.',
  },
  {
    id: 'cpc6128',
    page: 'cpc',
    name: 'CPC 6128',
    manufacturer: 'Amstrad',
    year: 1985,
    blurb: 'The CPC with 128K and more keywords. Locomotive BASIC 1.1.',
  },
  {
    id: 'trs80',
    page: 'trs80',
    name: 'TRS-80',
    manufacturer: 'Tandy',
    year: 1977,
    blurb: 'Tandy’s Radio Shack original. Runs Level II BASIC.',
  },
  {
    id: 'zx80',
    page: 'zx80',
    name: 'ZX80',
    manufacturer: 'Sinclair',
    year: 1980,
    blurb: 'Sinclair’s first home computer. Runs ZX80 BASIC.',
  },
  {
    id: 'zx81',
    page: 'zx81',
    name: 'ZX81',
    manufacturer: 'Sinclair',
    year: 1981,
    blurb: 'Sinclair’s million-selling breakthrough. ZX81 BASIC.',
  },
  {
    id: 'zxspectrum',
    page: 'zxspectrum',
    name: 'Spectrum',
    manufacturer: 'Sinclair',
    year: 1982,
    blurb: 'Britain’s best-selling computer. 48K Sinclair BASIC.',
  },
  {
    id: 'zxspectrum128',
    page: 'zxspectrum',
    name: 'Spectrum 128',
    manufacturer: 'Sinclair',
    year: 1985,
    blurb: 'The Spectrum with AY sound. Runs 128 Sinclair BASIC.',
  },
];
