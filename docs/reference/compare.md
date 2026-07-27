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

const factsFor = (id) => portingFacts.find((f) => f.id === id);

// Alphabetical by dialect, matching the reference sidebar order.
const dialects = [
  { id: 'atom', label: 'Atom BASIC', reference: atomReference, escapes: atomEscapes, facts: factsFor('atom') },
  { id: 'bbc', label: 'BBC BASIC', reference: bbcReference, escapes: bbcEscapes, facts: factsFor('bbc') },
  { id: 'commodore', label: 'Commodore BASIC', reference: commodoreReference, escapes: commodoreEscapes, facts: factsFor('commodore') },
  { id: 'cpc', label: 'Locomotive BASIC', reference: cpcReference, escapes: cpcEscapes, facts: factsFor('cpc') },
  { id: 'trs80', label: 'TRS-80 Level II BASIC', reference: trs80Reference, escapes: trs80Escapes, facts: factsFor('trs80') },
  { id: 'zxspectrum', label: 'ZX Spectrum BASIC', reference: zxspectrumReference, escapes: zxspectrumEscapes, facts: factsFor('zxspectrum') },
  { id: 'zx80', label: 'ZX80 BASIC', reference: zx80Reference, escapes: zx80Escapes, facts: factsFor('zx80') },
  { id: 'zx81', label: 'ZX81 BASIC', reference: zx81Reference, escapes: zx81Escapes, facts: factsFor('zx81') },
];
</script>

# Porting guide

Pick a dialect you're porting **from** and one you're porting **to**, and this
page summarises what to change: the keywords you'll lose, gain, or that behave
differently, the control codes that differ, and the language-rule and hardware
differences between the two machines.

The guide includes a feature to automatically port your program via the AI
assistant. In order to use this you must be viewing these docs inside the [IDE](https://ba.sical.ly/)
with your program open, and AI must be configured in the settings.

This guide and the automation act as a starting point. There will likely be
performance considerations, hardware inputs and other things still to address
after porting is complete.

## What a port usually involves

Four things account for most of the work:

**Restructuring.** If the target allows ony one statement on a line, every `:`
has to become a new line, which renumbers everything after it (you can use the
**Renumber file** feature to fix this). If the target has no `ELSE`, each
`IF … THEN … ELSE` becomes a test and its inverse. Dialects that
require `LET` reject a bare `X=1`. The table below tells you which of these
apply to your pair.

**Variable names.** This is where silent breakage lives. Where only the first
two characters are significant, `SCORE` and `SCALE` are the same variable and a
program that used both will misbehave rather than fail. Where names are a single
letter, long names have to be re-mapped by hand. And on the machines that ignore
spaces outside strings, a name that contains a reserved word is a syntax error,
`SCORE` contains `OR`. You can use the variable watcher in the emulator to monitor
variable usage.

**Anything numeric.** Integer-only machines have no fractions at all, so
division truncates and every fractional calculation needs rescaling. Watch the
exponent operator too: it is spelled `**`, `^` or `↑` depending on the machine,
some have no support.

**Everything touching hardware.** Addresses never travel. A `POKE`, `USR`,
`CALL` or `SYS` aimed at one machine's screen, sound chip or system variables
means nothing to another machine, and neither do the control codes. Graphics
and sound must be rewritten rather than translated: the machines here range from
no graphics commands whatsoever to full `PLOT`/`DRAW`/`CIRCLE` with sound.

<DialectCompare :dialects="dialects" />
