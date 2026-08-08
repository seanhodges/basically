# Writing BASIC

You write BASIC as plain text: one numbered line per statement, with keywords
written as words. The editor highlights
the active dialect, autocompletes keywords, and underlines errors as you type.

Each machine has its own dialect with its own rules - the selector in the
toolbar chooses which one the editor and emulator use. Moving a program you
have already written to another machine? The
[porting guide](../reference/compare) sets any two dialects side by side and
says what has to change.

## Example

The example below is for
the **ZX81**; the other machines follow their own syntax.

```basic
10 LET S=0
20 PRINT "GUESS A NUMBER 1-10"
30 LET N=INT (RND*10)+1
40 INPUT G
50 IF G=N THEN GOTO 90
60 IF G<N THEN PRINT "HIGHER"
70 IF G>N THEN PRINT "LOWER"
80 GOTO 40
90 PRINT "GOT IT!"
```

## Editor features

The editor offers a rich set of modern features to assist with BASIC coding.
Everything below is configured from the **Settings** button in the toolbar
(the **Editor** section) unless noted.

![Annotated desktop editor showing the code completion popup, the open Edit menu (Renumber line and Outline), and the Settings button](/editor-features.png)

On a phone the toolbar is tighter: the Edit actions move into the **⋯ overflow
menu**, and the same code completion popup appears as you type.

<img src="/editor-features-mobile.png" alt="Annotated mobile editor showing the overflow menu's Edit actions and the code completion popup" style="max-width: 340px; width: 100%; height: auto; display: block; margin: 1rem auto;" />

### Code completion

As you start typing a keyword, a suggestions popup opens automatically, with the
best match highlighted at the top. Press **Enter** to accept the highlighted
suggestion.

![The code completion popup open over the editor, listing keyword matches for the typed prefix with the best match highlighted at the top](/completion-example.png)

With **Full code completion (expand keywords to blocks)** switched on, structural
keywords expand to a whole skeleton rather than a bare word. Accepting `FOR`
drops in a complete counting loop, `IF` an `IF … THEN` line, etc. The cursor
lands on the first thing you need to fill in (the loop variable, the condition…);
press **Enter** / **Shift+Enter** to jump forward and back through the remaining
fields. Turn it off to get plain keyword completion only (no block expansion).

### Dot abbreviation

While the popup is open you can also accept the top suggestion by typing a
**`.`** (period) - a shortcut inspired by the BBC Micro's keyword abbreviations.
The dot is the trigger and is not inserted, so typing `PR.` completes to
`PRINT`, and `P.` completes to whatever `P…` currently tops the list.

### Automatic line numbering

With **Automatic line numbering** on, pressing **Enter** at the end of a line
adds the next line number for you, so you can keep typing statements without
managing the numbering by hand. The gap between numbers is set by **Line number
increment** (10 by default).

### Renumbering

To tidy a line number - or make space where an increment has run out - put the
cursor on the line and choose **Edit ▸ Renumber line** (or press
**Ctrl/Cmd + Alt + R**). Any `GOTO`/`GOSUB` references to that line are updated
to match, so jumps don't break.

### Outline

**Edit ▸ Outline** opens the **Program outline**: a list of the program's
procedures and functions and the line numbers that `GOTO`/`GOSUB` jump to. Click
any entry to move the editor straight to that line - a quick way to navigate a
longer program. The outline tool reads nearby REM statements to give more descriptive
naming of functions and jump points.

![The Program outline dialog for a BBC Micro program, grouping the entries into Procedures, Functions, Subroutines and GOTOs, each labelled from a nearby REM](/program-outline.png)

The sections that appear depend on the dialect: a machine with `PROC`/`FN`
definitions lists **Procedures** and **Functions**, and every dialect groups the
lines its `GOSUB`s and `GOTO`s jump to under **Subroutines** and **GOTOs**.

### Scratch buffers

To try something out without editing your program, press **+** after the last
tab and choose **New scratch buffer**. Open as many as you like and click a tab
to switch; each one is edited exactly like the program.

**▶ Play runs the buffer you are looking at** - the button names it, so it reads
**▶ Play Scratch 1** - and a snippet takes your
[machine-code blocks](./machine-code) with it, which makes a scratch buffer a
good place to test a `RANDOMIZE USR` or `SYS` call. Breakpoints belong to the
buffer they were set on.


## Keeping an eye on memory as you write

Retro machines have very little RAM, and two of the IDE's tools help you stay
within it without leaving the editor.

The status bar tracks your **byte budget** live as you type: the size of your
tokenized program against the target machine's available RAM. Keywords tokenize
to single bytes and numeric literals carry an extra binary form, so the count
reflects the real cost of each line you add - and it turns amber, then red, as
you approach the limit. On the smallest machines (the unexpanded ZX81 has just
1K!) that's worth watching as you go, so you catch a program outgrowing its RAM
while you're writing rather than when you try to run it.

![The status bar showing the byte-budget readout - a program size, and the percentage of the machine's RAM budget it uses - turned amber as it nears the limit](/byte-budget.png)

If your program `POKE`s memory directly, keep the **memory map** (the memory-map
icon in the toolbar) open beside the editor as a live reference: every `POKE` in
your source is drawn as a marker at its address, so you can see which addresses
you've already used - and where the machine's own screen, system and program
areas sit - before you write another.

![The memory map for the Commodore 64 showing its regions - screen memory, BASIC program, ROM and the I/O area - each labelled with its share of memory, with markers on the addresses the program POKEs](/memory-map-overview.png)

See **[Memory management](/reference/memory-management)** for the full picture,
including the live RAM readout, activity monitoring, and the variable watcher.

## Special characters and tokens

How source text maps to the machine's character set and tokens - block graphics,
inverse video, the quote-image character, and how numbers are stored - is
covered in detail under **[File formats](/reference/file-formats)**.
