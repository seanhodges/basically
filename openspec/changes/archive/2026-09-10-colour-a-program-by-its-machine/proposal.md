## Why

The language server answers an editor's every question about a program except
what the program *looks like*. It declares diagnostics, completion, hover,
definition, symbols, references and highlights — and nothing about colour. So a
user who follows `docs/guide/language-server.md` and points their editor at
`basically lsp --stdio` gets a listing rendered in one flat colour, while the
same listing in the IDE's own editor is coloured keyword by keyword.

The gap is not that colour is hard. The IDE colours a listing from its dialect's
own stream language: the tokenizer already says, for every run of characters,
whether it is a keyword, a function, an operator, a variable, a line number, a
literal, a comment or a directive, and `src/editor/tokenAt.ts` already asks that
same tree what a single position is. The server has the whole apparatus and
publishes none of it.

The gap matters more here than in a language with one dialect. `IF` is a keyword
everywhere; `TIME` is a keyword on one machine and an ordinary variable on
another, and a listing crunched ROM-style splits into runs no general-purpose
BASIC highlighter would split the same way. A highlighter written from a keyword
list — the usual way an editor colours a language — would be a second reading of
the program, disagreeing with the first as soon as the two drifted. Publishing
the reading the product already has is both less work and the only version that
stays true.

## What Changes

- **The server tells the editor what every run of characters in a program is**,
  so the editor colours it with its own theme. The classification is the bound
  machine's own — the same one the IDE colours from — so a name that is a
  keyword on one machine and a variable on another is reported differently on
  each.
- **A listing that declares its machine is read as declaring it.** The
  tokenizer already treats a `#BIN` line as a directive rather than as the code
  its text resembles; a `#MACHINE` line was not, so it read as two ordinary
  variable names. It now reads as the directive it is, in the IDE and in an
  editor alike.
- **Nothing is reported for a program with no machine.** The server already
  declines to guess a machine rather than picking among several; colour follows
  the same rule, so an unbound listing is left uncoloured rather than coloured
  wrongly.
- The server answers for a range as well as for the whole program, so an editor
  showing one screen of a long listing can ask for one screen of it.

No breaking change: an editor that does not ask for colour is served exactly as
it is today.

## Capabilities

### Modified Capabilities

- `language-server`: gains a requirement that a program is coloured by the
  machine it is for.

## Non-goals

- **Colouring what the machine cannot read.** Only the program's own text is
  classified; the server does not mark a keyword as deprecated, a variable as
  unused, or a line as unreachable. Those are diagnostics, and the server
  already has a place to put them.
- **A grammar shipped to each editor.** The point of this change is that there
  is one reading of a program, served over the protocol. Anything an editor
  would have to be handed separately — a TextMate grammar, a tree-sitter
  parser — is a second reading and is out of scope here.
- **Restyling the IDE.** No colour, theme or style rule changes. The one thing
  the browser editor shows differently is the `#MACHINE` line above, which is a
  correction to what that line *is* rather than to how a directive looks — it
  now wears the colour `#BIN` already wore.
- **Semantic modifiers.** The protocol allows a token to carry modifiers as well
  as a type. Nothing in the product's reading of a program distinguishes, say, a
  declaration from a use at the token level, so none are declared.
