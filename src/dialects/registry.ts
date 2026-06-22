import type { Dialect } from './types';
import { zx81 } from './zx81';
import { zx80 } from './zx80';
import { zxspectrum } from './zxspectrum';
import { bbcmicro } from './bbcmicro';
import { bbcmaster } from './bbcmaster';
import { commodore64 } from './commodore64';
import { atom } from './atom';

export const dialects: Dialect[] = [
  zx81,
  zx80,
  zxspectrum,
  bbcmicro,
  bbcmaster,
  commodore64,
  atom,
];

export function getDialect(id: string): Dialect {
  const d = dialects.find((d) => d.id === id);
  if (!d) throw new Error(`Unknown dialect: ${id}`);
  return d;
}
