## Why

Navigation through a listing runs one way. The server takes the user from a jump
to the line it names, and from a procedure call to where it is defined. Nothing
takes them back. Standing on the `1000` in `GOSUB 1000` and asking where it is
defined works; asking what else reaches it answers nothing — the same character
of the same program answers one question and declines the other.

That backwards direction is how a reader works out what a numbered line *is*. A
line is a subroutine, or something fallen into from the line above, or code
nothing reaches any more, and the line itself looks identical in all three cases.
Only its callers say which, and a reader with no way to ask has to search the
listing by eye for a number — finding the ones inside strings and comments too.

Renaming a variable is the other half. The machines' own rules make it something
a user cannot do by hand: two spellings can be one variable, because Microsoft
BASIC keeps only the first two characters of a name, and one spelling can be two,
because BBC BASIC tells upper case from lower. A search-and-replace is wrong in
both directions — it misses the name the ROM will merge with, and it changes the
name the ROM keeps apart. The server already knows which uses count, on the
machine's own terms, and reports them when asked. It just will not change them.

Worse, a rename can break a program silently. A name the ROM reads as a keyword
stops being a variable at all — it is not an error, the machine simply runs the
line wrongly — and a name that collapses onto another name merges two variables
into one without complaint. Those are exactly the readings the server already
performs when it reports a program's problems.

## What Changes

- **Every jump to a line is reachable from that line.** Asking what reaches a
  line number reports each place the program jumps to it, wherever the jump is
  written — including each target of a list of them — and never a number inside
  a string, a comment or a directive.
- **A variable can be renamed everywhere the machine would read it.** Which uses
  are changed is the set the server already reports as that variable's uses, on
  the same machine rules, so a rename and a search for uses can never disagree.
- **A rename the machine would not survive is refused, in the machine's own
  words.** A new name the machine would read as a keyword, or would store as a
  variable the program already has, is declined with the reason the machine's own
  reading gives — not carried out and left for the user to discover running it.
- **Which uses count is unchanged.** No existing answer moves.
- Existing behaviour is otherwise untouched; an editor that asks neither new
  question is unaffected. **Not breaking.**

## Capabilities

### Modified Capabilities

- `language-server`: *A jump target can be reached from where it is named* covers
  only the direction from the name to the target. It gains the reverse.
- `language-server`: *A program's structure and a variable's uses are reachable*
  requires every use of a variable to be reported. A requirement is added for
  changing them, bound to that same set so the two cannot drift.

## Non-goals

- **Renumbering a program.** It is a whole-program edit, not a rename of a thing
  under the cursor, and it belongs to its own change. This one leaves the
  renumbering behaviour exactly as it is.
- **Renaming a line number**, which is renumbering wearing a different hat.
- **Renaming a procedure or function.** The machines that have them do not share
  the naming rules that make variable renaming hard, and a proc rename has a
  different failure — it is worth its own thinking, not a corner of this.
- **Serving a call hierarchy.** Knowing every jump to a line is what a hierarchy
  would be built on, and this change makes it knowable. Serving it as a hierarchy
  is a separate decision about a separate protocol capability.
- **Widening what counts as a jump.** The forms recognised today are the forms
  renumbering rewrites; adding more would change which references renumbering
  moves, which is a real risk to a user's program and is not this change's to
  take.
- **Anything in the browser IDE.** Its own editor already has these motions, or
  deliberately does not.

## Impact

- **The reference scan** that renumbering and jump-to-definition already share
  becomes something a third caller can ask for by position, rather than two
  functions walking the same ground for different answers.
- **The server** gains one declared capability and answers one existing question
  in a place it previously declined to.
- **Every editor client** gains both motions without changing: they are the
  protocol's own methods, and the clients declare the standard set already.
- **The Dialect / MachineEmulator seam is untouched.** Every answer here is read
  from the program's text and the bound dialect's declared keywords and naming
  rules. No machine is started, and no ROM is needed.
