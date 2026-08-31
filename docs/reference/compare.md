---
title: Porting guide
---

<script setup>
import { altair8800Reference } from '../../src/reference/altair8800';
import { apple1Reference } from '../../src/reference/apple1';
import { apple2Reference } from '../../src/reference/apple2';
import { atariReference } from '../../src/reference/atari';
import { atomReference } from '../../src/reference/atom';
import { bbcReference } from '../../src/reference/bbc';
import { commodoreReference } from '../../src/reference/commodore';
import { cpcReference } from '../../src/reference/cpc';
import { pmd85Reference } from '../../src/reference/pmd85';
import { trs80Reference } from '../../src/reference/trs80';
import { zxspectrumReference } from '../../src/reference/zxspectrum';
import { zx80Reference } from '../../src/reference/zx80';
import { zx81Reference } from '../../src/reference/zx81';

import { altair8800Escapes } from '../../src/reference/escapes/altair8800';
import { apple1Escapes } from '../../src/reference/escapes/apple1';
import { apple2Escapes } from '../../src/reference/escapes/apple2';
import { atariEscapes } from '../../src/reference/escapes/atari';
import { atomEscapes } from '../../src/reference/escapes/atom';
import { bbcEscapes } from '../../src/reference/escapes/bbc';
import { commodoreEscapes } from '../../src/reference/escapes/commodore';
import { cpcEscapes } from '../../src/reference/escapes/cpc';
import { pmd85Escapes } from '../../src/reference/escapes/pmd85';
import { trs80Escapes } from '../../src/reference/escapes/trs80';
import { zxspectrumEscapes } from '../../src/reference/escapes/zxspectrum';
import { zx80Escapes } from '../../src/reference/escapes/zx80';
import { zx81Escapes } from '../../src/reference/escapes/zx81';

import { altair8800MemoryMap } from '../../src/dialects/altair8800/memoryMap';
import { apple1MemoryMap } from '../../src/dialects/apple1/memoryMap';
import { apple2MemoryMap } from '../../src/dialects/apple2/memoryMap';
import { atari800MemoryMap } from '../../src/dialects/atari800/memoryMap';
import { atari400MemoryMap } from '../../src/dialects/atari400/memoryMap';
import { atomMemoryMap } from '../../src/dialects/atom/memoryMap';
import { bbcMasterMemoryMap } from '../../src/dialects/bbcmaster/memoryMap';
import { bbcMicroMemoryMap } from '../../src/dialects/bbcmicro/memoryMap';
import { c64MemoryMap } from '../../src/dialects/commodore64/memoryMap';
import { cpc464MemoryMap } from '../../src/dialects/cpc464/memoryMap';
import { cpc664MemoryMap } from '../../src/dialects/cpc664/memoryMap';
import { cpc6128MemoryMap } from '../../src/dialects/cpc6128/memoryMap';
import { pmd85MemoryMap } from '../../src/dialects/pmd85/memoryMap';
import { petMemoryMap } from '../../src/dialects/pet/memoryMap';
import { vic20MemoryMap } from '../../src/dialects/vic20/memoryMap';
import { zx80MemoryMap } from '../../src/dialects/zx80/memoryMap';
import { zx81MemoryMap } from '../../src/dialects/zx81/memoryMap';
import { spectrumMemoryMap } from '../../src/dialects/zxspectrum/memoryMap';
import { spectrum128MemoryMap } from '../../src/dialects/zxspectrum128/memoryMap';

import { portingFacts } from '../../src/reference/facts';
import { machines as machineList } from '../../src/reference/machines';

// Reference and escape tables belong to the docs *page*, which may cover
// several machines; DialectCompare narrows their rows to whichever machine is
// selected. Facts belong to the *machine*, because free RAM and colour do not
// survive being averaged across a family.
const referenceByPage = {
  altair8800: altair8800Reference,
  apple1: apple1Reference,
  apple2: apple2Reference,
  atari: atariReference,
  atom: atomReference,
  bbc: bbcReference,
  commodore: commodoreReference,
  cpc: cpcReference,
  pmd85: pmd85Reference,
  trs80: trs80Reference,
  zxspectrum: zxspectrumReference,
  zx80: zx80Reference,
  zx81: zx81Reference,
};
const escapesByPage = {
  altair8800: altair8800Escapes,
  apple1: apple1Escapes,
  apple2: apple2Escapes,
  atari: atariEscapes,
  atom: atomEscapes,
  bbc: bbcEscapes,
  commodore: commodoreEscapes,
  cpc: cpcEscapes,
  pmd85: pmd85Escapes,
  trs80: trs80Escapes,
  zxspectrum: zxspectrumEscapes,
  zx80: zx80Escapes,
  zx81: zx81Escapes,
};

// Memory maps belong to the *machine*, like facts and unlike the reference and
// escape tables: two machines on one page can lay their memory out quite
// differently (the BBC Micro and Master, the two CPCs). Imported straight from
// the dialects rather than mirrored into src/reference/ - the data is already
// structured, so a copy would only be something to keep in step. The dialect
// registry stays out of reach either way; machinePickerBoundary.test.ts walks
// these modules and holds that line.
const memoryMapById = {
  altair8800: altair8800MemoryMap,
  apple1: apple1MemoryMap,
  apple2: apple2MemoryMap,
  atari800: atari800MemoryMap,
  atari400: atari400MemoryMap,
  atom: atomMemoryMap,
  bbcmaster: bbcMasterMemoryMap,
  bbcmicro: bbcMicroMemoryMap,
  commodore64: c64MemoryMap,
  cpc464: cpc464MemoryMap,
  cpc664: cpc664MemoryMap,
  cpc6128: cpc6128MemoryMap,
  pet: petMemoryMap,
  pmd85: pmd85MemoryMap,
  vic20: vic20MemoryMap,
  zx80: zx80MemoryMap,
  zx81: zx81MemoryMap,
  zxspectrum: spectrumMemoryMap,
  zxspectrum128: spectrum128MemoryMap,
  // No entry for the TRS-80: its layout is not described, so the guide reports
  // no memory layouts for any pair involving it rather than half of one.
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
  memoryMap: memoryMapById[m.id],
}));
</script>

# Porting guide

Pick a machine you're porting **from** and one you're porting **to**, and this
page tells you what needs to change. Read it inside the [IDE](https://ba.sical.ly/) with a program open and it
speclialises itself to that program.

If you're new to porting programs, read [this](./porting-basics) first. The usage
strings below are written in the [argument notation](./#argument-notation) the
language references use.

<DialectCompare :dialects="dialects" />
