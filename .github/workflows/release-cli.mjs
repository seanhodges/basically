// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Whether there is a release to make, and which version it is.
 *
 * Read by `release-cli.yml`, and kept out of it because a shell pipeline of
 * `npm view` into `sed` into a version comparison is where a release workflow
 * goes wrong quietly. Two answers, both derived rather than remembered:
 *
 * - **Is this build already published?** The build id
 *   `scripts/headless/build.mjs` writes over every emitted file is stamped into
 *   the published manifest, so the question is asked of the registry rather
 *   than of the repository. A deleted tag or a rewritten history cannot make it
 *   publish twice.
 * - **Which number?** Settled against the registry, because the registry is
 *   what the number must not collide with. A `cli-v*` tag ahead of what is
 *   published is a person asking for that minor or major; otherwise the patch
 *   digit is raised, which is the only digit this ever moves.
 *
 * Run with `--stamp` it writes the version and the build id into the manifest
 * instead of reporting them. The answer is recomputed rather than passed along,
 * because every input is a file or a tag and the arithmetic is the same both
 * times.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** A version as three numbers, or null for anything that is not one. */
function parseVersion(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(text).trim());
  return match ? match.slice(1, 4).map(Number) : null;
}

/** Negative, zero or positive, as a comparator wants it. */
function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

const show = (version) => version.join('.');

/** The newest of a list of versions. */
const newest = (versions) =>
  versions.reduce((best, one) => (compare(one, best) > 0 ? one : best));

/** The newest version named by a `cli-v*` tag, or null when there is none. */
function intendedVersion(tags) {
  const versions = tags
    .map((tag) => parseVersion(tag.trim().replace(/^cli-v/, '')))
    .filter((version) => version !== null);
  return versions.length === 0 ? null : newest(versions);
}

/**
 * The first version, when nothing is published and nobody has asked for a
 * number. Not 1.0.0: what it means is "this exists", not "this is settled".
 */
const FIRST_VERSION = [0, 1, 0];

/** An object, as distinct from null and from an array. */
const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Every version named by a packument's `versions`, whichever shape it arrived
 * in: the registry's own document keys a manifest by each version, while
 * `npm view --json` flattens the same field to a list of version strings.
 */
function versionsIn(versions) {
  if (Array.isArray(versions)) return versions.map(String);
  return isRecord(versions) ? Object.keys(versions) : [];
}

/**
 * Every build id the registry holds, over all of the published versions rather
 * than the newest alone - so a build that shipped under an older number is
 * still recognised as shipped.
 *
 * The two readings of a packument put it in different places: the registry's
 * document carries it inside each version's manifest and has no top-level
 * field at all, while `npm view --json` reports the latest version's manifest
 * flattened over the document. Both are read, because either can be what the
 * workflow handed over.
 */
function buildsIn(packument) {
  const ids = [packument?.basicallyBuildId];
  const versions = packument?.versions;
  if (isRecord(versions)) {
    for (const manifest of Object.values(versions)) {
      ids.push(manifest?.basicallyBuildId);
    }
  }
  return new Set(ids.filter((id) => typeof id === 'string' && id !== ''));
}

/**
 * What the registry said, as the three things the arithmetic needs: every
 * version it holds, the newest of those that is a release, and the builds
 * already behind them. The newest is taken over the whole list rather than
 * from `dist-tags.latest` alone, so a `latest` pointing at a prerelease is a
 * registry with no release on it yet rather than an answer that cannot be read.
 */
function readPackument(packument) {
  if (packument?.basicallyAbsent === true) {
    return { latest: null, taken: new Set(), published: new Set() };
  }
  const distTags = packument?.['dist-tags'];
  const versions = packument?.versions;
  if (!isRecord(distTags) && !Array.isArray(versions) && !isRecord(versions)) {
    throw new Error(
      'The registry answer names neither dist-tags nor versions, so what is ' +
        'published is unknown. Publishing from here would overwrite a version ' +
        'rather than add one.',
    );
  }
  const taken = new Set([
    ...versionsIn(versions),
    ...Object.values(isRecord(distTags) ? distTags : {}).map(String),
  ]);
  const releases = [...taken]
    .map(parseVersion)
    .filter((version) => version !== null);
  return {
    latest: releases.length === 0 ? null : newest(releases),
    taken,
    published: buildsIn(packument),
  };
}

/**
 * The release decision, as a function of the three things it depends on: what
 * the registry holds, what was built, and what the tags ask for.
 */
export function decide({ packument, built, tags }) {
  const { latest, taken, published } = readPackument(packument);
  const latestText = latest === null ? '' : show(latest);

  if (published.has(built)) {
    return { changed: false, built, latest: latestText, version: '' };
  }

  const intended = intendedVersion(tags);

  let version;
  if (latest === null) {
    // No release yet: whatever a person tagged, or a first version.
    version = intended ?? FIRST_VERSION;
  } else if (intended !== null && compare(intended, latest) > 0) {
    // A tag ahead of the registry is a person asking for a minor or a major.
    version = intended;
  } else {
    version = [latest[0], latest[1], latest[2] + 1];
  }

  // Every number the registry holds is spent, whatever the arithmetic above
  // made of it. Stepping over them is what keeps a publish from being refused
  // for a number it could have walked past.
  while (taken.has(show(version))) {
    version = [version[0], version[1], version[2] + 1];
  }

  return { changed: true, built, latest: latestText, version: show(version) };
}

/** Every `cli-v*` tag in the repository, or none when git cannot say. */
function readTags() {
  try {
    return execFileSync('git', ['tag', '--list', 'cli-v*'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((tag) => tag.trim() !== '');
  } catch {
    return [];
  }
}

function main() {
  const publishedPath = process.env.PUBLISHED ?? 'published.json';
  const bundleDir = process.env.BUNDLE_DIR ?? 'scripts/headless/dist';
  const manifestPath = process.env.MANIFEST ?? 'scripts/headless/package.json';

  const built = readFileSync(
    path.join(bundleDir, 'buildId.txt'),
    'utf8',
  ).trim();

  const answer = readFileSync(publishedPath, 'utf8');
  let packument;
  try {
    packument = JSON.parse(answer);
  } catch (error) {
    throw new Error(
      `${publishedPath} is not JSON, so what is published is unknown: ` +
        `${error.message}. It begins ${JSON.stringify(answer.slice(0, 200))}.`,
    );
  }

  const decision = decide({ packument, built, tags: readTags() });

  if (process.argv.includes('--stamp')) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.version = decision.version;
    manifest.basicallyBuildId = decision.built;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Stamped ${decision.version} (build ${decision.built}).`);
    return;
  }

  const output = process.env.GITHUB_OUTPUT;
  const lines =
    `changed=${decision.changed}\n` +
    `built=${decision.built}\n` +
    `latest=${decision.latest}\n` +
    `version=${decision.version}\n`;
  if (output) appendFileSync(output, lines);
  console.log(
    decision.changed
      ? `Publishing ${decision.version}: built ${decision.built}, ` +
          `published ${decision.latest || 'nothing'}.`
      : `Nothing to publish: ${decision.latest} already carries ${decision.built}.`,
  );
}

// Importing this reads nothing and writes nothing: the tests want the
// arithmetic without the files the workflow reads it from.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
