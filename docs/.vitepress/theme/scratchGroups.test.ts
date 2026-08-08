import { describe, it } from 'vitest';
import { machines } from '../../../src/reference/machines';
import { keywordEquivalences } from '../../../src/reference/porting';
import { domainGuidance } from '../../../src/reference/domain-guidance';
import { escapeGuidance } from '../../../src/reference/escape-guidance';
import {
  capabilitySections,
  diffEscapes,
  diffKeywords,
  escapeSections,
  escapeTableForMachine,
  tableForMachine,
} from '../../../src/reference/compare';
import { DOMAIN_ORDER } from './domainMeta';
import { altair8800Reference } from '../../../src/reference/altair8800';
import { atomReference } from '../../../src/reference/atom';
import { bbcReference } from '../../../src/reference/bbc';
import { commodoreReference } from '../../../src/reference/commodore';
import { cpcReference } from '../../../src/reference/cpc';
import { trs80Reference } from '../../../src/reference/trs80';
import { zxspectrumReference } from '../../../src/reference/zxspectrum';
import { zx80Reference } from '../../../src/reference/zx80';
import { zx81Reference } from '../../../src/reference/zx81';
import { altair8800Escapes } from '../../../src/reference/escapes/altair8800';
import { atomEscapes } from '../../../src/reference/escapes/atom';
import { bbcEscapes } from '../../../src/reference/escapes/bbc';
import { commodoreEscapes } from '../../../src/reference/escapes/commodore';
import { cpcEscapes } from '../../../src/reference/escapes/cpc';
import { trs80Escapes } from '../../../src/reference/escapes/trs80';
import { zxspectrumEscapes } from '../../../src/reference/escapes/zxspectrum';
import { zx80Escapes } from '../../../src/reference/escapes/zx80';
import { zx81Escapes } from '../../../src/reference/escapes/zx81';

const refs: Record<string, any> = {
  altair8800: altair8800Reference,
  atom: atomReference,
  bbc: bbcReference,
  commodore: commodoreReference,
  cpc: cpcReference,
  trs80: trs80Reference,
  zxspectrum: zxspectrumReference,
  zx80: zx80Reference,
  zx81: zx81Reference,
};
const escs: Record<string, any> = {
  altair8800: altair8800Escapes,
  atom: atomEscapes,
  bbc: bbcEscapes,
  commodore: commodoreEscapes,
  cpc: cpcEscapes,
  trs80: trs80Escapes,
  zxspectrum: zxspectrumEscapes,
  zx80: zx80Escapes,
  zx81: zx81Escapes,
};

describe('scratch', () => {
  it('group counts per pair', () => {
    const caps: string[] = [];
    const esc: string[] = [];
    let maxCap = 0;
    let maxEsc = 0;
    for (const s of machines) {
      for (const t of machines) {
        if (s.id === t.id) continue;
        const st = tableForMachine(refs[s.page], s.id);
        const tt = tableForMachine(refs[t.page], t.id);
        const diff = diffKeywords(st, tt, {
          from: s.page,
          to: t.page,
          equivalences: keywordEquivalences,
        });
        const secs = capabilitySections(
          diff.mustReplace,
          diff.newlyAvailable,
          tt,
          DOMAIN_ORDER,
          domainGuidance,
          t.page,
        );
        const losing = secs.filter((x) => x.entries.length).length;
        if (t.id === 'zx81' && (s.id === 'commodore64' || s.id === 'bbcmicro'))
          console.log(`PAIR ${s.id} -> zx81: ${losing} capability groups`);
        maxCap = Math.max(maxCap, losing);
        if (losing > 10) caps.push(`${s.id} -> ${t.id}: ${losing} groups`);

        const se = escapeTableForMachine(escs[s.page], s.id);
        const te = escapeTableForMachine(escs[t.page], t.id);
        const ed = diffEscapes(se, te);
        const n = escapeSections(
          ed.mustReplace,
          escs[s.page],
          escapeGuidance,
          t.page,
        ).length;
        maxEsc = Math.max(maxEsc, n);
        if (n > 10) esc.push(`${s.id} -> ${t.id}: ${n} categories`);
      }
    }
    console.log('CAPABILITY groups > 10:', caps.length, 'max', maxCap);
    console.log(caps.slice(0, 15).join('\n'));
    console.log('ESCAPE categories > 10:', esc.length, 'max', maxEsc);
    console.log(esc.slice(0, 15).join('\n'));
  });
});
