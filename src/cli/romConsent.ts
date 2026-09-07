// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Agreeing to obtain ROM images.
 *
 * Nothing else in this toolchain asks the user anything - every command reads
 * its arguments, does the work and exits - so this is the one place a question
 * is put, and the reason it earns an exception is that obtaining a ROM writes
 * someone else's firmware onto a disk under terms the user has not seen. The
 * notice those terms live in (`public/roms/ATTRIBUTION.md`, published beside
 * the images) is named in the question, so agreeing is agreeing to something
 * readable rather than to a yes/no.
 *
 * What is agreed to is *obtaining ROM images from the publisher*, not one
 * version of one set: the record is a single file and it covers every later
 * machine and every later refresh. See the change's design note for why asking
 * per image would be both noisier and less honest.
 *
 * Three ways to have already agreed, because a terminal is not always there:
 * the environment setting, a deliberate `roms accept`, or simply having the
 * images already - in which case nothing is obtained and the question never
 * arises.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { attributionUrl, romCacheHome } from './romCache';

const CONSENT_FILE = 'consent.json';

/** What was agreed, when, and how it was given. */
export interface RomConsent {
  acceptedAt: string;
  /** The manifest version held when it was given, where one was. */
  romsVersion?: string;
  source: 'asked' | 'accept' | 'environment';
}

/** How the environment says yes. Anything else, including absent, is no. */
const YES = ['yes', 'y', '1', 'true'];

/** Whether this run was started already agreeing. */
export function consentFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const setting = env.BASICALLY_ROM_CONSENT?.trim().toLowerCase();
  return setting !== undefined && YES.includes(setting);
}

/** What was agreed previously, or null if nothing was. */
export function recordedConsent(
  home: string = romCacheHome(),
): RomConsent | null {
  const file = path.join(home, CONSENT_FILE);
  if (!existsSync(file)) return null;
  try {
    const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof raw !== 'object' || raw === null) return null;
    const consent = raw as Partial<RomConsent>;
    return typeof consent.acceptedAt === 'string'
      ? (consent as RomConsent)
      : null;
  } catch {
    return null;
  }
}

/** Remember that the user agreed, so they are not asked again. */
export function recordConsent(
  consent: RomConsent,
  home: string = romCacheHome(),
): void {
  mkdirSync(home, { recursive: true });
  writeFileSync(
    path.join(home, CONSENT_FILE),
    `${JSON.stringify(consent, null, 2)}\n`,
  );
}

/**
 * Forget the agreement, so the next run that would obtain a ROM asks again.
 *
 * `roms clear` does this alongside discarding the images, because the question
 * says the answer is remembered until then. Leaving the agreement behind would
 * make that sentence untrue and leave no way to take it back.
 */
export function forgetConsent(home: string = romCacheHome()): void {
  rmSync(path.join(home, CONSENT_FILE), { force: true });
}

/**
 * The question, as the lines it is put in.
 *
 * Separate from the asking so `roms accept` can show the same words without a
 * prompt, and so a test can read them without a terminal.
 */
export function consentQuestion(opts: {
  home?: string;
  env?: NodeJS.ProcessEnv;
}): string[] {
  const env = opts.env ?? process.env;
  const home = opts.home ?? romCacheHome(env);
  const notice = attributionUrl(undefined, env);
  return [
    'The machine ROM images are not part of this tool: they are the original',
    'firmware, published separately and covered by their own terms.',
    '',
    `They can be downloaded to ${path.join(home, 'roms')}`,
    // Where this build names no publisher there is no served notice to point at,
    // so the checkout's copy - the same words - is named on its own instead.
    ...(notice === undefined
      ? [
          'See https://github.com/seanhodges/basically/blob/main/public/roms/ATTRIBUTION.md.',
        ]
      : [
          `The terms are set out in the notice beside them, ${notice}.`,
        ]),
    '',
    'Answering yes covers future machines and updates; to retract, run "basically roms clear".',
  ];
}

/**
 * Ask, and answer false where there is nobody to ask.
 *
 * Both streams are checked, not just stdin: a run whose output is piped
 * somewhere would put the question where no one reads it and then wait for an
 * answer that cannot come. A caller with no terminal is refused promptly and
 * told how to agree in advance - it is never left waiting on a question it has
 * no way to answer.
 *
 * The caller must decide this *before* reading a program from stdin. `run` and
 * `check` consume stdin for the program, and a question asked afterwards would
 * be reading an answer from a stream that has already ended.
 */
export async function askForConsent(
  opts: {
    home?: string;
    env?: NodeJS.ProcessEnv;
    input?: NodeJS.ReadStream;
    output?: NodeJS.WriteStream;
  } = {},
): Promise<boolean> {
  const input = opts.input ?? process.stdin;
  const output = opts.output ?? process.stderr;
  if (!input.isTTY || !output.isTTY) return false;

  for (const line of consentQuestion(opts)) output.write(`${line}\n`);
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question('Download them? [y/N] ');
    return YES.includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

/**
 * Whether this run may obtain ROMs, asking if it can and must.
 *
 * `ask` is what separates a command that should put the question from one that
 * should not: `roms status` reports on a cache without ever being allowed to
 * start a download, where `run` may.
 */
export async function consentToFetch(
  opts: {
    home?: string;
    env?: NodeJS.ProcessEnv;
    ask?: boolean;
    input?: NodeJS.ReadStream;
    output?: NodeJS.WriteStream;
  } = {},
): Promise<{ agreed: boolean; askedAndDeclined: boolean }> {
  const env = opts.env ?? process.env;
  const home = opts.home ?? romCacheHome(env);
  if (consentFromEnv(env)) {
    if (!recordedConsent(home)) {
      recordConsent(
        { acceptedAt: new Date().toISOString(), source: 'environment' },
        home,
      );
    }
    return { agreed: true, askedAndDeclined: false };
  }
  if (recordedConsent(home)) return { agreed: true, askedAndDeclined: false };
  if (opts.ask === false) return { agreed: false, askedAndDeclined: false };

  const agreed = await askForConsent({ ...opts, home, env });
  if (agreed) {
    recordConsent(
      { acceptedAt: new Date().toISOString(), source: 'asked' },
      home,
    );
  }
  return { agreed, askedAndDeclined: !agreed };
}

/** What to tell a caller that could not be asked and had not agreed. */
export function howToAgree(): string {
  return (
    'run "basically roms accept" once, or set BASICALLY_ROM_CONSENT=yes, ' +
    'or point --rom-root at ROMs you already have'
  );
}
