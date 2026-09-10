---
title: Playing the machine
---

# Playing the machine

[Watching the machine](./watching-the-machine) shows you a held machine's
screen. **Playing** one hands over its keyboard as well: you're given an
address, anything that can show a web page can show what's there, and whoever
is shown it types at the machine and sees it answer at the machine's own rate.

This is written for two people: someone who has been supervising a run and
would now like to take the controls, and someone building an application around
the toolchain — an editor, say — whose user should be able to run what they've
written without leaving for a terminal.

## Getting a play channel

Run something and leave the machine up, then ask:

```bash
basically run game.bas -m zx81 --hold
basically play
```

`play` prints the address:

```
The machine can be played at http://127.0.0.1:52413/p/9Kd1…/ - show it in a web
view or open it in a browser.
```

Open it and the machine is yours: it's running, it answers the keys you press,
and you see what it does. Asking again while a channel is open gives you the
same address rather than a second channel, so you can recover it if you've lost
it. `--json` prints the address as data, which is what an application wrapping
the command line wants:

```bash
basically play --json
```

When you've finished, give the channel up. The machine stays up and stops
running on its own again:

```bash
basically play --stop
```

An application embedding the toolchain asks for a channel the same way, over
its own copy of the operations conversation rather than through the command
line's shared machine — see
[embedding the toolchain](./embedding-the-toolchain).

## Putting it in a frame

The contract is a URL, exactly as a view's is. Put it in an `<iframe>` and size
the frame however you like — the page fits the screen to whatever room it's
given, at the machine's own proportions, and shows a line underneath saying what
it's showing.

```html
<iframe
  src="http://127.0.0.1:52413/p/9Kd1…/"
  title="The machine"
  style="width: 480px; height: 400px; border: 0"
></iframe>
```

The frame needs the keyboard for the machine to receive it, so give it the focus
the way you would any other control your user is typing into. Nothing else about
the page is part of the contract: how the picture gets there and how a key gets
back may change, and an application that only ever hands the address to a web
view will not notice when it does.

## The keys are the machine's own

A key press reaches the machine as the machine's own key, named the way a
written schedule names it — so `PRESS A` in a
[`check` file](../guide/testing-programs) and the A you press by hand are the
same key to the machine. A key your machine hasn't got does nothing rather than
pressing something nearby, which is why a machine with no escape key ignores
Escape rather than interrupting on it.

There is no sound. A played machine is seen and not heard; machines that
synthesise audio go on doing so for their own sake.

## What playing costs

**The machine runs on its own clock.** This is the one exception to the rule the
toolchain otherwise keeps everywhere: a held machine advances only when a
command asks it to. While you're playing it, somebody is typing at it, so it has
to be running between their keystrokes — and it runs at its own rate for as long
as the channel lasts, and not a moment longer.

**So it isn't a machine anything can measure.** A machine being driven by a
person is not a run. While the channel is open, commands that act on the machine
or measure it are refused, and say so:

```
$ basically profile
This machine is being played, so it is advancing on its own clock and is not a
machine anything can act on or measure: it is being driven by whoever is playing
rather than by requests. "profile" is refused until the play channel is given
up - "basically play --stop" - after which the machine advances only when a
request asks it to again, and everything you can measure of it means what it
used to. Reading the screen ("look", "screenshot") is answered while playing, of
a machine that is moving.
```

That covers `drive`, `profile`, `time`, `variables` and `expect`. Give the
channel up and every one of them is answered again, on a machine that is once
more where the last command left it.

**Reading still works.** `look` and `screenshot` spend none of the machine's
frames, so they're answered while you play — of a machine that is moving. Two
reads a moment apart may differ, and that is the machine running, not a fault.

**Running a program still works too**, and the channel follows you: run a second
program and you're playing the new machine at the same address. Release the
machine without giving up the channel and the channel says there's no machine up
rather than leaving you looking at one that has gone.

**A machine has a play channel or a view, never both.** Ask to play a machine
you're watching and the view ends; ask to watch one you're playing and the
channel ends. Either way you're told which happened, rather than being left with
an address that has quietly stopped answering.

## Who can play it

Read this part before you put a play channel anywhere. **What the address admits
is acting on the machine, not watching it**: anyone holding it can type at
whatever the machine is running.

- **The address is the only thing protecting it.** Anyone who has it can play,
  for as long as the channel lasts. There is no password and no account. Treat
  the address the way you would treat a password: don't paste it into a chat, a
  bug report or a screenshot.
- **It is reachable from your computer only.** Nothing on another machine, on
  your network or anywhere else can reach it.
- **Every channel gets its own address**, and an address is never given out
  twice. Once a channel has ended, its address admits nobody, ever again.
- **Playing is the machine's keyboard and screen and nothing else.** Whoever
  plays cannot start or stop the machine, load or run a program, reach any
  operation the toolchain offers, or learn anything about your computer beyond
  the machine itself. They hold no machine of their own, and nothing they do
  changes what you can do with yours beyond what this page describes.
- **The channel does not tell anyone its own address** — not the page you embed
  it in, and not anything that page goes on to talk to.
- **Anyone may embed it.** That's the whole point, so there is no restriction on
  who may frame a play channel, and none is relied on as protection. The address
  is what protects it, and that is all.
- **It is played by one person.** Whoever holds the address plays; this is not a
  shared arrangement, and nothing about it is recorded or replayable.

## When a channel ends

A play channel lasts as long as the caller that asked for it. It ends when you
give it up with `play --stop`, when you disconnect, when the host stops, or when
you ask for a view of the same machine — and nothing is reachable at its address
afterwards. The machine stops advancing unasked the moment it ends, and is again
a machine that advances only when a command asks it to, with every measurement
you can take of it meaning what it used to.

Until somebody asks to play, no channel exists: a toolchain nobody has asked to
play is reachable at no network address at all.

## If you're told no

- **"No machine is up."** A play channel is onto a machine you're holding. Run
  something with `--hold` first.
- **"This machine cannot be pictured."** A few machines can't hand over a
  picture of their display, so playing one would show nothing. You're told so
  rather than given an address that would — `basically look` still reads the
  screen as characters, and `basically drive` still presses its keys.

## Why an agent isn't offered this

Playing is a person at a keyboard. An agent works in turns and cannot type at a
machine that keeps going between them, and it already has the way of driving one
that suits it: a schedule that spends exactly the frames it says, on a machine
whose measurements mean something. So the [agent server](./mcp-server) offers
every operation the toolchain has except this one, and says why rather than
leaving the absence to look like an oversight.
