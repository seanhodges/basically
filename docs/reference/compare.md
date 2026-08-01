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
page tells you what changes: the keywords you lose, gain or must rewrite, the
control codes that differ, and how the two machines differ in language rules and
hardware.

Read it inside the [IDE](https://ba.sical.ly/) with a program open and it
narrows itself to that program: the commands to rewrite, the commands to rename,
the commands whose usage differs, the same-word-different-meaning warnings and
the control codes to replace are limited to the ones your listing actually
contains. It says how much of the program it recognised and how many other
differences it is holding back, and a tick shows them all again. The language
and hardware table, what the target machine adds and the guidance below are
never narrowed — those apply to any program whatever it uses. With an AI
assistant configured you can also have the port carried out for you. Either way
it is a starting point — performance and hardware input usually need attention
afterwards.

Every machine is listed in its own right, because sharing a BASIC is not
sharing a machine: a program that fits a Commodore 64 will not necessarily fit
an unexpanded VIC-20, and a CPC 6128 has commands a 464 does not.

If you're new to porting programs, read [this](./porting-basics) first.

<DialectCompare :dialects="dialects" />
