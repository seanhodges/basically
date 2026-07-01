# Writing BASIC

You write BASIC as plain text: one numbered line per statement, with keywords
written as words. The editor highlights
the active dialect, autocompletes keywords, and underlines errors as you type.

Each machine has its own dialect with its own rules — the selector in the
toolbar chooses which one the editor and emulator use.

## Example

The example below is for
the **ZX81**; the other machines follow their own syntax.

One numbered line per statement, keywords as words. A few ZX81-specific
conventions:

- **Block graphics** as unicode (`█▀▌▒` …) or as escapes (`\::`).
- **Inverse video** as `%A` … `%9`.
- **Power** is `**`.
- Line numbers must be strictly ascending; one statement per line, no `ELSE`.
- Variable names are single letters (`A`–`Z`, optionally with `$` for strings).

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

### Code completion

As you start typing a keyword, a suggestions popup opens automatically, with the
best match highlighted at the top.

Press **Enter** to accept the highlighted suggestion.

### Dot abbreviation

While the popup is open you can also accept the top suggestion by typing a
**`.`** (period) — a shortcut inspired by the BBC Micro's keyword abbreviations.
The dot is the trigger and is not inserted, so typing `PR.` completes to
`PRINT`, and `P.` completes to whatever `P…` currently tops the list.

### Snippet (block) completion

With **Full code completion (expand keywords to blocks)** switched on, structural
keywords expand to a whole skeleton rather than a bare word. Accepting `FOR`
drops in a complete counting loop, `IF` an `IF … THEN` line, etc. The cursor
lands on the first thing you need to fill in (the loop variable, the condition…);
press **Enter** / **Shift+Enter** to jump forward and back through the remaining
fields. (**Tab** / **Shift+Tab** is also supported on keyboards that support it)

Turn it off to get plain keyword completion only (no block expansion).

### Automatic line numbering

With **Automatic line numbering** on, pressing **Enter** at the end of a line
adds the next line number for you, so you can keep typing statements without
managing the numbering by hand. The gap between numbers is set by **Line number
increment** (10 by default).

### Renumbering

To tidy a line number — or make space where an increment has run out — put the
cursor on the line and choose **Edit ▸ Renumber line** (or press
**Ctrl/Cmd + Alt + R**). Any `GOTO`/`GOSUB` references to that line are updated
to match, so jumps don't break.

### Outline

**Edit ▸ Outline…** opens the **Program outline**: a list of the program's
procedures and functions and the line numbers that `GOTO`/`GOSUB` jump to. Click
any entry to move the editor straight to that line — a quick way to navigate a
longer program. The outline tool reads nearby REM statements to give more descriptive
naming of functions and jump points.

## The byte budget

The status bar shows how many bytes your tokenized program occupies against the
target machine's available RAM. Keywords tokenize to single bytes; numeric
literals carry an extra binary form. Keeping an eye on this matters on
smaller machines in particular (the unexpanded ZX81 has just 1K!).

## Special characters and tokens

How source text maps to the machine's character set and tokens — block graphics,
inverse video, the quote-image character, and how numbers are stored — is
covered in detail under **[File formats](/reference/file-formats)**.

## Importing existing programs

You can import an existing machine image or decode a
cassette-audio recording back into editable source. See
**[Running on real hardware](/guide/hardware)** for the transfer side and
**[File formats](/reference/file-formats)** for what each format contains.

Please note the Import reads tokenised source code, it does not disassemble machine code. If you want to hack around on third-party commercial programs/games you will need to legally obtain a copy of the source code first.
