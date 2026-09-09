---
title: Watching the machine
---

# Watching the machine

The toolchain outside the browser holds a machine between commands: run a
program with `--hold` and the machine stays up, and everything you ask
afterwards acts on it. Until now the only way to _see_ that machine was to ask
for a still picture, one request at a time.

A **view** is the other way. Ask for one and you're given an address; anything
that can show a web page can show what's there — a browser tab, or a frame
inside an application of your own. It shows the machine's screen, and keeps
showing it as the machine changes.

This is written for two people: someone supervising an agent who'd like to keep
an eye on the screen while it works, and someone building an application around
the toolchain that needs to show its user the machine it's driving.

## Getting a view

Run something and leave the machine up, then ask:

```bash
basically run game.bas -m zx81 --hold
basically view
```

`view` prints the address:

```
The display is being projected to http://127.0.0.1:52413/v/xB2h…/ - show it in
a web view or open it in a browser.
```

Open it and you're looking at the machine. Drive the machine from another
command and the view follows:

```bash
basically drive 'PRESS A; WAIT FOR "READY"'
```

Asking again while a view is open gives you the same address rather than a
second view, so you can recover it if you've lost it. `--json` prints the
address as data, which is what an application wrapping the command line wants:

```bash
basically view --json
```

An agent asks for a view the same way — `view` is one of the tools the
[agent server](./mcp-server) offers, and the address comes back in the answer.

When you're done being watched, give the view up. The machine stays up and you
can carry on:

```bash
basically view --stop
```

## Putting it in a frame

The contract is a URL. Put it in an `<iframe>` and size the frame however you
like — the page fits the screen to whatever room it's given, at the machine's
own proportions, and shows a line underneath saying what the machine is doing.

```html
<iframe
  src="http://127.0.0.1:52413/v/xB2h…/"
  title="The machine"
  style="width: 480px; height: 400px; border: 0"
></iframe>
```

Nothing else about the page is part of the contract: how the picture actually
gets there may change, and an application that only ever hands the address to a
web view will not notice when it does.

## What a view is, and what it is not

**It mirrors the machine; it does not run it.** The machine still advances only
when a request asks it to. Between requests the view holds the picture the last
one left — that is the machine, not a frozen stream — and while a request is
working the view follows it. Nothing about the machine's timing, its
measurements, or what a request reports changes because somebody is watching.

**A viewer can only watch.** Whoever opens the address sees the screen and can
do nothing else: they cannot press a key, start or stop the machine, load or run
a program, or reach any part of the toolchain. That is what makes it safe to
show a machine to someone without handing it over — the caller that holds the
machine is still the only one that can act on it.

**It says what it's showing.** A still picture is ambiguous, so the view
distinguishes a machine sitting idle from one a request is working on, and says
plainly when there's no machine up at all rather than leaving a stale picture on
screen. Run a second program and the view shows the new machine; release the
machine without giving up the view and the view says so, and its address stays
good.

**There is no sound, no recording and no seeking.** The view shows what the
machine shows now.

## Who can see it

Read this part before you put a view anywhere.

- **The address is the only thing protecting it.** Anyone who has it can watch,
  for as long as the view lasts. There is no password and no account. Treat the
  address the way you would treat a password: don't paste it into a chat, a bug
  report or a screenshot.
- **It is reachable from your computer only.** Nothing on another machine, on
  your network or anywhere else can reach it.
- **Every view gets its own address**, and an address is never given out twice.
  Once a view has ended, its address shows nothing to anybody, ever again.
- **The view does not tell anyone its own address** — not the page you embed it
  in, and not anything that page goes on to talk to.
- **Anyone may embed it.** That's the whole point, so there is no restriction on
  who may frame a view, and none is relied on as protection. The address is what
  protects it, and that is all.

## When a view ends

A view lasts as long as the caller that asked for it. It ends when you give it
up with `view --stop`, when you disconnect, or when the host stops — and nothing
is reachable at its address afterwards. Giving up a view does not give up the
machine.

Until somebody asks for a view, none exists: a toolchain nobody has asked to be
watched is reachable at no network address at all.

## If you're told no

- **"No machine is up."** A view is a view of a machine you're holding. Run
  something with `--hold` first.
- **"This machine cannot be pictured."** A few machines can't hand over a
  picture of their display. You're told so rather than given an address that
  would show nothing — `basically look` still reads the screen as characters.
