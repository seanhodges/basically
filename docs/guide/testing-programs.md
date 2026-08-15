# Testing your code

Once you've written some BASIC (see **[Writing BASIC](/guide/writing-basic)**),
you can test it by building it and running it in the built-in emulator for the
same machine(s) the program would run on. This guide covers running a program,
giving it input from the on-screen keyboard and game controller, and tracking
down bugs with breakpoints and the variable watcher.

## Running a program

Press the **▶ Play** button in the toolbar to build the current program and run
it in the emulator, or use the shortcut **Ctrl/Cmd + Enter**. The program is loaded
into a fresh machine, and started; the emulator pane boots the real ROM and takes
over from there.

If the program still has mistakes, it won't run: the emulator reports
**Fix N error(s) before running** (the same errors the editor underlines as you
type), and an empty program reports **Program is empty**. Fix the highlighted
lines and press Play again. If you want to run anyway - say, to watch the
machine's own error report - turn off **Block Run on editor lint errors** under
**Settings → Emulator**; only errors that break the program build itself will
stop a run then.

The status bar shows the emulator state - **stopped**, **running**, or
**paused** - alongside the byte budget.

To stop, press **■ Stop**. This is a full power-off, not a pause: the machine is
shut down and the screen blanks, so the next run starts clean.

## Saving a picture of the screen

The camera button in the toolbar - or **Ctrl/Cmd + Alt + S** - saves what the
machine has drawn as a PNG, named after your program and stamped with the time,
so a second screenshot is a second file rather than an overwrite. The standalone
player has the same button beside its Play control.

The file is the machine's own picture, at its own pixels, enlarged by a whole
number so every machine pixel stays a square block. Nothing that surrounds the
screen goes with it: no bezel, no panel, and no **CRT scanline effect** - that
setting changes the screen you are looking at, but never the saved image. If you
want the scanlines in a picture, use your operating system's own screenshot tool.

A machine that has been stopped still gives you the last frame it drew. Asking
before it has drawn anything tells you there is nothing to save.

## Running on a phone or tablet

On a narrow screen (and in landscape) the workspace splits into tabs along the
top: **Editor**, **Run**, **AI**, and **Settings**. The editor and the emulator
each get the full screen in turn rather than sitting side by side.

While the **Editor** tab is open, a floating **▶** play button sits in the
bottom corner of the editor - its tooltip reads **Build and run in the
emulator**. Tapping it builds the program and automatically switches you to the
**Run** tab so you see the result straight away. (The **Run** tab on its own just
shows the emulator; the floating button is what actually builds and starts it.)

## Giving your program input

Programs that use `INPUT`, read the keyboard, or poll a joystick need a way to
receive input in the browser. Two on-screen controls provide it, both toggled
from the status bar.

### The on-screen keyboard

Press the **⌨** button in the status bar to show or hide the on-screen keyboard.
It reproduces the target machine's real key legends, including its shift/mode
keys, and sends keystrokes to whichever surface is active - into the editor while
you're editing, or into the running program when the emulator is in front.

A few options under **Settings ▸ Keyboard** tune it:

- **Show automatically on focus** pops the keyboard up when you tap the editor or
  the emulator screen.
- **Authentic** vs **Compact** legends switch between faithful and simplified key
  labels.
- Optional key-click **sound** and **haptics** (vibration) for feedback.

On a phone in landscape the status bar is hidden; there the keyboard has its own
**⌨** toggle in the top-right corner of the emulator pane.

### The game controller

For games, press the gamepad button in the status bar to **Enable game
controller**. This overlays a D-pad and fire buttons over the bottom
of the emulator screen (in phone landscape the controls flank the screen
instead). Under **Settings ▸ Gamepad** you can choose the **layout** (4- or
8-way, one or two fire buttons) and the **input mode**:

- **Native Interface** / **Kempston** drive the machine's real joystick hardware.
  This is available on the machines that have such hardware - the Commodore 64,
  the VIC-20, the BBC Micro and Master, and the ZX Spectrum family (which also
  supports Kempston).
- **Key mapped** presses machine keys instead, so the controller works on any
  machine even without a joystick port. To change which keys a control presses,
  **long-press** a control while the program is stopped and pick a new key.

If you choose a joystick mode on a machine that lacks one, Settings tells you so
and falls back to Key mapped for that machine.

## Debugging with breakpoints

Debugging lets you halt a running program on a chosen line and inspect what it's
doing. It's available on the machines that support step debugging - for those,
the Step and Continue controls described below appear.

To set a **breakpoint**, click the gutter to the left of a line: a blue dot
appears. Breakpoints are tied to the BASIC line number, not the editor row, so
they stay put as you edit and renumber. Click the dot again to remove it. (If a
line also has an error, its red marker takes priority and hides the dot until you
fix the error.)

Now run the program as usual. When execution reaches a breakpointed line it
**pauses**: the editor highlights that line and scrolls it into view, and the
emulator shows **paused at line N**. From a paused state you have two controls in
the toolbar:

- **⤵ Step** - run to the next BASIC line.
- **▶ Continue** - carry on until the next breakpoint (or the program ends).

**■ Stop** ends the debug session entirely. Both Step and Continue are only
active while the program is paused.

On mobile these controls live in the three-dots overflow menu on the **Run** tab.
When a breakpoint trips on a phone, the app switches to the **Editor** tab so you
can see the highlighted line, since the frozen emulator screen wouldn't show
where you are.

## Watching variables

Press the **{x}** button in the status bar to show or hide the **variable
watcher**, a live table of your program's variables below the emulator screen. It
lists each variable's **name**, **type** (number, string, num array, or str
array), and current **value**.

While the program is running the watcher refreshes several times a second, so you
can watch values change in real time. When the program is paused at a breakpoint
the values hold steady, pairing the watcher with breakpoints is the quickest way
to see exactly what state a line leaves behind.

The `{x}` toggle lives in the status bar, so on a phone it's on every tab except
in landscape (where the status bar is hidden); the watcher panel itself appears
under the screen on the **Run** tab.

## Finding the slow line

Every run measures itself. There's no profiling mode to switch on and no run
that turns out not to have been measured - by the time you've watched a program
crawl, the measurements of that run are already there.

The moment a program starts running, coloured bars appear in the gutter beside
your lines. Each bar is that line's share of the run's time: a pale yellow bar
for a line that was incidental to the run, deepening through orange to red for
the line that dominated it. A line that never ran carries no bar at all, which
is different from a line that ran cheaply. Hover a bar to see the exact
percentage. The bars sit on the gutter's inside edge, so they never hide an
error marker or a breakpoint dot.

For the whole picture, open **Edit ▸ Run profile**. It lists:

- **the hottest lines**, as shares of the run - click one to jump to it;
- **the same shares summed over each routine**, using the procedures,
  subroutines and jump targets from the
  [outline](./writing-basic#outline), so you can read what a routine cost
  without adding its lines up by hand;
- **BASIC RAM across the run**, drawn against the run's own elapsed time, with
  the most memory the program ever used.

That memory chart is how you catch the classic Commodore freeze: a program that
builds strings fills memory steadily and then stalls for the best part of a
second while BASIC reclaims what it can. On the chart that's a rising line and a
sudden drop, at the moment your program appeared to hang.

Two things are worth knowing about the numbers.

**They are the machine's own time, not yours.** A duration is what the program
would take on the real hardware. Running the emulator at four times speed to get
through a long program faster doesn't change a single figure, and neither does
the refresh rate of your screen.

**A line's cost is that line alone.** Time spent inside a routine is charged to
the routine's own lines, never to the line that called it. So a `GOSUB` reads as
cheap however much work it sets off - which is why the profile also offers the
per-routine totals. If a call site looks free but your program is slow, look at
what it calls.

Not every machine can be measured. Measuring means charging time to the BASIC
line being executed, and a machine that can't report which line that is - the
same machines that offer no breakpoints - reports no per-line costs and says so
rather than showing zeroes. A machine that can't report its BASIC memory
figures likewise says the memory account is unavailable.

Measurements describe one run of one program. Starting a new run replaces them,
and editing your program so that its lines no longer match - adding, removing or
renumbering one - discards them rather than marking lines that no longer
correspond.

## Inspecting data files

On the machines that can write non-program data files, the IDE captures these and
writes to a virtual filesystem so you can see what your program stored.

Open it from **File ▸ Emulator files** (shortcut **Ctrl/Cmd + Alt + F**). The
dialog lists every file the running program has saved to tape, disk, or the
network, with its **Name**, **Kind** (a dialect-specific tag such as `code`,
`data`, or `data-str`), **Size**, and the time it was saved. Click a row to
expand a **hex dump** of its contents - the quickest way to check that a record
was written the way you expected. Each row also has a **Download** button that
saves the raw bytes to your computer for inspection in another tool.

The virtual filesystem is cleared every time the emulator restarts, so
each run starts with an empty filesystem. The files live only in the browser for the
current session; if you want to keep one, use the **Download** button before restarting.

When your program runs the way you want, see **[Running on real
hardware](/guide/hardware)** to get it onto - or off - an actual machine.
