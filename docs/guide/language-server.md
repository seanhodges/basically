# Editing in another editor

The IDE's language help - keyword completion, inline problems, jumping from a
`GOSUB` to the line it calls, seeing every use of a variable - isn't only for
the browser. If you keep your programs in a repository and edit them in VS
Code, Neovim, Helix, Emacs or anything else that speaks the **Language Server
Protocol**, you can get the same help there.

## Starting the server

Basically's command-line tool has an operation for this:

```bash
basically lsp --stdio
```

It doesn't finish and print something back - it holds the connection open and
answers your editor's questions until you close the file or quit the editor.
Point your editor's language-client configuration at this command; most
editors that support LSP run a language server as a child process over
standard input/output. A generic client configuration looks something like:

```json
{ "command": "basically", "args": ["lsp", "--stdio"] }
```

Check your editor's own documentation for exactly where that configuration
goes - it's the same shape whatever editor you use, because that's the whole
point of the protocol: nothing here is written for one editor in particular.

No ROM is needed. The server never runs a program, so it works exactly the
same whether or not you have the machine's ROM installed — and that stays true
however busy the machine is otherwise, because nothing your editor asks for
waits on a program someone else is running.

### Sharing one server

The command above starts a server for your editor alone, which is what most
editors expect. If you also use the command line or an AI agent, they can share
one copy instead of each starting their own:

```bash
basically-server          # serves an editor, an agent and the command line
basically server stop     # stop it
```

Your editor is served the same way and given the same answers either way, so
nothing in its configuration needs to change.

## Telling it which machine

Every program is for one machine, and the server needs to know which before
it can help with anything. It decides in this order, taking the first one that
answers:

1. **The program declares it.** A line at the top of the file naming its
   machine - `#MACHINE zx81` - always wins, however the rest is set. This is
   what lets one repository hold programs for several machines side by side.
2. **You've configured one.** Set `basically.machine` in your editor's
   settings for the workspace (or, for an editor that doesn't support pulling
   settings from the server, pass `{ "machine": "zx81" }` as the language
   client's initialization options - check your client's documentation for
   where that goes).
3. **It can be worked out.** With neither of the above, the server checks
   whether the program's text only makes sense on one registered machine. Many
   machines share most of BASIC, so this often can't tell - and rather than
   guess, the server says so.

When none of the three settles it, you'll see one problem reported on the
program itself, saying what to set. That's expected the first time you open a
program with nothing configured - set `basically.machine`, or add the
`#MACHINE` line, and it goes away.

## What you get

Once a program is bound to a machine, your editor should offer:

- **Problems as you type** - the same checks the IDE runs, reported without
  asking for them, with a genuine error underlined differently from an
  advisory one.
- **Completion** of that machine's own keywords, its multi-line block
  constructs (`FOR`/`NEXT`, `IF`/`THEN`, procedures…) inserted as a whole
  skeleton with each blank to fill in offered in turn, and never anything
  the machine doesn't have.
- **Hovering a keyword** to see how it's written and what it does, including a
  keyword typed in one of the machine's shorter spellings.
- **Jumping to a definition**: from a `GOTO`/`GOSUB` to the line it targets,
  or from a procedure or function call to where it's defined.
- **The program's structure and outline** - its procedures, functions and
  jump targets, so you can jump straight to any of them.
- **Every use of a variable**, following the machine's own rules for what
  counts as the same variable - including a machine that only distinguishes
  the first few characters of a name.

Every answer is exactly what the IDE itself would give for the same program,
because it's produced the same way.

See [Writing BASIC](/guide/writing-basic) for what these features look like
inside the IDE, and
[File formats ▸ Declaring the machine](/reference/file-formats#declaring-the-machine)
for more on the `#MACHINE` line.

## Serving an AI agent instead

An editor isn't the only thing that can be handed the toolchain. If you'd
rather have an AI agent work on a program — running it, looking at the screen,
pressing keys and looking again — there's a server for that too, described in
[Serving an agent](../reference/mcp-server).
