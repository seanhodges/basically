---
title: Porting guide
---

<script setup>
import { altair8800Reference } from '../../src/reference/altair8800';
import { atomReference } from '../../src/reference/atom';
import { bbcReference } from '../../src/reference/bbc';
import { commodoreReference } from '../../src/reference/commodore';
import { cpcReference } from '../../src/reference/cpc';
import { trs80Reference } from '../../src/reference/trs80';
import { zxspectrumReference } from '../../src/reference/zxspectrum';
import { zx80Reference } from '../../src/reference/zx80';
import { zx81Reference } from '../../src/reference/zx81';

import { altair8800Escapes } from '../../src/reference/escapes/altair8800';
import { atomEscapes } from '../../src/reference/escapes/atom';
import { bbcEscapes } from '../../src/reference/escapes/bbc';
import { commodoreEscapes } from '../../src/reference/escapes/commodore';
import { cpcEscapes } from '../../src/reference/escapes/cpc';
import { trs80Escapes } from '../../src/reference/escapes/trs80';
import { zxspectrumEscapes } from '../../src/reference/escapes/zxspectrum';
import { zx80Escapes } from '../../src/reference/escapes/zx80';
import { zx81Escapes } from '../../src/reference/escapes/zx81';

import { portingFacts } from '../../src/reference/facts';
import { machines as machineList } from '../../src/reference/machines';

// Reference and escape tables belong to the docs *page*, which may cover
// several machines; DialectCompare narrows their rows to whichever machine is
// selected. Facts belong to the *machine*, because free RAM and colour do not
// survive being averaged across a family.
const referenceByPage = {
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
const escapesByPage = {
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

const factsFor = (id) => portingFacts.find((f) => f.id === id);

// The manufacturer, year and blurb are what the machine picker shows on a row.
// They come from machines.ts, where machines-crosscheck.test.ts pins each of
// them to the registry - unlike the manufacturer map that used to be inlined
// here, which nothing checked and which grouped a machine under its own name
// when it was missing.
const dialects = machineList.map((m) => ({
  id: m.id,
  page: m.page,
  machine: m.id,
  name: m.name,
  manufacturer: m.manufacturer,
  year: m.year,
  blurb: m.blurb,
  reference: referenceByPage[m.page],
  escapes: escapesByPage[m.page],
  facts: factsFor(m.id),
}));
</script>

# Porting guide

Pick a machine you're porting **from** and one you're porting **to**, and this
page tells you what needs to change. Read it inside the [IDE](https://ba.sical.ly/) with a program open and it
speclialises itself to that program.

If you're new to porting programs, read [this](./porting-basics) first.

<DialectCompare :dialects="dialects" />
