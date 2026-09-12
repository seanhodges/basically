---
title: Debugging a program
---

# Debugging a program outside the browser

The IDE can stop a BASIC program on a line, show you which line it stopped
before, and step it on a line at a time while you watch what the variables hold.
The toolchain can do the same thing without a browser anywhere near it: a run can
be told where to stop, and the machine is left sitting there for the commands
that follow.

This is written for two people: someone who has a program that goes wrong
somewhere and would rather find out where than add `PRINT` statements to it, and
someone building an application around the toolchain — an editor, say — whose
user is going to want a debugger.

## Stopping a program part-way through

Breakpoints have to be in place before the program starts, or the program is over
before anyone could set one. So the run is where the first ones go:

```bash
basically run count.bas -m zx81 --break 30 --hold
```

```
ZX81 (zx81) 256x192 @ 50.08Hz
program 64 bytes, 1 frame, stopped before line 30
the machine is left there: "basically where", "basically variables",
"basically step" and "basically continue" act on it
```

A run that stopped is not a run that ended, and says so rather than leaving you
to guess from the screen. Lines may be written `--break 30`, `--break 20,30` or
`--break '20 30'`.

The machine is still there, stopped before line 30 with nothing advancing it, so
everything you can ask of a held machine you can ask of it now — and the answers
are about that moment in the program rather than about the end of it:

```bash
basically variables
```

```
A = 1
```

## Stepping and continuing

`step` runs the program on until the line about to be executed is a different
one, so a line the program dwells on is one step rather than one per frame:

```bash
basically step
```

```
The program is stopped before line 20. It cost 0.02s of this machine's own time
(1 frame). Read its variables, look at its screen, or step it on.
```

`continue` runs it on until it stops again or until it ends:

```bash
basically continue
```

```
The program is stopped before line 30. It cost 0.02s of this machine's own time
(1 frame).
```

Both say what they cost in the emulated machine's own time, which is the same
clock everything else is measured in — so a stretch of a program can be timed a
line at a time, and the seconds add up to the seconds the whole of it takes. Time
you spend thinking at a stop costs the program nothing: a stopped machine advances
not at all, so a minute between two commands is a minute the program never sees.

Continuing off a line that is itself one of the lines to stop before runs on
rather than stopping again on the spot — otherwise you could never get past the
first stop — and stops there again when the loop comes round to it.

A program that loops forever is an ordinary BASIC program, so continuing is
bounded and running out is an ordinary answer rather than a failure:

```bash
basically continue --max-frames 200
```

```
Continuing reached neither a stop nor the end of the program within 200 frames,
and the machine is left running. A program that loops forever is an ordinary
BASIC program; continue again, or name a line to stop before.
```

## Changing where it stops

`break` replaces the lines in force, and tells you what they are afterwards so
you never have to remember what you asked for:

```bash
basically break 20 40
```

```
The program stops before lines 20, 40. A line this program does not carry is
kept and simply never reached.
```

A line the program doesn't have is accepted rather than refused: you may be
breakpointing a line you're about to write. Naming no line at all clears them,
and the program then stops nowhere:

```bash
basically break
```

```
The program now stops nowhere: continuing runs it to its end.
```

## Asking where you are

Nothing has to be remembered between commands, because the machine can be asked:

```bash
basically where
```

```
The program is stopped before line 30. Set to stop before 20, 40.
```

`where` changes nothing and spends none of the machine's frames, so asking twice
gives the same answer and asking is never a reason for the program to move. It
answers the whole question — the line, whether a program is running at all, the
lines in force, and whether this machine can be stepped — which is what makes it
usable by something that has only just been handed a machine.

## Machines that cannot be stepped

Stopping on a BASIC line needs the machine to be able to say which line it is
executing, and not every machine can. One that can't is told so plainly rather
than given a stop that would never happen:

```bash
basically run count.bas -m atom --break 30
```

```
This machine cannot say which BASIC line it is executing, so it cannot be
stepped: a line named to stop before would never be reached. You can still run a
program on it, drive it with a schedule of keys to press, look at its screen and
take a picture of it. "info" says of any machine whether it can be stepped.
```

You can ask before you try, which is what an application embedding the toolchain
should do — it may be running against a copy that is not the one it shipped with:

```bash
basically info atom
```

```
can be stepped no - it cannot say which BASIC line it is executing
```

## What stopping does to a program, and what it doesn't

**A program runs the same whether or not it can be stopped.** The same emulated
time passes, the same measurements come out, and the program does the same thing.
The only difference stopping makes is that the program stops where you asked it
to. A run with nothing named to stop on is the run it always was.

**Stopping is a BASIC line, and nothing finer.** There are no conditional
breakpoints, no watchpoints, and no stopping on a runtime error: a breakpoint is
a line number, as it is in the IDE.

**Variables are read, not written.** You can see what a variable holds at a stop;
you cannot set it and carry on.

**Memory and registers are not part of this.** A machine reports which addresses
a program touched, not what is in them, and there is no reading an arbitrary
address, no CPU registers and no disassembly.

## Debugging and playing are opposites

A machine being [played](./playing-the-machine) is being driven by a person on
its own clock, so it is not a machine anything can be asked to stop: the lines
you named would be lines it runs straight past. `break`, `step` and `continue`
are refused while a play channel is open, saying so and saying how to give the
channel up, exactly as the measuring commands are. `where` and `variables` are
answered, of a machine that is moving — so two answers may differ, and that is
not a fault. Watching what a played program holds is the one thing you can still
do while somebody is typing at it.

## If you're told no

- **"No machine is up."** Stepping acts on a machine you're holding. Run
  something with `--hold` first, and name where it is to stop on that run.
- **"This machine cannot be stepped."** It cannot say which BASIC line it is
  executing. `basically info <machine>` says which machines can.
- **"No ROM for this machine."** Stopping needs the program to actually execute,
  which needs the machine's ROM. `basically roms --help` says how one is
  obtained.
- **"This machine is being played."** Give the channel up with
  `basically play --stop` and the machine can be stopped again.

## An agent gets all of this

Every one of these is a tool the [agent server](./mcp-server) offers, on the same
terms: `break`, `step`, `continue` and `where`, with the lines to stop before
given to the run. An agent holding a machine nobody is looking at is exactly the
caller a debugger reachable over a protocol is for.

The assistant inside the IDE is the one caller that has none of them, and
deliberately: the machine it would step is the one already on the user's screen,
the breakpoints are the ones in the gutter of the buffer they're looking at, and
stepping and continuing are already on the toolbar beside it.
