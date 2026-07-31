// What the porting comparison can be pointed at: every machine the IDE
// supports, plus the shared BASICs that cover a whole family.
//
// The comparison used to offer one option per reference *page*, which meant
// four of its eight options covered two or three machines at once and answered
// for a marquee one - a port to a VIC-20 was told the C64's free RAM, and a port
// to a CPC was offered BASIC 1.1 commands a 464 does not have. The machine is
// the unit now; this module is the list.
//
// Hand-authored because the docs runtime must never import src/ (the dialect
// registry pulls in every emulator core), and pinned to the registry by
// machines-crosscheck.test.ts, which may import it freely - so a newly
// registered dialect, a renamed machine or a changed docs page fails until this
// file agrees.

/** One machine the comparison can be pointed at. */
export interface MachineChoice {
  /** Dialect id, matching `Dialect.id` in the registry. */
  id: string;
  /** Reference page slug, matching `Dialect.docsReference ?? Dialect.id`. */
  page: string;
  /** Display name, matching `Dialect.name`. */
  label: string;
}

/**
 * A BASIC shared by several machines, offered as a selection in its own right
 * for a reader who has not yet chosen between close relatives.
 *
 * Keeping these means every link shared before the comparison became
 * per-machine still reopens the comparison it always did - the old `?from=cpc`
 * slugs are these, unchanged. What changes is that they now say what they are
 * instead of quietly answering for one member: `label` names the family, and
 * figures that differ across `members` are reported as a range.
 */
export interface FamilyChoice {
  /** The value used in `?from=`/`?to=`. */
  slug: string;
  /**
   * Reference page slug this reads from. Equal to `slug` for three of the four;
   * the Spectrum family reads page `zxspectrum` under slug `zxspectrum-any`,
   * because the bare slug is the 48K machine's dialect id.
   */
  page: string;
  /** Display name, naming the BASIC and saying it spans machines. */
  label: string;
  /** Dialect ids this covers, in the order they should be read. */
  members: string[];
}

/**
 * Every supported machine, ordered by family then by age within it - the order
 * the reference sidebar and the machine picker both use, so a reader moving
 * between them is not re-sorting in their head.
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

/**
 * The four BASICs that span more than one machine. The other four pages cover a
 * single machine, so their slug is already that machine's id and they need no
 * entry here - `?from=zx81` has always meant exactly one thing.
 */
export const families: FamilyChoice[] = [
  {
    slug: 'bbc',
    page: 'bbc',
    label: 'BBC BASIC (either machine)',
    members: ['bbcmicro', 'bbcmaster'],
  },
  {
    slug: 'commodore',
    page: 'commodore',
    label: 'Commodore BASIC (any machine)',
    members: ['pet', 'vic20', 'commodore64'],
  },
  {
    slug: 'cpc',
    page: 'cpc',
    label: 'Locomotive BASIC (either CPC)',
    members: ['cpc464', 'cpc6128'],
  },
  {
    // Not `zxspectrum`: that is the 48K machine's own dialect id, and every
    // machine being addressable by its id matters more than this one family
    // keeping the bare page slug. The consequence is deliberate - a link shared
    // as `?from=zxspectrum` now means the 48K machine rather than the 48K+128K
    // union. The two differ by SPECTRUM and PLAY and by the two 48K-only UDG
    // rows, and a program shared as "Spectrum" was overwhelmingly a 48K one, so
    // the new reading is the more accurate of the two.
    slug: 'zxspectrum-any',
    page: 'zxspectrum',
    label: 'ZX Spectrum BASIC (either machine)',
    members: ['zxspectrum', 'zxspectrum128'],
  },
];

/** Every valid `?from=`/`?to=` value: machine ids and family slugs alike. */
export const selectableIds: string[] = [
  ...machines.map((m) => m.id),
  ...families.map((f) => f.slug),
];

/**
 * The machine a selection means, or `undefined` when it names a family - which
 * is what `tableForMachine` takes to keep a whole page.
 *
 * Machine ids and family slugs share one namespace and are guaranteed disjoint
 * by machines-crosscheck.test.ts, so the lookup order here carries no meaning.
 */
export function machineForSelection(id: string): string | undefined {
  return machines.find((m) => m.id === id)?.id;
}

/** The reference page a selection reads from, whether machine or family. */
export function pageForSelection(id: string): string | undefined {
  const family = families.find((f) => f.slug === id);
  if (family) return family.page;
  return machines.find((m) => m.id === id)?.page;
}
