---
title: Porting between dialects
---

# Porting between dialects

What every port between these BASICs involves, whichever two machines you pick.
For the differences between one machine and another, see the
[porting guide](./compare).

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
