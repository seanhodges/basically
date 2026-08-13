import { describe, expect, it } from 'vitest';
import { showsSection } from './sectionVisibility';

describe('showsSection', () => {
  it('shows a narrowed section holding work', () => {
    expect(showsSection({ narrowed: true, work: 3 })).toBe(true);
  });

  it('hides a narrowed section holding nothing', () => {
    expect(showsSection({ narrowed: true, work: 0 })).toBe(false);
  });

  it('hides a narrowed section holding only filtered-out reference content', () => {
    expect(
      showsSection({
        narrowed: true,
        work: 0,
        reference: 4,
        referenceShown: false,
      }),
    ).toBe(false);
  });

  it('shows that same section once the reader asks for the reference content', () => {
    expect(
      showsSection({
        narrowed: true,
        work: 0,
        reference: 4,
        referenceShown: true,
      }),
    ).toBe(true);
  });

  // The filter is page-wide and the sections it governs are not: work in one
  // keeps that one open whatever the filter is doing to the others.
  it('shows a narrowed section holding both work and hidden reference content', () => {
    expect(
      showsSection({
        narrowed: true,
        work: 1,
        reference: 9,
        referenceShown: false,
      }),
    ).toBe(true);
  });

  it('shows an unnarrowed section holding only reference content', () => {
    expect(
      showsSection({
        narrowed: false,
        work: 0,
        reference: 2,
        referenceShown: false,
      }),
    ).toBe(true);
  });

  it('hides an unnarrowed section holding nothing at all', () => {
    expect(showsSection({ narrowed: false, work: 0, reference: 0 })).toBe(
      false,
    );
  });

  // Reference content is optional at the call sites that have none - the memory
  // maps and the fit report answer to no filter.
  it('treats absent reference content as none', () => {
    expect(showsSection({ narrowed: true, work: 0 })).toBe(false);
    expect(showsSection({ narrowed: false, work: 0 })).toBe(false);
  });
});
