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
 *   publish twice, and a package that is not there yet is a difference rather
 *   than an error.
 * - **Which number?** Settled against the registry, because the registry is
 *   what the number must not collide with. A `cli-v*` tag ahead of what is
 *   published is a person asking for that minor or major; otherwise the patch
 *   digit is raised, which is the only digit this ever moves.
 *
 * That second rule is what makes a lost tag harmless. If a publish succeeds and
 * the tag push then fails, the next run finds the build id already on the
 * registry and stops - so there is no second release of the same build, and no
 * attempt to reuse a number that is already spent. Counting from the tags
 * instead would try to republish what just shipped and fail every run until
 * someone noticed.
 *
 * Run with `--stamp` it writes the version and the build id into the manifest
 * instead of reporting them. The answer is recomputed rather than passed along,
 * because every input is a file or a tag and the arithmetic is the same both
 * times.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const published = process.env.PUBLISHED ?? 'published.json';
const bundleDir = process.env.BUNDLE_DIR ?? 'scripts/headless/dist';
const manifestPath = process.env.MANIFEST ?? 'scripts/headless/package.json';

/** A version as three numbers, or null for anything that is not one. */
function parseVersion(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
  return match ? match.slice(1, 4).map(Number) : null;
}

/** Negative, zero or positive, as a comparator wants it. */
function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

const show = (version) => version.join('.');

/** The newest `cli-v*` tag in the repository, or null when there is none. */
function intendedVersion() {
  let tags;
  try {
    tags = execFileSync('git', ['tag', '--list', 'cli-v*'], {
      encoding: 'utf8',
    });
  } catch {
    return null;
  }
  const versions = tags
    .split('\n')
    .map((tag) => parseVersion(tag.trim().replace(/^cli-v/, '')))
    .filter((version) => version !== null);
  if (versions.length === 0) return null;
  return versions.reduce((newest, one) =>
    compare(one, newest) > 0 ? one : newest,
  );
}

/**
 * The first version, when nothing is published and nobody has asked for a
 * number. Not 1.0.0: what it means is "this exists", not "this is settled".
 */
const FIRST_VERSION = [0, 1, 0];

function decide() {
  const built = readFileSync(
    path.join(bundleDir, 'buildId.txt'),
    'utf8',
  ).trim();

  let packument = {};
  try {
    packument = JSON.parse(readFileSync(published, 'utf8') || '{}');
  } catch {
    // An absent or unreadable answer is the same as nothing published: this
    // build is new, which is the safe direction to be wrong in.
  }
  const latestText = packument['dist-tags']?.latest ?? packument.version ?? '';
  const publishedBuild = packument.basicallyBuildId ?? '';

  if (publishedBuild !== '' && publishedBuild === built) {
    return { changed: false, built, latest: latestText, version: '' };
  }

  const latest = parseVersion(latestText);
  const intended = intendedVersion();

  let version;
  if (latest === null) {
    // Nothing published yet: whatever a person tagged, or a first version.
    version = intended ?? FIRST_VERSION;
  } else if (intended !== null && compare(intended, latest) > 0) {
    // A tag ahead of the registry is a person asking for a minor or a major.
    version = intended;
  } else {
    version = [latest[0], latest[1], latest[2] + 1];
  }

  return { changed: true, built, latest: latestText, version: show(version) };
}

const answer = decide();

if (process.argv.includes('--stamp')) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.version = answer.version;
  manifest.basicallyBuildId = answer.built;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Stamped ${answer.version} (build ${answer.built}).`);
} else {
  const output = process.env.GITHUB_OUTPUT;
  const lines =
    `changed=${answer.changed}\n` +
    `built=${answer.built}\n` +
    `latest=${answer.latest}\n` +
    `version=${answer.version}\n`;
  if (output) appendFileSync(output, lines);
  console.log(
    answer.changed
      ? `Publishing ${answer.version}: built ${answer.built}, ` +
          `published ${answer.latest || 'nothing'}.`
      : `Nothing to publish: ${answer.latest} already carries ${answer.built}.`,
  );
}
