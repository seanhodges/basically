## Why

A program stopped on a line is the moment the user most wants to know what it
holds, and the listing in front of them is the last place they can see it. The
values are readable — a caller holding a stopped machine can ask what its
variables hold, and an editor showing them draws a pane of its own — but a pane
is a list of names somewhere else on the screen, and the question being asked is
almost always about a name that is right there on the line about to run.

So the user reads a name in the listing, finds it again in a list sorted by
nothing in particular, reads a value, and looks back. On a machine that keeps
only the first two characters of a name, the list does not even contain the name
they read: the listing says `SCORE` and the machine reports `SC`, because two
characters is all the ROM stores. The value is present and the user cannot
connect it to the name they are looking at.

Nothing about the listing is unknown here. The server already works out what
every run of characters in a program is, on the bound machine's terms, including
which of them are variables and which spellings that machine would store as the
same one. What it has never been asked is where the variables are on a particular
line, for something else to fill in.

## What Changes

- **The server reports where a program's variables are written**, for the part of
  a listing an editor asks about, so that an editor with a stopped machine can
  show each value beside the name it belongs to.
- **Each is reported under the name the machine would hold it as**, not the
  spelling in the listing, so that a value can be found for a name on a machine
  that keeps only part of it.
- **The report says whether the name is to be matched with case or without**,
  following the bound machine, because some of these machines tell `a` from `A`
  and most do not.
- **A machine that cannot report what it holds says so**, rather than a listing
  that silently shows nothing being indistinguishable from one where nothing has
  a value yet.
- Nothing about reading a machine's variables changes, and nothing about stopping
  or stepping a program changes. **Not breaking.**

## Capabilities

### Modified Capabilities

- `language-server`: a requirement is added for reporting where a program's
  variables are written and what to look each one up as. The server reports
  positions and names only — it holds no machine and reads no values.

## Non-goals

- **Reading a machine's variables.** That is settled: what a program's variables
  hold is read from the machine a caller holds, on the terms already specified,
  and this change adds no way to read them and no second answer about them.
- **Serving values from the language server.** The server that answers about a
  listing holds no machine, and giving it one would mean a second route to
  somebody's running machine for no gain. It says where and what-to-call-it; the
  values come from the machine the editor is already stopped on.
- **Evaluating an expression.** Showing what `A` holds is not the same as showing
  what `A*2+B` holds, and the machines here answer no such question today.
- **Changing what a stopped program offers.** Which controls a stopped program
  answers, and what it says about where it is, are untouched.
- **Writing a value back.** Reading is the whole of this.
- **Anything in the browser IDE.**

## Impact

- **The server** gains one declared capability and one answer, built from the
  reading of the program it already performs and the naming rules it already
  applies. It starts no machine and needs no ROM, as it does not today.
- **An editor with both a stopped machine and this server** can put a value
  beside a name. An editor with only one of them is unaffected.
- **`basically-editor-extensions`** is the immediate beneficiary and is expected
  to need no code: the editor asks for this on its own once a server offers it,
  and resolves each name against the stopped session it already holds. What it
  does need is to keep the two conversations separate, which is how it is built.
- **The Dialect / MachineEmulator seam is untouched.** No new member, and no new
  obligation on a machine. Which machines can take part is decided by two answers
  that already exist — whether a machine can be stepped, and whether it can
  report what it holds — and neither is being changed.
