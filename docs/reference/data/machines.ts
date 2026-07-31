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
// Hand-authored because the docs runtime must never import src/ (the dialect
// registry pulls in every emulator core), and pinned to the registry by
// machines-crosscheck.test.ts, which may import it freely - so a newly
// registered dialect, a renamed machine or a changed docs page fails until this
// file agrees.

/** One machine the comparison can be pointed at. */
export interface MachineChoice {
  /** Dialect id, matching `Dialect.id` in the registry. The selectable value. */
  id: string;
  /** Reference page slug, matching `Dialect.docsReference ?? Dialect.id`. */
  page: string;
  /** Display name, matching `Dialect.name`. */
  label: string;
}

/**
 * Every supported machine, ordered by manufacturer then by age within it - the
 * order the reference sidebar and the machine picker both use, so a reader
 * moving between them is not re-sorting in their head.
 */
export const machines: MachineChoice[] = [
  { id: 'atom', page: 'atom', label: 'Atom' },
  { id: 'bbcmicro', page: 'bbc', label: 'BBC Micro' },
  { id: 'bbcmaster', page: 'bbc', label: 'BBC Master' },
  { id: 'pet', page: 'commodore', label: 'PET' },
  { id: 'vic20', page: 'commodore', label: 'VIC-20' },
  { id: 'commodore64', page: 'commodore', label: 'C64' },
  { id: 'cpc464', page: 'cpc', label: 'CPC 464' },
  { id: 'cpc6128', page: 'cpc', label: 'CPC 6128' },
  { id: 'trs80', page: 'trs80', label: 'TRS-80' },
  { id: 'zx80', page: 'zx80', label: 'ZX80' },
  { id: 'zx81', page: 'zx81', label: 'ZX81' },
  { id: 'zxspectrum', page: 'zxspectrum', label: 'Spectrum' },
  { id: 'zxspectrum128', page: 'zxspectrum', label: 'Spectrum 128' },
];
