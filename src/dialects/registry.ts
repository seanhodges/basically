import type { Dialect } from './types';
import { zx81 } from './zx81';
import { zx80 } from './zx80';
import { zxspectrum } from './zxspectrum';
import { zxspectrum128 } from './zxspectrum128';
import { bbcmicro } from './bbcmicro';
import { bbcmaster } from './bbcmaster';
import { commodore64 } from './commodore64';
import { pet } from './pet';
import { vic20 } from './vic20';
import { atom } from './atom';
import { trs80 } from './trs80';
import { cpc464 } from './cpc464';

export const dialects: Dialect[] = [
  zx81,
  zx80,
  zxspectrum,
  zxspectrum128,
  bbcmicro,
  bbcmaster,
  commodore64,
  pet,
  vic20,
  atom,
  trs80,
  cpc464,
];

export function getDialect(id: string): Dialect {
  const d = dialects.find((d) => d.id === id);
  if (!d) throw new Error(`Unknown dialect: ${id}`);
  return d;
}

/**
 * Look up a dialect by id, returning `undefined` rather than throwing when it
 * isn't registered. For callers that must handle an unknown id gracefully -
 * e.g. opening a project saved under a dialect this build doesn't ship.
 */
export function findDialect(id: string): Dialect | undefined {
  return dialects.find((d) => d.id === id);
}
