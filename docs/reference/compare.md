---
title: Porting guide
---

<script setup>
import { atomReference } from './data/atom';
import { bbcReference } from './data/bbc';
import { commodoreReference } from './data/commodore';
import { cpcReference } from './data/cpc';
import { trs80Reference } from './data/trs80';
import { zxspectrumReference } from './data/zxspectrum';
import { zx80Reference } from './data/zx80';
import { zx81Reference } from './data/zx81';

import { atomEscapes } from './data/escapes/atom';
import { bbcEscapes } from './data/escapes/bbc';
import { commodoreEscapes } from './data/escapes/commodore';
import { cpcEscapes } from './data/escapes/cpc';
import { trs80Escapes } from './data/escapes/trs80';
import { zxspectrumEscapes } from './data/escapes/zxspectrum';
import { zx80Escapes } from './data/escapes/zx80';
import { zx81Escapes } from './data/escapes/zx81';

import { portingFacts } from './data/facts';
import { machines as machineList } from './data/machines';

// Reference and escape tables belong to the docs *page*, which may cover
// several machines; DialectCompare narrows their rows to whichever machine is
// selected. Facts belong to the *machine*, because free RAM and colour do not
// survive being averaged across a family.
const referenceByPage = {
  atom: atomReference,
  bbc: bbcReference,
  commodore: commodoreReference,
  cpc: cpcReference,
  trs80: trs80Reference,
  zxspectrum: zxspectrumReference,
  zx80: zx80Reference,
  zx81: zx81Reference,
};
const escapesByPage = {
  atom: atomEscapes,
  bbc: bbcEscapes,
  commodore: commodoreEscapes,
  cpc: cpcEscapes,
  trs80: trs80Escapes,
  zxspectrum: zxspectrumEscapes,
  zx80: zx80Escapes,
  zx81: zx81Escapes,
};

// Manufacturer headings for the dropdown. Restated here rather than read from
// the registry because these docs never import src/; machines-crosscheck.test.ts
// pins the machine list itself, and a machine missing a heading just groups
// under its own label rather than breaking.
const makerOf = {
  atom: 'Acorn', bbcmicro: 'Acorn', bbcmaster: 'Acorn',
  pet: 'Commodore', vic20: 'Commodore', commodore64: 'Commodore',
  cpc464: 'Amstrad', cpc6128: 'Amstrad',
  trs80: 'Tandy',
  zx80: 'Sinclair', zx81: 'Sinclair',
  zxspectrum: 'Sinclair', zxspectrum128: 'Sinclair',
};

const factsFor = (id) => portingFacts.find((f) => f.id === id);

const dialects = machineList.map((m) => ({
  id: m.id,
  page: m.page,
  machine: m.id,
  label: m.label,
  group: makerOf[m.id],
  reference: referenceByPage[m.page],
  escapes: escapesByPage[m.page],
  facts: factsFor(m.id),
}));
</script>

# Porting guide

Pick a machine you're porting **from** and one you're porting **to**, and this
page tells you what changes: the keywords you lose, gain or must rewrite, the
control codes that differ, and how the two machines differ in language rules and
hardware. Reading it inside the [IDE](https://ba.sical.ly/) with a program open
and an AI assistant configured, you can also have the port carried out for you.
Either way it is a starting point — performance and hardware input usually need
attention afterwards.

Every machine is listed in its own right, because sharing a BASIC is not
sharing a machine: a program that fits a Commodore 64 will not necessarily fit
an unexpanded VIC-20, and a CPC 6128 has commands a 464 does not.

If you're new to porting programs, read [this](./porting-basics) first.

<DialectCompare :dialects="dialects" />
