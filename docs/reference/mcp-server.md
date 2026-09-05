---
title: Agent server protocol
---

# Serving an agent

Everything Basically can do outside the browser — describe a machine, check a
listing, build a program into a file the machine loads, run one, drive it,
look at its screen, measure it, check it against what it should do — can be
served to an AI agent over the **Model Context Protocol**, the same way the
[language server](../guide/language-server) serves an editor.

The difference from running the command line yourself is that the server stays
up between requests, and so does the machine. An agent boots a machine once and
then works the way a person does: run the program, look at the screen, press a
key, look again.

## Starting the server

```bash
basically mcp --stdio
```

It doesn't finish and print something back — it holds the connection open and
answers requests until the client disconnects. Point your client's server
configuration at this command; most clients that support the protocol run a
server as a child process over standard input/output. A generic client
configuration looks something like:

```json
{ "command": "basically", "args": ["mcp", "--stdio"] }
```

Check your client's own documentation for exactly where that configuration
goes — it's the same shape whatever client you use, because that's the point of
the protocol: nothing here is written for one client in particular.

You can name a machine when you start it:

```bash
basically mcp --stdio -m zx81
```

That machine is then what a request works on when nothing is specified and the program
doesn't declare one with a `#MACHINE` line. Naming none is fine too — unlike an
operation on a program, which needs to know its machine before it can do
anything, a server outlives any one request and the client may say which machine
it means each time.

## What the client is offered

Every operation the command line has, as a tool of its own. Asking the server
what it offers lists them, each with the same description and the same inputs
the toolchain uses everywhere else:

| Tool                               | What it does                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `machines`<br>`info`               | List every machine, or describe one in full                                   |
| `lint`<br>`build`                  | Report a program's problems; write it as a file the machine loads             |
| `run`<br>`check`                   | Run a program; check one against what it should do                            |
| `drive`<br>`look`<br>`screenshot`  | Press keys on the machine; read its screen; picture its display               |
| `profile`<br>`time`<br>`variables` | Where a run's time and memory went; how long it took; what its variables hold |
| `expect`                           | Say what the machine should be showing, and check it                          |

There is nothing here the command line cannot also do, and nothing the command
line can do that isn't here. The two are the same operations, reached
differently.

Most of these need no ROM. Running a program and checking one do, because they
boot the machine; the rest work whether or not the machine's ROM is installed.

## The machine stays up

Running a program leaves the machine it ran on running. Every request after that
acts on it:

- **Looking costs nothing.** Reading the screen, the variables or the
  measurements doesn't advance the machine, so reading twice with nothing in
  between reads the same screen both times.
- **Acting costs what it costs.** Pressing keys runs the frames the machine
  needs and no more.
- **Nothing happens while you think.** The machine only advances when a request
  asks it to, so a program sitting at a prompt sits there however long the
  client takes, and a run's measurements are the same whether the requests came
  back to back or an hour apart. Every duration reported is the emulated
  machine's own time, never how long anything took on your computer.

That is what makes an agent's loop possible: run a program that waits for input,
look at what it's showing, press the key it asked for, and look again to see
what that did — rather than writing the whole sequence of keypresses in advance
and getting one screen back.

**One machine at a time.** Running a second program lets the first machine go,
and the answer says so. Disconnecting lets go of whatever is still up, so a
client that stops without saying so leaves nothing behind.

## A picture as a picture

A client that can be shown an image is sent the display itself rather than a
description of it — the same PNG the IDE would show you, at the machine's own
size. A machine whose display can't be pictured says so rather than sending
nothing back.

## When a request can't be carried out

The server answers and goes on serving rather than stopping. A request naming a
tool it doesn't have, one whose input doesn't fit what that tool takes, or one
needing a machine before any is running is answered saying what was wrong — and
in that last case, how to get a machine — marked as a failure rather than passed
off as a result. A request that runs but doesn't achieve what was asked, such as
a schedule that waited for something that never appeared, is reported as a
failure too.

Starting the server with an option it doesn't have, or a machine that isn't
registered, is refused before anything is served.
