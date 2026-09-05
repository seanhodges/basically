---
title: Porting between dialects
---

# Porting between dialects

What every port between these BASICs involves, whichever two machines you pick.
For the differences between one machine and another, see the
[porting guide](./compare).

Seven things account for most of the work.

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

**The characters themselves.** No machine here covers printable ASCII in full,
and several fall well short — a ZX81 has no `!`, `#`, `&` or `@`, and a Commodore
has no `\` or `^`. A character the target has no glyph for cannot appear
anywhere: not in a string, not in a comment, not in a variable name. The porting
guide lists the ones your program actually uses.

**Anything numeric.** An integer-only machine has no fractions at all: division
truncates and every fractional calculation needs rescaling. The exponent
operator is spelled `**`, `^` or `↑` depending on the machine — on the Atom it
belongs to the floating-point half of the language and an integer expression
rejects it — and every machine here folds it left to right, so `2^3^2` is 64.
Integer division and remainder are `DIV` and `MOD` on the BBC, `\` and `MOD` on
the Amstrad, `%` for remainder alone on the Atom, and nothing at all on the
Sinclair and Microsoft machines, where they become `INT(a/b)` and
`a-b*INT(a/b)`.

**Logic and comparisons.** This is the one that does not fail — it computes a
different answer and says nothing. On most of these machines `AND`, `OR` and
`NOT` combine their operands bit by bit; on the ZX81 and the Spectrum they pick
one of the operands instead, so `5 AND 3` is `5` there and `1` on a Commodore.
A condition built from `0` and `1` behaves the same either way, which is why the
line that masks bits is the line nobody rewrites. The truth value differs with
it: a true comparison is `-1` on the Microsoft, BBC and Amstrad machines and the
ZX80, and `1` on the ZX81, the Spectrum and the Atom — so the counting idiom
`X=X+(A>B)` changes sign after a port. Exclusive-OR is `EOR` on the BBC, `XOR`
on the Amstrad, `:` on the Atom, and absent elsewhere. The two Sinclairs are not
a pair here: the ZX80 sits with the bitwise machines and the ZX81 does not.

**The arguments themselves.** A command that survives the port under the same
spelling can still take different arguments, and nothing about the line will look
wrong — it simply does something else. Three ways this bites. Some machines take a
_leading_ argument the others don't: `PLOT` is `PLOT <x>, <y>` on the Sinclair and
Amstrad machines but `PLOT <action>, <x>, <y>` on the Acorn ones, where the first
number chooses whether to draw, invert or move. Some take the same arguments in a
_different order_: the BBC's `SOUND <channel>, <amplitude>, <pitch>, <duration>` puts
duration last, the Amstrad's `SOUND <channel>, <period>, <duration>` puts it third, and
the Spectrum's `BEEP <duration>, <pitch>` puts it first. And some measure the same
thing differently — that Amstrad `<period>` is a tone period, not a pitch. Coordinates
can be relative rather than absolute, too: the Spectrum's `DRAW` takes an offset from
where the last one finished, where every other machine here draws to a point.

Optional arguments are the quiet ones. Dropping an argument the target does not have
is usually easy; noticing that the target _needs_ one is not. Each language reference
gives the full argument list for every command, written the same way on every page, so
two pages can be read side by side — and the porting guide reports the commands whose
usage differs between the pair you picked.

**Everything touching hardware.** Addresses never travel: a `POKE`, `USR`,
`CALL` or `SYS` aimed at one machine's screen, sound chip or system variables
means nothing on another, and neither do its control codes. Graphics and sound
have to be rewritten rather than translated — these machines range from no
graphics commands at all to `PLOT`/`DRAW`/`CIRCLE` with sound.
