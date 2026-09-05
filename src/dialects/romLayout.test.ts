import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dialects } from './registry';

/**
 * Where a machine's ROM image lives, and that the next one lands in the same
 * place.
 *
 * `public/roms/` holds one folder per machine, named for the dialect id that
 * owns it (`zx81/zx81.rom`, `commodore64/kernal.bin`); the layout note at the
 * top of `public/roms/ATTRIBUTION.md` is the prose version of what is checked
 * here. Nothing about the seam enforces it: `romUrl` is a string, an image
 * dropped at the top of the folder loads exactly as well as one inside it, and
 * a machine whose image went in the wrong place still boots. So the layout
 * drifts silently, one new machine at a time, which is how it drifted before it
 * was tidied.
 *
 * The exceptions are declared here rather than skipped, so each stays checked
 * for the thing that makes it an exception.
 */

const ROM_DIR = join(__dirname, '../../public/roms');

/**
 * jsbeeb's own layout, which is not ours to choose.
 *
 * The BBC Micro and BBC Master run on jsbeeb, whose model table names each ROM
 * by a literal path and whose loader fetches it as `<base>/roms/<name>`, so
 * this subtree is a copy of jsbeeb's `public/roms/` and has to keep its shape.
 * The Atom runs on jsbeeb too and is not exempted: jsbeeb names its images
 * `atom/…`, which is the folder the scheme would have picked anyway.
 */
const JSBEEB_ENTRIES = ['os.rom', 'BASIC.ROM', 'b', 'master'];
const JSBEEB_DIALECTS = ['bbcmicro', 'bbcmaster'];

/**
 * Folders named for a set of machines rather than for one dialect id, because
 * those machines share one image.
 *
 * The Atari 400 and 800 ran the same firmware, and duplicating 18K of it to
 * give each dialect a folder of its own would be the worse answer. An entry
 * here is a claim about the hardware, not somewhere to put a machine that was
 * awkward to file.
 */
const SHARED_FOLDERS: Record<string, readonly string[]> = {
  atari: ['atari400', 'atari800'],
};

const ids = new Set(dialects.map((d) => d.id));

/** The `roms/…` tail of a `romUrl`, which is otherwise a deployed URL. */
function romTail(romUrl: string): string {
  return romUrl.slice(romUrl.indexOf('roms/') + 'roms/'.length);
}

/** Every file under `public/roms/`, as a path relative to it. */
function romFiles(dir = ROM_DIR, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? romFiles(join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}

describe('the ROM folder layout', () => {
  it('every machine points at an image inside its own folder', () => {
    let checked = 0;
    for (const dialect of dialects) {
      const url = dialect.romUrl;
      if (url === undefined) continue;
      checked++;
      const tail = romTail(url);
      const [folder, ...rest] = tail.split('/');

      if (JSBEEB_DIALECTS.includes(dialect.id)) {
        // Still checked, against jsbeeb's table instead of ours: the day one of
        // these stops being resolved by jsbeeb it stops being an exception, and
        // is filed like everything else.
        expect(
          JSBEEB_ENTRIES,
          `${dialect.id} runs on jsbeeb, so roms/${tail} has to be one of jsbeeb's own paths`,
        ).toContain(folder);
        continue;
      }

      expect(
        rest.length,
        `roms/${tail} sits at the top of public/roms/ - give ${dialect.id} a folder of its own (see the layout note in public/roms/ATTRIBUTION.md)`,
      ).toBeGreaterThan(0);
      // Who the folder belongs to, asked of the folder: `[dialect.id]` as the
      // fallback would pass whatever folder the machine reached into.
      expect(
        SHARED_FOLDERS[folder!] ?? [folder!],
        `roms/${tail} is not ${dialect.id}'s own folder - name the folder for the dialect id, or declare the sharing in SHARED_FOLDERS with the reason`,
      ).toContain(dialect.id);
    }
    // Guard against a vacuous pass: a registry that declared no ROM URLs at all
    // would satisfy every case above by having none.
    expect(checked, 'no registered dialect declares a romUrl').toBeGreaterThan(
      0,
    );
  });

  it('every committed image is filed under a machine', () => {
    // The other direction, and the one a new machine gets wrong: an image can
    // be committed anywhere, and the check above only sees the ones a `romUrl`
    // names. A machine that fetches a set (the Commodores, the CPCs) points its
    // `romUrl` at one file and reads the rest of the folder by name.
    for (const file of romFiles()) {
      if (file === 'ATTRIBUTION.md') continue;
      const [folder, ...rest] = file.split('/');
      if (JSBEEB_ENTRIES.includes(folder!)) continue;
      expect(
        rest.length,
        `public/roms/${file} sits at the top of the folder - put it in the folder named for the dialect id that runs it`,
      ).toBeGreaterThan(0);
      expect(
        ids.has(folder!) || folder! in SHARED_FOLDERS,
        `public/roms/${file} is in a folder no registered dialect is named for - name it for the dialect id, or declare it in SHARED_FOLDERS with the reason`,
      ).toBe(true);
    }
  });

  it('the exception tables carry nothing stale', () => {
    // An exception outlives what justified it silently, which is how a rule
    // becomes a list of special cases nobody can explain.
    for (const id of JSBEEB_DIALECTS) {
      expect(ids, `${id} is exempted here but is not registered`).toContain(id);
    }
    for (const [folder, sharers] of Object.entries(SHARED_FOLDERS)) {
      for (const id of sharers) {
        expect(ids, `${id} shares ${folder}/ but is not registered`).toContain(
          id,
        );
      }
      const pointsIn = dialects.filter(
        (d) =>
          d.romUrl !== undefined && romTail(d.romUrl).startsWith(`${folder}/`),
      );
      expect(
        pointsIn.map((d) => d.id).sort(),
        `${folder}/ is declared shared by ${sharers.join(' and ')}, but that is not who points into it`,
      ).toEqual([...sharers].sort());
    }
  });
});
