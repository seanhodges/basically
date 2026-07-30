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
page tells you what changes: the keywords you lose, gain or must rewrite, the
control codes that differ, and how the two machines differ in language rules and
hardware. Reading it inside the [IDE](https://ba.sical.ly/) with a program open
and an AI assistant configured, you can also have the port carried out for you.
Either way it is a starting point — performance and hardware input usually need
attention afterwards.

<DialectCompare :dialects="dialects">

## Porting between dialects

Four things account for most of the work.

**Restructuring.** If the target allows only one statement per line, every `:`
becomes a new line, which renumbers everything after it — the **Renumber file**
feature fixes that. Without `ELSE`, each `IF … THEN … ELSE` becomes a test and
its inverse, and a dialect that requires `LET` rejects a bare `X=1`.

**Variable names.** Where only the first two characters are significant, `SCORE`
and `SCALE` are one variable, and the program misbehaves rather than fails.
Where names are a single letter, long names must be remapped by hand. On the
machines that ignore spaces outside strings, a name containing a reserved word
is a syntax error — `SCORE` contains `OR`. The emulator's variable watcher shows
what the program actually ends up with.

**Anything numeric.** An integer-only machine has no fractions at all: division
truncates and every fractional calculation needs rescaling. The exponent
operator is spelled `**`, `^` or `↑` depending on the machine, and some have
none.

**Everything touching hardware.** Addresses never travel: a `POKE`, `USR`,
`CALL` or `SYS` aimed at one machine's screen, sound chip or system variables
means nothing on another, and neither do its control codes. Graphics and sound
have to be rewritten rather than translated — these machines range from no
graphics commands at all to `PLOT`/`DRAW`/`CIRCLE` with sound.

</DialectCompare>
