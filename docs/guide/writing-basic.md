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
