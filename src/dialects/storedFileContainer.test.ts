/**
 * Every registered machine says how a file it stored splits into the bytes a
 * program saved and the framing around them.
 *
 * `Dialect.unwrapStoredFile` is optional, and absent is a real answer: most
 * machines write the payload itself into the file store, so the stored bytes
 * are the file. But absent is also what a machine that *does* wrap its files
 * looks like when nobody wired it up, and the failure is silent - a user opens
 * their high-score table on a tape header and it reads as a corrupt file
 * rather than as a missing seam. So the exemptions are an exact set with a
 * reason each, and a dialect added without one fails here.
 *
 * Behavioural rather than a `typeof` check, deliberately: a member that always
 * answered "the stored bytes are the payload" would compile, satisfy any
 * presence test, and unwrap nothing. So a dialect that declares one also
 * brings the shape its own machine stores, and has to actually split it.
 */
import { describe, expect, it } from 'vitest';
import { dialects } from './registry';
import { tapFromPayloads } from './zxspectrum/tapfile';
import { DATA_FILE_TYPE, buildPmdImage } from './pmd85/tape';

/**
 * Machines whose file store holds the payload itself, and why. Every dialect
 * not listed here must declare `unwrapStoredFile`.
 */
const STORES_THE_PAYLOAD: Record<string, string> = {
  // Traps that write what the program wrote, with no container of their own.
  bbcmicro: 'the filing-system trap stores the bytes the program wrote',
  bbcmaster: 'the filing-system trap stores the bytes the program wrote',
  atom: 'the filing-system trap stores the bytes the program wrote',
  commodore64: 'the KERNAL trap stores the bytes the program wrote',
  vic20: 'the KERNAL trap stores the bytes the program wrote',
  pet: 'the KERNAL trap stores the bytes the program wrote',
  trs80: 'the interpreter stores a sequential file as the text it wrote',
  cpc464: 'the cassette-manager trap stores the bytes the program wrote',
  cpc664: 'the cassette-manager trap stores the bytes the program wrote',
  cpc6128: 'the cassette-manager trap stores the bytes the program wrote',
  // Machines that do not trap file I/O at all: nothing reaches the store, so
  // there is nothing to unwrap. Wiring them up is its own piece of work, and
  // whichever of them gains a container has to come out of this table.
  zx81: 'no file-I/O trap, so nothing reaches the store',
  zx80: 'no file-I/O trap, so nothing reaches the store',
  altair8800: 'no file-I/O trap, so nothing reaches the store',
  apple1: 'no file-I/O trap, so nothing reaches the store',
  atari800: 'no file-I/O trap, so nothing reaches the store',
  atari400: 'no file-I/O trap, so nothing reaches the store',
};

/** The payload every case below unwraps to, so a partial split is visible. */
const PAYLOAD = Uint8Array.from([0x10, 0x20, 0x30, 0x40, 0x00, 0xff]);

/**
 * One file in the shape the dialect's own machine stores it, per dialect that
 * declares the seam. A declaring dialect with no entry fails: the point of the
 * test is that the member unwraps something real.
 */
const STORED_SHAPE: Record<string, () => Uint8Array> = {
  zxspectrum: spectrumTapeImage,
  zxspectrum128: spectrumTapeImage,
  pmd85: pmd85TapeImage,
};

/** A two-block tape image, as the Spectrum deck stores a `SAVE … DATA`. */
function spectrumTapeImage(): Uint8Array {
  const header = new Uint8Array(17).fill(0x20);
  header[0] = 1; // number array
  header[11] = PAYLOAD.length & 0xff;
  header[12] = (PAYLOAD.length >> 8) & 0xff;
  return tapFromPayloads(header, PAYLOAD);
}

/** One tape file, as the PMD 85 deck stores a `DSAVE`: header block then body. */
function pmd85TapeImage(): Uint8Array {
  return buildPmdImage({
    header: { number: 2, type: DATA_FILE_TYPE, start: 0x7000, name: '' },
    bytes: PAYLOAD,
  });
}

/** Bytes no machine's own capture path produced, in the shapes that trip framing. */
const FOREIGN: [string, Uint8Array][] = [
  ['empty', new Uint8Array()],
  ['a lone byte', Uint8Array.from([0x41])],
  ['plain text', Uint8Array.from([0x48, 0x49, 0x0d, 0x0a])],
  [
    'a length prefix promising more than it carries',
    Uint8Array.from([0xff, 0xff, 0x00]),
  ],
];

describe('every registered machine declares how its stored files unwrap', () => {
  for (const dialect of dialects) {
    const excused = STORES_THE_PAYLOAD[dialect.id];

    if (excused) {
      it(`${dialect.id} stores the payload itself: ${excused}`, () => {
        expect(dialect.unwrapStoredFile).toBeUndefined();
      });
      continue;
    }

    it(`${dialect.id} splits a stored file into its payload and container`, () => {
      expect(
        typeof dialect.unwrapStoredFile,
        `${dialect.id} should declare unwrapStoredFile, or be listed in ` +
          'STORES_THE_PAYLOAD with a reason',
      ).toBe('function');
      const shape = STORED_SHAPE[dialect.id];
      expect(
        shape,
        `${dialect.id} declares unwrapStoredFile but STORED_SHAPE has no ` +
          'example of what its machine stores, so nothing proves it unwraps',
      ).toBeDefined();

      const { payload, container } = dialect.unwrapStoredFile!(shape!());
      expect(Array.from(payload)).toEqual(Array.from(PAYLOAD));
      expect(container).not.toBeNull();
      expect(container!.length).toBeGreaterThan(0);
    });

    // A file the store holds that this machine did not write - another
    // machine's leftovers, a capture that never finished - is shown whole
    // rather than refused or truncated to a container that isn't there.
    it(`${dialect.id} hands back bytes it cannot frame`, () => {
      for (const [label, bytes] of FOREIGN) {
        const got = dialect.unwrapStoredFile!(bytes);
        expect(Array.from(got.payload), `${dialect.id}: ${label}`).toEqual(
          Array.from(bytes),
        );
        expect(got.container, `${dialect.id}: ${label}`).toBeNull();
      }
    });
  }
});
