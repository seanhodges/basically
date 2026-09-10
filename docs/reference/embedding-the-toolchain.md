---
title: Embedding the toolchain
---

# Embedding the toolchain

An editor starts `basically lsp --stdio` and speaks the Language Server
Protocol to it. An agent's client starts `basically mcp --stdio` and speaks the
Model Context Protocol. There is a third, for an application that is neither:

```bash
basically ops --stdio
```

That serves the toolchain's own **operations conversation** — the same one the
command line speaks — over the process's standard input and output. Start it as
a child process the way you would either of the others:

```json
{ "command": "basically", "args": ["ops", "--stdio"] }
```

It doesn't finish and print something back: it holds its streams open, serves
the caller that started it, and ends when that caller disconnects or you stop
it.

## Why not just run the command line?

Because the command line's machine is the user's. `basically run --hold` leaves
a machine up and every later command acts on it — that is the point of it — and
that machine is shared across every command the user types. An application that
shelled out to `basically` would find itself holding the same machine as the
terminal beside it, and each would let the other's go.

A caller served over its own streams holds a machine of its own. Neither is
given the other's, neither disturbs the other, and a program the application
runs leaves a machine only the application can see.

## Naming a machine

You can name one when you start it:

```bash
basically ops --stdio -m zx81
```

That machine is then what a request works on when the request names none and
the program doesn't declare one with a `#MACHINE` line. Naming none is fine
too — unlike an operation on a program, which needs to know its machine before
it can do anything, a server outlives any one request and the caller may say
which machine it means each time.

## What you can ask for

Every operation the command line has, reached the same way and answered the
same way: describe a machine, check a listing, build one into a file the machine
loads, run one, drive it, look at its screen, measure it, check it against what
it should do. Two of them are what an embedding application usually wants next:

- [`view`](./watching-the-machine) hands back an address anything that can show
  a web page can be pointed at, so your user can watch the machine you are
  driving.
- [`play`](./playing-the-machine) hands back an address your user can type at,
  so they can run what they've written without leaving your application. That
  address admits acting on the machine rather than watching it — read
  [who can play it](./playing-the-machine#who-can-play-it) before you put one
  anywhere.

## Sharing one host

`basically ops --stdio` starts a copy for your application alone. There is
another arrangement: a host that keeps running and serves whoever asks it, so an
agent, an editor and a shell all reach one warm copy of the toolchain rather
than starting three.

```bash
basically-server          # serves everything, and stops when nothing needs it
basically-server --ops    # or just the operations conversation
basically server stop     # stop it
```

You are answered the same way either way, and the machine your application is
working on is yours: nothing else reaching that host can see it or disturb it.
