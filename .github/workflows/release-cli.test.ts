import { describe, expect, it } from 'vitest';
// @ts-expect-error - the release gate is plain JS, run by node from the workflow
import { decide } from './release-cli.mjs';

/**
 * The registry document the workflow fetches, as it read at the point this was
 * written: a manifest keyed by each version, carrying the build id, and no
 * top-level build id at all.
 */
const PUBLISHED = {
  'dist-tags': { alpha: '0.0.0-alpha.1', latest: '0.1.0' },
  versions: {
    '0.0.0-alpha.1': {},
    '0.1.0': { basicallyBuildId: 'shipped' },
  },
};

/**
 * The same registry as `npm view --json` reports it: `versions` flattened to a
 * list of version strings, and the latest manifest's build id spread over the
 * document. Both readings have to work - the workflow asks the registry
 * directly, and a person checking by hand reaches for npm.
 */
const AS_NPM_VIEW = {
  'dist-tags': { alpha: '0.0.0-alpha.1', latest: '0.1.0' },
  versions: ['0.0.0-alpha.1', '0.1.0'],
  basicallyBuildId: 'shipped',
};

/** What the workflow writes when the registry says the package is not there. */
const ABSENT = { basicallyAbsent: true };

describe('the release gate', () => {
  it('raises the patch digit over what is published', () => {
    expect(
      decide({ packument: PUBLISHED, built: 'new', tags: ['cli-v0.1.0'] }),
    ).toMatchObject({ changed: true, latest: '0.1.0', version: '0.1.1' });
  });

  it('stops rather than guess when the registry answer says nothing', () => {
    // The failure this guards: read as "nothing is published", an empty answer
    // sends the arithmetic to the newest tag - which names the version that
    // most recently shipped, so the publish is refused for colliding with it.
    expect(() =>
      decide({ packument: {}, built: 'new', tags: ['cli-v0.1.0'] }),
    ).toThrow(/dist-tags/);
  });

  it('publishes a first version when the package is not there yet', () => {
    expect(decide({ packument: ABSENT, built: 'new', tags: [] })).toMatchObject(
      { changed: true, latest: '', version: '0.1.0' },
    );
  });

  it('publishes the tagged version when the package is not there yet', () => {
    expect(
      decide({ packument: ABSENT, built: 'new', tags: ['cli-v0.2.0'] }),
    ).toMatchObject({ version: '0.2.0' });
  });

  it('publishes nothing when the registry already carries this build', () => {
    expect(
      decide({ packument: PUBLISHED, built: 'shipped', tags: ['cli-v0.1.0'] }),
    ).toMatchObject({ changed: false, latest: '0.1.0', version: '' });
  });

  it('finds a build id carried by a version that is not the latest', () => {
    const registry = {
      'dist-tags': { latest: '0.2.0' },
      versions: {
        '0.1.0': { basicallyBuildId: 'shipped' },
        '0.2.0': { basicallyBuildId: 'newer' },
      },
    };
    expect(
      decide({ packument: registry, built: 'shipped', tags: ['cli-v0.2.0'] }),
    ).toMatchObject({ changed: false, version: '' });
  });

  it('takes a tag ahead of the registry as a minor or major', () => {
    expect(
      decide({
        packument: PUBLISHED,
        built: 'new',
        tags: ['cli-v0.1.0', 'cli-v0.2.0'],
      }),
    ).toMatchObject({ version: '0.2.0' });
  });

  it('steps over a number spent out of band', () => {
    const registry = {
      ...PUBLISHED,
      versions: { ...PUBLISHED.versions, '0.1.1': {} },
    };
    expect(
      decide({ packument: registry, built: 'new', tags: ['cli-v0.1.0'] }),
    ).toMatchObject({ version: '0.1.2' });
  });

  it('reads the same registry as npm view reports it', () => {
    expect(
      decide({ packument: AS_NPM_VIEW, built: 'new', tags: ['cli-v0.1.0'] }),
    ).toMatchObject({ latest: '0.1.0', version: '0.1.1' });
    expect(
      decide({
        packument: AS_NPM_VIEW,
        built: 'shipped',
        tags: ['cli-v0.1.0'],
      }),
    ).toMatchObject({ changed: false, version: '' });
  });

  it('reads a prerelease-only registry as having no release yet', () => {
    const registry = {
      'dist-tags': { latest: '0.0.0-alpha.1' },
      versions: ['0.0.0-alpha.1'],
    };
    expect(
      decide({ packument: registry, built: 'new', tags: [] }),
    ).toMatchObject({ latest: '', version: '0.1.0' });
  });
});
